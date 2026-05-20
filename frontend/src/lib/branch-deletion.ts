import type {
  AttendanceRecord,
  Expense,
  JobCard,
  PayrollRecord,
  PickupDropRequest,
  User,
} from "@/types";

export type BranchDeletionBlocker = {
  kind:
    | "employees"
    | "job_cards"
    | "expenses"
    | "pickup_drop"
    | "payroll"
    | "attendance"
    | "last_branch";
  count: number;
  message: string;
};

export interface BranchDeletionContext {
  staff: User[];
  jobCards: JobCard[];
  expenses: Expense[];
  pickupDropRequests: PickupDropRequest[];
  payrollRecords: PayrollRecord[];
  attendanceRecords: AttendanceRecord[];
  totalBranches: number;
}

export function getBranchDeletionBlockers(
  branchId: string,
  ctx: BranchDeletionContext
): BranchDeletionBlocker[] {
  const blockers: BranchDeletionBlocker[] = [];

  if (ctx.totalBranches <= 1) {
    blockers.push({
      kind: "last_branch",
      count: 1,
      message: "Cannot delete the only remaining site.",
    });
  }

  const employeeCount = ctx.staff.filter((s) => s.branchId === branchId).length;
  if (employeeCount > 0) {
    blockers.push({
      kind: "employees",
      count: employeeCount,
      message: `${employeeCount} employee${employeeCount === 1 ? "" : "s"} assigned to this site`,
    });
  }

  const jobCardCount = ctx.jobCards.filter((j) => j.branchId === branchId).length;
  if (jobCardCount > 0) {
    blockers.push({
      kind: "job_cards",
      count: jobCardCount,
      message: `${jobCardCount} job card${jobCardCount === 1 ? "" : "s"} linked to this site`,
    });
  }

  const expenseCount = ctx.expenses.filter((e) => e.branchId === branchId).length;
  if (expenseCount > 0) {
    blockers.push({
      kind: "expenses",
      count: expenseCount,
      message: `${expenseCount} expense${expenseCount === 1 ? "" : "s"} linked to this site`,
    });
  }

  const pickupCount = ctx.pickupDropRequests.filter((r) => r.branchId === branchId).length;
  if (pickupCount > 0) {
    blockers.push({
      kind: "pickup_drop",
      count: pickupCount,
      message: `${pickupCount} pickup/drop request${pickupCount === 1 ? "" : "s"} linked to this site`,
    });
  }

  const payrollCount = ctx.payrollRecords.filter((r) => r.branchId === branchId).length;
  if (payrollCount > 0) {
    blockers.push({
      kind: "payroll",
      count: payrollCount,
      message: `${payrollCount} payroll record${payrollCount === 1 ? "" : "s"} linked to this site`,
    });
  }

  const attendanceCount = ctx.attendanceRecords.filter((r) => r.branchId === branchId).length;
  if (attendanceCount > 0) {
    blockers.push({
      kind: "attendance",
      count: attendanceCount,
      message: `${attendanceCount} attendance record${attendanceCount === 1 ? "" : "s"} linked to this site`,
    });
  }

  return blockers;
}

export function canDeleteBranch(branchId: string, ctx: BranchDeletionContext): boolean {
  return getBranchDeletionBlockers(branchId, ctx).length === 0;
}
