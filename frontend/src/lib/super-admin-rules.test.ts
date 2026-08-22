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

    // Setup a dummy salary structure for both
    usePayrollStore.setState({
      salaryStructures: [
        {
          id: "s-mech",
          role: "MECHANIC",
          experienceBand: "MID",
          components: { basic: 1000, hra: 0, da: 0, allowances: 0, deductions: 0 },
        },
        {
          id: "s-admin",
          role: "SUPER_ADMIN",
          experienceBand: "MID",
          components: { basic: 5000, hra: 0, da: 0, allowances: 0, deductions: 0 },
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
    // Manually inject a SUPER_ADMIN record (e.g. historical)
    usePayrollStore.setState({
      payrollRecords: [
        {
          id: "p-1",
          employeeId: "u-admin",
          periodYear: 2026,
          periodMonth: 8,
          status: "DRAFT",
          breakdown: { basic: 0, hra: 0, da: 0, allowances: 0, deductions: 0, attendanceDays: 0, paidLeaveDays: 0, unpaidLeaveDays: 0 },
          totals: { grossEarnings: 0, grossDeductions: 0, netSalary: 0 },
        } as any,
        {
          id: "p-2",
          employeeId: "u-mech",
          periodYear: 2026,
          periodMonth: 8,
          status: "DRAFT",
          breakdown: { basic: 0, hra: 0, da: 0, allowances: 0, deductions: 0, attendanceDays: 0, paidLeaveDays: 0, unpaidLeaveDays: 0 },
          totals: { grossEarnings: 0, grossDeductions: 0, netSalary: 0 },
        } as any,
      ],
    });

    usePayrollStore.getState().recalculateAll();

    const records = usePayrollStore.getState().payrollRecords;
    // SUPER_ADMIN record should be untouched (basic: 0)
    const adminRecord = records.find((r) => r.employeeId === "u-admin");
    expect(adminRecord?.totals.grossEarnings).toBe(0);

    // Mechanic record should be recalculated (basic: 1000)
    const mechRecord = records.find((r) => r.employeeId === "u-mech");
    expect(mechRecord?.totals.grossEarnings).toBeGreaterThan(0);
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
