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
  const rl = p.reorderLevel ?? 0;
  if (rl <= 0) return false;
  return p.quantity <= rl;
}

export type ItemPartyRow = {
  itemName: string;
  itemCode: string;
  salesQuantity: number;
  salesAmount: number;
  purchaseQuantity: number;
  purchaseAmount: number;
};

export type PartyItemMovementRow = {
  partyName: string;
  salesQty: number;
  salesAmount: number;
  purchaseQty: number;
  purchaseAmount: number;
};

export function buildItemReportByPartyRows(
  customerId: string,
  invoices: import("@/types").Invoice[],
  period: string,
  category: string,
  parts: Part[]
): ItemPartyRow[] {
  const allowedParts =
    category === "all" ? null : new Set(parts.filter((p) => p.category === category).map((p) => p.id));
  const map = new Map<string, ItemPartyRow>();

  for (const inv of invoices) {
    if (inv.customerId !== customerId || !dateInPreset(inv.createdAt, period)) continue;
    for (const li of inv.lineItems) {
      const key = li.description.trim() || "Item";
      const code = li.hsnSac?.trim() || "—";
      const partMatch = parts.find((p) => p.name === key || p.sku === code);
      if (allowedParts && partMatch && !allowedParts.has(partMatch.id)) continue;
      const existing = map.get(key);
      if (existing) {
        existing.salesQuantity += li.quantity;
        existing.salesAmount += li.total ?? 0;
      } else {
        map.set(key, {
          itemName: key,
          itemCode: code,
          salesQuantity: li.quantity,
          salesAmount: li.total ?? 0,
          purchaseQuantity: 0,
          purchaseAmount: 0,
        });
      }
    }
  }

  return [...map.values()].sort((a, b) => b.salesAmount - a.salesAmount);
}

export function buildPartyReportByItemRows(
  partId: string,
  part: Part | undefined,
  movements: StockMovement[],
  jobCards: import("@/types").JobCard[],
  purchases: import("@/types").ProductPurchase[],
  period: string
): PartyItemMovementRow[] {
  const map = new Map<string, PartyItemMovementRow>();
  const unitPrice = part?.unitPrice ?? 0;

  for (const m of movements) {
    if (m.partId !== partId || !dateInPreset(m.createdAt, period)) continue;
    const qty = m.unit === "ML" ? m.quantity / 1000 : m.quantity;
    const amount = Math.round(qty * unitPrice * 100) / 100;

    if (m.type === "OUT" && m.jobCardId) {
      const jc = jobCards.find((j) => j.id === m.jobCardId);
      const party = jc?.customerName ?? "Walk-in";
      const row = map.get(party) ?? {
        partyName: party,
        salesQty: 0,
        salesAmount: 0,
        purchaseQty: 0,
        purchaseAmount: 0,
      };
      row.salesQty += qty;
      row.salesAmount += amount;
      map.set(party, row);
    }

    if (m.type === "IN") {
      const party = m.vendor ?? "Supplier";
      const row = map.get(party) ?? {
        partyName: party,
        salesQty: 0,
        salesAmount: 0,
        purchaseQty: 0,
        purchaseAmount: 0,
      };
      row.purchaseQty += qty;
      row.purchaseAmount += amount;
      map.set(party, row);
    }
  }

  for (const p of purchases) {
    if (p.partId !== partId || !dateInPreset(p.purchasedAt, period)) continue;
    const qty = p.quantityMl / 1000;
    const amount = Math.round(qty * (p.unitCost ?? unitPrice) * 100) / 100;
    const party = p.vendorName;
    const row = map.get(party) ?? {
      partyName: party,
      salesQty: 0,
      salesAmount: 0,
      purchaseQty: 0,
      purchaseAmount: 0,
    };
    row.purchaseQty += qty;
    row.purchaseAmount += amount;
    map.set(party, row);
  }

  return [...map.values()]
    .filter((r) => r.salesQty > 0 || r.purchaseQty > 0)
    .sort((a, b) => b.salesAmount + b.purchaseAmount - (a.salesAmount + a.purchaseAmount));
}
