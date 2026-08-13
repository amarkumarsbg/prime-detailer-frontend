import type { UserRole } from "@/types";

/** Super admin: unrestricted navigation (all routes that use role gates). */
export function isSuperAdmin(role: UserRole | undefined): boolean {
  return role === "SUPER_ADMIN";
}

/** Can create / edit / deactivate branches on the Locations page. */
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
  return [];
}

/**
 * Sidebar / command menu: SUPER_ADMIN passes all checks; BRANCH_MANAGER matches MANAGER entries.
 * Non-Super Admin users must also satisfy custom permission checks if a permissionKey is specified.
 */
export function canAccessNavItem(
  allowed: UserRole[] | undefined,
  userRole: UserRole | undefined,
  permissionKey?: string,
  userPermissions?: string[]
): boolean {
  if (!userRole) return false;
  if (userRole === "SUPER_ADMIN") return true;

  // 1. Role-based check
  let roleAllowed = false;
  if (!allowed || allowed.length === 0) {
    roleAllowed = true;
  } else if (allowed.includes(userRole)) {
    roleAllowed = true;
  } else if (userRole === "BRANCH_MANAGER" && allowed.includes("MANAGER")) {
    roleAllowed = true;
  }

  if (!roleAllowed) return false;

  // 2. Custom permission check
  if (permissionKey) {
    return userPermissions ? userPermissions.includes(permissionKey) : false;
  }

  return true;
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
