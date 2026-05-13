import type { UserRole } from "@/types";

/** Super admin: unrestricted navigation (all routes that use role gates). */
export function isSuperAdmin(role: UserRole | undefined): boolean {
  return role === "SUPER_ADMIN";
}

/** Can create / edit / deactivate branches in Settings. */
export function canManageOrgBranches(role: UserRole | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

/** Super Admin and Admin may onboard accounts (public signup is disabled). */
export function canCreateStaffAccounts(role: UserRole | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

/** Can open Staff / Users directory (view and edit existing profiles where permitted). */
export function canManageStaffUsers(role: UserRole | undefined): boolean {
  return (
    role === "SUPER_ADMIN" ||
    role === "ADMIN" ||
    role === "BRANCH_MANAGER" ||
    role === "MANAGER"
  );
}

/** Which staff roles an actor may assign when adding/editing team members. */
export function getAssignableStaffRoles(actor: UserRole | undefined): UserRole[] {
  if (!actor) return [];
  if (actor === "SUPER_ADMIN") {
    return [
      "SUPER_ADMIN",
      "ADMIN",
      "BRANCH_MANAGER",
      "MANAGER",
      "SUPERVISOR",
      "RECEPTIONIST",
      "MECHANIC",
    ];
  }
  if (actor === "ADMIN") {
    return [
      "ADMIN",
      "BRANCH_MANAGER",
      "MANAGER",
      "SUPERVISOR",
      "RECEPTIONIST",
      "MECHANIC",
    ];
  }
  if (actor === "BRANCH_MANAGER" || actor === "MANAGER") {
    return ["SUPERVISOR", "RECEPTIONIST", "MECHANIC"];
  }
  return [];
}

/**
 * Sidebar / command menu: SUPER_ADMIN passes all checks; BRANCH_MANAGER matches MANAGER entries.
 */
export function canAccessNavItem(allowed: UserRole[] | undefined, userRole: UserRole | undefined): boolean {
  if (!userRole) return false;
  if (userRole === "SUPER_ADMIN") return true;
  if (!allowed || allowed.length === 0) return true;
  if (allowed.includes(userRole)) return true;
  if (userRole === "BRANCH_MANAGER" && allowed.includes("MANAGER")) return true;
  return false;
}

export function roleDisplayLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    SUPER_ADMIN: "Super Admin",
    ADMIN: "Admin",
    BRANCH_MANAGER: "Branch Manager",
    MANAGER: "Manager",
    SUPERVISOR: "Supervisor",
    RECEPTIONIST: "Receptionist",
    MECHANIC: "Mechanic",
  };
  return labels[role];
}
