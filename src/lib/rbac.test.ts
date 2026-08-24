import { describe, expect, it } from "vitest";
import {
  canAccessNavItem,
  canCreateStaffAccounts,
  canManageOrgBranches,
  canManageStaffUsers,
  getAssignableStaffRoles,
  isSuperAdmin,
} from "@/lib/rbac";

describe("rbac helpers", () => {
  it("identifies super admin", () => {
    expect(isSuperAdmin("SUPER_ADMIN")).toBe(true);
    expect(isSuperAdmin("ADMIN")).toBe(false);
  });

  it("gates branch and staff management by role", () => {
    expect(canManageOrgBranches("ADMIN")).toBe(true);
    expect(canManageOrgBranches("MECHANIC")).toBe(false);
    expect(canCreateStaffAccounts("ADMIN")).toBe(true);
    expect(canCreateStaffAccounts("MANAGER")).toBe(false);
    expect(canManageStaffUsers("MANAGER")).toBe(true);
    expect(canManageStaffUsers("RECEPTIONIST")).toBe(false);
  });

  it("only SUPER_ADMIN assigns roles", () => {
    expect(getAssignableStaffRoles("SUPER_ADMIN")).toContain("MECHANIC");
    expect(getAssignableStaffRoles("ADMIN")).toEqual([]);
  });

  it("canAccessNavItem combines role + permissionKey", () => {
    expect(canAccessNavItem(undefined, "SUPER_ADMIN")).toBe(true);
    expect(canAccessNavItem(["ADMIN"], "MECHANIC")).toBe(false);
    expect(canAccessNavItem(["MANAGER"], "BRANCH_MANAGER")).toBe(true);
    expect(canAccessNavItem(undefined, "RECEPTIONIST", "BILLING", ["BILLING"])).toBe(true);
    expect(canAccessNavItem(undefined, "RECEPTIONIST", "BILLING", ["JOB_CARDS"])).toBe(false);
    expect(canAccessNavItem(undefined, "RECEPTIONIST", "BILLING")).toBe(false);
  });
});
