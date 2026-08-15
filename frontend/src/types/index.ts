export type PlanCode = "STARTER" | "GROWTH" | "BUSINESS" | "ENTERPRISE" | "CUSTOM";

export type SubscriptionStatus = "ACTIVE" | "PAST_DUE" | "EXPIRED" | "CANCELLED";

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
  };
  usage: { branchesUsed: number };
  canCreateBranch: boolean;
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
