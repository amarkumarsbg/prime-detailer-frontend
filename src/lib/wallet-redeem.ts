/** Max wallet balance that can be redeemed toward an invoice (₹). */
export const MAX_WALLET_REDEEM_INR = 200;

/**
 * How much wallet can be applied on this payment:
 * min(balance, amount due, remaining room under the ₹200 invoice cap).
 */
export function maxWalletRedeemForPayment(input: {
  walletBalance: number;
  amountDue: number;
  /** Wallet already applied on this invoice from prior payments. */
  walletAlreadyUsedOnInvoice?: number;
}): number {
  const balance = Math.max(0, Number(input.walletBalance) || 0);
  const due = Math.max(0, Number(input.amountDue) || 0);
  const already = Math.max(0, Number(input.walletAlreadyUsedOnInvoice) || 0);
  const remainingCap = Math.max(0, MAX_WALLET_REDEEM_INR - already);
  return Math.min(balance, due, remainingCap);
}
