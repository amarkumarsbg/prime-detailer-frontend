import { apiGet } from "./api-client";
import { reconcileCurrentBranch } from "./branch-selection";
import { useAuthStore } from "@/store/auth-store";
import type { Branch, OrganizationEntitlement } from "@/types";
import { useBranchStore } from "@/store/branch-store";
import { useOrganizationStore } from "@/store/organization-store";
import {
  mergeAppSettingsPayload,
  useSettingsStore,
} from "@/store/settings-store";

/** Public branding fields from thin `/api/bootstrap` (no bank/GST secrets). */
export type BootstrapBranding = {
  businessName?: string;
  businessLogo?: string;
  businessTagline?: string;
  businessPhone?: string;
  businessWhatsApp?: string;
  businessEmail?: string;
  businessAddress?: string;
  businessWebsite?: string;
  brandPrimary?: string;
};

/** Shell-only bootstrap payload (domain data loads via permission-scoped APIs). */
export type BootstrapPayload = {
  branches: Branch[];
  branding: BootstrapBranding;
  entitlement?: OrganizationEntitlement | null;
};

/**
 * Hydrate shell stores only: branches, branding, entitlement, branch reconcile.
 * Domain Zustand stores are filled by `domain-data-loader`.
 */
export async function bootstrapAppData(): Promise<void> {
  const data = await apiGet<BootstrapPayload>("/api/bootstrap");

  useBranchStore.setState({ branches: data.branches ?? [] });
  useOrganizationStore.getState().setEntitlement(data.entitlement ?? null);

  const auth = useAuthStore.getState();
  if (auth.user) {
    const nextBranch = reconcileCurrentBranch(
      auth.user,
      auth.user.branchId
        ? (data.branches.find((b) => b.id === auth.user!.branchId) ?? null)
        : null,
      auth.currentBranch,
      data.branches ?? []
    );
    if (
      nextBranch &&
      (nextBranch.id !== auth.currentBranch?.id ||
        nextBranch.name !== auth.currentBranch?.name)
    ) {
      auth.setBranch(nextBranch);
    }
  }

  const brandingPatch = mergeAppSettingsPayload(data.branding ?? {});
  if (Object.keys(brandingPatch).length > 0) {
    useSettingsStore.getState().patchFromBootstrap(brandingPatch);
  }
}
