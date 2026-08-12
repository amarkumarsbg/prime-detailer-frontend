import type { Quotation, QuotationStatus } from "@/types";

const EDITABLE_STATUSES: ReadonlySet<QuotationStatus> = new Set([
  "DRAFT",
  "SENT",
  "APPROVED",
]);

/** Quotation content can be edited until converted or rejected. */
export function quotationIsEditable(q: Pick<Quotation, "status">): boolean {
  return EDITABLE_STATUSES.has(q.status);
}

/** System patches allowed after lock (convert / WhatsApp flags). */
const LOCKED_ALLOWED_KEYS = new Set([
  "status",
  "convertedToJobCardId",
  "convertedToInvoiceId",
  "sentViaWhatsApp",
  "customerApproved",
  "updatedAt",
]);

export function quotationUpdateAllowed(
  prev: Quotation,
  patch: Partial<Quotation>
): boolean {
  if (quotationIsEditable(prev)) return true;
  return Object.keys(patch).every((k) => LOCKED_ALLOWED_KEYS.has(k));
}
