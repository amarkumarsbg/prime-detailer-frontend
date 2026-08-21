export type PlanCode = "STARTER" | "GROWTH" | "BUSINESS" | "ENTERPRISE" | "CUSTOM";

export type SubscriptionStatus = "ACTIVE" | "PAST_DUE" | "EXPIRED" | "CANCELLED";

export type SubscriptionPaymentStatus = "PAID" | "PENDING" | "PROCESSING" | "FAILED";

export type GraceOrLockStatus = "OK" | "EXPORT_LOCKED" | "EXPIRED";

export type PlanLimits = {
  maxBranches: number | null;
  maxStaff?: number | null;
  maxCustomers?: number | null;
};

export type OrganizationEntitlement = {
  organization: { id: string; name: string; slug: string | null };
  subscription: {
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
    termMonths?: number;
    startsAt?: string | null;
    expiresAt?: string | null;
    paymentStatus?: SubscriptionPaymentStatus;
    lastPaymentTxnId?: string | null;
    daysRemaining?: number | null;
    graceOrLock?: GraceOrLockStatus;
    exportLocked?: boolean;
  };
  usage: { branchesUsed: number; usersUsed?: number };
  canCreateBranch: boolean;
  canExportData?: boolean;
};

export type SubscriptionPaymentRow = {
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
};

export type SubscriptionBillRow = {
  id: string;
  billNumber: string;
  planName: string;
  termMonths: number;
  termLabel: string;
  periodStart: string;
  periodEnd: string;
  amount: number | null;
  currency: string;
  createdAt: string;
  organizationName?: string;
};

export * from "./auth";
export * from "./customer";
export * from "./vehicle";
export * from "./service";
export * from "./job-card";
export * from "./billing";
export * from "./appointment";
export * from "./inventory";
export * from "./expense";
export * from "./hr";
export * from "./ops";
export * from "./activity";
export * from "./dashboard";
export * from "./party";
