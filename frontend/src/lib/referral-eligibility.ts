/** A friend’s referral code may only be used when creating a genuinely new customer. */

export const REFERRAL_NEW_CUSTOMER_WINDOW_MS = 48 * 60 * 60 * 1000;

export const REFERRAL_EXISTING_CUSTOMER_MESSAGE =
  "Referral codes can only be used when creating a new customer.";

export function invoiceCarriesReferral(inv: {
  referralDiscount?: number;
  referralCodeUsed?: string;
}): boolean {
  return (Number(inv.referralDiscount) || 0) > 0.01 || Boolean(inv.referralCodeUsed?.trim());
}

export function isNewCustomerForReferral(input: {
  createdAt: string;
  totalVisits: number;
  referredBy?: string | null;
  otherInvoiceCount: number;
  nowMs?: number;
}): boolean {
  if (input.otherInvoiceCount > 0) return false;
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
  nowMs?: number;
}): boolean {
  const customer = input.customer;
  if (!customer) return false;
  const otherInvoiceCount = input.invoices.filter(
    (inv) => inv.customerId === customer.id && inv.id !== input.currentInvoiceId
  ).length;
  return isNewCustomerForReferral({
    createdAt: customer.createdAt,
    totalVisits: customer.totalVisits,
    referredBy: customer.referredBy,
    otherInvoiceCount,
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
