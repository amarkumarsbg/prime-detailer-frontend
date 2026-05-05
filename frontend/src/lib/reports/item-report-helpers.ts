import type { Part, StockMovement } from "@/types";
import { dateInPreset } from "@/lib/reports/report-period-presets";

export function partStockQtyDisplay(p: Part): string {
  if (p.stockQuantityMl != null) {
    return `${(p.stockQuantityMl / 1000).toFixed(1)} L`;
  }
  return `${p.quantity.toFixed(1)} PCS`;
}

/** Numeric quantity for totals (litres for fluids, pieces for count parts). */
export function partNumericStock(p: Part): number {
  if (p.stockQuantityMl != null) return p.stockQuantityMl / 1000;
  return p.quantity;
}

export function partStockValue(p: Part): number {
  if (p.stockQuantityMl != null) {
    return (p.stockQuantityMl / 1000) * p.unitPrice;
  }
  return p.quantity * p.unitPrice;
}

export function movementQtyDisplay(m: StockMovement): string {
  if (m.unit === "ML") {
    return `${(m.quantity / 1000).toFixed(2)} L`;
  }
  return `${m.quantity} ${m.unit}`;
}

function movementAmountForAgg(m: StockMovement): number {
  if (m.unit === "ML") return m.quantity / 1000;
  return m.quantity;
}

export type SalesPurchaseRow = {
  partId: string;
  itemName: string;
  salesQty: number;
  purchaseQty: number;
};

export function aggregateItemSalesPurchase(
  parts: Part[],
  movements: StockMovement[],
  category: string,
  period: string
): SalesPurchaseRow[] {
  const filteredParts =
    category === "all" ? parts : parts.filter((p) => p.category === category);
  const allowed = new Set(filteredParts.map((p) => p.id));
  const mov = movements.filter(
    (m) => dateInPreset(m.createdAt, period) && allowed.has(m.partId)
  );
  const agg = new Map<string, { s: number; p: number }>();
  for (const m of mov) {
    const cur = agg.get(m.partId) ?? { s: 0, p: 0 };
    const amt = movementAmountForAgg(m);
    if (m.type === "OUT") cur.s += amt;
    if (m.type === "IN") cur.p += amt;
    agg.set(m.partId, cur);
  }
  return filteredParts
    .map((part) => {
      const a = agg.get(part.id) ?? { s: 0, p: 0 };
      return {
        partId: part.id,
        itemName: part.name,
        salesQty: Math.round(a.s * 1000) / 1000,
        purchaseQty: Math.round(a.p * 1000) / 1000,
      };
    })
    .filter((row) => row.salesQty > 0 || row.purchaseQty > 0);
}

export function isLowStockPart(p: Part): boolean {
  if (p.stockQuantityMl != null) {
    const rl = p.reorderLevelMl ?? 0;
    if (rl <= 0) return false;
    return p.stockQuantityMl <= rl;
  }
  if (p.reorderLevel <= 0) return false;
  return p.quantity <= p.reorderLevel;
}
