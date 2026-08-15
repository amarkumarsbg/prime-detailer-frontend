"use client";

import { create } from "zustand";
import type { Invoice, JobCard, Part, ProductPurchase, StockMovement } from "@/types";
import { deductionsForJob, type ConsumptionDeduction } from "@/lib/inventory/consumption";
import {
  deductCanonicalSecondary,
  formatAvailableStock,
  getCanonicalStockSecondary,
  initializeDualUnitStock,
  normalizePartUnits,
} from "@/lib/inventory/multi-unit";
import { isMlTrackedPart, litresToMl } from "@/lib/inventory-units";
import { deleteCollectionDocument, postCollectionSnapshot } from "@/lib/collection-sync";
import { useServiceCatalogStore } from "@/store/service-catalog-store";

interface InventoryStore {
  parts: Part[];
  stockMovements: StockMovement[];
  productPurchases: ProductPurchase[];
  addPart: (part: Part) => void;
  updatePart: (partId: string, patch: Partial<Part>) => void;
  removePart: (partId: string) => Promise<void>;
  addPurchase: (input: Omit<ProductPurchase, "id">) => void;
  renamePurchaseVendor: (fromName: string, toName: string) => void;
  recordStockAdjustment: (input: {
    partId: string;
    direction: "IN" | "OUT";
    amountMl?: number;
    amountCount?: number;
    reason: string;
    performedBy: string;
  }) => void;
  applyDeductionForInvoice: (
    invoice: Invoice,
    jobCard: JobCard | undefined,
    performedBy: string
  ) => { ok: boolean; error?: string };
  applyDeductionForJobCardReady: (
    jobCard: JobCard,
    performedBy: string
  ) => { ok: boolean; error?: string };
}

function persistInventorySnapshot(get: () => InventoryStore): void {
  const { parts, stockMovements, productPurchases } = get();
  void Promise.all([
    postCollectionSnapshot("parts", parts),
    postCollectionSnapshot("stockMovements", stockMovements),
    postCollectionSnapshot("productPurchases", productPurchases),
  ]);
}

function validateDeductions(parts: Part[], lines: ConsumptionDeduction[]): string | null {
  for (const d of lines) {
    const p = parts.find((x) => x.id === d.partId);
    if (!p) return `Unknown part: ${d.partId}`;
    const before = getCanonicalStockSecondary(p);
    if (d.ml != null) {
      if (!isMlTrackedPart(p)) return `${p.name} is not tracked in ml`;
      if (before < d.ml) {
        return `Insufficient stock: ${p.name} (need ${d.ml} ml)`;
      }
    }
    if (d.secondaryUnits != null && before < d.secondaryUnits) {
      const unit = d.displayUnit ?? p.secondaryUnit;
      return `Insufficient stock: ${p.name} — only ${formatAvailableStock(p, unit)} available`;
    }
    if (d.primaryCount != null && p.quantity < d.primaryCount) {
      return `Insufficient stock: ${p.name} (need ${d.primaryCount} ${p.primaryUnit})`;
    }
  }
  return null;
}

function applyDeductionToParts(parts: Part[], lines: ConsumptionDeduction[]): Part[] {
  const next = parts.map((p) => ({ ...p }));
  for (const d of lines) {
    const idx = next.findIndex((x) => x.id === d.partId);
    if (idx < 0) continue;
    const p = next[idx];
    const amount = d.ml ?? d.secondaryUnits ?? 0;
    if (d.ml != null || d.secondaryUnits != null) {
      next[idx] = deductCanonicalSecondary(p, amount);
      continue;
    }
    if (d.primaryCount != null) {
      next[idx] = {
        ...p,
        quantity: Math.max(0, p.quantity - d.primaryCount),
      };
    }
  }
  return next;
}

