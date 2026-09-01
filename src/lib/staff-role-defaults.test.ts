import { describe, expect, it } from "vitest";
import { buildInitialPermissions, getDefaultModuleKeysForRole } from "@/lib/staff-role-defaults";

describe("staff-role-defaults", () => {
  it("returns no module keys for admin roles", () => {
    expect(getDefaultModuleKeysForRole("ADMIN")).toEqual([]);
    expect(getDefaultModuleKeysForRole("SUPER_ADMIN")).toEqual([]);
  });

  it("grants mechanic workshop modules", () => {
    expect(getDefaultModuleKeysForRole("MECHANIC")).toContain("JOB_CARDS");
    expect(getDefaultModuleKeysForRole("MECHANIC")).toContain("CUSTOMERS");
  });

  it("supervisor extends receptionist with job-card ops and HR modules", () => {
    const receptionist = getDefaultModuleKeysForRole("RECEPTIONIST");
    const supervisor = getDefaultModuleKeysForRole("SUPERVISOR");
    for (const mod of receptionist) {
      expect(supervisor).toContain(mod);
    }
    expect(supervisor).toContain("JOB_CARD_PRICING");
    expect(supervisor).toContain("PICKUP_DROP");
    expect(supervisor).toContain("EXPENSES");
    expect(supervisor).toContain("ATTENDANCE");
    expect(supervisor).toContain("STAFF_REWARDS");
  });

  it("adds EDIT keys when access is withEditAccess", () => {
    const perms = buildInitialPermissions("RECEPTIONIST", "withEditAccess");
    expect(perms).toContain("CUSTOMERS_EDIT");
    expect(perms).not.toContain("CUSTOMERS_DELETE");
  });

  it("omits EDIT keys when access is withoutEditAccess", () => {
    const perms = buildInitialPermissions("RECEPTIONIST", "withoutEditAccess");
    expect(perms).toContain("CUSTOMERS_CREATE");
    expect(perms).toContain("CUSTOMERS_VIEW");
    expect(perms).not.toContain("CUSTOMERS_EDIT");
  });
});
