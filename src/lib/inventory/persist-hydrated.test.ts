import { describe, expect, it } from "vitest";
import type { InventoryCollectionKey } from "@/store/inventory-store";

/** Mirrors persistInventorySnapshot gating (keep in sync with inventory-store). */
function collectionsEligibleForSnapshot(
  hydrated: Partial<Record<InventoryCollectionKey, boolean>>
): InventoryCollectionKey[] {
  const all: InventoryCollectionKey[] = [
    "parts",
    "stockMovements",
    "productPurchases",
    "branchStocks",
    "stockTransfers",
    "partCategories",
  ];
  return all.filter((key) => hydrated[key]);
}

describe("inventory snapshot hydration gate", () => {
  it("excludes productPurchases when only job-card inventory slices are hydrated", () => {
    const eligible = collectionsEligibleForSnapshot({
      parts: true,
      stockMovements: true,
      branchStocks: true,
    });
    expect(eligible).toEqual(["parts", "stockMovements", "branchStocks"]);
    expect(eligible).not.toContain("productPurchases");
  });

  it("includes productPurchases after inventory page hydration", () => {
    const eligible = collectionsEligibleForSnapshot({
      parts: true,
      stockMovements: true,
      productPurchases: true,
      branchStocks: true,
      stockTransfers: true,
      partCategories: true,
    });
    expect(eligible).toContain("productPurchases");
  });
});