function movementFromDeduction(
  d: ConsumptionDeduction,
  part: Part | undefined,
  base: Omit<
    StockMovement,
    "quantity" | "unit" | "stockBeforeSecondary" | "stockAfterSecondary" | "displayQuantity" | "displayUnit"
  >
): StockMovement {
  const before = part ? getCanonicalStockSecondary(part) : 0;
  const delta = d.ml ?? d.secondaryUnits ?? d.primaryCount ?? 0;
  const after = Math.max(0, before - delta);
  const unit = d.displayUnit ?? (d.ml != null ? "ML" : part?.secondaryUnit ?? part?.primaryUnit ?? "Piece");
  const qty = d.displayQuantity ?? d.ml ?? d.secondaryUnits ?? d.primaryCount ?? 0;
  return {
    ...base,
    quantity: qty,
    unit,
    stockBeforeSecondary: before,
    stockAfterSecondary: after,
    displayQuantity: d.displayQuantity ?? qty,
    displayUnit: unit,
  };
}

export const useInventoryStore = create<InventoryStore>((set, get) => ({
  parts: [],
  stockMovements: [],
  productPurchases: [],

  addPart: (part) => {
    set((state) => ({
      parts: [normalizePartUnits(initializeDualUnitStock(part)), ...state.parts],
    }));
    persistInventorySnapshot(get);
  },

  updatePart: (partId, patch) => {
    set((state) => ({
      parts: state.parts.map((p) => {
        if (p.id !== partId) return p;
        return normalizePartUnits(initializeDualUnitStock({ ...p, ...patch, id: partId }));
      }),
    }));
    persistInventorySnapshot(get);
  },

  removePart: async (partId) => {
    const { parts, stockMovements, productPurchases } = get();
    const nextMovements = stockMovements.filter((m) => m.partId !== partId);
    const nextPurchases = productPurchases.filter((p) => p.partId !== partId);
    const catalog = useServiceCatalogStore.getState().catalog;
    const needsCatalogUpdate = catalog.some((s) =>
      s.consumptionProfile?.some((l) => l.partId === partId)
    );

    await deleteCollectionDocument("parts", partId);
    await Promise.all([
      postCollectionSnapshot("stockMovements", nextMovements),
      postCollectionSnapshot("productPurchases", nextPurchases),
    ]);
    if (needsCatalogUpdate) {
      await useServiceCatalogStore.getState().setCatalog((prev) =>
        prev.map((s) => ({
          ...s,
          consumptionProfile: (s.consumptionProfile ?? []).filter((l) => l.partId !== partId),
        }))
      );
    }

    set({
      parts: parts.filter((p) => p.id !== partId),
      stockMovements: nextMovements,
      productPurchases: nextPurchases,
    });
  },

  addPurchase: (input) => {
    const id = `pp-${Date.now()}`;
    const purchase: ProductPurchase = { ...input, id };
    set((state) => {
      const parts = state.parts.map((p) => {
        if (p.id !== input.partId) return p;
        if (isMlTrackedPart(p)) {
          return {
            ...p,
            stockQuantityMl: (p.stockQuantityMl ?? 0) + input.quantityMl,
            lastRestocked: input.purchasedAt,
          };
        }
        return p;
      });
      const movement: StockMovement = {
        id: `sm-${Date.now()}`,
        partId: input.partId,
        type: "IN",
        quantity: input.quantityMl,
        unit: "ML",
        reason: `Purchase${input.reference ? ` (${input.reference})` : ""}`,
        vendor: input.vendorName,
        purchaseId: id,
        performedBy: input.recordedBy,
        createdAt: input.purchasedAt,
      };
      return {
        parts,
        productPurchases: [purchase, ...state.productPurchases],
        stockMovements: [movement, ...state.stockMovements],
      };
    });
    persistInventorySnapshot(get);
  },

  renamePurchaseVendor: (fromName, toName) => {
    const from = fromName.trim();
    const to = toName.trim();
    if (!from || !to || from === to) return;
    set((state) => ({
      productPurchases: state.productPurchases.map((p) =>
        p.vendorName.trim() === from ? { ...p, vendorName: to } : p
      ),
      stockMovements: state.stockMovements.map((m) =>
        m.vendor?.trim() === from ? { ...m, vendor: to } : m
      ),
    }));
    persistInventorySnapshot(get);
  },

  recordStockAdjustment: (input) => {
    const { partId, direction, amountMl, amountCount, reason, performedBy } = input;
    set((state) => {
      const beforePart = state.parts.find((x) => x.id === partId);
      const before = beforePart ? getCanonicalStockSecondary(beforePart) : 0;
      const parts = state.parts.map((p) => {
        if (p.id !== partId) return p;
        if (amountMl != null && isMlTrackedPart(p)) {
          const delta = direction === "IN" ? amountMl : -amountMl;
          return {
            ...p,
            stockQuantityMl: Math.max(0, (p.stockQuantityMl ?? 0) + delta),
          };
        }
        if (amountCount != null) {
          const delta = direction === "IN" ? amountCount : -amountCount;
          if (p.stockQuantitySecondary != null) {
            return deductCanonicalSecondary(
              { ...p, stockQuantitySecondary: (p.stockQuantitySecondary ?? 0) + delta },
              0
            );
          }
          return { ...p, quantity: Math.max(0, p.quantity + delta) };
        }
        return p;
      });
      const afterPart = parts.find((x) => x.id === partId);
      const after = afterPart ? getCanonicalStockSecondary(afterPart) : before;
      const qty = amountMl ?? amountCount ?? 0;
      const unit = amountMl != null ? "ML" : afterPart?.primaryUnit ?? "Piece";
      const movement: StockMovement = {
        id: `sm-${Date.now()}`,
        partId,
        type: direction,
        quantity: qty,
        unit,
        reason,
        performedBy,
        createdAt: new Date().toISOString(),
        stockBeforeSecondary: before,
        stockAfterSecondary: after,
        displayQuantity: qty,
        displayUnit: unit,
      };
      return {
        parts,
        stockMovements: [movement, ...state.stockMovements],
      };
    });
    persistInventorySnapshot(get);
  },

  applyDeductionForInvoice: (invoice, jobCard, performedBy) => {
    const catalog = useServiceCatalogStore.getState().catalog;
    if (invoice.inventoryDeductedAt) {
      return { ok: true };
    }
    if (!jobCard) {
      return { ok: false, error: "Job card not found for this invoice." };
    }
    const lines = deductionsForJob(jobCard, catalog, get().parts);
    if (lines.length === 0) {
      return { ok: true };
    }
    const err = validateDeductions(get().parts, lines);
    if (err) {
      return { ok: false, error: err };
    }
    const currentParts = get().parts;
    const newParts = applyDeductionToParts(currentParts, lines);
    const createdAt = new Date().toISOString();
    const newMovements: StockMovement[] = lines.map((d, i) => {
      const p = currentParts.find((x) => x.id === d.partId);
      return movementFromDeduction(d, p, {
        id: `sm-inv-${invoice.id}-${i}-${Date.now()}`,
        partId: d.partId,
        type: "OUT",
        reason: `Invoice ${invoice.invoiceNumber}`,
        invoiceId: invoice.id,
        jobCardId: jobCard.id,
        performedBy,
        createdAt,
      });
    });
    set({
      parts: newParts,
      stockMovements: [...newMovements, ...get().stockMovements],
    });
    persistInventorySnapshot(get);
    return { ok: true };
  },

  applyDeductionForJobCardReady: (jobCard, performedBy) => {
    const catalog = useServiceCatalogStore.getState().catalog;
    if (jobCard.inventoryConsumedAt) {
      return { ok: true };
    }
    const lines = deductionsForJob(jobCard, catalog, get().parts);
    if (lines.length === 0) {
      return { ok: true };
    }
    const err = validateDeductions(get().parts, lines);
    if (err) {
      return { ok: false, error: err };
    }
    const currentParts = get().parts;
    const newParts = applyDeductionToParts(currentParts, lines);
    const createdAt = new Date().toISOString();
    const newMovements: StockMovement[] = lines.map((d, i) => {
      const p = currentParts.find((x) => x.id === d.partId);
      return movementFromDeduction(d, p, {
        id: `sm-ready-${jobCard.id}-${i}-${Date.now()}`,
        partId: d.partId,
        type: "OUT",
        reason: `Job ready — ${jobCard.jobNumber}`,
        jobCardId: jobCard.id,
        performedBy,
        createdAt,
      });
    });
    set({
      parts: newParts,
      stockMovements: [...newMovements, ...get().stockMovements],
    });
    persistInventorySnapshot(get);
    return { ok: true };
  },
}));

export function parseLitresInput(value: string): number | null {
  const n = parseFloat(value.replace(/,/g, ""));
  if (Number.isNaN(n) || n < 0) return null;
  return litresToMl(n);
}
