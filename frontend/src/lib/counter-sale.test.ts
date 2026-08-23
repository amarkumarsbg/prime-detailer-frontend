import { describe, expect, it } from "vitest";
import {
  buildCounterSaleInvoice,
  counterSaleCartSubtotal,
  counterSaleInvoiceStatus,
  counterSaleLineTotal,
} from "./counter-sale";
import { invoiceOutstanding, invoicePaidTotal, buildPartyTransactions, partyCurrentBalance } from "./party/ledger-math";
import { invoiceBranchId, buildJobBranchMap } from "./branch-scope";

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

// ---------------------------------------------------------------------------
// Fix 1: Counter-sale invoice always carries branchId (branch attribution)
// ---------------------------------------------------------------------------

function makeCSInvoice(branchId: string, id = "inv-cs-test") {
  return buildCounterSaleInvoice({
    id,
    invoiceNumber: `INV-${id}`,
    branchId,
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
        unitPrice: 500,
        lineDiscount: 0,
      },
    ],
    discountAmount: 0,
    taxRate: 0,
    taxAmount: 0,
    grandTotal: 500,
    paidAmount: 500,
    paymentMethod: "CASH",
    createdAt: "2026-08-20T10:00:00.000Z",
  });
}

describe("counter sale branch attribution", () => {
  it("invoice always stores the provided branchId", () => {
    const inv = makeCSInvoice("br-main");
    expect(inv.branchId).toBe("br-main");
    expect(inv.source).toBe("COUNTER_SALE");
  });

  it("invoiceBranchId resolves directly from invoice.branchId (no job card needed)", () => {
    const inv = makeCSInvoice("br-main");
    // Empty job-branch map — counter-sale has no job card
    const jobBranch = buildJobBranchMap([]);
    expect(invoiceBranchId(inv, jobBranch)).toBe("br-main");
  });

  it("Branch A counter-sale is NOT visible when filtered to Branch B", () => {
    const invA = makeCSInvoice("br-main", "inv-cs-a");
    const invB = makeCSInvoice("br-002", "inv-cs-b");
    const jobBranch = buildJobBranchMap([]);

    const branchAVisible = [invA, invB].filter(
      (inv) => invoiceBranchId(inv, jobBranch) === "br-main"
    );
    expect(branchAVisible).toHaveLength(1);
    expect(branchAVisible[0]?.id).toBe("inv-cs-a");
  });

  it("Branch B counter-sale is NOT visible when filtered to Branch A", () => {
    const invA = makeCSInvoice("br-main", "inv-cs-a");
    const invB = makeCSInvoice("br-002", "inv-cs-b");
    const jobBranch = buildJobBranchMap([]);

    const branchBVisible = [invA, invB].filter(
      (inv) => invoiceBranchId(inv, jobBranch) === "br-002"
    );
    expect(branchBVisible).toHaveLength(1);
    expect(branchBVisible[0]?.id).toBe("inv-cs-b");
  });
});
