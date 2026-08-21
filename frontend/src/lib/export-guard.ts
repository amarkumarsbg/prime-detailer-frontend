"use client";

import { useOrganizationStore } from "@/store/organization-store";
import { isExportLocked } from "@/lib/subscription-export-lock";
import { assertCanExportData } from "@/lib/assert-can-export";

export {
  assertCanExportData,
  requireCanExportData,
  ExportLockedError,
  EXPORT_LOCKED_MESSAGE,
} from "@/lib/assert-can-export";

export function useExportGuard() {
  const entitlement = useOrganizationStore((s) => s.entitlement);
  const locked = isExportLocked(entitlement);
  return {
    locked,
    canExport: !locked,
    assertCanExport: assertCanExportData,
  };
}
