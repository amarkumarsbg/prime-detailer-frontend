import { describe, expect, it, vi } from "vitest";
import {
  creditReferralWalletsForInvoice,
  hasReferralWalletCredit,
  referralAdvocateWalletRef,
  referralBuyerWalletRef,
} from "./referral-wallet-credits";
import type { Customer, WalletTransaction } from "@/types";

function customer(partial: Partial<Customer> & Pick<Customer, "id" | "name">): Customer {
  return {
    phone: "",
    email: "",
    address: "",
    referralCode: "REF-SELF",
    totalVisits: 0,
    rewardPoints: 0,
    walletBalance: 0,
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

describe("referral wallet credits", () => {
  it("credits buyer and advocate once (idempotent)", async () => {
    const buyer = customer({ id: "c-buyer", name: "Buyer", walletBalance: 10 });
    const advocate = customer({
      id: "c-adv",
      name: "Advocate",
      referralCode: "REF-ADV1",
      walletBalance: 50,
    });
    const balances: Record<string, number> = {
      "c-buyer": 10,
      "c-adv": 50,
    };
    const txs: WalletTransaction[] = [];
    const creditWallet = vi.fn(async (id: string, amount: number) => {
      balances[id] = (balances[id] || 0) + amount;
    });
    const addTransaction = vi.fn(async (tx: WalletTransaction) => {
      txs.push(tx);
    });
    const updateCustomer = vi.fn(async () => undefined);

    const first = await creditReferralWalletsForInvoice({
      invoiceId: "inv-1",
      buyer,
      advocate,
      buyerAmount: 200,
      advocateAmount: 500,
      referralCode: "REF-ADV1",
      transactions: txs,
      creditWallet,
      addTransaction,
      getCustomer: (id) => customer({ id, name: id, walletBalance: balances[id] }),
      updateCustomer,
    });
    expect(first).toEqual({ buyerCredited: true, advocateCredited: true });
    expect(creditWallet).toHaveBeenCalledTimes(2);
    expect(hasReferralWalletCredit(txs, referralBuyerWalletRef("inv-1"))).toBe(true);
    expect(hasReferralWalletCredit(txs, referralAdvocateWalletRef("inv-1"))).toBe(true);
    expect(updateCustomer).toHaveBeenCalledWith("c-buyer", { referredBy: "REF-ADV1" });

    const second = await creditReferralWalletsForInvoice({
      invoiceId: "inv-1",
      buyer,
      advocate,
      buyerAmount: 200,
      advocateAmount: 500,
      referralCode: "REF-ADV1",
      transactions: txs,
      creditWallet,
      addTransaction,
      getCustomer: (id) => customer({ id, name: id, walletBalance: balances[id] }),
      updateCustomer,
    });
    expect(second).toEqual({ buyerCredited: false, advocateCredited: false });
    expect(creditWallet).toHaveBeenCalledTimes(2);
  });
});
