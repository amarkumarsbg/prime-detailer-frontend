import type {
  ExperienceBand,
  PayrollRecord,
  SalaryAdvance,
  SalaryAdvanceRecovery,
  SalaryStructure,
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

export function workingDaysInMonth(year: number, month: number): number {
  const days = new Date(year, month, 0).getDate();
  return Math.min(26, Math.max(22, days - 8));
}

export function monthDays(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function computeBaseFromStructure(
  structure: SalaryStructure,
  attendanceDays: number,
  daysInMonth: number
): Pick<
  PayrollRecord,
  | "presencePayment"
  | "baseSalary"
  | "absenceDeduction"
  | "grossEarnings"
  | "netSalaryBeforeAdvance"
> {
  const baseSalary = round2(structure.baseSalary);
  const presencePayment = round2(attendanceDays * structure.attendanceBonusPerDay);
  const absenceDays = Math.max(0, daysInMonth - attendanceDays);
  const absenceDeduction = round2(absenceDays * structure.absenceDeductionPerDay);
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
