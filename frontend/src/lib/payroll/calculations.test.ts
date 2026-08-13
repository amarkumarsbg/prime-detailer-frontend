import { describe, expect, it } from "vitest";
import {
  buildRecoveryPlan,
  computeBaseFromStructure,
  monthDays,
  round2,
} from "@/lib/payroll/calculations";
import type { SalaryAdvance, SalaryAdvanceRecovery, SalaryStructure } from "@/types";

const structure = {
  id: "ss-1",
  role: "MECHANIC",
  experienceBand: "MID",
  label: "Mechanic Mid",
  baseSalary: 20000,
  attendanceBonusPerDay: 100,
  absenceDeductionPerDay: 200,
} as SalaryStructure;

describe("payroll calculations", () => {
  it("round2 rounds to paise", () => {
    expect(round2(10.006)).toBe(10.01);
    expect(round2(Number.NaN)).toBe(0);
  });

  it("computeBaseFromStructure applies presence and absence", () => {
    const days = monthDays(2026, 4); // April = 30
    const base = computeBaseFromStructure(structure, 28, days);
    expect(base.baseSalary).toBe(20000);
    expect(base.presencePayment).toBe(2800);
    expect(base.absenceDeduction).toBe(400); // 2 days * 200
    expect(base.grossEarnings).toBe(22800);
    expect(base.netSalaryBeforeAdvance).toBe(22400);
  });

  it("buildRecoveryPlan caps monthly deduction and salary left", () => {
    const advances: SalaryAdvance[] = [
      {
        id: "sa-1",
        employeeId: "u-1",
        employeeName: "A",
        branchId: "b-1",
        advanceAmount: 5000,
        advanceDate: "2026-01-01",
        status: "OPEN",
        recoveredAmount: 0,
        remainingAmount: 5000,
        monthlyDeductionAmount: 1500,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    const recoveries: SalaryAdvanceRecovery[] = [];
    const plan = buildRecoveryPlan({
      employeeId: "u-1",
      payrollRecordId: "pr-1",
      periodMonth: 2,
      periodYear: 2026,
      netSalaryBeforeAdvance: 2000,
      advances,
      recoveries,
    });
    expect(plan.outstandingBefore).toBe(5000);
    expect(plan.deductionPlanned).toBe(1500);
    expect(plan.outstandingAfterPlanned).toBe(3500);
    expect(plan.items).toEqual([{ advanceId: "sa-1", amount: 1500 }]);
  });
});
