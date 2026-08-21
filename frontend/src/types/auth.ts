/** Org-level super user: full access including branch CRUD. */
export type UserRole =
  | "PLATFORM_OWNER"
  | "SUPER_ADMIN"
  | "ADMIN"
  | "BRANCH_MANAGER"
  | "MANAGER"
  | "SUPERVISOR"
  | "RECEPTIONIST"
  | "MECHANIC";

export interface Branch {
  id: string;
  name: string;
  /** Street / building line */
  address: string;
  phone: string;
  isActive: boolean;
  qrCodeId?: string;
  /** Short reference label (invoices, badges) */
  code?: string;
  city?: string;
  state?: string;
  pincode?: string;
  email?: string;
  managerName?: string;
  managerPhone?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  branchId: string;
  avatar?: string;
  isActive: boolean;
  /** Demo flag for directory / “verified email” stats */
  emailVerified?: boolean;
  /** Demo-only attendance PIN; production should store hashes and verify via API */
  attendancePin?: string;
  totalJobsCompleted?: number;
  totalIncentiveEarned?: number;
  /** Unique staff employee code (optional; unique when set). */
  employeeCode?: string;
  /** Job title — distinct from role. */
  designation?: string;
  department?: string;
  /** Employment start date yyyy-mm-dd (separate from birthday and anniversary). */
  joiningDate?: string;
  /** ISO date yyyy-mm-dd */
  birthday?: string;
  /** Work anniversary yyyy-mm-dd (not joining date). */
  anniversary?: string;
  notes?: string;
  /** Server sets true until the user completes an authenticated password change (onboarding). */
  mustChangePassword?: boolean;
  /** ISO timestamp when login password was last changed (server audit). */
  passwordUpdatedAt?: string;
  /** Staff user id who provisioned this account password (server audit). */
  passwordCreatedBy?: string;
  permissions?: string[];
}
