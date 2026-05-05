import type { Part } from "@/types";

const ML_PER_L = 1000;

/** Parts that use canonical ml stock (fluid products with Litre primary + ML secondary). */
export function isMlTrackedPart(part: Part): boolean {
  return (
    part.stockQuantityMl != null &&
    part.primaryUnit === "Litre" &&
    part.secondaryUnit === "ML"
  );
}

export function mlToLitres(ml: number): number {
  return ml / ML_PER_L;
}

export function litresToMl(litres: number): number {
  return Math.round(litres * ML_PER_L);
}

export function formatLitresFromMl(ml: number, fractionDigits = 2): string {
  const L = mlToLitres(ml);
  return `${L.toLocaleString("en-IN", { maximumFractionDigits: fractionDigits, minimumFractionDigits: 0 })} L`;
}

export function formatMlAndLitres(ml: number): string {
  return `${ml.toLocaleString("en-IN")} ml (${formatLitresFromMl(ml)})`;
}

/** Stock value: per-litre pricing for ml-tracked fluids; else quantity × unit price. */
export function partStockValueInr(part: Part): number {
  if (isMlTrackedPart(part)) {
    return mlToLitres(part.stockQuantityMl!) * part.unitPrice;
  }
  return part.quantity * part.unitPrice;
}

export function getStockStatus(part: Part): {
  label: string;
  className: string;
} {
  if (isMlTrackedPart(part)) {
    const ml = part.stockQuantityMl!;
    const threshold = part.reorderLevelMl ?? 0;
    if (ml <= 0) {
      return {
        label: "Out of Stock",
        className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      };
    }
    if (ml <= threshold) {
      return {
        label: "Low Stock",
        className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      };
    }
    return {
      label: "In Stock",
      className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    };
  }

  if (part.quantity === 0) {
    return {
      label: "Out of Stock",
      className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    };
  }
  if (part.quantity <= part.reorderLevel) {
    return {
      label: "Low Stock",
      className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    };
  }
  return {
    label: "In Stock",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  };
}
