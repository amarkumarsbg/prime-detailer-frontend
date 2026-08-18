import { describe, expect, it } from "vitest";
import {
  buildCounterSaleInvoice,
  counterSaleCartSubtotal,
  counterSaleInvoiceStatus,
  counterSaleLineTotal,
} from "./counter-sale";
import { invoiceOutstanding, invoicePaidTotal, buildPartyTransactions, partyCurrentBalance } from "./party/ledger-math";

describe("counter sale totals and status", () => {
  const line = {
    partId: "p1",
    name: "Wax",
    sku: "W-1",
    quantity: 2,
    unit: "Piece",
    unitPrice: 500,
    lineDiscount: 100,
  };

  it("computes line and cart totals after discount", () => {
    expect(counterSaleLineTotal(line)).toBe(900);
    expect(counterSaleCartSubtotal([line, { ...line, partId: "p2", lineDiscount: 0 }])).toBe(1900);
  });

  it("sets paid / partial / credit statuses", () => {
    expect(counterSaleInvoiceStatus(6300, 6300)).toBe("PAID");
    expect(counterSaleInvoiceStatus(6300, 2000)).toBe("PARTIALLY_PAID");
    expect(counterSaleInvoiceStatus(6300, 0)).toBe("ISSUED");
  });

  it("builds an invoice that ledger math can outstanding", () => {
    const inv = buildCounterSaleInvoice({
      id: "inv-cs-1",
      invoiceNumber: "INV-2026-0100",
      branchId: "br-1",
      customerId: "c-1",
      customerName: "Test",
      customerPhone: "9000000000",
      lines: [line],
      discountAmount: 0,
      taxRate: 0,
      taxAmount: 0,
      grandTotal: 900,
      paidAmount: 200,
      paymentMethod: "CASH",
      createdAt: "2026-08-18T12:00:00.000Z",
    });
    expect(inv.source).toBe("COUNTER_SALE");
    expect(inv.jobNumber).toBe("Counter Sale");
    expect(invoicePaidTotal(inv)).toBe(200);
    expect(invoiceOutstanding(inv)).toBe(700);
    expect(inv.status).toBe("PARTIALLY_PAID");
  });
});

describe("counter sale ledger label", () => {
  it("appears as Counter Sale on the customer ledger", () => {
    const inv = buildCounterSaleInvoice({
      id: "inv-cs-2",
      invoiceNumber: "INV-2026-0101",
      branchId: "br-1",
      customerId: "c-1",
      customerName: "Test",
      customerPhone: "9000000000",
      lines: [
        {
          partId: "p1",
          name: "Wax",
          sku: "W-1",
          quantity: 1,
          unit: "Piece",
          unitPrice: 100,
          lineDiscount: 0,
        },
      ],
      discountAmount: 0,
      taxRate: 0,
      taxAmount: 0,
      grandTotal: 100,
      paidAmount: 0,
      paymentMethod: "CASH",
      createdAt: "2026-08-18T12:00:00.000Z",
    });
    const party = {
      id: "c:c-1",
      kind: "customer" as const,
      name: "Test",
      openingBalance: 0,
      customFields: [],
      customerId: "c-1",
      createdAt: inv.createdAt,
      updatedAt: inv.createdAt,
    };
    const rows = buildPartyTransactions(party, [inv], [], "fy");
    const sale = rows.find((r) => r.id === inv.id);
    expect(sale?.typeLabel).toBe("Counter Sale");
    expect(sale?.unpaidAmount).toBe(100);
    expect(partyCurrentBalance(party, [inv], [])).toBe(100);
  });
});
