import { describe, expect, it } from "vitest";
import type { Part, StockMovement } from "@/types";
import { buildInventoryHistoryExportRows } from "@/lib/inventory/history-export";

function movement(overrides: Partial<StockMovement>): StockMovement {
  return {
    id: "m-1",
    partId: "p-1",
    type: "OUT",
    quantity: 5,
    unit: "Pack",
    reason: "Counter sale",
    performedBy: "u-1",
    createdAt: "2026-08-26T10:00:00.000Z",
    ...overrides,
  };
}

const parts: Part[] = [
  {
    id: "p-1",
    name: "Microfibre",
    sku: "MF-01",
    category: "Detailing",
    quantity: 100,
    primaryUnit: "Pack",
    secondaryUnit: "Pack",
    conversionFactor: 1,
    unitPrice: 100,
    reorderLevel: 5,
    supplier: "",
    lastRestocked: "2026-08-26T00:00:00.000Z",
  },
];

describe("inventory history export rows", () => {
  it("exports stock-out quantity with clear direction", () => {
    const rows = buildInventoryHistoryExportRows(
      [movement({ movementKind: "DIRECT_ISSUE", reason: "Counter Sale" })],
      parts,
      () => "Main",
      () => "Admin"
    );
    expect(rows[0]?.type).toBe("Counter Sale");
    expect(rows[0]?.qty).toBe("- 5 Pack (Stock Out)");
  });

  it("exports stock-in quantity with clear direction", () => {
    const rows = buildInventoryHistoryExportRows(
      [movement({ type: "IN", movementKind: "PURCHASE", quantity: 7, unit: "Litre" })],
      parts,
      () => "Main",
      () => "Admin"
    );
    expect(rows[0]?.type).toBe("Purchase");
    expect(rows[0]?.qty).toBe("+ 7 Litre (Stock In)");
  });
});
