import type { Branch, User } from "@/types";
import { ALL_BRANCHES_BRANCH, isAllBranchesScope } from "@/lib/all-branches";

export function canOrgWideRole(role: User["role"]): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "MANAGER";
}

/** Default header scope after sign-in. */
export function defaultBranchForUser(
  user: User,
  homeBranch: Branch | null,
  activeBranchCount?: number
): Branch | null {
  if (!canOrgWideRole(user.role)) return homeBranch;
  // Catalog unknown at login → keep previous “All branches” default; callers pass count when known.
  if (activeBranchCount === undefined) return ALL_BRANCHES_BRANCH;
  if (activeBranchCount > 1) return ALL_BRANCHES_BRANCH;
  return homeBranch;
}

/**
 * Resolve header branch after session refresh or bootstrap.
 * Org-wide users keep a specific branch selection when it still exists in the catalog.
 * “All branches” is only used when 2+ active locations exist.
 */
export function reconcileCurrentBranch(
  user: User,
  homeBranch: Branch | null,
  persisted: Branch | null,
  catalog: Branch[]
): Branch | null {
  const active = catalog.filter((b) => b.isActive);
  const single = active.length <= 1 ? active[0] ?? homeBranch : null;

  if (!canOrgWideRole(user.role)) {
    return (
      active.find((b) => b.id === (homeBranch?.id ?? user.branchId)) ??
      homeBranch ??
      active[0] ??
      null
    );
  }

  if (active.length <= 1) {
    return single;
  }

  if (!persisted || isAllBranchesScope(persisted)) {
    return ALL_BRANCHES_BRANCH;
  }

  return active.find((b) => b.id === persisted.id) ?? ALL_BRANCHES_BRANCH;
}
