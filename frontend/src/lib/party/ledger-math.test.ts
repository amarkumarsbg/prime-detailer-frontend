import { describe, expect, it } from "vitest";
import {
  customerHasPendingInvoiceDues,
  expenseOutstanding,
  expensePaidAmount,
  invoiceOutstanding,
  invoicePaidTotal,
} from "@/lib/party/ledger-math";
import type { Expense, Invoice } from "@/types";

function inv(partial: Partial<Invoice> & Pick<Invoice, "id" | "grandTotal" | "payments">): Invoice {
  return {
    invoiceNumber: "INV-1",
    jobCardId: "jc-1",
    jobNumber: "JC-1",
    customerId: "c-1",
    customerName: "A",
    customerPhone: "9999999999",
    status: "ISSUED",
    subtotal: partial.grandTotal,
    taxRate: 0.18,
    taxAmount: 0,
    lineItems: [],
    createdAt: "2026-01-01",
    ...partial,
  } as Invoice;
}

describe("invoicePaidTotal / invoiceOutstanding", () => {
  it("sums payments and wallet", () => {
    const invoice = inv({
      id: "i1",
      grandTotal: 1000,
      walletAmountUsed: 100,
      payments: [
        { id: "p1", invoiceId: "i1", amount: 400, method: "CASH", paidAt: "2026-01-02" },
        { id: "p2", invoiceId: "i1", amount: 200, method: "UPI", paidAt: "2026-01-03" },
      ],
    });
    expect(invoicePaidTotal(invoice)).toBe(700);
    expect(invoiceOutstanding(invoice)).toBe(300);
  });

  it("never returns negative outstanding", () => {
    const invoice = inv({
      id: "i2",
      grandTotal: 100,
      payments: [{ id: "p1", invoiceId: "i2", amount: 150, method: "CASH", paidAt: "2026-01-02" }],
    });
    expect(invoiceOutstanding(invoice)).toBe(0);
  });
});

describe("expenseOutstanding", () => {
  it("is zero when paid", () => {
    const e = {
      id: "e1",
      amount: 500,
      amountPaid: 100,
      paymentStatus: "PAID",
    } as Expense;
    expect(expenseOutstanding(e)).toBe(0);
    expect(expensePaidAmount(e)).toBe(500);
  });

  it("uses amountPaid for pending/partial", () => {
    const e = {
      id: "e2",
      amount: 500,
      amountPaid: 200,
      paymentStatus: "PARTIAL",
    } as Expense;
    expect(expenseOutstanding(e)).toBe(300);
  });
});

describe("customerHasPendingInvoiceDues", () => {
  it("ignores drafts and paid-down invoices", () => {
    const invoices = [
      inv({
        id: "d1",
        customerId: "c-1",
        status: "DRAFT",
        grandTotal: 500,
        payments: [],
      }),
      inv({
        id: "p1",
        customerId: "c-1",
        status: "PAID",
        grandTotal: 500,
        payments: [{ id: "x", invoiceId: "p1", amount: 500, method: "CASH", paidAt: "2026-01-01" }],
      }),
      inv({
        id: "o1",
        customerId: "c-1",
        status: "PARTIALLY_PAID",
        grandTotal: 500,
        payments: [{ id: "y", invoiceId: "o1", amount: 100, method: "CASH", paidAt: "2026-01-01" }],
      }),
    ];
    expect(customerHasPendingInvoiceDues("c-1", invoices)).toBe(true);
    expect(customerHasPendingInvoiceDues("c-other", invoices)).toBe(false);
  });
});
