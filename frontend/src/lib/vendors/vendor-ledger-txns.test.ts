import { describe, expect, it } from "vitest";
import { buildVendorLedgerTransactions } from "@/lib/vendors/vendor-ledger-txns";
import type { Expense, ProductPurchase } from "@/types";

describe("buildVendorLedgerTransactions", () => {
  it("shows purchase bill + payment lines like inventory payment history", () => {
    const purchase = {
      id: "pur-1",
      partId: "part-1",
      vendorName: "Vendor Seed 4",
      quantityMl: 1,
      purchasedAt: "2026-08-21T10:00:00.000Z",
      recordedBy: "u1",
      purchaseNumber: "PUR-2026-0001",
      grandTotal: 1180,
      amountPaid: 80,
      payments: [
        {
          id: "pay-1",
          amount: 80,
          method: "CASH",
          paidAt: "2026-08-21T12:00:00.000Z",
        },
      ],
    } as ProductPurchase;

    const rows = buildVendorLedgerTransactions({ purchases: [purchase], expenses: [] });
    expect(rows).toHaveLength(2);
    // Newest first
    expect(rows[0].type).toBe("Payment");
    expect(rows[0].credit).toBe(80);
    expect(rows[0].detail).toBe("CASH");
    expect(rows[1].type).toBe("Purchase");
    expect(rows[1].debit).toBe(1180);
    expect(rows[0].balance).toBe(1100);
    expect(rows[1].balance).toBe(1180);
  });

  it("includes direct expense bill + paid amount", () => {
    const expense = {
      id: "exp-1",
      title: "Marketing",
      category: "MARKETING",
      amount: 9800,
      amountPaid: 2000,
      paymentStatus: "PARTIAL",
      paymentMethod: "CASH",
      date: "2026-04-08",
      vendorName: "Vendor Seed 4",
    } as Expense;

    const rows = buildVendorLedgerTransactions({ purchases: [], expenses: [expense] });
    expect(rows.some((r) => r.type === "Expense" && r.debit === 9800)).toBe(true);
    expect(rows.some((r) => r.type === "Payment" && r.credit === 2000)).toBe(true);
    expect(rows[0].balance).toBe(7800);
  });
});
