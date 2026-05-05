"use client";

import { create } from "zustand";
import { putSingletonDocument } from "@/lib/collection-sync";
import type {
  ExperienceBand,
  PayrollRecord,
  PayrollRecordStatus,
  SalaryStructure,
  User,
  UserRole,
} from "@/types";

const BANDS: ExperienceBand[] = ["ENTRY", "MID", "SENIOR", "LEAD"];

function bandForStaff(
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

function pickStructure(
  staff: User,
  structures: SalaryStructure[]
): SalaryStructure | undefined {
  const band = bandForStaff(staff.id, staff.role, structures);
  return (
    structures.find((x) => x.role === staff.role && x.experienceBand === band) ??
    structures.find((x) => x.role === staff.role)
  );
}

function nextRecordId(existing: PayrollRecord[]): string {
  return `pr-${Date.now()}-${existing.length}`;
}

function workingDaysInMonth(year: number, month: number): number {
  const days = new Date(year, month, 0).getDate();
  return Math.min(26, Math.max(22, days - 8));
}

function persistPayroll(salaryStructures: SalaryStructure[], payrollRecords: PayrollRecord[]) {
  void putSingletonDocument("payroll", { salaryStructures, payrollRecords }).catch(console.error);
}

interface PayrollStore {
  salaryStructures: SalaryStructure[];
  payrollRecords: PayrollRecord[];
  setSalaryStructures: (structures: SalaryStructure[]) => void;
  upsertSalaryStructure: (s: SalaryStructure) => void;
  removeSalaryStructure: (id: string) => void;
  generatePayroll: (input: {
    year: number;
    month: number;
    staff: User[];
    branchId: string | null;
  }) => number;
  recalculateAll: () => void;
  setRecordStatus: (id: string, status: PayrollRecordStatus) => void;
  resetToSeed: () => void;
}

function computeRecordFromStructure(
  structure: SalaryStructure,
  attendanceDays: number,
  monthDays: number
): Pick<
  PayrollRecord,
  | "presencePayment"
  | "baseSalary"
  | "absenceDeduction"
  | "grossEarnings"
  | "totalDeductions"
  | "netSalary"
> {
  const baseSalary = structure.baseSalary;
  const presencePayment = attendanceDays * structure.attendanceBonusPerDay;
  const absenceDays = Math.max(0, monthDays - attendanceDays);
  const absenceDeduction = absenceDays * structure.absenceDeductionPerDay;
  const grossEarnings = baseSalary + presencePayment;
  const totalDeductions = absenceDeduction;
  const netSalary = Math.max(0, grossEarnings - totalDeductions);
  return {
    baseSalary,
    presencePayment,
    absenceDeduction,
    grossEarnings,
    totalDeductions,
    netSalary,
  };
}

export const usePayrollStore = create<PayrollStore>((set, get) => ({
  salaryStructures: [],
  payrollRecords: [],

  resetToSeed: () => {
    set({ salaryStructures: [], payrollRecords: [] });
    persistPayroll([], []);
  },

  setSalaryStructures: (structures) => {
    set({ salaryStructures: structures });
    persistPayroll(structures, get().payrollRecords);
  },

  upsertSalaryStructure: (s) => {
    const list = get().salaryStructures;
    const i = list.findIndex((x) => x.id === s.id);
    const salaryStructures =
      i >= 0 ? list.map((x) => (x.id === s.id ? s : x)) : [...list, s];
    set({ salaryStructures });
    persistPayroll(salaryStructures, get().payrollRecords);
  },

  removeSalaryStructure: (id) => {
    const salaryStructures = get().salaryStructures.filter((x) => x.id !== id);
    set({ salaryStructures });
    persistPayroll(salaryStructures, get().payrollRecords);
  },

  generatePayroll: ({ year, month, staff, branchId }) => {
    const structures = get().salaryStructures;
    if (structures.length === 0) return 0;

    const monthDays = new Date(year, month, 0).getDate();
    const targetStaff = staff.filter((u) => {
      if (!u.isActive) return false;
      if (branchId && u.branchId !== branchId) return false;
      return true;
    });

    const existing = get().payrollRecords;
    const now = new Date().toISOString();
    let created = 0;
    const next: PayrollRecord[] = [...existing];

    for (const member of targetStaff) {
      const dup = next.some(
        (r) => r.employeeId === member.id && r.periodYear === year && r.periodMonth === month
      );
      if (dup) continue;

      const structure = pickStructure(member, structures);
      if (!structure) continue;

      const att = workingDaysInMonth(year, month);
      const calc = computeRecordFromStructure(structure, att, monthDays);

      next.push({
        id: nextRecordId(next),
        employeeId: member.id,
        employeeName: member.name,
        branchId: member.branchId,
        periodMonth: month,
        periodYear: year,
        attendanceDays: att,
        salaryStructureId: structure.id,
        status: "PENDING",
        createdAt: now,
        updatedAt: now,
        ...calc,
      });
      created++;
    }

    set({ payrollRecords: next });
    persistPayroll(get().salaryStructures, next);
    return created;
  },

  recalculateAll: () => {
    const structures = get().salaryStructures;
    const monthDays = (y: number, m: number) => new Date(y, m, 0).getDate();

    const payrollRecords = get().payrollRecords.map((r) => {
      const structure = structures.find((s) => s.id === r.salaryStructureId);
      if (!structure) return r;
      const md = monthDays(r.periodYear, r.periodMonth);
      const calc = computeRecordFromStructure(structure, r.attendanceDays, md);
      return {
        ...r,
        ...calc,
        updatedAt: new Date().toISOString(),
      };
    });
    set({ payrollRecords });
    persistPayroll(structures, payrollRecords);
  },

  setRecordStatus: (id, status) => {
    const payrollRecords = get().payrollRecords.map((r) =>
      r.id === id ? { ...r, status, updatedAt: new Date().toISOString() } : r
    );
    set({ payrollRecords });
    persistPayroll(get().salaryStructures, payrollRecords);
  },
}));
