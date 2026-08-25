import { describe, expect, it } from "vitest";
import type { StockMovement } from "@/types";
import {
  inferMovementKind,
  movementDirectionLabel,
  movementKindLabel,
  movementQuantityText,
  movementSignedQuantityText,
} from "@/lib/inventory/movement-labels";

function movement(overrides: Partial<StockMovement>): StockMovement {
  return {
    id: "m-1",
    partId: "p-1",
    type: "OUT",
    quantity: 1,
    unit: "Pack",
    reason: "manual",
    performedBy: "u-1",
    createdAt: "2026-08-26T10:00:00.000Z",
    ...overrides,
  };
}

describe("inventory movement labels", () => {
  it("maps movement kinds to consistent labels", () => {
    expect(movementKindLabel(movement({ movementKind: "PURCHASE", type: "IN" }))).toBe("Purchase");
    expect(movementKindLabel(movement({ movementKind: "ADJUSTMENT" }))).toBe("Adjustment");
    expect(movementKindLabel(movement({ movementKind: "TRANSFER_IN", type: "IN" }))).toBe("Transfer In");
    expect(movementKindLabel(movement({ movementKind: "TRANSFER_OUT", type: "OUT" }))).toBe("Transfer Out");
    expect(movementKindLabel(movement({ movementKind: "JOB_CARD" }))).toBe("Job Card Usage");
    expect(movementKindLabel(movement({ movementKind: "DIRECT_ISSUE", reason: "Direct issue" }))).toBe("Direct Issue");
    expect(movementKindLabel(movement({ movementKind: "RETURN", type: "IN" }))).toBe("Return");
    expect(movementKindLabel(movement({ movementKind: "OTHER" }))).toBe("Other");
  });

  it("shows Counter Sale label for direct issue counter-sale rows", () => {
    const m = movement({ movementKind: "DIRECT_ISSUE", reason: "Counter sale invoice INV-1" });
    expect(movementKindLabel(m)).toBe("Counter Sale");
  });

  it("infers transfer in/out from transfer id + direction", () => {
    expect(inferMovementKind(movement({ movementKind: undefined, transferId: "t-1", type: "IN" }))).toBe("TRANSFER_IN");
    expect(inferMovementKind(movement({ movementKind: undefined, transferId: "t-2", type: "OUT" }))).toBe("TRANSFER_OUT");
  });

  it("formats quantity in absolute form and avoids double-negative output", () => {
    const outNegative = movement({ type: "OUT", quantity: -5, displayQuantity: -5, unit: "Pack", displayUnit: "Pack" });
    expect(movementQuantityText(outNegative)).toBe("5 Pack");
    expect(movementSignedQuantityText(outNegative)).toBe("- 5 Pack");

    const inNegative = movement({ type: "IN", quantity: -3, displayQuantity: -3, unit: "Litre", displayUnit: "Litre" });
    expect(movementQuantityText(inNegative)).toBe("3 Litre");
    expect(movementSignedQuantityText(inNegative)).toBe("+ 3 Litre");
  });

  it("labels direction as Stock In/Stock Out", () => {
    expect(movementDirectionLabel(movement({ type: "OUT" }))).toBe("Stock Out");
    expect(movementDirectionLabel(movement({ type: "IN" }))).toBe("Stock In");
  });
});
