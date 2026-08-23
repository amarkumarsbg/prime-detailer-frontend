import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePayrollStore } from "@/store/payroll-store";
import { useStaffRewardStore } from "@/store/staff-reward-store";
import { useStaffStore } from "@/store/staff-store";
import type { User, JobRewardInput } from "@/types";

describe("SUPER_ADMIN exclusion rules", () => {
  beforeEach(() => {
    vi.resetModules();
    usePayrollStore.setState({ payrollRecords: [], salaryAdvances: [], salaryAdvanceRecoveries: [], salaryStructures: [] });
    useStaffRewardStore.setState({ ledger: [], targets: [] });
    
    // Mock 2 users: one mechanic, one SUPER_ADMIN
    const mockStaff: User[] = [
      {
        id: "u-mech",
        name: "Mechanic Bob",
        role: "MECHANIC",
        branchId: "b-1",
        isActive: true,
        email: "mech@example.com",
      } as User,
      {
        id: "u-admin",
        name: "Super Admin",
        role: "SUPER_ADMIN",
        branchId: "b-1",
        isActive: true,
        email: "super@example.com",
      } as User,
    ];
    useStaffStore.setState({ staff: mockStaff });

    // Setup salary structures using the correct SalaryStructure shape
    // (baseSalary / attendanceBonusPerDay / absenceDeductionPerDay — no "components" wrapper)
    usePayrollStore.setState({
      salaryStructures: [
        {
          id: "s-mech",
          role: "MECHANIC",
          experienceBand: "MID",
          label: "Mechanic Mid",
          baseSalary: 1000,
          attendanceBonusPerDay: 0,
          absenceDeductionPerDay: 0,
        },
        {
          id: "s-admin",
          role: "SUPER_ADMIN",
          experienceBand: "MID",
          label: "Super Admin Mid",
          baseSalary: 5000,
          attendanceBonusPerDay: 0,
          absenceDeductionPerDay: 0,
        },
      ],
    });
  });

  it("generatePayroll excludes SUPER_ADMIN", () => {
    const staff = useStaffStore.getState().staff;
    const count = usePayrollStore.getState().generatePayroll({
      year: 2026,
      month: 8,
      staff,
      attendanceRecords: [],
      leaveRequests: [],
      leaveTypes: [],
      rewardLedger: [],
    });

    // Only 1 record should be generated (for the mechanic)
    expect(count).toBe(1);
    const records = usePayrollStore.getState().payrollRecords;
    expect(records.length).toBe(1);
    expect(records[0].employeeId).toBe("u-mech");
  });

  it("recalculateAll skips SUPER_ADMIN records if they exist", () => {
    const now = new Date().toISOString();
    // Manually inject a SUPER_ADMIN record (e.g. historical).
    // Records must use the flat PayrollRecord shape (no "breakdown"/"totals" wrappers).
    // The mechanic is set isAttendanceTracked:false so recalculation yields baseSalary
    // without needing attendance rows — simpler and sufficient for this test.
    useStaffStore.setState({
      staff: [
        {
          id: "u-mech",
          name: "Mechanic Bob",
          role: "MECHANIC",
          branchId: "b-1",
          isActive: true,
          isAttendanceTracked: false,
          email: "mech@example.com",
          organizationId: "org-1",
          phone: "9000000000",
          permissions: [],
        } as any,
        {
          id: "u-admin",
          name: "Super Admin",
          role: "SUPER_ADMIN",
          branchId: "b-1",
          isActive: true,
          isAttendanceTracked: false,
          email: "super@example.com",
          organizationId: "org-1",
          phone: "9000000001",
          permissions: [],
        } as any,
      ],
    });

    usePayrollStore.setState({
      payrollRecords: [
        {
          id: "p-1",
          employeeId: "u-admin",
          salaryStructureId: "s-admin",
          periodYear: 2026,
          periodMonth: 8,
          status: "PENDING",
          attendanceDays: 0,
          paidLeaveDays: 0,
          unpaidLeaveDays: 0,
          presencePayment: 0,
          baseSalary: 0,
          absenceDeduction: 0,
          grossEarnings: 0,
          totalDeductions: 0,
          netSalaryBeforeAdvance: 0,
          advanceDeductionPlanned: 0,
          advanceDeductionFinalized: 0,
          advanceOutstandingBefore: 0,
          advanceOutstandingAfterPlanned: 0,
          advanceOutstandingAfterFinalized: 0,
          advanceRecoveryRefs: [],
          netSalary: 0,
          createdAt: now,
          updatedAt: now,
        } as any,
        {
          id: "p-2",
          employeeId: "u-mech",
          salaryStructureId: "s-mech",
          periodYear: 2026,
          periodMonth: 8,
          status: "PENDING",
          attendanceDays: 0,
          paidLeaveDays: 0,
          unpaidLeaveDays: 0,
          presencePayment: 0,
          baseSalary: 0,
          absenceDeduction: 0,
          grossEarnings: 0,
          totalDeductions: 0,
          netSalaryBeforeAdvance: 0,
          advanceDeductionPlanned: 0,
          advanceDeductionFinalized: 0,
          advanceOutstandingBefore: 0,
          advanceOutstandingAfterPlanned: 0,
          advanceOutstandingAfterFinalized: 0,
          advanceRecoveryRefs: [],
          netSalary: 0,
          createdAt: now,
          updatedAt: now,
        } as any,
      ],
    });

    usePayrollStore.getState().recalculateAll();

    const records = usePayrollStore.getState().payrollRecords;
    // SUPER_ADMIN record must NOT be recalculated — grossEarnings stays 0
    const adminRecord = records.find((r) => r.employeeId === "u-admin");
    expect(adminRecord?.grossEarnings).toBe(0);

    // Mechanic record MUST be recalculated — isAttendanceTracked:false gives full baseSalary
    const mechRecord = records.find((r) => r.employeeId === "u-mech");
    expect(mechRecord?.grossEarnings).toBeGreaterThan(0);
  });

  it("recordJobDeliveryRewards skips SUPER_ADMIN mechanics", () => {
    useStaffRewardStore.setState({
      settings: {
        rewardMode: "FIXED_PER_JOB",
        defaultFixedAmount: 100,
        defaultPercent: 10,
        supervisorSharePercent: 0,
        applicatorSharePercent: 100,
      } as any,
    });

    const jobForAdmin: JobRewardInput = {
      id: "j-1",
      jobNumber: "J-001",
      mechanicId: "u-admin",
      branchId: "b-1",
      estimatedAmount: 500,
      incentivePercent: 0,
      incentiveAmount: 0,
    };

    const { added: added1 } = useStaffRewardStore.getState().recordJobDeliveryRewards(jobForAdmin);
    expect(added1.length).toBe(0);

    const jobForMech: JobRewardInput = {
      id: "j-2",
      jobNumber: "J-002",
      mechanicId: "u-mech",
      branchId: "b-1",
      estimatedAmount: 500,
      incentivePercent: 0,
      incentiveAmount: 0,
    };

    const { added: added2 } = useStaffRewardStore.getState().recordJobDeliveryRewards(jobForMech);
    expect(added2.length).toBeGreaterThan(0);
    expect(added2[0].staffId).toBe("u-mech");
  });
});
