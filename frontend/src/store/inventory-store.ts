"use client";

import { create } from "zustand";
import type { Invoice, JobCard, Part, ProductPurchase, StockMovement } from "@/types";
import { deductionsForJob, type ConsumptionDeduction } from "@/lib/inventory/consumption";
import { isMlTrackedPart, litresToMl } from "@/lib/inventory-units";
import { postCollectionSnapshot } from "@/lib/collection-sync";
import { useServiceCatalogStore } from "@/store/service-catalog-store";

interface InventoryStore {
  parts: Part[];
  stockMovements: StockMovement[];
  productPurchases: ProductPurchase[];
  addPart: (part: Part) => void;
  addPurchase: (input: Omit<ProductPurchase, "id">) => void;
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
    if (d.ml != null) {
      if (!isMlTrackedPart(p)) return `${p.name} is not tracked in ml`;
      if ((p.stockQuantityMl ?? 0) < d.ml) {
        return `Insufficient stock: ${p.name} (need ${d.ml} ml)`;
      }
    }
    if (d.count != null && p.quantity < d.count) {
      return `Insufficient stock: ${p.name} (need ${d.count} ${p.primaryUnit})`;
    }
  }
  return null;
}

function applyDeductionToParts(parts: Part[], lines: ConsumptionDeduction[]): Part[] {
  let next = parts.map((p) => ({ ...p }));
  for (const d of lines) {
    const idx = next.findIndex((x) => x.id === d.partId);
    if (idx < 0) continue;
    let p = next[idx];
    if (d.ml != null && isMlTrackedPart(p)) {
      p = {
        ...p,
        stockQuantityMl: Math.max(0, (p.stockQuantityMl ?? 0) - d.ml),
      };
      next[idx] = p;
    }
    if (d.count != null) {
      p = next[idx];
      next[idx] = {
        ...p,
        quantity: Math.max(0, p.quantity - d.count),
      };
    }
  }
  return next;
}

export const useInventoryStore = create<InventoryStore>((set, get) => ({
  parts: [],
  stockMovements: [],
  productPurchases: [],

  addPart: (part) => {
    set((state) => ({
      parts: [part, ...state.parts],
    }));
    persistInventorySnapshot(get);
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

  recordStockAdjustment: (input) => {
    const { partId, direction, amountMl, amountCount, reason, performedBy } = input;
    set((state) => {
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
          return { ...p, quantity: Math.max(0, p.quantity + delta) };
        }
        return p;
      });
      const p = state.parts.find((x) => x.id === partId);
      const qty = amountMl ?? amountCount ?? 0;
      const unit = amountMl != null ? "ML" : p?.primaryUnit ?? "Piece";
      const movement: StockMovement = {
        id: `sm-${Date.now()}`,
        partId,
        type: direction,
        quantity: qty,
        unit,
        reason,
        performedBy,
        createdAt: new Date().toISOString(),
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
    const lines = deductionsForJob(jobCard, catalog);
    if (lines.length === 0) {
      return { ok: true };
    }
    const err = validateDeductions(get().parts, lines);
    if (err) {
      return { ok: false, error: err };
    }
    const newParts = applyDeductionToParts(get().parts, lines);
    const createdAt = new Date().toISOString();
    const newMovements: StockMovement[] = lines.map((d, i) => {
      const p = get().parts.find((x) => x.id === d.partId);
      const qty = d.ml ?? d.count ?? 0;
      const unit = d.ml != null ? "ML" : p?.primaryUnit ?? "Piece";
      return {
        id: `sm-inv-${invoice.id}-${i}-${Date.now()}`,
        partId: d.partId,
        type: "OUT" as const,
        quantity: qty,
        unit,
        reason: `Invoice ${invoice.invoiceNumber}`,
        invoiceId: invoice.id,
        jobCardId: jobCard.id,
        performedBy,
        createdAt,
      };
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
    const lines = deductionsForJob(jobCard, catalog);
    if (lines.length === 0) {
      return { ok: true };
    }
    const err = validateDeductions(get().parts, lines);
    if (err) {
      return { ok: false, error: err };
    }
    const newParts = applyDeductionToParts(get().parts, lines);
    const createdAt = new Date().toISOString();
    const newMovements: StockMovement[] = lines.map((d, i) => {
      const p = get().parts.find((x) => x.id === d.partId);
      const qty = d.ml ?? d.count ?? 0;
      const unit = d.ml != null ? "ML" : p?.primaryUnit ?? "Piece";
      return {
        id: `sm-ready-${jobCard.id}-${i}-${Date.now()}`,
        partId: d.partId,
        type: "OUT" as const,
        quantity: qty,
        unit,
        reason: `Job ready — ${jobCard.jobNumber}`,
        jobCardId: jobCard.id,
        performedBy,
        createdAt,
      };
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
