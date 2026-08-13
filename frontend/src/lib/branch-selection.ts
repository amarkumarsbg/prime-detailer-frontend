import type { Branch, User } from "@/types";
import { ALL_BRANCHES_BRANCH, isAllBranchesScope } from "@/lib/all-branches";

export function canOrgWideRole(role: User["role"]): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "MANAGER";
}

/** Default header scope after sign-in (org-wide users start on “All branches”). */
export function defaultBranchForUser(user: User, homeBranch: Branch | null): Branch | null {
  return canOrgWideRole(user.role) ? ALL_BRANCHES_BRANCH : homeBranch;
}

/**
 * Resolve header branch after session refresh or bootstrap.
 * Org-wide users keep a specific branch selection when it still exists in the catalog.
 */
export function reconcileCurrentBranch(
  user: User,
  homeBranch: Branch | null,
  persisted: Branch | null,
  catalog: Branch[]
): Branch | null {
  const active = catalog.filter((b) => b.isActive);

  if (!canOrgWideRole(user.role)) {
    return (
      active.find((b) => b.id === (homeBranch?.id ?? user.branchId)) ??
      homeBranch ??
      active[0] ??
      null
    );
  }

  if (!persisted || isAllBranchesScope(persisted)) {
    return ALL_BRANCHES_BRANCH;
  }

  return active.find((b) => b.id === persisted.id) ?? ALL_BRANCHES_BRANCH;
}
