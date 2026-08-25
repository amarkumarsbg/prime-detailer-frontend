import { describe, expect, it } from "vitest";
import { buildRecentExpenseRows } from "@/lib/accounting/recent-expenses";
import type { Expense, ProductPurchase } from "@/types";

function expense(partial: Partial<Expense> & Pick<Expense, "id" | "amount">): Expense {
  return {
    id: partial.id,
    title: partial.title ?? "Expense",
    category: partial.category ?? "SUPPLIES",
    amount: partial.amount,
    amountPaid: partial.amountPaid,
    date: partial.date ?? "2026-08-26",
    paymentStatus: partial.paymentStatus ?? "PENDING",
    paymentMethod: partial.paymentMethod ?? "CASH",
    createdBy: "u1",
    createdByName: "User",
    branchId: "b1",
    createdAt: partial.createdAt ?? "2026-08-26T10:00:00.000Z",
    purchaseId: partial.purchaseId,
    vendorName: partial.vendorName,
    description: partial.description,
    receipt: partial.receipt,
  };
}

function purchase(
  partial: Partial<ProductPurchase> & Pick<ProductPurchase, "id">,
): ProductPurchase {
  return {
    id: partial.id,
    partId: partial.partId ?? "legacy",
    vendorName: partial.vendorName ?? "Vendor",
    quantityMl: partial.quantityMl ?? 0,
    purchasedAt: partial.purchasedAt ?? "2026-08-26T09:00:00.000Z",
    recordedBy: partial.recordedBy ?? "u1",
    grandTotal: partial.grandTotal,
    amountPaid: partial.amountPaid,
    payments: partial.payments,
    paymentStatus: partial.paymentStatus,
    branchId: partial.branchId,
    dueDate: partial.dueDate,
    purchaseNumber: partial.purchaseNumber,
    supplierId: partial.supplierId,
    supplierInvoiceNumber: partial.supplierInvoiceNumber,
    invoiceFileName: partial.invoiceFileName,
    notes: partial.notes,
    items: partial.items,
    subtotal: partial.subtotal,
    discountTotal: partial.discountTotal,
    gstTotal: partial.gstTotal,
    roundOff: partial.roundOff,
    unitCost: partial.unitCost,
    reference: partial.reference,
  };
}

describe("buildRecentExpenseRows", () => {
  it("shows standalone fully paid expense as full paid amount with no due", () => {
    const rows = buildRecentExpenseRows([
      expense({ id: "e1", amount: 2700, paymentStatus: "PAID", paymentMethod: "CASH" }),
    ], []);
    expect(rows[0]?.displayAmount).toBe(2700);
    expect(rows[0]?.dueAmount).toBe(0);
  });

  it("shows standalone partial expense as paid amount and due", () => {
    const rows = buildRecentExpenseRows([
      expense({ id: "e1", amount: 2700, amountPaid: 700, paymentStatus: "PARTIAL" }),
    ], []);
    expect(rows[0]?.displayAmount).toBe(700);
    expect(rows[0]?.dueAmount).toBe(2000);
  });

  it("shows zero paid for standalone unpaid expense and full due", () => {
    const rows = buildRecentExpenseRows([
      expense({ id: "e1", amount: 2700, paymentStatus: "PENDING" }),
    ], []);
    expect(rows[0]?.displayAmount).toBe(0);
    expect(rows[0]?.dueAmount).toBe(2700);
  });

  it("for purchase-linked expense with multiple payments, shows latest payment amount and remaining due", () => {
    const exp = expense({ id: "e1", amount: 2700, purchaseId: "p1", paymentStatus: "PARTIAL" });
    const pur = purchase({
      id: "p1",
      grandTotal: 2700,
      payments: [
        { id: "pay-1", amount: 700, paidAt: "2026-08-25T10:00:00.000Z", method: "CASH" },
        { id: "pay-2", amount: 500, paidAt: "2026-08-26T12:00:00.000Z", method: "UPI" },
      ],
    });

    const rows = buildRecentExpenseRows([exp], [pur]);
    expect(rows[0]?.displayAmount).toBe(500);
    expect(rows[0]?.dueAmount).toBe(1500);
    expect(rows[0]?.displayPaymentMethod).toBe("UPI");
    expect(rows[0]?.displayDate).toBe("2026-08-26T12:00:00.000Z");
  });

  it("for purchase-linked expense with no payment entries, falls back to amountPaid and due", () => {
    const exp = expense({ id: "e1", amount: 2700, purchaseId: "p1", paymentStatus: "PARTIAL" });
    const pur = purchase({ id: "p1", grandTotal: 2700, amountPaid: 700, payments: [] });
    const rows = buildRecentExpenseRows([exp], [pur]);
    expect(rows[0]?.displayAmount).toBe(700);
    expect(rows[0]?.dueAmount).toBe(2000);
  });

  it("sorts by latest effective payment/expense date descending", () => {
    const expA = expense({ id: "eA", amount: 1000, purchaseId: "pA", date: "2026-08-20" });
    const expB = expense({ id: "eB", amount: 800, paymentStatus: "PAID", date: "2026-08-26" });
    const purA = purchase({
      id: "pA",
      grandTotal: 1000,
      payments: [{ id: "pay-a", amount: 300, paidAt: "2026-08-27T09:00:00.000Z", method: "CASH" }],
    });
    const rows = buildRecentExpenseRows([expB, expA], [purA]);
    expect(rows[0]?.expense.id).toBe("eA");
    expect(rows[1]?.expense.id).toBe("eB");
  });
});
