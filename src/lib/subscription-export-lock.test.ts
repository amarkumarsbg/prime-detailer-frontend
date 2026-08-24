import { describe, expect, it } from "vitest";
import {
  canExportData,
  daysUntilExpiry,
  graceOrLockStatus,
  isExportLocked,
  isExportLockedFromExpiry,
} from "./subscription-export-lock";
import type { OrganizationEntitlement } from "@/types";

function entitlement(partial: {
  expiresAt?: string | null;
  exportLocked?: boolean;
  canExportData?: boolean;
}): OrganizationEntitlement {
  return {
    organization: { id: "org-1", name: "Studio", slug: "studio" },
    subscription: {
      planCode: "STARTER",
      planName: "Starter",
      status: "ACTIVE",
      limits: { maxBranches: 1 },
      maxBranchesOverride: null,
      effectiveMaxBranches: 1,
      contactUsUrl: null,
      contactPhone: null,
      upgradeUrl: null,
      currentPeriodEnd: partial.expiresAt ?? null,
      expiresAt: partial.expiresAt ?? null,
      exportLocked: partial.exportLocked,
    },
    usage: { branchesUsed: 0 },
    canCreateBranch: true,
    canExportData: partial.canExportData,
  };
}

describe("subscription-export-lock", () => {
  it("computes lock window from expiry", () => {
    const now = new Date("2026-08-21T12:00:00.000Z");
    expect(daysUntilExpiry("2026-09-20T12:00:00.000Z", now)).toBe(30);
    expect(isExportLockedFromExpiry("2026-09-20T12:00:00.000Z", now)).toBe(true);
    expect(graceOrLockStatus("2026-09-21T12:00:00.000Z", now)).toBe("OK");
  });

  it("respects entitlement.exportLocked flag", () => {
    expect(isExportLocked(entitlement({ exportLocked: true }))).toBe(true);
    expect(canExportData(entitlement({ exportLocked: false, expiresAt: null }))).toBe(true);
  });

  it("falls back to canExportData when present", () => {
    expect(canExportData(entitlement({ canExportData: false }))).toBe(false);
    expect(canExportData(entitlement({ canExportData: true, exportLocked: false }))).toBe(true);
  });
});
