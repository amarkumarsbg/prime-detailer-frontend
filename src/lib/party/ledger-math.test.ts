import { describe, expect, it } from "vitest";
import {
  buildPartyStatement,
  customerHasPendingInvoiceDues,
  expenseOutstanding,
  expensePaidAmount,
  invoiceOutstanding,
  invoicePaidTotal,
  paymentLedgerTimestamp,
} from "@/lib/party/ledger-math";
import type { Expense, Invoice } from "@/types";
import type { Party } from "@/types/party";

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

function customerParty(): Party {
  return {
    id: "c:c-1",
    kind: "customer",
    name: "A",
    openingBalance: 0,
    openingBalanceSide: "toCollect",
    customFields: [],
    customerId: "c-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
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

describe("paymentLedgerTimestamp", () => {
  it("prefers paidAt and falls back to invoice createdAt", () => {
    expect(paymentLedgerTimestamp("2026-09-07T12:00:00.000Z", "2026-09-01T10:00:00.000Z")).toBe(
      "2026-09-07T12:00:00.000Z"
    );
    expect(paymentLedgerTimestamp("", "2026-09-01T10:00:00.000Z")).toBe("2026-09-01T10:00:00.000Z");
    expect(paymentLedgerTimestamp(null, "2026-09-01T10:00:00.000Z")).toBe("2026-09-01T10:00:00.000Z");
  });
});

describe("buildPartyStatement payment dates", () => {
  it("shows payment on paidAt, not invoice createdAt, for later settlement", () => {
    const invoices = [
      inv({
        id: "old",
        invoiceNumber: "INV-2026-0025",
        grandTotal: 75000,
        createdAt: "2026-09-01T10:00:00.000Z",
        status: "PAID",
        payments: [
          {
            id: "pay-today",
            invoiceId: "old",
            amount: 75000,
            method: "CASH",
            paidAt: "2026-09-07T12:00:00.000Z",
          },
        ],
      }),
    ];
    const lines = buildPartyStatement(customerParty(), invoices, [], "all").filter(
      (l) => !l.isSummary
    );
    expect(lines).toHaveLength(2);
    expect(lines[0]?.voucher).toMatch(/Sales|Invoice/i);
    expect(lines[0]?.debit).toBe(75000);
    expect(lines[0]?.date).toMatch(/01/);
    expect(lines[1]?.voucher).toMatch(/^Payment In/);
    expect(lines[1]?.serialNo).toBe("INV-2026-0025");
    expect(lines[1]?.credit).toBe(75000);
    expect(lines[1]?.date).toMatch(/07/);
    expect(lines[1]?.balance).toBe(0);
  });

  it("includes payment rows even when building from mixed invoice/payment dates", () => {
    const invoices = [
      inv({
        id: "old",
        grandTotal: 500,
        createdAt: "2025-01-01T10:00:00.000Z",
        payments: [
          {
            id: "pay-new",
            invoiceId: "old",
            amount: 200,
            method: "UPI",
            paidAt: "2026-09-07T12:00:00.000Z",
          },
          {
            id: "pay-mid",
            invoiceId: "old",
            amount: 300,
            method: "CASH",
            paidAt: "2026-09-05T12:00:00.000Z",
          },
        ],
      }),
    ];
    const lines = buildPartyStatement(customerParty(), invoices, [], "all").filter(
      (l) => !l.isSummary
    );
    const payments = lines.filter((l) => l.voucher.startsWith("Payment In"));
    expect(payments).toHaveLength(2);
    expect(payments.map((p) => p.credit).sort()).toEqual([200, 300]);
    expect(lines.at(-1)?.balance).toBe(0);
  });
});
