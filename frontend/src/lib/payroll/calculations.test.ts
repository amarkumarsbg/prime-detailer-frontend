import { describe, expect, it } from "vitest";
import {
  buildRecoveryPlan,
  computeBaseFromStructure,
  countAttendanceDaysForStaff,
  countLeaveDaysForStaff,
  monthDays,
  round2,
  sumApprovedRewardsForStaff,
} from "@/lib/payroll/calculations";
import type {
  AttendanceRecord,
  LeaveRequest,
  LeaveType,
  SalaryAdvance,
  SalaryAdvanceRecovery,
  SalaryStructure,
  StaffRewardLedgerEntry,
} from "@/types";

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

  it("countAttendanceDaysForStaff weights PRESENT/LATE/HALF_DAY", () => {
    const records: AttendanceRecord[] = [
      {
        id: "a1",
        staffId: "u-1",
        staffName: "A",
        staffRole: "MECHANIC",
        branchId: "b-1",
        date: "2026-04-01",
        status: "PRESENT",
        qrScanned: false,
      },
      {
        id: "a2",
        staffId: "u-1",
        staffName: "A",
        staffRole: "MECHANIC",
        branchId: "b-1",
        date: "2026-04-02",
        status: "LATE",
        qrScanned: false,
      },
      {
        id: "a3",
        staffId: "u-1",
        staffName: "A",
        staffRole: "MECHANIC",
        branchId: "b-1",
        date: "2026-04-03",
        status: "HALF_DAY",
        qrScanned: false,
      },
      {
        id: "a4",
        staffId: "u-1",
        staffName: "A",
        staffRole: "MECHANIC",
        branchId: "b-1",
        date: "2026-04-04",
        status: "ABSENT",
        qrScanned: false,
      },
      {
        id: "a5",
        staffId: "u-2",
        staffName: "B",
        staffRole: "MECHANIC",
        branchId: "b-1",
        date: "2026-04-01",
        status: "PRESENT",
        qrScanned: false,
      },
      {
        id: "a6",
        staffId: "u-1",
        staffName: "A",
        staffRole: "MECHANIC",
        branchId: "b-1",
        date: "2026-03-31",
        status: "PRESENT",
        qrScanned: false,
      },
    ];
    expect(countAttendanceDaysForStaff(records, "u-1", 2026, 4)).toBe(2.5);
  });

  it("countLeaveDaysForStaff pro-rates paid/unpaid across month boundary", () => {
    const leaveTypes: LeaveType[] = [
      {
        id: "lt-paid",
        name: "Casual",
        paid: true,
        tracksBalance: true,
        defaultDaysPerYear: 12,
        isActive: true,
      },
      {
        id: "lt-unpaid",
        name: "Unpaid",
        paid: false,
        tracksBalance: false,
        defaultDaysPerYear: 0,
        isActive: true,
      },
    ];
    const requests: LeaveRequest[] = [
      {
        id: "lr-1",
        staffId: "u-1",
        staffName: "A",
        leaveTypeId: "lt-paid",
        leaveTypeName: "Casual",
        branchId: "b-1",
        fromDate: "2026-03-30",
        toDate: "2026-04-02",
        days: 4,
        reason: "trip",
        status: "APPROVED",
        appliedAt: "2026-03-01T00:00:00.000Z",
      },
      {
        id: "lr-2",
        staffId: "u-1",
        staffName: "A",
        leaveTypeId: "lt-unpaid",
        leaveTypeName: "Unpaid",
        branchId: "b-1",
        fromDate: "2026-04-10",
        toDate: "2026-04-11",
        days: 2,
        reason: "personal",
        status: "APPROVED",
        appliedAt: "2026-04-01T00:00:00.000Z",
      },
      {
        id: "lr-3",
        staffId: "u-1",
        staffName: "A",
        leaveTypeId: "lt-paid",
        leaveTypeName: "Casual",
        branchId: "b-1",
        fromDate: "2026-04-20",
        toDate: "2026-04-20",
        days: 1,
        reason: "pending",
        status: "PENDING",
        appliedAt: "2026-04-15T00:00:00.000Z",
      },
    ];
    expect(countLeaveDaysForStaff(requests, leaveTypes, "u-1", 2026, 4)).toEqual({
      paidLeaveDays: 2, // Apr 1–2 only
      unpaidLeaveDays: 2,
    });
  });

  it("sumApprovedRewardsForStaff includes APPROVED/PENDING only", () => {
    const ledger: StaffRewardLedgerEntry[] = [
      {
        id: "srl-1",
        staffId: "u-1",
        staffName: "A",
        branchId: "b-1",
        rewardType: "JOB_INCENTIVE",
        amount: 500,
        status: "APPROVED",
        periodMonth: 4,
        periodYear: 2026,
        createdAt: "2026-04-01T00:00:00.000Z",
        idempotencyKey: "k1",
      },
      {
        id: "srl-2",
        staffId: "u-1",
        staffName: "A",
        branchId: "b-1",
        rewardType: "MANUAL_CREDIT",
        amount: 200,
        status: "PENDING",
        periodMonth: 4,
        periodYear: 2026,
        createdAt: "2026-04-02T00:00:00.000Z",
        idempotencyKey: "k2",
      },
      {
        id: "srl-3",
        staffId: "u-1",
        staffName: "A",
        branchId: "b-1",
        rewardType: "MANUAL_CREDIT",
        amount: 100,
        status: "CANCELLED",
        periodMonth: 4,
        periodYear: 2026,
        createdAt: "2026-04-03T00:00:00.000Z",
        idempotencyKey: "k3",
      },
      {
        id: "srl-4",
        staffId: "u-1",
        staffName: "A",
        branchId: "b-1",
        rewardType: "JOB_INCENTIVE",
        amount: 50,
        status: "PAID_IN_PAYROLL",
        periodMonth: 4,
        periodYear: 2026,
        createdAt: "2026-04-04T00:00:00.000Z",
        idempotencyKey: "k4",
      },
      {
        id: "srl-5",
        staffId: "u-1",
        staffName: "A",
        branchId: "b-1",
        rewardType: "JOB_INCENTIVE",
        amount: 999,
        status: "APPROVED",
        periodMonth: 5,
        periodYear: 2026,
        createdAt: "2026-05-01T00:00:00.000Z",
        idempotencyKey: "k5",
      },
    ];
    expect(sumApprovedRewardsForStaff(ledger, "u-1", 2026, 4)).toEqual({
      amount: 700,
      refs: ["srl-1", "srl-2"],
    });
  });
});
