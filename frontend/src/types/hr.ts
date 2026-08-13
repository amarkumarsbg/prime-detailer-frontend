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
