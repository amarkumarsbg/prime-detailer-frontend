import type { Part, ProductPurchase } from "@/types";

export type DraftItemRow = {
  key: string;
  partId: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  gstRate: string;
  lockPart?: boolean;
};

export type PartPurchaseMeta = {
  purchaseId: string;
  purchaseNumber?: string;
  vendorName: string;
  supplierInvoiceNumber?: string;
};

export function createEmptyDraftItem(): DraftItemRow {
  return {
    key: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    partId: "",
    quantity: "1",
    unitPrice: "",
    discount: "0",
    gstRate: "18",
  };
}

export function createLockedBlankDraftItem(): DraftItemRow {
  return {
    key: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    partId: "",
    quantity: "",
    unitPrice: "",
    discount: "",
    gstRate: "",
    lockPart: true,
  };
}

export function applyPartToDraftItems(
  prev: DraftItemRow[],
  part: Part,
  targetKey?: string | null
): DraftItemRow[] {
  let openingQty = 1;
  if (part.stockQuantityMl != null && part.stockQuantityMl > 0) {
    openingQty = part.stockQuantityMl / 1000;
  } else if (
    part.stockQuantitySecondary != null &&
    part.stockQuantitySecondary > 0 &&
    (part.conversionFactor ?? 1) > 1
  ) {
    openingQty = Math.round(part.stockQuantitySecondary / (part.conversionFactor ?? 1));
  } else if (part.quantity > 0) {
    openingQty = part.quantity;
  }

  const patch = {
    partId: part.id,
    quantity: String(openingQty),
    unitPrice: String(part.costPrice ?? part.unitPrice ?? ""),
    gstRate: part.gstApplicable === false ? "0" : String(part.gstRate ?? 18),
    lockPart: true,
  };

  if (targetKey && prev.some((i) => i.key === targetKey)) {
    return prev.map((i) => (i.key === targetKey ? { ...i, ...patch } : i));
  }

  const emptyIdx = prev.findIndex((i) => !i.partId);
  if (emptyIdx >= 0) {
    const next = [...prev];
    next[emptyIdx] = { ...next[emptyIdx]!, ...patch };
    return next;
  }

  return [...prev, { ...createEmptyDraftItem(), ...patch }];
}

export function ensureTrailingBlankRow(rows: DraftItemRow[]): DraftItemRow[] {
  if (rows.length === 0) return [createLockedBlankDraftItem()];
  const last = rows[rows.length - 1];
  if (last && !last.partId) return rows;
  return [...rows, createLockedBlankDraftItem()];
}

export function applyCreatedPartAndAppendBlank(
  prev: DraftItemRow[],
  part: Part,
  targetKey?: string | null
): DraftItemRow[] {
  return applyPartToDraftItems(prev, part, targetKey);
}

export function removeDraftItem(rows: DraftItemRow[], key: string): DraftItemRow[] {
  return rows.filter((row) => row.key !== key);
}

export function buildLatestPurchaseByPartId(
  purchases: ProductPurchase[]
): Map<string, PartPurchaseMeta> {
  const map = new Map<string, PartPurchaseMeta>();
  const sorted = [...purchases].sort(
    (a, b) => Date.parse(b.purchasedAt) - Date.parse(a.purchasedAt)
  );

  for (const purchase of sorted) {
    const linePartIds = purchase.items?.map((line) => line.partId) ?? [];
    const partIds = linePartIds.length > 0 ? linePartIds : purchase.partId ? [purchase.partId] : [];
    for (const pid of partIds) {
      if (!pid || map.has(pid)) continue;
      map.set(pid, {
        purchaseId: purchase.id,
        purchaseNumber: purchase.purchaseNumber,
        vendorName: purchase.vendorName,
        supplierInvoiceNumber: purchase.supplierInvoiceNumber,
      });
    }
  }

  return map;
}
