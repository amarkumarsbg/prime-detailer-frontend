import { describe, expect, it } from "vitest";
import {
  groupPendingPaymentCustomers,
  isPendingPaymentInvoice,
} from "@/lib/dashboard-filters";
import type { Invoice } from "@/types";

function inv(partial: Partial<Invoice> & Pick<Invoice, "id" | "customerId" | "grandTotal" | "status">): Invoice {
  return {
    invoiceNumber: "INV-1",
    jobCardId: "jc-1",
    jobNumber: "JC-1",
    customerName: "A",
    customerPhone: "9999999999",
    subtotal: partial.grandTotal,
    taxRate: 0.18,
    taxAmount: 0,
    lineItems: [],
    payments: [],
    createdAt: "2026-01-01",
    ...partial,
  } as Invoice;
}

describe("isPendingPaymentInvoice", () => {
  it("includes issued invoices with a balance due", () => {
    expect(
      isPendingPaymentInvoice(
        inv({ id: "i1", customerId: "c-1", grandTotal: 500, status: "ISSUED", payments: [] })
      )
    ).toBe(true);
  });

  it("excludes issued invoices that are fully paid", () => {
    expect(
      isPendingPaymentInvoice(
        inv({
          id: "i2",
          customerId: "c-1",
          grandTotal: 500,
          status: "ISSUED",
          payments: [{ id: "p1", invoiceId: "i2", amount: 500, method: "CASH", paidAt: "2026-01-02" }],
        })
      )
    ).toBe(false);
  });

  it("excludes paid invoices", () => {
    expect(
      isPendingPaymentInvoice(
        inv({ id: "i3", customerId: "c-1", grandTotal: 100, status: "PAID", payments: [] })
      )
    ).toBe(false);
  });
});

describe("groupPendingPaymentCustomers", () => {
  it("returns one row per customer with outstanding dues", () => {
    const rows = groupPendingPaymentCustomers([
      inv({ id: "a", customerId: "c-1", customerName: "One", grandTotal: 200, status: "ISSUED", payments: [] }),
      inv({ id: "b", customerId: "c-1", customerName: "One", grandTotal: 100, status: "PARTIALLY_PAID", payments: [] }),
      inv({ id: "c", customerId: "c-2", customerName: "Two", grandTotal: 50, status: "ISSUED", payments: [] }),
      inv({
        id: "d",
        customerId: "c-3",
        customerName: "Settled",
        grandTotal: 80,
        status: "ISSUED",
        payments: [{ id: "p", invoiceId: "d", amount: 80, method: "UPI", paidAt: "2026-01-02" }],
      }),
    ]);
    expect(rows.map((r) => r.customerId)).toEqual(["c-1", "c-2"]);
    expect(rows[0]?.outstanding).toBe(300);
    expect(rows[0]?.invoiceCount).toBe(2);
    expect(rows[1]?.outstanding).toBe(50);
  });
});
