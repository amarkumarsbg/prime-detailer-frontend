import { describe, expect, it } from "vitest";
import type { Part, ProductPurchase } from "@/types";
import {
  applyCreatedPartAndAppendBlank,
  buildLatestPurchaseByPartId,
  createEmptyDraftItem,
  removeDraftItem,
} from "@/lib/inventory/purchase-item-flow";

function makePart(overrides: Partial<Part> = {}): Part {
  return {
    id: "part-1",
    name: "MICROFIBRE",
    sku: "MF-001",
    category: "Detailing",
    quantity: 5,
    primaryUnit: "PCS",
    secondaryUnit: "PCS",
    conversionFactor: 1,
    unitPrice: 100,
    reorderLevel: 1,
    supplier: "",
    lastRestocked: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("purchase item creation flow", () => {
  it("adds created item and appends the next blank row", () => {
    const created = makePart({ id: "part-new", name: "MICROFIBRE", costPrice: 50, quantity: 5 });
    const initial = [createEmptyDraftItem()];

    const next = applyCreatedPartAndAppendBlank(initial, created, null);

    expect(next.length).toBe(2);
    expect(next[0]?.partId).toBe("part-new");
    expect(next[0]?.quantity).toBe("5");
    expect(next[0]?.unitPrice).toBe("50");
    expect(next[1]?.partId).toBe("");
    expect(next[1]?.lockPart).toBeUndefined();
  });

  it("keeps created item in previous row and does not auto-select part in new row", () => {
    const created = makePart({ id: "part-new-2", quantity: 1 });
    const seeded = [
      { ...createEmptyDraftItem(), key: "k1", partId: "part-old", quantity: "2" },
      { ...createEmptyDraftItem(), key: "k2" },
    ];

    const next = applyCreatedPartAndAppendBlank(seeded, created, "k2");

    expect(next.length).toBe(3);
    expect(next[1]?.partId).toBe("part-new-2");
    expect(next[2]?.partId).toBe("");
  });

  it("deletes purchase line directly from purchase rows", () => {
    const rows = [
      { ...createEmptyDraftItem(), key: "a", partId: "p1" },
      { ...createEmptyDraftItem(), key: "b", partId: "p2" },
    ];
    const next = removeDraftItem(rows, "a");
    expect(next).toHaveLength(1);
    expect(next[0]?.key).toBe("b");
  });
});

describe("parts catalog purchase linkage", () => {
  it("maps part -> vendor + invoice + purchase using latest purchase first", () => {
    const purchases: ProductPurchase[] = [
      {
        id: "pur-old",
        partId: "part-1",
        vendorName: "Old Vendor",
        quantityMl: 0,
        purchasedAt: "2026-01-01T00:00:00.000Z",
        recordedBy: "u1",
        supplierInvoiceNumber: "INV-OLD",
      },
      {
        id: "pur-new",
        partId: "part-1",
        vendorName: "ABC Suppliers",
        quantityMl: 0,
        purchasedAt: "2026-08-20T00:00:00.000Z",
        recordedBy: "u1",
        supplierInvoiceNumber: "PUR-2026-0042",
        purchaseNumber: "PUR-0042",
        items: [
          {
            partId: "part-1",
            partName: "MICROFIBRE",
            sku: "MF-001",
            quantity: 5,
            unit: "PCS",
            unitPrice: 100,
            discount: 0,
            gstRate: 18,
            taxableAmount: 500,
            gstAmount: 90,
            lineTotal: 590,
          },
        ],
      },
    ];

    const map = buildLatestPurchaseByPartId(purchases);
    const meta = map.get("part-1");

    expect(meta).toBeDefined();
    expect(meta?.purchaseId).toBe("pur-new");
    expect(meta?.vendorName).toBe("ABC Suppliers");
    expect(meta?.supplierInvoiceNumber).toBe("PUR-2026-0042");
  });

  it("keeps old items safe when no purchase relation exists", () => {
    const map = buildLatestPurchaseByPartId([]);
    expect(map.get("legacy-part-without-purchase")).toBeUndefined();
  });
});
