import type { Part } from "@/types";
import { isMlTrackedPart, litresToMl, mlToLitres } from "@/lib/inventory-units";

export function unitsMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Primary + secondary with conversion (BOX/PCS, KG/GM, Litre/ML). */
export function hasDualUnitPart(part: Part): boolean {
  if (isMlTrackedPart(part)) return true;
  const cf = part.conversionFactor;
  if (!Number.isFinite(cf) || cf <= 1) return false;
  const sec = part.secondaryUnit?.trim();
  const pri = part.primaryUnit?.trim();
  if (!sec || !pri) return false;
  return !unitsMatch(sec, pri);
}

const PACK_UNIT_RE = /^(box|pack|carton|case)$/i;
const COUNT_UNIT_RE = /^(pcs|pc|piece|pieces|ea|each|unit|units)$/i;

function titleUnit(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (COUNT_UNIT_RE.test(t)) return "PCS";
  if (/^box$/i.test(t)) return "Box";
  if (/^pack$/i.test(t)) return "Pack";
  if (/^carton$/i.test(t)) return "Carton";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Repair inverted dual-unit seed/legacy rows where primary was PCS and secondary was Box
 * (model is 1 primary pack = N secondary count units).
 */
export function normalizePartUnits(part: Part): Part {
  if (part.stockQuantityMl != null) {
    return {
      ...part,
      primaryUnit: "Litre",
      secondaryUnit: "ML",
      conversionFactor: 1000,
    };
  }

  const pri = part.primaryUnit?.trim() ?? "";
  const sec = part.secondaryUnit?.trim() ?? "";
  const cf = part.conversionFactor;
  if (
    Number.isFinite(cf) &&
    cf > 1 &&
    COUNT_UNIT_RE.test(pri) &&
    PACK_UNIT_RE.test(sec)
  ) {
    const secondaryStock = part.stockQuantitySecondary ?? part.quantity;
    return initializeDualUnitStock({
      ...part,
      primaryUnit: titleUnit(sec),
      secondaryUnit: "PCS",
      conversionFactor: cf,
      stockQuantitySecondary: secondaryStock,
      quantity: Math.floor(secondaryStock / cf),
    });
  }

  if (hasDualUnitPart(part) && part.stockQuantitySecondary == null) {
    return initializeDualUnitStock(part);
  }
  return part;
}

export function getSelectableUnits(part: Part): string[] {
  if (isMlTrackedPart(part)) {
    return [part.primaryUnit || "Litre", part.secondaryUnit || "ML"];
  }
  if (hasDualUnitPart(part)) {
    return [part.primaryUnit, part.secondaryUnit];
  }
  return [part.primaryUnit || "Piece"];
}

/** Canonical on-hand stock in secondary units (PCS, ML, GM, …). */
export function getCanonicalStockSecondary(part: Part): number {
  if (isMlTrackedPart(part)) {
    return part.stockQuantityMl ?? 0;
  }
  if (part.stockQuantitySecondary != null) {
    return part.stockQuantitySecondary;
  }
  if (hasDualUnitPart(part)) {
    return part.quantity * part.conversionFactor;
  }
  return part.quantity;
}

export function syncPrimaryQuantityFromCanonical(part: Part): Part {
  if (isMlTrackedPart(part)) return part;
  if (!hasDualUnitPart(part)) return part;
  const sec = getCanonicalStockSecondary(part);
  const cf = part.conversionFactor;
  return {
    ...part,
    stockQuantitySecondary: sec,
    quantity: Math.floor(sec / cf),
  };
}

export function initializeDualUnitStock(part: Part): Part {
  if (isMlTrackedPart(part)) return part;
  if (!hasDualUnitPart(part)) {
    return { ...part, stockQuantitySecondary: undefined };
  }
  return syncPrimaryQuantityFromCanonical({
    ...part,
    stockQuantitySecondary: part.quantity * part.conversionFactor,
  });
}

export interface DualStockDisplay {
  primaryQty: number;
  secondaryRemainder: number;
  canonicalSecondary: number;
  primaryUnit: string;
  secondaryUnit: string;
}

export function getDualStockDisplay(part: Part): DualStockDisplay | null {
  if (isMlTrackedPart(part)) {
    const ml = part.stockQuantityMl ?? 0;
    return {
      primaryQty: mlToLitres(ml),
      secondaryRemainder: ml,
      canonicalSecondary: ml,
      primaryUnit: part.primaryUnit,
      secondaryUnit: part.secondaryUnit,
    };
  }
  if (!hasDualUnitPart(part)) return null;
  const cf = part.conversionFactor;
  const canonical = getCanonicalStockSecondary(part);
  return {
    primaryQty: Math.floor(canonical / cf),
    secondaryRemainder: canonical % cf,
    canonicalSecondary: canonical,
    primaryUnit: part.primaryUnit,
    secondaryUnit: part.secondaryUnit,
  };
}

export function formatDualUnitStock(part: Part): string {
  if (isMlTrackedPart(part)) {
    const ml = part.stockQuantityMl ?? 0;
    return `${mlToLitres(ml).toLocaleString("en-IN")} ${part.primaryUnit}`;
  }
  const d = getDualStockDisplay(part);
  if (!d) {
    return `${part.quantity.toLocaleString("en-IN")} ${part.primaryUnit}`;
  }
  if (d.secondaryRemainder === 0) {
    return `${d.primaryQty.toLocaleString("en-IN")} ${d.primaryUnit}`;
  }
  if (d.primaryQty === 0) {
    return `${d.secondaryRemainder.toLocaleString("en-IN")} ${d.secondaryUnit}`;
  }
  return `${d.primaryQty.toLocaleString("en-IN")} ${d.primaryUnit} + ${d.secondaryRemainder.toLocaleString("en-IN")} ${d.secondaryUnit}`;
}

export function formatDualUnitStockEquivalent(part: Part): string | null {
  if (isMlTrackedPart(part) || !hasDualUnitPart(part)) return null;
  const d = getDualStockDisplay(part);
  if (!d) return null;
  return `${d.canonicalSecondary.toLocaleString("en-IN")} ${d.secondaryUnit}`;
}

export function getUnitPrice(part: Part, unit: string): number {
  if (unitsMatch(unit, part.primaryUnit)) {
    return part.unitPrice;
  }
  if (part.unitPriceSecondary != null && Number.isFinite(part.unitPriceSecondary)) {
    return part.unitPriceSecondary;
  }
  const cf = part.conversionFactor;
  if (cf > 0 && unitsMatch(unit, part.secondaryUnit)) {
    return part.unitPrice / cf;
  }
  return part.unitPrice;
}

export function quantityToCanonicalSecondary(part: Part, qty: number, unit: string): number {
  if (isMlTrackedPart(part)) {
    if (unitsMatch(unit, part.primaryUnit) || unitsMatch(unit, "Litre")) {
      return litresToMl(qty);
    }
    return qty;
  }
  if (hasDualUnitPart(part) && unitsMatch(unit, part.primaryUnit)) {
    return qty * part.conversionFactor;
  }
  return qty;
}

export function canonicalSecondaryToUnitQty(part: Part, canonical: number, unit: string): number {
  if (isMlTrackedPart(part)) {
    if (unitsMatch(unit, part.primaryUnit) || unitsMatch(unit, "Litre")) {
      return mlToLitres(canonical);
    }
    return canonical;
  }
  if (hasDualUnitPart(part) && unitsMatch(unit, part.primaryUnit)) {
    return canonical / part.conversionFactor;
  }
  return canonical;
}

export function formatAvailableStock(part: Part, unit?: string): string {
  const canonical = getCanonicalStockSecondary(part);
  const u = unit ?? (hasDualUnitPart(part) ? part.secondaryUnit : part.primaryUnit);
  const qty = canonicalSecondaryToUnitQty(part, canonical, u);
  const formatted = Number.isInteger(qty)
    ? qty.toLocaleString("en-IN")
    : qty.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  return `${formatted} ${u}`;
}

export function validateStockConsumption(
  part: Part,
  qty: number,
  unit: string
): { ok: true } | { ok: false; message: string } {
  if (qty <= 0) return { ok: false, message: "Quantity must be greater than zero" };
  const needed = quantityToCanonicalSecondary(part, qty, unit);
  const available = getCanonicalStockSecondary(part);
  if (needed > available + 1e-9) {
    return {
      ok: false,
      message: `Insufficient stock — only ${formatAvailableStock(part, unit)} available`,
    };
  }
  return { ok: true };
}

export function deductCanonicalSecondary(part: Part, amount: number): Part {
  if (isMlTrackedPart(part)) {
    return {
      ...part,
      stockQuantityMl: Math.max(0, (part.stockQuantityMl ?? 0) - amount),
    };
  }
  const current = getCanonicalStockSecondary(part);
  const next = Math.max(0, current - amount);
  return syncPrimaryQuantityFromCanonical({ ...part, stockQuantitySecondary: next });
}

export function partMatchesInventorySearch(part: Part, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    part.name.toLowerCase().includes(q) ||
    part.sku.toLowerCase().includes(q) ||
    (part.brand?.toLowerCase().includes(q) ?? false) ||
    (part.barcode?.toLowerCase().includes(q) ?? false)
  );
}
