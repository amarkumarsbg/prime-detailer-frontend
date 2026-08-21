import { toast } from "sonner";
import { useOrganizationStore } from "@/store/organization-store";
import { canExportData } from "@/lib/subscription-export-lock";

export const EXPORT_LOCKED_MESSAGE =
  "Exports and downloads are locked until your subscription is renewed. Use Renew / Pay Now to continue.";

export class ExportLockedError extends Error {
  constructor(message = EXPORT_LOCKED_MESSAGE) {
    super(message);
    this.name = "ExportLockedError";
  }
}

/** Returns true when export is allowed; otherwise toasts and returns false. */
export function assertCanExportData(): boolean {
  const entitlement = useOrganizationStore.getState().entitlement;
  if (canExportData(entitlement)) return true;
  toast.error(EXPORT_LOCKED_MESSAGE);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("subscription:open-renew"));
  }
  return false;
}

/** Throws ExportLockedError when locked (after toast). */
export function requireCanExportData(): void {
  if (!assertCanExportData()) throw new ExportLockedError();
}
