import type { UserRole } from "./auth";

export type PayrollRecordStatus = "PENDING" | "PROCESSING" | "PAID" | "CANCELLED";

export type SalaryAdvanceStatus =
  | "OPEN"
  | "PARTIALLY_RECOVERED"
  | "CLOSED"
  | "CANCELLED";

export type SalaryAdvanceRecoveryMode = "AUTO_PAYROLL" | "MANUAL";

export type SalaryAdvanceRecoveryState = "PLANNED" | "FINALIZED" | "REVERSED";

export interface SalaryAdvanceRecovery {
  id: string;
  advanceId: string;
  payrollRecordId: string;
  employeeId: string;
  periodMonth: number;
  periodYear: number;
  recoveredAmount: number;
  recoveredAt: string;
  mode: SalaryAdvanceRecoveryMode;
  state: SalaryAdvanceRecoveryState;
}

export interface SalaryAdvance {
  id: string;
  employeeId: string;
  employeeName: string;
  branchId: string;
  advanceAmount: number;
  advanceDate: string;
  monthlyDeductionAmount?: number;
  recoveredAmount: number;
  remainingAmount: number;
  status: SalaryAdvanceStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  cancelledAt?: string;
  cancelledReason?: string;
}

/** Experience band for salary structure tiers (role + band = pay rules). */
export type ExperienceBand = "ENTRY" | "MID" | "SENIOR" | "LEAD";

export interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  branchId: string;
  periodMonth: number;
  periodYear: number;
  attendanceDays: number;
  presencePayment: number;
  baseSalary: number;
  absenceDeduction: number;
  grossEarnings: number;
  totalDeductions: number;
  netSalaryBeforeAdvance: number;
  advanceDeductionPlanned: number;
  advanceDeductionFinalized: number;
  advanceOutstandingBefore: number;
  advanceOutstandingAfterPlanned: number;
  advanceOutstandingAfterFinalized: number;
  advanceRecoveryRefs: string[];
  netSalary: number;
  status: PayrollRecordStatus;
  salaryStructureId: string;
  createdAt: string;
  updatedAt: string;
  /** Approved paid leave days overlapping the payroll month. */
  paidLeaveDays?: number;
  /** Approved unpaid leave days overlapping the payroll month. */
  unpaidLeaveDays?: number;
  /** Sum of APPROVED/PENDING reward ledger amounts included in gross/net. */
  rewardAmount?: number;
  /** Ledger entry ids included in `rewardAmount`. */
  rewardLedgerRefs?: string[];
}

export interface SalaryStructure {
  id: string;
  role: UserRole;
  experienceBand: ExperienceBand;
  label: string;
  baseSalary: number;
  attendanceBonusPerDay: number;
  absenceDeductionPerDay: number;
}

export interface AttendanceRecord {
  id: string;
  staffId: string;
  staffName: string;
  staffRole: UserRole;
  branchId: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  durationMinutes?: number;
  status: "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY";
  qrScanned: boolean;
}

export type LeaveRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface LeaveType {
  id: string;
  name: string;
  /** When true, days count against annual entitlement. */
  paid: boolean;
  /** When false (e.g. unpaid leave), balance checks are skipped. */
  tracksBalance: boolean;
  defaultDaysPerYear: number;
  isActive: boolean;
}

export interface LeaveBalance {
  id: string;
  staffId: string;
  leaveTypeId: string;
  branchId: string;
  year: number;
  entitled: number;
  used: number;
  pending: number;
}

export interface LeaveRequest {
  id: string;
  staffId: string;
  staffName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  branchId: string;
  organizationId?: string;
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  status: LeaveRequestStatus;
  appliedAt: string;
  /** Approver / rejector / canceller user id when decided. */
  decidedById?: string;
  decidedByName?: string;
  decidedAt?: string;
  comments?: string;
}

/** Singleton `leaveConfig` document shape. */
export interface LeaveConfig {
  leaveTypes: LeaveType[];
  balances: LeaveBalance[];
}

/** Staff rewards — tiers, ledger, and targets. */

export type StaffRewardTier = "BRONZE" | "SILVER" | "GOLD" | "DIAMOND";

export type StaffRewardMode = "PERCENT_OF_JOB" | "FIXED_PER_JOB";

export type StaffRewardType =
  | "JOB_INCENTIVE"
  | "TIME_BONUS"
  | "LATE_DEDUCTION"
  | "MANUAL_CREDIT"
  | "MANUAL_DEBIT"
  | "TIER_BONUS";

export type StaffRewardLedgerStatus =
  | "PENDING"
  | "APPROVED"
  | "PAID_IN_PAYROLL"
  | "CANCELLED";

export type StaffTargetMetric = "JOBS_COMPLETED" | "REVENUE" | "INCENTIVE";

export interface StaffRewardTierRule {
  id: string;
  name: string;
  tier: StaffRewardTier;
  monthlyJobThreshold: number;
  percentBonus: number;
}

/** Singleton `staffRewardSettings` document shape. */
export interface StaffRewardSettings {
  rewardMode: StaffRewardMode;
  defaultPercent: number;
  defaultFixedAmount: number;
  tiersEnabled: boolean;
  tiers: StaffRewardTierRule[];
  timeBonusEnabled: boolean;
  timeBonusMinutesThreshold: number;
  timeBonusPercent: number;
  lateDeductionEnabled: boolean;
  lateDeductionPercent: number;
  supervisorSharePercent: number;
  applicatorSharePercent: number;
  updatedAt: string;
}

export interface StaffRewardLedgerEntry {
  id: string;
  staffId: string;
  staffName: string;
  branchId: string;
  jobCardId?: string;
  jobNumber?: string;
  rewardType: StaffRewardType;
  amount: number;
  status: StaffRewardLedgerStatus;
  periodMonth: number;
  periodYear: number;
  reason?: string;
  createdById?: string;
  createdByName?: string;
  createdAt: string;
  idempotencyKey: string;
}

export interface StaffTarget {
  id: string;
  staffId: string;
  staffName: string;
  branchId: string;
  periodMonth: number;
  periodYear: number;
  metric: StaffTargetMetric;
  targetValue: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
