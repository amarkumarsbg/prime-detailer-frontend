import { purchaseAmountPaid, purchaseGrandTotal } from "@/lib/inventory/purchase-math";
import { expensePaidAmount } from "@/lib/party/ledger-math";
import type { Expense, ProductPurchase } from "@/types";

/** Chronological vendor ledger lines (bills + cash payments). */
export type VendorLedgerTxn = {
  id: string;
  at: string;
  /** Purchase | Payment | Expense | Payment (expense) */
  type: string;
  reference: string;
  detail?: string;
  /** Increases payable (bill). */
  debit: number;
  /** Decreases payable (payment out). */
  credit: number;
  /** Running balance due after this line (oldest → newest). */
  balance: number;
};

/**
 * Build vendor transaction history:
 * - Purchase / expense bills as debits
 * - Purchase payment lines (+ expense paid amount) as credits
 * Matches Inventory purchase “Payment history” at vendor scope.
 */
export function buildVendorLedgerTransactions(input: {
  purchases: ProductPurchase[];
  expenses: Expense[];
}): VendorLedgerTxn[] {
  type Draft = Omit<VendorLedgerTxn, "balance">;
  const drafts: Draft[] = [];

  for (const p of input.purchases) {
    const total = purchaseGrandTotal(p);
    const ref = p.purchaseNumber ?? p.reference ?? p.id;
    drafts.push({
      id: `bill-purchase-${p.id}`,
      at: p.purchasedAt,
      type: "Purchase",
      reference: ref,
      detail: "Bill",
      debit: total,
      credit: 0,
    });
    const payments = p.payments ?? [];
    if (payments.length > 0) {
      for (const pay of payments) {
        drafts.push({
          id: `pay-purchase-${pay.id}`,
          at: pay.paidAt,
          type: "Payment",
          reference: ref,
          detail: pay.method ? String(pay.method) : undefined,
          debit: 0,
          credit: pay.amount,
        });
      }
    } else {
      const paid = purchaseAmountPaid(p);
      if (paid > 0.01) {
        drafts.push({
          id: `pay-purchase-legacy-${p.id}`,
          at: p.purchasedAt,
          type: "Payment",
          reference: ref,
          detail: "Recorded paid",
          debit: 0,
          credit: paid,
        });
      }
    }
  }

  for (const e of input.expenses) {
    drafts.push({
      id: `bill-expense-${e.id}`,
      at: e.date,
      type: "Expense",
      reference: e.title,
      detail: e.category || "Direct",
      debit: e.amount,
      credit: 0,
    });
    const paid = expensePaidAmount(e);
    if (paid > 0.01) {
      drafts.push({
        id: `pay-expense-${e.id}`,
        at: e.date,
        type: "Payment",
        reference: e.title,
        detail: e.paymentMethod ? String(e.paymentMethod) : "Expense payment",
        debit: 0,
        credit: paid,
      });
    }
  }

  drafts.sort((a, b) => {
    const ta = new Date(a.at).getTime();
    const tb = new Date(b.at).getTime();
    if (ta !== tb) return ta - tb;
    // Bills before payments on same timestamp
    if (a.debit > 0 && b.credit > 0) return -1;
    if (a.credit > 0 && b.debit > 0) return 1;
    return a.id.localeCompare(b.id);
  });

  let balance = 0;
  const withBalance: VendorLedgerTxn[] = drafts.map((d) => {
    balance = Math.round((balance + d.debit - d.credit) * 100) / 100;
    return { ...d, balance };
  });

  // Newest first for UI
  return withBalance.reverse();
}
