import { eachDateInRange, monthDateRange } from "@/lib/attendance-reports";
import { rangesOverlap } from "@/lib/leave/calculations";
import type {
  AttendanceRecord,
  ExperienceBand,
  LeaveRequest,
  LeaveType,
  PayrollRecord,
  SalaryAdvance,
  SalaryAdvanceRecovery,
  SalaryStructure,
  StaffRewardLedgerEntry,
  User,
  UserRole,
} from "@/types";

const BANDS: ExperienceBand[] = ["ENTRY", "MID", "SENIOR", "LEAD"];

export function round2(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

export function bandForStaff(
  staffId: string,
  role: UserRole,
  structures: SalaryStructure[]
): ExperienceBand {
  let sum = 0;
  for (let i = 0; i < staffId.length; i++) sum += staffId.charCodeAt(i);
  for (let k = 0; k < BANDS.length; k++) {
    const band = BANDS[(sum + k) % BANDS.length];
    if (structures.some((s) => s.role === role && s.experienceBand === band)) {
      return band;
    }
  }
  return structures.find((s) => s.role === role)?.experienceBand ?? "MID";
}

export function pickStructure(
  staff: User,
  structures: SalaryStructure[]
): SalaryStructure | undefined {
  const band = bandForStaff(staff.id, staff.role, structures);
  return (
    structures.find((x) => x.role === staff.role && x.experienceBand === band) ??
    structures.find((x) => x.role === staff.role)
  );
}

export function countWorkingDaysInRange(start: Date, end: Date): number {
  let count = 0;
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  cur.setHours(0, 0, 0, 0);
  const normalizedEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  normalizedEnd.setHours(0, 0, 0, 0);

  while (cur <= normalizedEnd) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) { // Exclude Sunday (0) and Saturday (6)
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export function workingDaysInMonth(year: number, month: number): number {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return countWorkingDaysInRange(start, end);
}

export function monthDays(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** PRESENT=1, LATE=1, HALF_DAY=0.5 for a staff member in the given month on/after joiningDate. */
export function countAttendanceDaysForStaff(
  records: AttendanceRecord[],
  staffId: string,
  year: number,
  month: number,
  joiningDateStr?: string
): number {
  const { fromDate, toDate } = monthDateRange(year, month);
  const filterFromDate = joiningDateStr && joiningDateStr > fromDate ? joiningDateStr : fromDate;

  let days = 0;
  for (const r of records) {
    if (r.staffId !== staffId) continue;
    if (r.date < filterFromDate || r.date > toDate) continue;
    if (r.status === "PRESENT" || r.status === "LATE") days += 1;
    else if (r.status === "HALF_DAY") days += 0.5;
  }
  return days;
}

/**
 * Count APPROVED leave days overlapping the month on/after joiningDate, split by leave type paid flag.
 */
export function countLeaveDaysForStaff(
  requests: LeaveRequest[],
  leaveTypes: LeaveType[],
  staffId: string,
  year: number,
  month: number,
  joiningDateStr?: string
): { paidLeaveDays: number; unpaidLeaveDays: number } {
  const { fromDate, toDate } = monthDateRange(year, month);
  const filterFromDate = joiningDateStr && joiningDateStr > fromDate ? joiningDateStr : fromDate;
  const typeById = new Map(leaveTypes.map((t) => [t.id, t]));
  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;

  for (const req of requests) {
    if (req.staffId !== staffId) continue;
    if (req.status !== "APPROVED") continue;
    if (!rangesOverlap(filterFromDate, toDate, req.fromDate, req.toDate)) continue;

    const overlapFrom = req.fromDate > filterFromDate ? req.fromDate : filterFromDate;
    const overlapTo = req.toDate < toDate ? req.toDate : toDate;
    const days = eachDateInRange(overlapFrom, overlapTo).length;
    if (days <= 0) continue;

    const leaveType = typeById.get(req.leaveTypeId);
    if (leaveType?.paid) paidLeaveDays += days;
    else unpaidLeaveDays += days;
  }

  return { paidLeaveDays, unpaidLeaveDays };
}

/**
 * Sum reward amounts for payroll inclusion on/after joiningDate: APPROVED or PENDING only.
 */
export function sumApprovedRewardsForStaff(
  ledger: StaffRewardLedgerEntry[],
  staffId: string,
  year: number,
  month: number,
  joiningDateStr?: string
): { amount: number; refs: string[] } {
  let amount = 0;
  const refs: string[] = [];
  const joinTime = joiningDateStr ? Date.parse(joiningDateStr) : NaN;
  const hasJoin = !Number.isNaN(joinTime);

  for (const e of ledger) {
    if (e.staffId !== staffId) continue;
    if (e.periodYear !== year || e.periodMonth !== month) continue;
    if (e.status !== "APPROVED" && e.status !== "PENDING") continue;

    if (hasJoin) {
      const entryTime = e.createdAt ? Date.parse(e.createdAt) : NaN;
      if (!Number.isNaN(entryTime) && entryTime < joinTime) {
        continue;
      }
    }

    amount = round2(amount + e.amount);
    refs.push(e.id);
  }
  return { amount: round2(amount), refs };
}

export function computeBaseFromStructure(args: {
  structure: SalaryStructure;
  paidAttendanceDays: number;
  eligibleWorkingDays: number;
  eligibleWorkingDaysInFullMonth: number;
  isJoiningMonth: boolean;
  isTracked: boolean;
}): {
  baseSalary: number;
  presencePayment: number;
  absenceDeduction: number;
  grossEarnings: number;
  netSalaryBeforeAdvance: number;
} {
  let baseSalary = 0;
  if (args.isTracked) {
    if (args.paidAttendanceDays > 0 && args.eligibleWorkingDaysInFullMonth > 0) {
      const dailyRate = args.structure.baseSalary / args.eligibleWorkingDaysInFullMonth;
      baseSalary = round2(dailyRate * args.paidAttendanceDays);
    }
  } else {
    if (args.eligibleWorkingDays > 0 && args.eligibleWorkingDaysInFullMonth > 0) {
      baseSalary = round2(
        args.isJoiningMonth
          ? (args.structure.baseSalary / args.eligibleWorkingDaysInFullMonth) * args.eligibleWorkingDays
          : args.structure.baseSalary
      );
    }
  }

  const presencePayment = round2(args.paidAttendanceDays * args.structure.attendanceBonusPerDay);
  const absenceDeduction = 0;
  const grossEarnings = round2(baseSalary + presencePayment);
  const netSalaryBeforeAdvance = Math.max(0, round2(grossEarnings - absenceDeduction));

  return {
    baseSalary,
    presencePayment,
    absenceDeduction,
    grossEarnings,
    netSalaryBeforeAdvance,
  };
}

export type RecoveryPlanItem = {
  advanceId: string;
  amount: number;
};

export type RecoveryPlan = {
  outstandingBefore: number;
  deductionPlanned: number;
  outstandingAfterPlanned: number;
  items: RecoveryPlanItem[];
};

export function activeRecoveries(
  recoveries: SalaryAdvanceRecovery[],
  employeeId: string,
  excludePayrollRecordId?: string
): SalaryAdvanceRecovery[] {
  return recoveries.filter((r) => {
    if (r.employeeId !== employeeId) return false;
    if (r.state === "REVERSED") return false;
    if (excludePayrollRecordId && r.payrollRecordId === excludePayrollRecordId) return false;
    return true;
  });
}

export function buildRecoveryPlan(opts: {
  employeeId: string;
  payrollRecordId: string;
  periodMonth: number;
  periodYear: number;
  netSalaryBeforeAdvance: number;
  advances: SalaryAdvance[];
  recoveries: SalaryAdvanceRecovery[];
}): RecoveryPlan {
  const {
    employeeId,
    payrollRecordId,
    netSalaryBeforeAdvance,
    advances,
    recoveries,
  } = opts;

  const rows = activeRecoveries(recoveries, employeeId, payrollRecordId);
  const reservedByAdvance = new Map<string, number>();
  for (const r of rows) {
    reservedByAdvance.set(r.advanceId, round2((reservedByAdvance.get(r.advanceId) ?? 0) + r.recoveredAmount));
  }

  const eligible = advances
    .filter((a) => a.employeeId === employeeId)
    .filter((a) => a.status !== "CANCELLED")
    .sort((a, b) => {
      const da = new Date(a.advanceDate).getTime();
      const db = new Date(b.advanceDate).getTime();
      if (da !== db) return da - db;
      const ca = new Date(a.createdAt).getTime();
      const cb = new Date(b.createdAt).getTime();
      if (ca !== cb) return ca - cb;
      return a.id.localeCompare(b.id);
    });

  const outstandingByAdvance = eligible.map((a) => {
    const reserved = reservedByAdvance.get(a.id) ?? 0;
    const remaining = Math.max(0, round2(a.advanceAmount - reserved));
    return { advance: a, remaining };
  });

  const outstandingBefore = round2(
    outstandingByAdvance.reduce((s, item) => s + item.remaining, 0)
  );

  let salaryLeft = Math.max(0, round2(netSalaryBeforeAdvance));
  const items: RecoveryPlanItem[] = [];

  for (const item of outstandingByAdvance) {
    if (salaryLeft <= 0) break;
    if (item.remaining <= 0) continue;
    const cap =
      item.advance.monthlyDeductionAmount != null && item.advance.monthlyDeductionAmount > 0
        ? round2(item.advance.monthlyDeductionAmount)
        : Number.POSITIVE_INFINITY;
    const amount = round2(Math.min(item.remaining, cap, salaryLeft));
    if (amount <= 0) continue;
    items.push({ advanceId: item.advance.id, amount });
    salaryLeft = round2(salaryLeft - amount);
  }

  const deductionPlanned = round2(items.reduce((s, r) => s + r.amount, 0));
  const outstandingAfterPlanned = Math.max(0, round2(outstandingBefore - deductionPlanned));

  return {
    outstandingBefore,
    deductionPlanned,
    outstandingAfterPlanned,
    items,
  };
}
