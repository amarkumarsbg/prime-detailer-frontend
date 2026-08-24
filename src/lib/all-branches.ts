import type { Branch } from "@/types";

/** Header / org-wide scope: not a real branch row in the DB. */
export const ALL_BRANCHES_BRANCH: Branch = {
  id: "__all__",
  name: "All branches",
  address: "",
  phone: "",
  isActive: true,
};

export function isAllBranchesScope(branch: Branch | null | undefined): boolean {
  return branch?.id === ALL_BRANCHES_BRANCH.id;
}

/** For forms / attendance when unknown branch keys off the user’s home branch. */
export function resolveSessionBranchId(
  currentBranch: Branch | null,
  homeBranchId: string | undefined
): string {
  if (currentBranch && !isAllBranchesScope(currentBranch)) return currentBranch.id;
  return homeBranchId ?? "br-main";
}
