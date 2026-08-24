import type { Customer, WalletTransaction } from "@/types";

/** Wallet ledger refs so the same invoice cannot credit twice. */
export function referralBuyerWalletRef(invoiceId: string): string {
  return `${invoiceId}:referral-buyer`;
}

export function referralAdvocateWalletRef(invoiceId: string): string {
  return `${invoiceId}:referral-advocate`;
}

export function hasReferralWalletCredit(
  transactions: WalletTransaction[],
  referenceId: string
): boolean {
  return transactions.some(
    (t) => t.source === "REFERRAL_REWARD" && t.referenceId === referenceId && t.type === "CREDIT"
  );
}

type CreditFn = (
  customerId: string,
  amount: number,
  type?: "CREDIT" | "DEBIT",
  reason?: string
) => Promise<void>;

type AddTxFn = (tx: WalletTransaction) => void | Promise<void>;

/**
 * Credits new-customer + referrer wallets for a referral on an invoice.
 * Idempotent per invoice via wallet transaction referenceIds.
 */
export async function creditReferralWalletsForInvoice(input: {
  invoiceId: string;
  buyer: Customer;
  advocate: Customer;
  buyerAmount: number;
  advocateAmount: number;
  referralCode: string;
  transactions: WalletTransaction[];
  creditWallet: CreditFn;
  addTransaction: AddTxFn;
  getCustomer?: (id: string) => Customer | undefined;
  /** Optional: stamp referredBy on the buyer when empty. */
  updateCustomer?: (id: string, patch: Partial<Customer>) => Promise<unknown> | unknown;
}): Promise<{ buyerCredited: boolean; advocateCredited: boolean }> {
  const {
    invoiceId,
    buyer,
    advocate,
    buyerAmount,
    advocateAmount,
    referralCode,
    transactions,
    creditWallet,
    addTransaction,
    getCustomer,
    updateCustomer,
  } = input;

  const buyerRef = referralBuyerWalletRef(invoiceId);
  const advocateRef = referralAdvocateWalletRef(invoiceId);
  const now = new Date().toISOString();
  const code = referralCode.trim().toUpperCase();

  let buyerCredited = false;
  let advocateCredited = false;

  if (buyerAmount > 0 && !hasReferralWalletCredit(transactions, buyerRef)) {
    await creditWallet(
      buyer.id,
      buyerAmount,
      "CREDIT",
      `Referral reward — used code ${code}`
    );
    const balanceAfter =
      getCustomer?.(buyer.id)?.walletBalance ?? (buyer.walletBalance || 0) + buyerAmount;
    await addTransaction({
      id: `wt-ref-buyer-${invoiceId}`,
      customerId: buyer.id,
      customerName: buyer.name,
      type: "CREDIT",
      amount: buyerAmount,
      source: "REFERRAL_REWARD",
      referenceId: buyerRef,
      description: `Referral welcome credit — code ${code}`,
      balanceAfter,
      createdAt: now,
    });
    buyerCredited = true;
  }

  if (
    advocateAmount > 0 &&
    advocate.id !== buyer.id &&
    !hasReferralWalletCredit(transactions, advocateRef)
  ) {
    await creditWallet(
      advocate.id,
      advocateAmount,
      "CREDIT",
      `Referral reward — ${buyer.name} used your code`
    );
    const balanceAfter =
      getCustomer?.(advocate.id)?.walletBalance ??
      (advocate.walletBalance || 0) + advocateAmount;
    await addTransaction({
      id: `wt-ref-adv-${invoiceId}`,
      customerId: advocate.id,
      customerName: advocate.name,
      type: "CREDIT",
      amount: advocateAmount,
      source: "REFERRAL_REWARD",
      referenceId: advocateRef,
      description: `Referral reward — ${buyer.name} used your code`,
      balanceAfter,
      createdAt: now,
    });
    advocateCredited = true;
  }

  if (updateCustomer && code && !buyer.referredBy?.trim()) {
    await updateCustomer(buyer.id, { referredBy: code });
  }

  return { buyerCredited, advocateCredited };
}
