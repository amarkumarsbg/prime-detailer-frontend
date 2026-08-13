/** Org-level super user: full access including branch CRUD. */
export type UserRole =
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
  /** ISO date yyyy-mm-dd (demo / HR fields) */
  birthday?: string;
  /** Employment start or work anniversary, ISO yyyy-mm-dd */
  anniversary?: string;
  /** Server sets true until the user completes an authenticated password change (onboarding). */
  mustChangePassword?: boolean;
  /** ISO timestamp when login password was last changed (server audit). */
  passwordUpdatedAt?: string;
  /** Staff user id who provisioned this account password (server audit). */
  passwordCreatedBy?: string;
  permissions?: string[];
}
