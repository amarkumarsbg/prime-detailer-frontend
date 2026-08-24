import { describe, expect, it } from "vitest";
import {
  buildRecoveryPlan,
  computeBaseFromStructure,
  countAttendanceDaysForStaff,
  countLeaveDaysForStaff,
  monthDays,
  round2,
  sumApprovedRewardsForStaff,
  countWorkingDaysInRange,
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

  const testStructure = {
    ...structure,
    baseSalary: 20500,
    attendanceBonusPerDay: 0,
    absenceDeductionPerDay: 420,
  };

  it("1. Tracked + 0 attendance + 0 leave = ₹0 base", () => {
    const base = computeBaseFromStructure({
      structure: testStructure,
      paidAttendanceDays: 0,
      eligibleWorkingDays: 21,
      eligibleWorkingDaysInFullMonth: 21,
      isJoiningMonth: false,
      isTracked: true,
    });
    expect(base.baseSalary).toBe(0);
    expect(base.absenceDeduction).toBe(0);
    expect(base.netSalaryBeforeAdvance).toBe(0);
  });

  it("2. Tracked + 1 attendance = 1 daily wage", () => {
    const base = computeBaseFromStructure({
      structure: testStructure,
      paidAttendanceDays: 1,
      eligibleWorkingDays: 21,
      eligibleWorkingDaysInFullMonth: 21,
      isJoiningMonth: false,
      isTracked: true,
    });
    expect(base.baseSalary).toBe(round2(20500 / 21)); // 976.19
    expect(base.absenceDeduction).toBe(0);
  });

  it("3. Tracked + 10 attendance = 10 daily wages", () => {
    const base = computeBaseFromStructure({
      structure: testStructure,
      paidAttendanceDays: 10,
      eligibleWorkingDays: 21,
      eligibleWorkingDaysInFullMonth: 21,
      isJoiningMonth: false,
      isTracked: true,
    });
    expect(base.baseSalary).toBe(round2((20500 / 21) * 10)); // 9761.90
    expect(base.absenceDeduction).toBe(0);
  });

  it("4. Tracked + 10 attendance + 2 paid leave = 12 daily wages", () => {
    const base = computeBaseFromStructure({
      structure: testStructure,
      paidAttendanceDays: 12, // 10 actual + 2 paid leave (handled upstream)
      eligibleWorkingDays: 21,
      eligibleWorkingDaysInFullMonth: 21,
      isJoiningMonth: false,
      isTracked: true,
    });
    expect(base.baseSalary).toBe(round2((20500 / 21) * 12));
  });

  it("5. Tracked + unpaid leave = unpaid days not paid", () => {
    // Unpaid leave doesn't add to paidAttendanceDays
    const base = computeBaseFromStructure({
      structure: testStructure,
      paidAttendanceDays: 10, 
      eligibleWorkingDays: 19, // 21 - 2 unpaid leaves
      eligibleWorkingDaysInFullMonth: 21,
      isJoiningMonth: false,
      isTracked: true,
    });
    expect(base.baseSalary).toBe(round2((20500 / 21) * 10)); // exactly 10 days
  });

  it("6. Untracked + no attendance = eligible working days paid", () => {
    const base = computeBaseFromStructure({
      structure: testStructure,
      paidAttendanceDays: 0,
      eligibleWorkingDays: 21,
      eligibleWorkingDaysInFullMonth: 21,
      isJoiningMonth: false,
      isTracked: false,
    });
    expect(base.baseSalary).toBe(20500); // full eligible days
    expect(base.absenceDeduction).toBe(0);
  });

  it("7. Joining mid-month + tracked + 0 attendance = ₹0", () => {
    const base = computeBaseFromStructure({
      structure: testStructure,
      paidAttendanceDays: 0,
      eligibleWorkingDays: 11, // mid-month
      eligibleWorkingDaysInFullMonth: 21,
      isJoiningMonth: true,
      isTracked: true,
    });
    expect(base.baseSalary).toBe(0);
  });

  it("8. Joining mid-month + untracked = prorated eligible salary", () => {
    const base = computeBaseFromStructure({
      structure: testStructure,
      paidAttendanceDays: 0,
      eligibleWorkingDays: 11,
      eligibleWorkingDaysInFullMonth: 21,
      isJoiningMonth: true,
      isTracked: false,
    });
    expect(base.baseSalary).toBe(round2((20500 / 21) * 11));
  });

  it("9. Absence deduction must always remain ₹0", () => {
    const base1 = computeBaseFromStructure({
      structure: testStructure,
      paidAttendanceDays: 5,
      eligibleWorkingDays: 21,
      eligibleWorkingDaysInFullMonth: 21,
      isJoiningMonth: false,
      isTracked: true,
    });
    const base2 = computeBaseFromStructure({
      structure: testStructure,
      paidAttendanceDays: 0,
      eligibleWorkingDays: 21,
      eligibleWorkingDaysInFullMonth: 21,
      isJoiningMonth: false,
      isTracked: false,
    });
    expect(base1.absenceDeduction).toBe(0);
    expect(base2.absenceDeduction).toBe(0);
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

  describe("joining date and proration scenarios", () => {
    const testStructure = {
      id: "ss-test",
      role: "MECHANIC",
      experienceBand: "MID",
      label: "Test Mechanic",
      baseSalary: 30000,
      attendanceBonusPerDay: 100,
      absenceDeductionPerDay: 1000,
    } as SalaryStructure;

    it("handles joining on the 1st of the month (full month)", () => {
      const base = computeBaseFromStructure({
        structure: testStructure,
        paidAttendanceDays: 22,
        eligibleWorkingDays: 22,
        eligibleWorkingDaysInFullMonth: 22,
        isJoiningMonth: true,
      });
      expect(base.baseSalary).toBe(30000);
      expect(base.absenceDeduction).toBe(0);
      expect(base.grossEarnings).toBe(32200); // 30000 + 22 * 100
    });

    it("handles joining mid-month with proration", () => {
      // Joining on 15th of November 2026. November has 30 days.
      // Working days in November 2026 = 22.
      // Working days from 15th to 30th = 11 working days.
      const base = computeBaseFromStructure({
        structure: testStructure,
        paidAttendanceDays: 10,
        eligibleWorkingDays: 11,
        eligibleWorkingDaysInFullMonth: 22,
        isJoiningMonth: true,
        isTracked: true,
      });
      // Prorated daily base = 30000 / 22 = 1363.64. Earned = 1363.64 * 10 days = 13636.36
      expect(base.baseSalary).toBe(13636.36);
      expect(base.absenceDeduction).toBe(0);
      expect(base.presencePayment).toBe(1000); // 10 * 100
      expect(base.grossEarnings).toBe(14636.36); // 13636.36 + 1000
      expect(base.netSalaryBeforeAdvance).toBe(14636.36);
    });

    it("handles joining on last working day", () => {
      const base = computeBaseFromStructure({
        structure: testStructure,
        paidAttendanceDays: 1,
        eligibleWorkingDays: 1,
        eligibleWorkingDaysInFullMonth: 22,
        isJoiningMonth: true,
        isTracked: true,
      });
      // Prorated base = 30000 / 22 * 1 = 1363.64
      expect(base.baseSalary).toBe(1363.64);
      expect(base.absenceDeduction).toBe(0);
      expect(base.presencePayment).toBe(100);
    });

    it("ignores activities before joiningDate", () => {
      const records: AttendanceRecord[] = [
        {
          id: "att-before",
          staffId: "u-1",
          staffName: "A",
          staffRole: "MECHANIC",
          branchId: "b-1",
          date: "2026-11-10",
          status: "PRESENT",
          qrScanned: false,
        },
        {
          id: "att-after",
          staffId: "u-1",
          staffName: "A",
          staffRole: "MECHANIC",
          branchId: "b-1",
          date: "2026-11-16",
          status: "PRESENT",
          qrScanned: false,
        },
      ];
      // Joined on 2026-11-15, should ignore att-before (10th) and count only att-after (16th)
      const count = countAttendanceDaysForStaff(records, "u-1", 2026, 11, "2026-11-15");
      expect(count).toBe(1);
    });

    it("ignores leave days before joiningDate", () => {
      const leaveTypes: LeaveType[] = [
        { id: "lt-paid", name: "Casual", paid: true, tracksBalance: true, defaultDaysPerYear: 12, isActive: true }
      ];
      const requests: LeaveRequest[] = [
        {
          id: "lr-before",
          staffId: "u-1",
          staffName: "A",
          leaveTypeId: "lt-paid",
          leaveTypeName: "Casual",
          branchId: "b-1",
          fromDate: "2026-11-05",
          toDate: "2026-11-07",
          days: 3,
          reason: "personal",
          status: "APPROVED",
          appliedAt: "2026-11-01T00:00:00.000Z",
        },
        {
          id: "lr-after",
          staffId: "u-1",
          staffName: "A",
          leaveTypeId: "lt-paid",
          leaveTypeName: "Casual",
          branchId: "b-1",
          fromDate: "2026-11-18",
          toDate: "2026-11-18",
          days: 1,
          reason: "trip",
          status: "APPROVED",
          appliedAt: "2026-11-10T00:00:00.000Z",
        }
      ];
      // Joined on 2026-11-15, should ignore lr-before
      const counts = countLeaveDaysForStaff(requests, leaveTypes, "u-1", 2026, 11, "2026-11-15");
      expect(counts.paidLeaveDays).toBe(1);
    });

    it("ignores rewards created before joiningDate", () => {
      const ledger: StaffRewardLedgerEntry[] = [
        {
          id: "srl-before",
          staffId: "u-1",
          staffName: "A",
          branchId: "b-1",
          rewardType: "JOB_INCENTIVE",
          amount: 500,
          status: "APPROVED",
          periodMonth: 11,
          periodYear: 2026,
          createdAt: "2026-11-10T00:00:00.000Z",
          idempotencyKey: "k1",
        },
        {
          id: "srl-after",
          staffId: "u-1",
          staffName: "A",
          branchId: "b-1",
          rewardType: "JOB_INCENTIVE",
          amount: 1000,
          status: "APPROVED",
          periodMonth: 11,
          periodYear: 2026,
          createdAt: "2026-11-20T00:00:00.000Z",
          idempotencyKey: "k2",
        }
      ];
      // Joined on 2026-11-15, should ignore srl-before
      const rewards = sumApprovedRewardsForStaff(ledger, "u-1", 2026, 11, "2026-11-15");
      expect(rewards.amount).toBe(1000);
      expect(rewards.refs).toEqual(["srl-after"]);
    });

    it("calculates correct working days excluding weekends", () => {
      // Nov 15, 2026 to Nov 30, 2026.
      // 15 is Sun (excluded)
      // 16-20 Mon-Fri (5 days)
      // 21-22 Sat-Sun (excluded)
      // 23-27 Mon-Fri (5 days)
      // 28-29 Sat-Sun (excluded)
      // 30 Mon (1 day)
      // Total = 11 working days.
      const workingDays = countWorkingDaysInRange(new Date("2026-11-15"), new Date("2026-11-30"));
      expect(workingDays).toBe(11);
    });

    it("verifies the exact user example scenario", () => {
      // Monthly salary = ₹30,000
      // Full-month working days = 26
      // Joining date = 15th
      // Eligible working days = 12 (as specified in sample)
      // Present = 10, Paid Leave = 1, Absent = 1
      // Attendance bonus = ₹100/day
      // Absence deduction = ₹1,000/day
      // Incentive = ₹2,000
      // Advance = ₹5,000, Recovery Cap = ₹1,000
      
      const testSc = {
        id: "ss-sc",
        role: "MECHANIC",
        experienceBand: "MID",
        label: "Sample",
        baseSalary: 30000,
        attendanceBonusPerDay: 100,
        absenceDeductionPerDay: 1000,
      } as SalaryStructure;

      const paidAttendanceDays = 10 + 1; // Present + Paid Leave
      const base = computeBaseFromStructure({
        structure: testSc,
        paidAttendanceDays,
        eligibleWorkingDays: 12,
        eligibleWorkingDaysInFullMonth: 26,
        isJoiningMonth: true,
        isTracked: true,
      });

      // Earned base salary = (30,000 / 26) * 11 days = 12692.31
      expect(base.baseSalary).toBe(12692.31);
      // Attendance bonus = 11 * 100 = 1100
      expect(base.presencePayment).toBe(1100);
      // Absence deduction = 0
      expect(base.absenceDeduction).toBe(0);
      // Gross earnings = 12692.31 + 1100 = 13792.31
      expect(base.grossEarnings).toBe(13792.31);
      
      // With Incentive = gross + 2000 = 15792.31
      const netSalaryBeforeAdvance = base.netSalaryBeforeAdvance + 2000;
      expect(netSalaryBeforeAdvance).toBe(15792.31);

      // Recovery Cap = 1000, remaining = 5000, netSalary = 15946.15
      const advances: SalaryAdvance[] = [
        {
          id: "sa-test",
          employeeId: "u-test",
          employeeName: "Tester",
          branchId: "b-1",
          advanceAmount: 5000,
          advanceDate: "2026-11-15",
          status: "OPEN",
          recoveredAmount: 0,
          remainingAmount: 5000,
          monthlyDeductionAmount: 1000,
          createdAt: "2026-11-15T00:00:00.000Z",
          updatedAt: "2026-11-15T00:00:00.000Z",
        }
      ];
      const recoveries: SalaryAdvanceRecovery[] = [];
      const plan = buildRecoveryPlan({
        employeeId: "u-test",
        payrollRecordId: "pr-test",
        periodMonth: 11,
        periodYear: 2026,
        netSalaryBeforeAdvance,
        advances,
        recoveries,
      });

      expect(plan.deductionPlanned).toBe(1000);
      expect(plan.outstandingAfterPlanned).toBe(4000);

      // Payable salary = 15792.31 - 1000 = 14792.31
      const payableSalary = netSalaryBeforeAdvance - plan.deductionPlanned;
      expect(payableSalary).toBe(14792.31);
    });
  });
});
