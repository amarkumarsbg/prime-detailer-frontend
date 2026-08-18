import type { BranchStock, Part } from "@/types";
import { getCanonicalStockSecondary } from "@/lib/inventory/multi-unit";

export function branchStockRowId(partId: string, branchId: string): string {
  return `bs-${partId}-${branchId}`;
}

export function findBranchStock(
  stocks: BranchStock[],
  partId: string,
  branchId: string
): BranchStock | undefined {
  return stocks.find((s) => s.partId === partId && s.branchId === branchId);
}

export function partHasBranchAllocation(stocks: BranchStock[], partId: string): boolean {
  return stocks.some((s) => s.partId === partId);
}

/** On-hand at a branch. Legacy catalog-only parts count as available until allocated. */
export function getBranchCanonicalQty(
  stocks: BranchStock[],
  part: Part,
  branchId: string
): number {
  const row = findBranchStock(stocks, part.id, branchId);
  if (row) return row.quantity;
  if (partHasBranchAllocation(stocks, part.id)) return 0;
  return getCanonicalStockSecondary(part);
}

export function upsertBranchStockQty(
  stocks: BranchStock[],
  partId: string,
  branchId: string,
  quantity: number,
  now: string,
  extra?: { location?: string; minStock?: number }
): BranchStock[] {
  const id = branchStockRowId(partId, branchId);
  const qty = Math.max(0, quantity);
  const existing = stocks.find((s) => s.id === id || (s.partId === partId && s.branchId === branchId));
  const next: BranchStock = {
    id: existing?.id ?? id,
    partId,
    branchId,
    quantity: qty,
    location: extra?.location ?? existing?.location,
    minStock: extra?.minStock ?? existing?.minStock,
    updatedAt: now,
  };
  if (!existing) return [next, ...stocks];
  return stocks.map((s) => (s.id === existing.id ? next : s));
}

export function applyBranchCanonicalDelta(
  stocks: BranchStock[],
  part: Part,
  branchId: string,
  delta: number,
  now: string
): { ok: true; stocks: BranchStock[]; before: number; after: number } | { ok: false; error: string } {
  const before = getBranchCanonicalQty(stocks, part, branchId);
  const after = before + delta;
  if (after < -1e-9) {
    return {
      ok: false,
      error: `Insufficient stock at this branch for ${part.name} (available ${before.toLocaleString("en-IN")})`,
    };
  }
  return {
    ok: true,
    stocks: upsertBranchStockQty(stocks, part.id, branchId, Math.max(0, after), now),
    before,
    after: Math.max(0, after),
  };
}
