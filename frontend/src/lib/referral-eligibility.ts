/** A friend’s referral code may only be used for a genuinely new customer (first visit). */

export const REFERRAL_NEW_CUSTOMER_WINDOW_MS = 48 * 60 * 60 * 1000;

export const REFERRAL_EXISTING_CUSTOMER_MESSAGE =
  "Referral codes can only be used for new customers — not existing customers.";

export function invoiceCarriesReferral(inv: {
  referralDiscount?: number;
  referralCodeUsed?: string;
}): boolean {
  return (Number(inv.referralDiscount) || 0) > 0.01 || Boolean(inv.referralCodeUsed?.trim());
}

/**
 * New-customer gate for referrals:
 * - No other invoices
 * - No prior job cards (beyond the current one)
 * - At most one visit recorded
 * - Either already signed up with referredBy, or account created within 48h
 */
export function isNewCustomerForReferral(input: {
  createdAt: string;
  totalVisits: number;
  referredBy?: string | null;
  otherInvoiceCount: number;
  /** Other job cards for this customer (exclude the invoice’s current job). */
  otherJobCardCount?: number;
  nowMs?: number;
}): boolean {
  if (input.otherInvoiceCount > 0) return false;
  if ((input.otherJobCardCount ?? 0) > 0) return false;
  if (input.totalVisits > 1) return false;
  if (input.referredBy?.trim()) return true;
  const created = new Date(input.createdAt).getTime();
  if (!Number.isFinite(created)) return false;
  const now = input.nowMs ?? Date.now();
  return now - created <= REFERRAL_NEW_CUSTOMER_WINDOW_MS;
}

export function canApplyReferralOnInvoice(input: {
  customer:
    | {
        id: string;
        createdAt: string;
        totalVisits: number;
        referredBy?: string | null;
      }
    | null
    | undefined;
  invoices: Array<{ id: string; customerId: string }>;
  currentInvoiceId: string;
  jobCards?: Array<{ id: string; customerId: string }>;
  currentJobCardId?: string | null;
  nowMs?: number;
}): boolean {
  const customer = input.customer;
  if (!customer) return false;
  const otherInvoiceCount = input.invoices.filter(
    (inv) => inv.customerId === customer.id && inv.id !== input.currentInvoiceId
  ).length;
  const otherJobCardCount = (input.jobCards ?? []).filter(
    (j) =>
      j.customerId === customer.id &&
      (!input.currentJobCardId || j.id !== input.currentJobCardId)
  ).length;
  return isNewCustomerForReferral({
    createdAt: customer.createdAt,
    totalVisits: customer.totalVisits,
    referredBy: customer.referredBy,
    otherInvoiceCount,
    otherJobCardCount,
    nowMs: input.nowMs,
  });
}

/** Empty input is allowed. A non-empty code must match an existing advocate. */
export function referredByFromOptionalInput(
  code: string,
  findByReferralCode: (code: string) => unknown
): { referredBy?: string; error?: string } {
  const trimmed = code.trim();
  if (!trimmed) return {};
  if (!findByReferralCode(trimmed)) {
    return { error: "Invalid referral code." };
  }
  return { referredBy: trimmed.toUpperCase() };
}
