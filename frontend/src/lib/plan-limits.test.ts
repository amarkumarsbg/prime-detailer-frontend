import { describe, expect, it } from "vitest";
import {
  branchLimitLabel,
  canCreateBranchFromEntitlement,
  canExportDataFromEntitlement,
  isAtOrOverBranchLimit,
  isUnlimitedBranches,
} from "./plan-limits";
import type { OrganizationEntitlement } from "@/types";

function entitlement(
  partial: Partial<OrganizationEntitlement> & {
    max?: number | null;
    used?: number;
    canCreate?: boolean;
    exportLocked?: boolean;
  }
): OrganizationEntitlement {
  const max = partial.max === undefined ? 1 : partial.max;
  const used = partial.used ?? 0;
  const exportLocked = partial.exportLocked ?? false;
  return {
    organization: { id: "org-1", name: "Studio", slug: "studio" },
    subscription: {
      planCode: "STARTER",
      planName: "Starter",
      status: "ACTIVE",
      limits: { maxBranches: max },
      maxBranchesOverride: null,
      effectiveMaxBranches: max,
      contactUsUrl: null,
      contactPhone: null,
      upgradeUrl: null,
      currentPeriodEnd: null,
      expiresAt: null,
      exportLocked,
    },
    usage: { branchesUsed: used },
    canCreateBranch: partial.canCreate ?? (max === null || used < max),
    canExportData: !exportLocked,
    ...partial,
  };
}

describe("plan-limits", () => {
  it("treats null as unlimited", () => {
    expect(isUnlimitedBranches(null)).toBe(true);
    expect(branchLimitLabel(null)).toBe("Unlimited");
  });

  it("blocks create at limit", () => {
    const e = entitlement({ used: 2, max: 2 });
    expect(canCreateBranchFromEntitlement(e)).toBe(false);
    expect(isAtOrOverBranchLimit(e)).toBe(true);
  });

  it("allows create under limit", () => {
    const e = entitlement({ used: 1, max: 2, canCreate: true });
    expect(canCreateBranchFromEntitlement(e)).toBe(true);
    expect(isAtOrOverBranchLimit(e)).toBe(false);
  });

  it("allows create when unlimited", () => {
    const e = entitlement({ used: 99, max: null, canCreate: true });
    expect(canCreateBranchFromEntitlement(e)).toBe(true);
    expect(isAtOrOverBranchLimit(e)).toBe(false);
  });

  it("fails closed when entitlement missing", () => {
    expect(canCreateBranchFromEntitlement(null)).toBe(false);
    expect(isAtOrOverBranchLimit(null)).toBe(true);
  });

  it("gates exports from entitlement", () => {
    expect(canExportDataFromEntitlement(entitlement({ exportLocked: false }))).toBe(true);
    expect(canExportDataFromEntitlement(entitlement({ exportLocked: true }))).toBe(false);
  });
});
