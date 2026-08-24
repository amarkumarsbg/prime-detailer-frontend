"use client";

import { create } from "zustand";
import { putSingletonDocument } from "@/lib/collection-sync";
import { useStaffRewardStore } from "@/store/staff-reward-store";
import type {
  AttendanceRecord,
  LeaveRequest,
  LeaveType,
  PayrollRecord,
  PayrollRecordStatus,
  SalaryAdvance,
  SalaryAdvanceRecovery,
  SalaryStructure,
  StaffRewardLedgerEntry,
  User,
} from "@/types";
import { useStaffStore } from "@/store/staff-store";
import {
  buildRecoveryPlan,
  computeBaseFromStructure,
  countAttendanceDaysForStaff,
  countLeaveDaysForStaff,
  monthDays,
  pickStructure,
  round2,
  sumApprovedRewardsForStaff,
  workingDaysInMonth,
  countWorkingDaysInRange,
} from "@/lib/payroll/calculations";

function nextRecordId(existing: PayrollRecord[]): string {
  return `pr-${Date.now()}-${existing.length}`;
}

function nextAdvanceId(existing: SalaryAdvance[]): string {
  return `sa-${Date.now()}-${existing.length}`;
}

function nextRecoveryId(recordId: string, advanceId: string): string {
  return `sar-${recordId}-${advanceId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function persistPayroll(
  salaryStructures: SalaryStructure[],
  payrollRecords: PayrollRecord[],
  salaryAdvances: SalaryAdvance[],
  salaryAdvanceRecoveries: SalaryAdvanceRecovery[]
): void {
  void putSingletonDocument("payroll", {
    salaryStructures,
    payrollRecords,
    salaryAdvances,
    salaryAdvanceRecoveries,
  }).catch((err) => {
    if (process.env.NODE_ENV !== "production") console.error(err);
  });
}

function syncAdvanceBalances(
  advances: SalaryAdvance[],
  recoveries: SalaryAdvanceRecovery[]
): SalaryAdvance[] {
  const finalizedByAdvance = new Map<string, number>();
  for (const r of recoveries) {
    if (r.state !== "FINALIZED") continue;
    finalizedByAdvance.set(
      r.advanceId,
      round2((finalizedByAdvance.get(r.advanceId) ?? 0) + r.recoveredAmount)
    );
  }

  return advances.map((a) => {
    const recoveredAmount = round2(finalizedByAdvance.get(a.id) ?? 0);
    const remainingAmount = Math.max(0, round2(a.advanceAmount - recoveredAmount));

    let status = a.status;
    if (a.status !== "CANCELLED") {
      if (remainingAmount <= 0) status = "CLOSED";
      else if (recoveredAmount > 0) status = "PARTIALLY_RECOVERED";
      else status = "OPEN";
    }

    return {
      ...a,
      recoveredAmount,
      remainingAmount,
      status,
    };
  });
}

function resetPlannedRecoveriesForEmployee(
  recoveries: SalaryAdvanceRecovery[],
  employeeId: string
): SalaryAdvanceRecovery[] {
  return recoveries.map((r) => {
    if (r.employeeId !== employeeId) return r;
    if (r.state !== "PLANNED") return r;
    return { ...r, state: "REVERSED" as const, recoveredAt: new Date().toISOString() };
  });
}

function recalcRecordsForEmployee(opts: {
  employeeId: string;
  records: PayrollRecord[];
  structures: SalaryStructure[];
  advances: SalaryAdvance[];
  recoveries: SalaryAdvanceRecovery[];
}): { records: PayrollRecord[]; recoveries: SalaryAdvanceRecovery[] } {
  const { employeeId, structures, advances } = opts;
  let recoveries = resetPlannedRecoveriesForEmployee(opts.recoveries, employeeId);

  const records = opts.records
    .slice()
    .sort((a, b) => {
      if (a.employeeId !== b.employeeId) return a.employeeId.localeCompare(b.employeeId);
      if (a.periodYear !== b.periodYear) return a.periodYear - b.periodYear;
      if (a.periodMonth !== b.periodMonth) return a.periodMonth - b.periodMonth;
      return a.id.localeCompare(b.id);
    })
    .map((r) => {
      if (r.employeeId !== employeeId) return r;
      const member = useStaffStore.getState().staff.find((s) => s.id === employeeId);
      const joiningDateStr = member?.joiningDate;

      let isJoiningMonth = false;
      const eligibleWorkingDaysInFullMonth = workingDaysInMonth(r.periodYear, r.periodMonth);
      let eligibleWorkingDays = eligibleWorkingDaysInFullMonth;

      if (joiningDateStr) {
        const jd = new Date(joiningDateStr);
        if (!Number.isNaN(jd.getTime())) {
          const jdYear = jd.getFullYear();
          const jdMonth = jd.getMonth() + 1;
          const targetYear = r.periodYear;
          const targetMonth = r.periodMonth;

          if (jdYear === targetYear && jdMonth === targetMonth) {
            isJoiningMonth = true;
            const endOfMonth = new Date(targetYear, targetMonth, 0);
            eligibleWorkingDays = Math.min(
              eligibleWorkingDaysInFullMonth,
              countWorkingDaysInRange(jd, endOfMonth)
            );
          } else if (jdYear > targetYear || (jdYear === targetYear && jdMonth > targetMonth)) {
            eligibleWorkingDays = 0;
          }
        }
      }

      const structure = structures.find((s) => s.id === r.salaryStructureId);
      if (!structure) return r;

      const isTracked = member?.isAttendanceTracked ?? true;
      const base = computeBaseFromStructure({
        structure,
        paidAttendanceDays: r.attendanceDays,
        eligibleWorkingDays,
        eligibleWorkingDaysInFullMonth,
        isJoiningMonth,
        isTracked,
      });
      const rewardAmount = round2(r.rewardAmount ?? 0);
      const grossEarnings = round2(base.grossEarnings + rewardAmount);
      const netSalaryBeforeAdvance = Math.max(
        0,
        round2(base.netSalaryBeforeAdvance + rewardAmount)
      );
      const withRewards = {
        ...base,
        grossEarnings,
        netSalaryBeforeAdvance,
      };

      const finalizedForRecord = round2(
        recoveries
          .filter((x) => x.payrollRecordId === r.id && x.state === "FINALIZED")
          .reduce((s, x) => s + x.recoveredAmount, 0)
      );

      if (r.status === "PAID") {
        const totalDeductions = round2(withRewards.absenceDeduction + finalizedForRecord);
        const netSalary = Math.max(
          0,
          round2(withRewards.netSalaryBeforeAdvance - finalizedForRecord)
        );
        return {
          ...r,
          ...withRewards,
          totalDeductions,
          netSalary,
          advanceDeductionPlanned: 0,
          advanceDeductionFinalized: finalizedForRecord,
          updatedAt: new Date().toISOString(),
        };
      }

      if (r.status === "CANCELLED") {
        const totalDeductions = round2(withRewards.absenceDeduction);
        return {
          ...r,
          ...withRewards,
          totalDeductions,
          netSalary: withRewards.netSalaryBeforeAdvance,
          advanceDeductionPlanned: 0,
          advanceDeductionFinalized: 0,
          advanceOutstandingBefore: 0,
          advanceOutstandingAfterPlanned: 0,
          advanceOutstandingAfterFinalized: 0,
          advanceRecoveryRefs: [],
          updatedAt: new Date().toISOString(),
        };
      }

      const plan = buildRecoveryPlan({
        employeeId,
        payrollRecordId: r.id,
        periodMonth: r.periodMonth,
        periodYear: r.periodYear,
        netSalaryBeforeAdvance: withRewards.netSalaryBeforeAdvance,
        advances,
        recoveries,
      });

      const now = new Date().toISOString();
      const createdRows: SalaryAdvanceRecovery[] = plan.items.map((it) => ({
        id: nextRecoveryId(r.id, it.advanceId),
        advanceId: it.advanceId,
        payrollRecordId: r.id,
        employeeId,
        periodMonth: r.periodMonth,
        periodYear: r.periodYear,
        recoveredAmount: it.amount,
        recoveredAt: now,
        mode: "AUTO_PAYROLL",
        state: "PLANNED",
      }));
      recoveries = [...recoveries, ...createdRows];

      const totalDeductions = round2(withRewards.absenceDeduction + plan.deductionPlanned);
      const netSalary = Math.max(
        0,
        round2(withRewards.netSalaryBeforeAdvance - plan.deductionPlanned)
      );
      return {
        ...r,
        ...withRewards,
        totalDeductions,
        netSalary,
        advanceDeductionPlanned: plan.deductionPlanned,
        advanceDeductionFinalized: 0,
        advanceOutstandingBefore: plan.outstandingBefore,
        advanceOutstandingAfterPlanned: plan.outstandingAfterPlanned,
        advanceOutstandingAfterFinalized: plan.outstandingAfterPlanned,
        advanceRecoveryRefs: createdRows.map((x) => x.id),
        updatedAt: now,
      };
    });

  return { records, recoveries };
}

function normalizeRecord(r: PayrollRecord): PayrollRecord {
  return {
    ...r,
    netSalaryBeforeAdvance:
      typeof r.netSalaryBeforeAdvance === "number"
        ? round2(r.netSalaryBeforeAdvance)
        : round2(r.grossEarnings - r.absenceDeduction),
    advanceDeductionPlanned:
      typeof r.advanceDeductionPlanned === "number" ? round2(r.advanceDeductionPlanned) : 0,
    advanceDeductionFinalized:
      typeof r.advanceDeductionFinalized === "number" ? round2(r.advanceDeductionFinalized) : 0,
    advanceOutstandingBefore:
      typeof r.advanceOutstandingBefore === "number" ? round2(r.advanceOutstandingBefore) : 0,
    advanceOutstandingAfterPlanned:
      typeof r.advanceOutstandingAfterPlanned === "number"
        ? round2(r.advanceOutstandingAfterPlanned)
        : 0,
    advanceOutstandingAfterFinalized:
      typeof r.advanceOutstandingAfterFinalized === "number"
        ? round2(r.advanceOutstandingAfterFinalized)
        : 0,
    advanceRecoveryRefs: Array.isArray(r.advanceRecoveryRefs) ? r.advanceRecoveryRefs : [],
    paidLeaveDays: r.paidLeaveDays,
    unpaidLeaveDays: r.unpaidLeaveDays,
    rewardAmount:
      typeof r.rewardAmount === "number" ? round2(r.rewardAmount) : undefined,
    rewardLedgerRefs: Array.isArray(r.rewardLedgerRefs) ? r.rewardLedgerRefs : undefined,
  };
}

function normalizeAdvance(a: SalaryAdvance): SalaryAdvance {
  return {
    ...a,
    recoveredAmount: round2(a.recoveredAmount ?? 0),
    remainingAmount: round2(a.remainingAmount ?? Math.max(0, (a.advanceAmount ?? 0) - (a.recoveredAmount ?? 0))),
    status: a.status ?? "OPEN",
  };
}

interface PayrollStore {
  salaryStructures: SalaryStructure[];
  payrollRecords: PayrollRecord[];
  salaryAdvances: SalaryAdvance[];
  salaryAdvanceRecoveries: SalaryAdvanceRecovery[];
  setSalaryStructures: (structures: SalaryStructure[]) => void;
  upsertSalaryStructure: (s: SalaryStructure) => void;
  removeSalaryStructure: (id: string) => void;
  generatePayroll: (input: {
    year: number;
    month: number;
    staff: User[];
    branchId: string | null;
    attendanceRecords?: AttendanceRecord[];
    leaveRequests?: LeaveRequest[];
    leaveTypes?: LeaveType[];
    rewardLedger?: StaffRewardLedgerEntry[];
  }) => number;
  recalculateAll: () => void;
  setRecordStatus: (id: string, status: PayrollRecordStatus) => void;
  deletePayrollRecord: (id: string) => void;
  addSalaryAdvance: (input: {
    employeeId: string;
    employeeName: string;
    branchId: string;
    advanceAmount: number;
    advanceDate: string;
    monthlyDeductionAmount?: number;
    notes?: string;
  }) => void;
  updateSalaryAdvance: (id: string, patch: Partial<SalaryAdvance>) => void;
  deleteSalaryAdvance: (id: string) => boolean;
  cancelSalaryAdvance: (id: string, reason?: string) => void;
  closeSalaryAdvance: (id: string, reason?: string) => void;
  getOutstandingAdvanceByEmployee: (employeeId: string) => number;
  resetToSeed: () => void;
}

export const usePayrollStore = create<PayrollStore>((set, get) => ({
  salaryStructures: [],
  payrollRecords: [],
  salaryAdvances: [],
  salaryAdvanceRecoveries: [],

  resetToSeed: () => {
    set({
      salaryStructures: [],
      payrollRecords: [],
      salaryAdvances: [],
      salaryAdvanceRecoveries: [],
    });
    persistPayroll([], [], [], []);
  },

  setSalaryStructures: (structures) => {
    set({ salaryStructures: structures });
    persistPayroll(
      structures,
      get().payrollRecords.map(normalizeRecord),
      get().salaryAdvances.map(normalizeAdvance),
      get().salaryAdvanceRecoveries
    );
  },

  upsertSalaryStructure: (s) => {
    const list = get().salaryStructures;
    const i = list.findIndex((x) => x.id === s.id);
    const salaryStructures = i >= 0 ? list.map((x) => (x.id === s.id ? s : x)) : [...list, s];
    set({ salaryStructures });
    persistPayroll(
      salaryStructures,
      get().payrollRecords.map(normalizeRecord),
      get().salaryAdvances.map(normalizeAdvance),
      get().salaryAdvanceRecoveries
    );
  },

  removeSalaryStructure: (id) => {
    const salaryStructures = get().salaryStructures.filter((x) => x.id !== id);
    set({ salaryStructures });
    persistPayroll(
      salaryStructures,
      get().payrollRecords.map(normalizeRecord),
      get().salaryAdvances.map(normalizeAdvance),
      get().salaryAdvanceRecoveries
    );
  },

  generatePayroll: ({
    year,
    month,
    staff,
    branchId,
    attendanceRecords,
    leaveRequests,
    leaveTypes,
    rewardLedger,
  }) => {
    const structures = get().salaryStructures;
    if (structures.length === 0) return 0;

    const daysInMonth = monthDays(year, month);
    const targetStaff = staff.filter((u) => {
      if (!u.isActive) return false;
      if (u.role === "SUPER_ADMIN") return false;
      if (branchId && u.branchId !== branchId) return false;
      return true;
    });

    const existing = get().payrollRecords.map(normalizeRecord);
    let records: PayrollRecord[] = [...existing];
    let recoveries = [...get().salaryAdvanceRecoveries];
    let created = 0;

    for (const member of targetStaff) {
      const dup = records.some(
        (r) => r.employeeId === member.id && r.periodYear === year && r.periodMonth === month && r.status !== "CANCELLED"
      );
      if (dup) continue;

      const structure = pickStructure(member, structures);
      if (!structure) continue;

      let isJoiningMonth = false;
      const eligibleWorkingDaysInFullMonth = workingDaysInMonth(year, month);
      let eligibleWorkingDays = eligibleWorkingDaysInFullMonth;

      const joiningDateStr = member.joiningDate;
      if (joiningDateStr) {
        const jd = new Date(joiningDateStr);
        if (!Number.isNaN(jd.getTime())) {
          const jdYear = jd.getFullYear();
          const jdMonth = jd.getMonth() + 1;

          if (jdYear === year && jdMonth === month) {
            isJoiningMonth = true;
            const endOfMonth = new Date(year, month, 0);
            eligibleWorkingDays = Math.min(
              eligibleWorkingDaysInFullMonth,
              countWorkingDaysInRange(jd, endOfMonth)
            );
          } else if (jdYear > year || (jdYear === year && jdMonth > month)) {
            eligibleWorkingDays = 0;
          }
        }
      }

      if (eligibleWorkingDays === 0) continue;

      const leaveCounts =
        leaveRequests != null && leaveTypes != null
          ? countLeaveDaysForStaff(leaveRequests, leaveTypes, member.id, year, month, joiningDateStr)
          : { paidLeaveDays: 0, unpaidLeaveDays: 0 };

      let presentDays = 0;
      const isTracked = member.isAttendanceTracked ?? true;
      if (isTracked && attendanceRecords != null) {
        presentDays = countAttendanceDaysForStaff(attendanceRecords, member.id, year, month, joiningDateStr);
      } else {
        presentDays = Math.max(0, eligibleWorkingDays - leaveCounts.paidLeaveDays - leaveCounts.unpaidLeaveDays);
      }

      const paidAttendanceDays = presentDays + leaveCounts.paidLeaveDays;

      const rewards =
        rewardLedger != null
          ? sumApprovedRewardsForStaff(rewardLedger, member.id, year, month, joiningDateStr)
          : { amount: 0, refs: [] as string[] };

      const base = computeBaseFromStructure({
        structure,
        paidAttendanceDays,
        eligibleWorkingDays,
        eligibleWorkingDaysInFullMonth,
        isJoiningMonth,
        isTracked,
      });

      const rewardAmount = round2(rewards.amount);
      const grossEarnings = round2(base.grossEarnings + rewardAmount);
      const netSalaryBeforeAdvance = Math.max(
        0,
        round2(base.netSalaryBeforeAdvance + rewardAmount)
      );

      const now = new Date().toISOString();
      records.push({
        id: nextRecordId(records),
        employeeId: member.id,
        employeeName: member.name,
        branchId: member.branchId,
        periodMonth: month,
        periodYear: year,
        attendanceDays: paidAttendanceDays,
        salaryStructureId: structure.id,
        status: "PENDING",
        createdAt: now,
        updatedAt: now,
        ...base,
        grossEarnings,
        netSalaryBeforeAdvance,
        totalDeductions: base.absenceDeduction,
        netSalary: netSalaryBeforeAdvance,
        advanceDeductionPlanned: 0,
        advanceDeductionFinalized: 0,
        advanceOutstandingBefore: 0,
        advanceOutstandingAfterPlanned: 0,
        advanceOutstandingAfterFinalized: 0,
        advanceRecoveryRefs: [],
        paidLeaveDays: leaveCounts.paidLeaveDays,
        unpaidLeaveDays: leaveCounts.unpaidLeaveDays,
        rewardAmount,
        rewardLedgerRefs: rewards.refs,
      });
      created++;
    }

    const affected = new Set(records.map((r) => r.employeeId));
    for (const employeeId of affected) {
      const next = recalcRecordsForEmployee({
        employeeId,
        records,
        structures,
        advances: get().salaryAdvances.map(normalizeAdvance),
        recoveries,
      });
      records = next.records;
      recoveries = next.recoveries;
    }

    const advances = syncAdvanceBalances(get().salaryAdvances.map(normalizeAdvance), recoveries);
    set({ payrollRecords: records, salaryAdvanceRecoveries: recoveries, salaryAdvances: advances });
    persistPayroll(structures, records, advances, recoveries);
    return created;
  },

  recalculateAll: () => {
    const structures = get().salaryStructures;
    let records = get().payrollRecords.map(normalizeRecord);
    let recoveries = [...get().salaryAdvanceRecoveries];
    const advances = get().salaryAdvances.map(normalizeAdvance);

    const staffStoreStaff = useStaffStore.getState().staff;
    const employees = Array.from(new Set(records.map((r) => r.employeeId))).filter((id) => {
      const user = staffStoreStaff.find((s) => s.id === id);
      return user?.role !== "SUPER_ADMIN";
    });
    for (const employeeId of employees) {
      const next = recalcRecordsForEmployee({
        employeeId,
        records,
        structures,
        advances,
        recoveries,
      });
      records = next.records;
      recoveries = next.recoveries;
    }

    const syncedAdvances = syncAdvanceBalances(advances, recoveries);
    set({ payrollRecords: records, salaryAdvances: syncedAdvances, salaryAdvanceRecoveries: recoveries });
    persistPayroll(structures, records, syncedAdvances, recoveries);
  },

  setRecordStatus: (id, status) => {
    const structures = get().salaryStructures;
    let records = get().payrollRecords.map(normalizeRecord);
    let recoveries = [...get().salaryAdvanceRecoveries];
    const advances = get().salaryAdvances.map(normalizeAdvance);

    const current = records.find((r) => r.id === id);
    if (!current) return;

    const now = new Date().toISOString();

    if (current.status !== "PAID" && status === "PAID") {
      recoveries = recoveries.map((r) => {
        if (r.payrollRecordId !== id) return r;
        if (r.state !== "PLANNED") return r;
        return { ...r, state: "FINALIZED" as const, recoveredAt: now };
      });
      const rewardRefs = current.rewardLedgerRefs ?? [];
      if (rewardRefs.length > 0) {
        useStaffRewardStore.getState().markLedgerPaidInPayroll(rewardRefs);
      }
    }

    if (current.status === "PAID" && status !== "PAID") {
      recoveries = recoveries.map((r) => {
        if (r.payrollRecordId !== id) return r;
        if (r.state !== "FINALIZED") return r;
        return { ...r, state: "REVERSED" as const, recoveredAt: now };
      });
      const rewardRefs = current.rewardLedgerRefs ?? [];
      if (rewardRefs.length > 0) {
        useStaffRewardStore.getState().revertLedgerPaidInPayroll(rewardRefs);
      }
    }

    if (status === "CANCELLED") {
      recoveries = recoveries.map((r) => {
        if (r.payrollRecordId !== id) return r;
        if (r.state !== "PLANNED") return r;
        return { ...r, state: "REVERSED" as const, recoveredAt: now };
      });
    }

    records = records.map((r) => (r.id === id ? { ...r, status, updatedAt: now } : r));

    const next = recalcRecordsForEmployee({
      employeeId: current.employeeId,
      records,
      structures,
      advances,
      recoveries,
    });
    records = next.records;
    recoveries = next.recoveries;

    const syncedAdvances = syncAdvanceBalances(advances, recoveries);
    set({ payrollRecords: records, salaryAdvanceRecoveries: recoveries, salaryAdvances: syncedAdvances });
    persistPayroll(structures, records, syncedAdvances, recoveries);
  },

  deletePayrollRecord: (id) => {
    const structures = get().salaryStructures;
    const records = get().payrollRecords.map(normalizeRecord);
    const row = records.find((r) => r.id === id);
    if (!row) return;

    let recoveries: SalaryAdvanceRecovery[] = [...get().salaryAdvanceRecoveries].map((rec) => {
      if (rec.payrollRecordId !== id) return rec;
      if (rec.state === "REVERSED") return rec;
      return { ...rec, state: "REVERSED" as const, recoveredAt: new Date().toISOString() };
    });

    let nextRecords = records.filter((r) => r.id !== id);
    const nextRecalc = recalcRecordsForEmployee({
      employeeId: row.employeeId,
      records: nextRecords,
      structures,
      advances: get().salaryAdvances.map(normalizeAdvance),
      recoveries,
    });
    nextRecords = nextRecalc.records;
    recoveries = nextRecalc.recoveries;

    const advances = syncAdvanceBalances(get().salaryAdvances.map(normalizeAdvance), recoveries);
    set({ payrollRecords: nextRecords, salaryAdvanceRecoveries: recoveries, salaryAdvances: advances });
    persistPayroll(structures, nextRecords, advances, recoveries);
  },

  addSalaryAdvance: (input) => {
    const amount = round2(input.advanceAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;

    const now = new Date().toISOString();
    const row: SalaryAdvance = {
      id: nextAdvanceId(get().salaryAdvances),
      employeeId: input.employeeId,
      employeeName: input.employeeName,
      branchId: input.branchId,
      advanceAmount: amount,
      advanceDate: input.advanceDate,
      monthlyDeductionAmount:
        input.monthlyDeductionAmount != null && input.monthlyDeductionAmount > 0
          ? round2(input.monthlyDeductionAmount)
          : undefined,
      recoveredAmount: 0,
      remainingAmount: amount,
      status: "OPEN",
      notes: input.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };

    const salaryAdvances = [...get().salaryAdvances.map(normalizeAdvance), row];
    const next = recalcRecordsForEmployee({
      employeeId: row.employeeId,
      records: get().payrollRecords.map(normalizeRecord),
      structures: get().salaryStructures,
      advances: salaryAdvances,
      recoveries: [...get().salaryAdvanceRecoveries],
    });

    const syncedAdvances = syncAdvanceBalances(salaryAdvances, next.recoveries);
    set({
      salaryAdvances: syncedAdvances,
      payrollRecords: next.records,
      salaryAdvanceRecoveries: next.recoveries,
    });
    persistPayroll(get().salaryStructures, next.records, syncedAdvances, next.recoveries);
  },

  updateSalaryAdvance: (id, patch) => {
    const existing = get().salaryAdvances.map(normalizeAdvance);
    const current = existing.find((x) => x.id === id);
    if (!current) return;

    const salaryAdvances = existing.map((x) => {
      if (x.id !== id) return x;
      return {
        ...x,
        ...patch,
        monthlyDeductionAmount:
          patch.monthlyDeductionAmount != null && patch.monthlyDeductionAmount > 0
            ? round2(patch.monthlyDeductionAmount)
            : patch.monthlyDeductionAmount === undefined
              ? x.monthlyDeductionAmount
              : undefined,
        updatedAt: new Date().toISOString(),
      };
    });

    const next = recalcRecordsForEmployee({
      employeeId: current.employeeId,
      records: get().payrollRecords.map(normalizeRecord),
      structures: get().salaryStructures,
      advances: salaryAdvances,
      recoveries: [...get().salaryAdvanceRecoveries],
    });

    const syncedAdvances = syncAdvanceBalances(salaryAdvances, next.recoveries);
    set({
      salaryAdvances: syncedAdvances,
      payrollRecords: next.records,
      salaryAdvanceRecoveries: next.recoveries,
    });
    persistPayroll(get().salaryStructures, next.records, syncedAdvances, next.recoveries);
  },

  deleteSalaryAdvance: (id) => {
    const advances = get().salaryAdvances.map(normalizeAdvance);
    const current = advances.find((a) => a.id === id);
    if (!current) return false;

    const hasAnyActiveRecovery = get().salaryAdvanceRecoveries.some(
      (r) => r.advanceId === id && r.state !== "REVERSED"
    );
    if (hasAnyActiveRecovery || current.recoveredAmount > 0) return false;

    const salaryAdvances = advances.filter((a) => a.id !== id);
    set({ salaryAdvances });
    persistPayroll(
      get().salaryStructures,
      get().payrollRecords.map(normalizeRecord),
      salaryAdvances,
      get().salaryAdvanceRecoveries
    );
    return true;
  },

  cancelSalaryAdvance: (id, reason) => {
    const advances = get().salaryAdvances.map(normalizeAdvance);
    const row = advances.find((a) => a.id === id);
    if (!row) return;

    let recoveries: SalaryAdvanceRecovery[] = [...get().salaryAdvanceRecoveries].map((r) => {
      if (r.advanceId !== id) return r;
      if (r.state !== "PLANNED") return r;
      return { ...r, state: "REVERSED" as const, recoveredAt: new Date().toISOString() };
    });

    const salaryAdvances = advances.map((a) =>
      a.id === id
        ? {
            ...a,
            status: "CANCELLED" as const,
            cancelledAt: new Date().toISOString(),
            cancelledReason: reason?.trim() || undefined,
            updatedAt: new Date().toISOString(),
          }
        : a
    );

    const next = recalcRecordsForEmployee({
      employeeId: row.employeeId,
      records: get().payrollRecords.map(normalizeRecord),
      structures: get().salaryStructures,
      advances: salaryAdvances,
      recoveries,
    });
    recoveries = next.recoveries;

    const syncedAdvances = syncAdvanceBalances(salaryAdvances, recoveries);
    set({ salaryAdvances: syncedAdvances, payrollRecords: next.records, salaryAdvanceRecoveries: recoveries });
    persistPayroll(get().salaryStructures, next.records, syncedAdvances, recoveries);
  },

  closeSalaryAdvance: (id, reason) => {
    const advances = get().salaryAdvances.map(normalizeAdvance);
    const row = advances.find((a) => a.id === id);
    if (!row) return;

    const salaryAdvances = advances.map((a) =>
      a.id === id
        ? {
            ...a,
            status: "CLOSED" as const,
            closedAt: new Date().toISOString(),
            notes: reason?.trim() ? `${a.notes ? `${a.notes}\n` : ""}Closed: ${reason.trim()}` : a.notes,
            updatedAt: new Date().toISOString(),
          }
        : a
    );

    set({ salaryAdvances });
    persistPayroll(
      get().salaryStructures,
      get().payrollRecords.map(normalizeRecord),
      salaryAdvances,
      get().salaryAdvanceRecoveries
    );
  },

  getOutstandingAdvanceByEmployee: (employeeId) => {
    const advances = syncAdvanceBalances(
      get().salaryAdvances.map(normalizeAdvance),
      get().salaryAdvanceRecoveries
    );
    return round2(
      advances
        .filter((a) => a.employeeId === employeeId)
        .filter((a) => a.status !== "CANCELLED")
        .reduce((s, a) => s + a.remainingAmount, 0)
    );
  },
}));
