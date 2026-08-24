/**
 * Shared GST helpers for pricing flows (job cards, bookings, invoices, quotations).
 * Single source of truth for the 18% rate and NOT_REGISTERED → 0% behavior.
 */

export type GstRegistrationStatus = "REGISTERED" | "NOT_REGISTERED";

/** Standard GST rate as a fraction (18%). */
export const DEFAULT_GST_RATE = 0.18;

export function isGstRegistered(
  status: GstRegistrationStatus | string | null | undefined
): boolean {
  return status !== "NOT_REGISTERED";
}

/** Effective tax rate fraction: 0.18 when registered, else 0. */
export function effectiveGstRate(
  status: GstRegistrationStatus | string | null | undefined
): number {
  return isGstRegistered(status) ? DEFAULT_GST_RATE : 0;
}

/**
 * Tax + grand total from a taxable base (subtotal after discounts).
 * When NOT_REGISTERED: taxAmount = 0, grandTotal = base.
 */
export function computeGstFromSubtotal(
  subtotal: number,
  status: GstRegistrationStatus | string | null | undefined
): { taxRate: number; taxAmount: number; grandTotal: number } {
  const taxRate = effectiveGstRate(status);
  const base = Math.max(0, Number.isFinite(subtotal) ? subtotal : 0);
  const taxAmount = Math.round(base * taxRate * 100) / 100;
  const grandTotal = Math.round((base + taxAmount) * 100) / 100;
  return { taxRate, taxAmount, grandTotal };
}
