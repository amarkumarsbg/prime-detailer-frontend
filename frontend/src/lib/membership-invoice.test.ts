import { describe, expect, it } from "vitest";
import { buildMembershipInvoice } from "./membership-invoice";
import { invoiceSourceColumnLabel, invoiceSourceLedgerLabel, invoiceSourceTitle } from "./invoice-source";
import { invoiceOutstanding, invoicePaidTotal, buildPartyTransactions } from "./party/ledger-math";

describe("membership invoice", () => {
  const inv = buildMembershipInvoice({
    id: "inv-mem-1",
    invoiceNumber: "INV-2026-0200",
    membershipId: "memsub-1",
    packageName: "Silver 1m",
    packagePrice: 2499,
    taxRate: 0,
    taxAmount: 0,
    grandTotal: 2499,
    customerId: "c-1",
    customerName: "Alok",
    customerPhone: "7004509790",
    vehicleRegNumber: "JH19A1234",
    createdAt: "2026-08-18T12:00:00.000Z",
  });

  it("bills only the membership package line", () => {
    expect(inv.source).toBe("MEMBERSHIP");
    expect(inv.jobNumber).toBe("Membership");
    expect(inv.jobCardId).toBe("");
    expect(inv.lineItems).toHaveLength(1);
    expect(inv.lineItems[0]?.description).toBe("Silver 1m membership");
    expect(inv.lineItems[0]?.total).toBe(2499);
    expect(inv.grandTotal).toBe(2499);
    expect(inv.status).toBe("ISSUED");
    expect(inv.payments).toHaveLength(0);
    expect(invoicePaidTotal(inv)).toBe(0);
    expect(invoiceOutstanding(inv)).toBe(2499);
  });

  it("labels as Membership on billing and ledger", () => {
    expect(invoiceSourceColumnLabel(inv)).toBe("Membership");
    expect(invoiceSourceTitle(inv)).toBe("Membership");
    expect(invoiceSourceLedgerLabel(inv)).toBe("Membership");
    const party = {
      id: "c:c-1",
      kind: "customer" as const,
      name: "Alok",
      openingBalance: 0,
      customFields: [],
      customerId: "c-1",
      createdAt: inv.createdAt,
      updatedAt: inv.createdAt,
    };
    const rows = buildPartyTransactions(party, [inv], [], "fy");
    expect(rows.find((r) => r.id === inv.id)?.typeLabel).toBe("Membership");
  });
});
