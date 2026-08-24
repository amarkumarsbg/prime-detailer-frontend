// ─── Auth ────────────────────────────────────────────────────────────────────

export type UserRole =
  | "PLATFORM_OWNER"
  | "SUPER_ADMIN"
  | "ADMIN"
  | "BRANCH_MANAGER"
  | "MANAGER"
  | "SUPERVISOR"
  | "RECEPTIONIST"
  | "MECHANIC";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organizationId: string | null;
  branchId: string | null;
  mustChangePassword?: boolean;
}

export interface AuthSession {
  accessToken: string;
  user: AdminUser;
}

// ─── Subscription Enums ──────────────────────────────────────────────────────

export type PlanCode = "STARTER" | "GROWTH" | "BUSINESS" | "ENTERPRISE" | "CUSTOM";

export type SubscriptionStatus = "ACTIVE" | "PAST_DUE" | "EXPIRED" | "CANCELLED";

export type SubscriptionPaymentStatus = "PAID" | "PENDING" | "PROCESSING" | "FAILED";

export type GraceOrLockStatus = "OK" | "GRACE" | "LOCKED" | "SUSPENDED";

// ─── Entitlement ─────────────────────────────────────────────────────────────

export interface PlanLimits {
  maxBranches: number | null;
  maxStaff?: number | null;
  maxCustomers?: number | null;
}

export interface SubscriptionInfo {
  planCode: PlanCode;
  planName: string;
  status: SubscriptionStatus;
  limits: PlanLimits;
  maxBranchesOverride: number | null;
  effectiveMaxBranches: number | null;
  contactUsUrl: string | null;
  contactPhone: string | null;
  upgradeUrl: string | null;
  currentPeriodEnd: string | null;
  termMonths: number;
  startsAt: string | null;
  expiresAt: string | null;
  paymentStatus: SubscriptionPaymentStatus;
  lastPaymentTxnId: string | null;
  daysRemaining: number | null;
  graceOrLock: GraceOrLockStatus;
  exportLocked: boolean;
}

export interface UsageInfo {
  branchesUsed: number;
  usersUsed: number;
}

export interface EntitlementPayload {
  organization: {
    id: string;
    name: string;
    slug: string | null;
    isActive?: boolean;
  };
  subscription: SubscriptionInfo;
  usage: UsageInfo;
}

// ─── Platform Org List ───────────────────────────────────────────────────────

export interface OrgListItem extends EntitlementPayload {
  organization: {
    id: string;
    name: string;
    slug: string | null;
    isActive?: boolean;
    activatedAt?: string | null;
    ownerName?: string | null;
    ownerEmail?: string | null;
  };
}

// ─── Platform Org Detail ─────────────────────────────────────────────────────

export interface OrgDetail extends EntitlementPayload {
  payments: SubscriptionPaymentRow[];
  bills: SubscriptionBillRow[];
}

// ─── Payments ────────────────────────────────────────────────────────────────

export interface SubscriptionPaymentRow {
  id: string;
  amount: number | null;
  currency: string;
  status: SubscriptionPaymentStatus;
  txnReference: string | null;
  method: string | null;
  notes: string | null;
  recordedBy: string | null;
  verifiedAt: string | null;
  createdAt: string;
}

// ─── Bills ───────────────────────────────────────────────────────────────────

export interface SubscriptionBillRow {
  id: string;
  billNumber: string;
  planName: string;
  termMonths: number;
  termLabel: string;
  periodStart: string;
  periodEnd: string;
  baseAmount: number;
  extraBranchCost: number;
  extraUserCost: number;
  onboardingFee: number;
  referralDiscount: number;
  gstPercent: number;
  gstAmount: number;
  paymentStatus: SubscriptionPaymentStatus | null;
  txnReference: string | null;
  amount: number | null;
  totalAmount: number;
  currency: string;
  createdAt: string;
}

// ─── Renewals ────────────────────────────────────────────────────────────────

export interface SubscriptionRenewalHistoryRow {
  billId: string;
  billNumber: string;
  previousExpiry: string;
  newExpiry: string;
  termMonths: number;
  termLabel: string;
  amount: number;
  gstAmount: number;
  paymentStatus: SubscriptionPaymentStatus | null;
  txnReference: string | null;
  renewalDate: string;
}

// ─── Pricing ─────────────────────────────────────────────────────────────────

export interface PricingBreakdown {
  planCode: PlanCode;
  planName: string;
  termMonths: number;
  termLabel: string;
  extraBranches: number;
  extraUsers: number;
  baseAmount: number;
  extraBranchCost: number;
  extraUserCost: number;
  onboardingFee: number;
  onboardingApplied: boolean;
  referralCode: string | null;
  referralDiscount: number;
  referralApplied: boolean;
  referralEligible: boolean;
  referralValidationMessage: string | null;
  gstPercent: number;
  gstAmount: number;
  subTotalBeforeTax: number;
  finalAmount: number;
  includedBranches: number | null;
  includedUsers: number | null;
  finalAllowedBranches: number | null;
  finalAllowedUsers: number | null;
  currency: string;
  isFirstSubscription: boolean;
}

export interface PricingQuote {
  breakdown: PricingBreakdown;
}

// ─── Patch Subscription Input ────────────────────────────────────────────────

export interface PatchSubscriptionInput {
  planCode?: PlanCode;
  planName?: string;
  status?: SubscriptionStatus;
  limits?: Partial<PlanLimits>;
  maxBranchesOverride?: number | null;
  contactUsUrl?: string | null;
  contactPhone?: string | null;
  upgradeUrl?: string | null;
  notes?: string | null;
}

// ─── API Envelope ─────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  error: { message: string; code?: string } | null;
}
