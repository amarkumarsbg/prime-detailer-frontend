import { describe, expect, it } from "vitest";
import { maxWalletRedeemForPayment, MAX_WALLET_REDEEM_INR } from "./wallet-redeem";

describe("maxWalletRedeemForPayment", () => {
  it("caps at 200 even when balance and due are higher", () => {
    expect(
      maxWalletRedeemForPayment({
        walletBalance: 500,
        amountDue: 1000,
      })
    ).toBe(MAX_WALLET_REDEEM_INR);
  });

  it("uses the smaller of balance and due under the cap", () => {
    expect(
      maxWalletRedeemForPayment({
        walletBalance: 80,
        amountDue: 1000,
      })
    ).toBe(80);
    expect(
      maxWalletRedeemForPayment({
        walletBalance: 500,
        amountDue: 50,
      })
    ).toBe(50);
  });

  it("reduces cap by wallet already used on the invoice", () => {
    expect(
      maxWalletRedeemForPayment({
        walletBalance: 500,
        amountDue: 1000,
        walletAlreadyUsedOnInvoice: 150,
      })
    ).toBe(50);
    expect(
      maxWalletRedeemForPayment({
        walletBalance: 500,
        amountDue: 1000,
        walletAlreadyUsedOnInvoice: 200,
      })
    ).toBe(0);
  });
});
