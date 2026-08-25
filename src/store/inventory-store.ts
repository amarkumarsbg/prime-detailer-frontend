"use client";

import { create } from "zustand";
import type {
  BranchStock,
  Invoice,
  JobCard,
  Part,
  PartCategoryRecord,
  PaymentMethod,
  ProductPurchase,
  StockMovement,
  StockMovementKind,
  StockTransfer,
  StockTransferItem,
  StockTransferStatus,
} from "@/types";
import { deductionsForJob, type ConsumptionDeduction } from "@/lib/inventory/consumption";
import {
  addCanonicalSecondary,
  deductCanonicalSecondary,
  formatAvailableStock,
  getCanonicalStockSecondary,
  initializeDualUnitStock,
  normalizePartUnits,
  quantityToCanonicalSecondary,
} from "@/lib/inventory/multi-unit";
import { isMlTrackedPart, litresToMl } from "@/lib/inventory-units";
import { deleteCollectionDocument, postCollectionSnapshot } from "@/lib/collection-sync";
import { useServiceCatalogStore } from "@/store/service-catalog-store";
import { calcPurchaseTotals } from "@/lib/inventory/purchase-math";
import { applyBranchCanonicalDelta, getBranchCanonicalQty, upsertBranchStockQty } from "@/lib/inventory/branch-stock";
import { mergePartCategoryNames, normalizePartCategoryName } from "@/lib/inventory/part-categories";

interface InventoryStore {
  parts: Part[];
  stockMovements: StockMovement[];
  productPurchases: ProductPurchase[];
  branchStocks: BranchStock[];
  stockTransfers: StockTransfer[];
  partCategories: PartCategoryRecord[];
  addPart: (part: Part) => Part;
  addPartCategory: (name: string) => { ok: true; name: string } | { ok: false; error: string };
  updatePart: (partId: string, patch: Partial<Part>) => void;
  removePart: (partId: string) => Promise<void>;
  addPurchase: (input: Omit<ProductPurchase, "id">) => void;
  addInventoryPurchase: (input: {
    vendorName: string;
    supplierId?: string;
    branchId: string;
    purchasedAt: string;
    dueDate?: string;
    supplierInvoiceNumber?: string;
    invoiceFileName?: string;
    notes?: string;
    items: NonNullable<ProductPurchase["items"]>;
    roundOff?: number;
    recordedBy: string;
    amountPaid?: number;
  }) => { ok: true; purchase: ProductPurchase } | { ok: false; error: string };
  recordPurchasePayment: (
    purchaseId: string,
    input: {
      amount: number;
      method?: PaymentMethod;
      receivedInAccountId?: string;
      receivedInAccountName?: string;
      referenceNumber?: string;
    }
  ) => { ok: boolean; error?: string };
  updateInventoryPurchase: (purchaseId: string, input: {
    vendorName: string;
    supplierId?: string;
    branchId: string;
    purchasedAt: string;
    dueDate?: string;
    supplierInvoiceNumber?: string;
    invoiceFileName?: string;
    notes?: string;
    items: NonNullable<ProductPurchase["items"]>;
    roundOff?: number;
    recordedBy: string;
  }) => { ok: true; purchase: ProductPurchase } | { ok: false; error: string };
  renamePurchaseVendor: (fromName: string, toName: string) => void;
  recordStockAdjustment: (input: {
    partId: string;
    direction: "IN" | "OUT";
    amountMl?: number;
    amountCount?: number;
    reason: string;
    notes?: string;
    performedBy: string;
    branchId?: string;
    movementKind?: StockMovementKind;
    invoiceId?: string;
  }) => { ok: boolean; error?: string };
  updateBranchStockMeta: (
    partId: string,
    branchId: string,
    patch: { location?: string; minStock?: number }
  ) => void;
  createStockTransfer: (input: {
    fromBranchId: string;
    toBranchId: string;
    items: StockTransferItem[];
    reason: string;
    notes?: string;
    requestedBy: string;
    requestedByName: string;
    asDraft?: boolean;
  }) => { ok: true; transfer: StockTransfer } | { ok: false; error: string };
  updateStockTransferStatus: (
    transferId: string,
    status: StockTransferStatus,
    actor: { id: string; name: string }
  ) => { ok: boolean; error?: string };
  acknowledgeTransferCost: (transferId: string) => void;
  applyDeductionForInvoice: (
    invoice: Invoice,
    jobCard: JobCard | undefined,
    performedBy: string
  ) => { ok: boolean; error?: string };
  applyDeductionForJobCardReady: (
    jobCard: JobCard,
    performedBy: string
  ) => { ok: boolean; error?: string };
  /** Reverses all OUT stock movements for a job card — called on job card deletion. */
  revertDeductionForJobCard: (jobCardId: string, jobNumber: string) => void;
}

function persistInventorySnapshot(get: () => InventoryStore): void {
  const { parts, stockMovements, productPurchases, branchStocks, stockTransfers, partCategories } = get();
  void Promise.all([
    postCollectionSnapshot("parts", parts),
    postCollectionSnapshot("stockMovements", stockMovements),
    postCollectionSnapshot("productPurchases", productPurchases),
    postCollectionSnapshot("branchStocks", branchStocks),
    postCollectionSnapshot("stockTransfers", stockTransfers),
    postCollectionSnapshot("partCategories", partCategories),
  ]);
}

function nextSerial(prefix: string, existing: string[], year: number): string {
  const re = new RegExp(`^${prefix}-${year}-(\\d+)$`);
  let max = 0;
  for (const n of existing) {
    const m = re.exec(n);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}-${year}-${String(max + 1).padStart(4, "0")}`;
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

const TRANSFER_TRANSITIONS: Record<StockTransferStatus, StockTransferStatus[]> = {
  DRAFT: ["PENDING", "CANCELLED"],
  PENDING: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["IN_TRANSIT", "RECEIVED", "CANCELLED"],
  IN_TRANSIT: ["RECEIVED", "CANCELLED"],
  RECEIVED: [],
  REJECTED: [],
  CANCELLED: [],
};

function applyTransferItems(
  parts: Part[],
  stocks: BranchStock[],
  items: StockTransferItem[],
  branchId: string,
  deltaSign: 1 | -1,
  now: string
):
  | { ok: true; parts: Part[]; stocks: BranchStock[] }
  | { ok: false; error: string } {
  let nextParts = parts;
  let nextStocks = stocks;
  for (const item of items) {
    const part = nextParts.find((p) => p.id === item.partId);
    if (!part) return { ok: false, error: `Unknown part: ${item.partName || item.partId}` };
    const canonical = quantityToCanonicalSecondary(part, item.quantity, item.unit);
    const applied = applyBranchCanonicalDelta(nextStocks, part, branchId, deltaSign * canonical, now);
    if (!applied.ok) return applied;
    nextStocks = applied.stocks;
  }
  return { ok: true, parts: nextParts, stocks: nextStocks };
}

function transferMovements(
  transfer: StockTransfer,
  parts: Part[],
  stocksBefore: BranchStock[],
  stocksAfter: BranchStock[],
  type: "IN" | "OUT",
  performedBy: string,
  createdAt: string
): StockMovement[] {
  return transfer.items.map((item, i) => {
    const part = parts.find((p) => p.id === item.partId);
    const branchId = type === "OUT" ? transfer.fromBranchId : transfer.toBranchId;
    const before = stocksBefore.find((s) => s.partId === item.partId && s.branchId === branchId)?.quantity;
    const after = stocksAfter.find((s) => s.partId === item.partId && s.branchId === branchId)?.quantity;
    return {
      id: `sm-tr-${transfer.id}-${type}-${i}-${Date.now()}`,
      partId: item.partId,
      type,
      quantity: item.quantity,
      unit: item.unit,
      reason:
        type === "OUT"
          ? `Transfer ${transfer.transferNumber} (out)`
          : `Transfer ${transfer.transferNumber} received`,
      transferId: transfer.id,
      performedBy,
      createdAt,
      stockBeforeSecondary: before,
      stockAfterSecondary: after,
      displayQuantity: item.quantity,
      displayUnit: item.unit,
      movementKind: type === "OUT" ? "TRANSFER_OUT" : "TRANSFER_IN",
      branchId,
    } satisfies StockMovement;
  });
}

export const useInventoryStore = create<InventoryStore>((set, get) => ({
  parts: [],
  stockMovements: [],
  productPurchases: [],
  branchStocks: [],
  stockTransfers: [],
  partCategories: [],

  addPartCategory: (name) => {
    const trimmed = normalizePartCategoryName(name);
    if (!trimmed) return { ok: false, error: "Enter a category name." };
    const existing = get().partCategories.find(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) return { ok: true, name: existing.name };
    const fromPart = get().parts.find((p) => p.category.toLowerCase() === trimmed.toLowerCase());
    if (fromPart) return { ok: true, name: fromPart.category };
    const builtin = mergePartCategoryNames([], []).find(
      (c) => c.toLowerCase() === trimmed.toLowerCase()
    );
    if (builtin) return { ok: true, name: builtin };
    const row: PartCategoryRecord = {
      id: `pcat-${Date.now().toString(36)}`,
      name: trimmed,
    };
    set((state) => ({ partCategories: [...state.partCategories, row] }));
    persistInventorySnapshot(get);
    return { ok: true, name: trimmed };
  },

  addPart: (part) => {
    const normalized = normalizePartUnits(initializeDualUnitStock(part));
    set((state) => ({
      parts: [normalized, ...state.parts],
    }));
    persistInventorySnapshot(get);
    return normalized;
  },

  updatePart: (partId, patch) => {
    const existing = get().parts.find((p) => p.id === partId);
    set((state) => {
      const nextPart = normalizePartUnits(
        initializeDualUnitStock({ ...existing, ...patch, id: partId } as Part)
      );
      const newCanonical = getCanonicalStockSecondary(nextPart);
      // When the unit type changes (e.g. Litre → Pack), reset branchStocks
      // so they reflect the new canonical quantity instead of stale ML values.
      const unitChanged = existing && existing.primaryUnit !== nextPart.primaryUnit;
      const nextBranchStocks = unitChanged
        ? state.branchStocks.map((bs) =>
            bs.partId === partId ? { ...bs, quantity: newCanonical, updatedAt: new Date().toISOString() } : bs
          )
        : state.branchStocks;
      return {
        parts: state.parts.map((p) => (p.id !== partId ? p : nextPart)),
        branchStocks: nextBranchStocks,
      };
    });
    persistInventorySnapshot(get);
  },

  removePart: async (partId) => {
    const { parts, stockMovements, productPurchases, branchStocks, stockTransfers } = get();
    const nextMovements = stockMovements.filter((m) => m.partId !== partId);
    const nextPurchases = productPurchases.filter((p) => {
      if (p.items?.length) return p.items.every((line) => line.partId !== partId);
      return p.partId !== partId;
    });
    const nextBranchStocks = branchStocks.filter((s) => s.partId !== partId);
    const catalog = useServiceCatalogStore.getState().catalog;
    const needsCatalogUpdate = catalog.some((s) =>
      s.consumptionProfile?.some((l) => l.partId === partId)
    );

    await deleteCollectionDocument("parts", partId);
    await Promise.all([
      postCollectionSnapshot("stockMovements", nextMovements),
      postCollectionSnapshot("productPurchases", nextPurchases),
      postCollectionSnapshot("branchStocks", nextBranchStocks),
      postCollectionSnapshot("stockTransfers", stockTransfers),
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
      branchStocks: nextBranchStocks,
    });
  },

  addPurchase: (input) => {
    const id = `pp-${Date.now()}`;
    const purchase: ProductPurchase = { ...input, id };
    set((state) => {
      const beforePart = state.parts.find((x) => x.id === input.partId);
      const before = beforePart ? getCanonicalStockSecondary(beforePart) : 0;
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
      const afterPart = parts.find((x) => x.id === input.partId);
      const after = afterPart ? getCanonicalStockSecondary(afterPart) : before;
      let branchStocks = state.branchStocks;
      if (input.branchId && afterPart) {
        const applied = applyBranchCanonicalDelta(
          branchStocks,
          afterPart,
          input.branchId,
          input.quantityMl,
          input.purchasedAt
        );
        if (applied.ok) branchStocks = applied.stocks;
      }
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
        stockBeforeSecondary: before,
        stockAfterSecondary: after,
        displayQuantity: input.quantityMl,
        displayUnit: "ML",
        movementKind: "PURCHASE",
        branchId: input.branchId,
      };
      return {
        parts,
        branchStocks,
        productPurchases: [purchase, ...state.productPurchases],
        stockMovements: [movement, ...state.stockMovements],
      };
    });
    persistInventorySnapshot(get);
  },

  addInventoryPurchase: (input) => {
    if (!input.vendorName.trim()) return { ok: false, error: "Supplier is required." };
    if (!input.branchId) return { ok: false, error: "Branch is required." };
    if (!input.items.length) return { ok: false, error: "Add at least one purchase item." };
    for (const line of input.items) {
      if (!line.partId) return { ok: false, error: "Each item must have a part." };
      if (!(line.quantity > 0)) return { ok: false, error: "Item quantity must be greater than zero." };
    }

    const year = new Date(input.purchasedAt).getFullYear();
    const purchaseNumber = nextSerial(
      "PUR",
      get().productPurchases.map((p) => p.purchaseNumber ?? ""),
      year
    );
    const roundOff = input.roundOff ?? 0;
    const totals = calcPurchaseTotals(input.items, roundOff);
    const amountPaid = Math.max(0, input.amountPaid ?? 0);
    const due = Math.max(0, totals.grandTotal - amountPaid);
    const paymentStatus = amountPaid <= 0.01 ? "UNPAID" : due <= 0.01 ? "PAID" : "PARTIAL";
    const id = `pp-${Date.now()}`;
    const first = input.items[0]!;
    const purchase: ProductPurchase = {
      id,
      partId: first.partId,
      vendorName: input.vendorName.trim(),
      quantityMl: 0,
      purchasedAt: input.purchasedAt,
      recordedBy: input.recordedBy,
      purchaseNumber,
      branchId: input.branchId,
      supplierId: input.supplierId,
      dueDate: input.dueDate,
      supplierInvoiceNumber: input.supplierInvoiceNumber,
      invoiceFileName: input.invoiceFileName,
      notes: input.notes,
      items: input.items,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      gstTotal: totals.gstTotal,
      roundOff,
      grandTotal: totals.grandTotal,
      amountPaid,
      paymentStatus,
      /** Seed payment row so Accounting cash-out matches Expenses paid amount. */
      payments:
        amountPaid > 0.01
          ? [
              {
                id: `ppay-${id}-initial`,
                amount: amountPaid,
                method: "CASH" as const,
                paidAt: input.purchasedAt || new Date().toISOString(),
              },
            ]
          : [],
      reference: input.supplierInvoiceNumber,
    };

    const now = input.purchasedAt;
    const currentParts = get().parts;
    const currentStocks = get().branchStocks;
    let nextParts = currentParts;
    let nextStocks = currentStocks;
    const movements: StockMovement[] = [];

    for (const line of input.items) {
      const part = nextParts.find((p) => p.id === line.partId);
      if (!part) return { ok: false, error: `Unknown part: ${line.partName || line.partId}` };
      const canonical = quantityToCanonicalSecondary(part, line.quantity, line.unit);
      const before = getCanonicalStockSecondary(part);
      const updated = {
        ...addCanonicalSecondary(part, canonical),
        lastRestocked: now,
        costPrice: line.unitPrice > 0 ? line.unitPrice : part.costPrice,
      };
      const after = getCanonicalStockSecondary(updated);
      nextParts = nextParts.map((p) => (p.id === part.id ? updated : p));
      // Pass pre-update `part` (not `updated`) so getBranchCanonicalQty fallback
      // uses the opening stock quantity, not the already-incremented value.
      const applied = applyBranchCanonicalDelta(nextStocks, part, input.branchId, canonical, now);
      if (!applied.ok) return applied;
      nextStocks = applied.stocks;
      movements.push({
        id: `sm-pur-${id}-${line.partId}-${Date.now()}-${movements.length}`,
        partId: line.partId,
        type: "IN",
        quantity: line.quantity,
        unit: line.unit,
        reason: `Purchase ${purchaseNumber}`,
        vendor: purchase.vendorName,
        purchaseId: id,
        performedBy: input.recordedBy,
        createdAt: now,
        stockBeforeSecondary: before,
        stockAfterSecondary: after,
        displayQuantity: line.quantity,
        displayUnit: line.unit,
        movementKind: "PURCHASE",
        branchId: input.branchId,
        notes: input.notes,
      });
    }

    set({
      parts: nextParts,
      branchStocks: nextStocks,
      productPurchases: [purchase, ...get().productPurchases],
      stockMovements: [...movements, ...get().stockMovements],
    });
    persistInventorySnapshot(get);
    return { ok: true, purchase };
  },

  recordPurchasePayment: (purchaseId, input) => {
    const amount = input.amount;
    if (!(amount > 0)) return { ok: false, error: "Enter a payment amount greater than zero." };
    const purchase = get().productPurchases.find((p) => p.id === purchaseId);
    if (!purchase) return { ok: false, error: "Purchase not found." };
    const nextPaid = (purchase.amountPaid ?? 0) + amount;
    const dueAfter = Math.max(0, (purchase.grandTotal ?? 0) - nextPaid);
    const paymentStatus = dueAfter <= 0.01 ? "PAID" : nextPaid > 0.01 ? "PARTIAL" : "UNPAID";
    const payment = {
      id: `ppay-${Date.now()}`,
      amount,
      method: input.method ?? "CASH",
      paidAt: new Date().toISOString(),
      receivedInAccountId: input.receivedInAccountId,
      receivedInAccountName: input.receivedInAccountName,
      referenceNumber: input.referenceNumber,
    };
    set((state) => ({
      productPurchases: state.productPurchases.map((p) =>
        p.id === purchaseId
          ? {
              ...p,
              amountPaid: nextPaid,
              paymentStatus,
              payments: [...(p.payments ?? []), payment],
            }
          : p
      ),
    }));
    persistInventorySnapshot(get);
    return { ok: true };
  },

  updateInventoryPurchase: (purchaseId, input) => {
    if (!input.vendorName.trim()) return { ok: false, error: "Supplier is required." };
    if (!input.branchId) return { ok: false, error: "Branch is required." };
    if (!input.items.length) return { ok: false, error: "Add at least one purchase item." };

    const existing = get().productPurchases.find((p) => p.id === purchaseId);
    if (!existing) return { ok: false, error: "Purchase not found." };

    const roundOff = input.roundOff ?? 0;
    const totals = calcPurchaseTotals(input.items, roundOff);
    const amountPaid = existing.amountPaid ?? 0;
    const due = Math.max(0, totals.grandTotal - amountPaid);
    const paymentStatus = amountPaid <= 0.01 ? "UNPAID" : due <= 0.01 ? "PAID" : "PARTIAL";

    // Reverse old stock movements for this purchase
    const oldMovements = get().stockMovements.filter((m) => m.purchaseId === purchaseId);
    let nextParts = get().parts;
    let nextStocks = get().branchStocks;
    const oldBranchId = existing.branchId ?? input.branchId;

    for (const mv of oldMovements) {
      const part = nextParts.find((p) => p.id === mv.partId);
      if (!part) continue;
      const canonical = quantityToCanonicalSecondary(part, mv.quantity, mv.unit);
      nextParts = nextParts.map((p) => p.id === mv.partId ? deductCanonicalSecondary(p, canonical) : p);
      const applied = applyBranchCanonicalDelta(nextStocks, part, oldBranchId, -canonical, new Date().toISOString());
      if (applied.ok) nextStocks = applied.stocks;
    }

    // Apply new items
    const now = input.purchasedAt;
    const newMovements: import("@/types").StockMovement[] = [];
    for (const line of input.items) {
      const part = nextParts.find((p) => p.id === line.partId);
      if (!part) return { ok: false, error: `Unknown part: ${line.partName || line.partId}` };
      const canonical = quantityToCanonicalSecondary(part, line.quantity, line.unit);
      const before = getCanonicalStockSecondary(part);
      const updated = { ...addCanonicalSecondary(part, canonical), lastRestocked: now, costPrice: line.unitPrice > 0 ? line.unitPrice : part.costPrice };
      const after = getCanonicalStockSecondary(updated);
      nextParts = nextParts.map((p) => (p.id === part.id ? updated : p));
      // Pass pre-update `part` so getBranchCanonicalQty fallback uses opening stock.
      const applied = applyBranchCanonicalDelta(nextStocks, part, input.branchId, canonical, now);
      if (!applied.ok) return applied;
      nextStocks = applied.stocks;
      newMovements.push({
        id: `sm-pur-${purchaseId}-${line.partId}-edit-${Date.now()}-${newMovements.length}`,
        partId: line.partId,
        type: "IN",
        quantity: line.quantity,
        unit: line.unit,
        reason: `Purchase ${existing.purchaseNumber ?? purchaseId} (edited)`,
        vendor: input.vendorName.trim(),
        purchaseId,
        performedBy: input.recordedBy,
        createdAt: now,
        stockBeforeSecondary: before,
        stockAfterSecondary: after,
        displayQuantity: line.quantity,
        displayUnit: line.unit,
        movementKind: "PURCHASE",
        branchId: input.branchId,
        notes: input.notes,
      });
    }

    const updated: ProductPurchase = {
      ...existing,
      vendorName: input.vendorName.trim(),
      supplierId: input.supplierId,
      branchId: input.branchId,
      purchasedAt: input.purchasedAt,
      dueDate: input.dueDate,
      supplierInvoiceNumber: input.supplierInvoiceNumber,
      invoiceFileName: input.invoiceFileName,
      notes: input.notes,
      items: input.items,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      gstTotal: totals.gstTotal,
      roundOff,
      grandTotal: totals.grandTotal,
      paymentStatus,
      reference: input.supplierInvoiceNumber,
    };

    set({
      parts: nextParts,
      branchStocks: nextStocks,
      productPurchases: get().productPurchases.map((p) => (p.id === purchaseId ? updated : p)),
      stockMovements: [
        ...newMovements,
        ...get().stockMovements.filter((m) => m.purchaseId !== purchaseId),
      ],
    });
    persistInventorySnapshot(get);
    return { ok: true, purchase: updated };
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
    const part = get().parts.find((x) => x.id === partId);
    if (!part) return { ok: false, error: "Part not found." };
    const canonicalDelta =
      amountMl != null
        ? amountMl
        : amountCount != null
          ? amountCount
          : 0;
    if (!(canonicalDelta > 0)) return { ok: false, error: "Quantity must be greater than zero." };

    const signed = direction === "IN" ? canonicalDelta : -canonicalDelta;
    const before = getCanonicalStockSecondary(part);
    if (direction === "OUT" && before + signed < -1e-9) {
      return { ok: false, error: `Insufficient stock — only ${formatAvailableStock(part, part.primaryUnit)} available.` };
    }

    const now = new Date().toISOString();
    let nextStocks = get().branchStocks;
    if (input.branchId) {
      const applied = applyBranchCanonicalDelta(nextStocks, part, input.branchId, signed, now);
      if (!applied.ok) return applied;
      nextStocks = applied.stocks;
    }

    const nextPart =
      direction === "IN"
        ? addCanonicalSecondary(part, canonicalDelta)
        : deductCanonicalSecondary(part, canonicalDelta);
    const after = getCanonicalStockSecondary(nextPart);
    const qty = amountMl ?? amountCount ?? 0;
    const unit = amountMl != null ? "ML" : part.primaryUnit;
    const movementKind: StockMovementKind =
      input.movementKind ??
      (reason.toLowerCase().includes("direct issue")
        ? "DIRECT_ISSUE"
        : reason.toLowerCase().includes("return")
          ? "RETURN"
          : "ADJUSTMENT");

    const movement: StockMovement = {
      id: `sm-${Date.now()}`,
      partId,
      type: direction,
      quantity: qty,
      unit,
      reason,
      notes: input.notes,
      performedBy,
      createdAt: now,
      stockBeforeSecondary: before,
      stockAfterSecondary: after,
      displayQuantity: qty,
      displayUnit: unit,
      movementKind,
      branchId: input.branchId,
      invoiceId: input.invoiceId,
    };

    set((state) => ({
      parts: state.parts.map((p) => (p.id === partId ? nextPart : p)),
      branchStocks: nextStocks,
      stockMovements: [movement, ...state.stockMovements],
    }));
    persistInventorySnapshot(get);
    return { ok: true };
  },

  updateBranchStockMeta: (partId, branchId, patch) => {
    const now = new Date().toISOString();
    set((state) => {
      const existing = state.branchStocks.find((s) => s.partId === partId && s.branchId === branchId);
      const qty = existing?.quantity ?? 0;
      return {
        branchStocks: upsertBranchStockQty(state.branchStocks, partId, branchId, qty, now, {
          location: patch.location,
          minStock: patch.minStock,
        }),
      };
    });
    persistInventorySnapshot(get);
  },

  createStockTransfer: (input) => {
    if (!input.fromBranchId || !input.toBranchId) {
      return { ok: false, error: "From and To branch are required." };
    }
    if (input.fromBranchId === input.toBranchId) {
      return { ok: false, error: "From and To branch cannot be the same." };
    }
    if (!input.reason.trim()) return { ok: false, error: "Reason is required." };
    if (!input.items.length) return { ok: false, error: "Add at least one part." };
    const parts = get().parts;
    const stocks = get().branchStocks;
    for (const item of input.items) {
      if (!(item.quantity > 0)) return { ok: false, error: "Quantity must be greater than zero." };
      const part = parts.find((p) => p.id === item.partId);
      if (!part) return { ok: false, error: `Unknown part: ${item.partName || item.partId}` };
      const canonical = quantityToCanonicalSecondary(part, item.quantity, item.unit);
      const available = getBranchCanonicalQty(stocks, part, input.fromBranchId);
      if (canonical > available + 1e-9) {
        return {
          ok: false,
          error: `Only ${available.toLocaleString("en-IN")} available at source for ${part.name}.`,
        };
      }
    }

    const year = new Date().getFullYear();
    const transferNumber = nextSerial(
      "TRF",
      get().stockTransfers.map((t) => t.transferNumber),
      year
    );
    const transferValue = Math.round(input.items.reduce((s, i) => s + i.lineValue, 0) * 100) / 100;
    const now = new Date().toISOString();
    const transfer: StockTransfer = {
      id: `st-${Date.now()}`,
      transferNumber,
      fromBranchId: input.fromBranchId,
      toBranchId: input.toBranchId,
      items: input.items,
      reason: input.reason.trim(),
      notes: input.notes?.trim() || undefined,
      status: input.asDraft ? "DRAFT" : "PENDING",
      settlementStatus: "UNSETTLED",
      costAcknowledged: false,
      requestedBy: input.requestedBy,
      requestedByName: input.requestedByName,
      createdAt: now,
      updatedAt: now,
      transferValue,
    };
    set((state) => ({ stockTransfers: [transfer, ...state.stockTransfers] }));
    persistInventorySnapshot(get);
    return { ok: true, transfer };
  },

  updateStockTransferStatus: (transferId, status, actor) => {
    const transfer = get().stockTransfers.find((t) => t.id === transferId);
    if (!transfer) return { ok: false, error: "Transfer not found." };
    if (!TRANSFER_TRANSITIONS[transfer.status].includes(status)) {
      return { ok: false, error: `Cannot change ${transfer.status} to ${status}.` };
    }

    const now = new Date().toISOString();
    const deductNow =
      (status === "IN_TRANSIT" || status === "RECEIVED") &&
      transfer.status !== "IN_TRANSIT" &&
      transfer.status !== "RECEIVED";
    const receiveNow = status === "RECEIVED" && transfer.status !== "RECEIVED";
    const restoreNow = status === "CANCELLED" && transfer.status === "IN_TRANSIT";

    let nextParts = get().parts;
    let nextStocks = get().branchStocks;
    const stocksSnapshot = nextStocks;
    const extraMovements: StockMovement[] = [];

    if (deductNow) {
      const applied = applyTransferItems(nextParts, nextStocks, transfer.items, transfer.fromBranchId, -1, now);
      if (!applied.ok) return applied;
      extraMovements.push(
        ...transferMovements(
          { ...transfer, status },
          nextParts,
          stocksSnapshot,
          applied.stocks,
          "OUT",
          actor.id,
          now
        )
      );
      nextParts = applied.parts;
      nextStocks = applied.stocks;
    }

    if (receiveNow) {
      const beforeReceive = nextStocks;
      const applied = applyTransferItems(nextParts, nextStocks, transfer.items, transfer.toBranchId, 1, now);
      if (!applied.ok) return applied;
      extraMovements.push(
        ...transferMovements(
          { ...transfer, status },
          nextParts,
          beforeReceive,
          applied.stocks,
          "IN",
          actor.id,
          now
        )
      );
      nextParts = applied.parts;
      nextStocks = applied.stocks;
    }

    if (restoreNow) {
      const applied = applyTransferItems(nextParts, nextStocks, transfer.items, transfer.fromBranchId, 1, now);
      if (!applied.ok) return applied;
      extraMovements.push(
        ...transferMovements(
          { ...transfer, status },
          nextParts,
          nextStocks,
          applied.stocks,
          "IN",
          actor.id,
          now
        ).map((m) => ({
          ...m,
          reason: `Transfer ${transfer.transferNumber} cancelled (restored)`,
          movementKind: "OTHER" as const,
        }))
      );
      nextParts = applied.parts;
      nextStocks = applied.stocks;
    }

    const nextTransfer: StockTransfer = {
      ...transfer,
      status,
      updatedAt: now,
      receivedAt: receiveNow ? now : transfer.receivedAt,
      settlementStatus:
        status === "RECEIVED" && transfer.costAcknowledged ? "SETTLED" : transfer.settlementStatus,
    };

    set({
      parts: nextParts,
      branchStocks: nextStocks,
      stockTransfers: get().stockTransfers.map((t) => (t.id === transferId ? nextTransfer : t)),
      stockMovements: extraMovements.length
        ? [...extraMovements, ...get().stockMovements]
        : get().stockMovements,
    });
    persistInventorySnapshot(get);
    return { ok: true };
  },

  acknowledgeTransferCost: (transferId) => {
    set((state) => ({
      stockTransfers: state.stockTransfers.map((t) =>
        t.id === transferId
          ? {
              ...t,
              costAcknowledged: true,
              settlementStatus: t.status === "RECEIVED" ? "SETTLED" : t.settlementStatus,
              updatedAt: new Date().toISOString(),
            }
          : t
      ),
    }));
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
    let nextStocks = get().branchStocks;
    const branchId = jobCard.branchId;
    for (const d of lines) {
      const part = currentParts.find((x) => x.id === d.partId);
      if (!part || !branchId) continue;
      const amount = d.ml ?? d.secondaryUnits ?? d.primaryCount ?? 0;
      if (!(amount > 0)) continue;
      const hasAlloc = nextStocks.some((s) => s.partId === part.id);
      if (!hasAlloc) continue;
      const applied = applyBranchCanonicalDelta(nextStocks, part, branchId, -amount, createdAt);
      if (!applied.ok) return applied;
      nextStocks = applied.stocks;
    }
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
        movementKind: "JOB_CARD",
        branchId,
        customerName: jobCard.customerName,
      });
    });
    set({
      parts: newParts,
      branchStocks: nextStocks,
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
    let nextStocks = get().branchStocks;
    const branchId = jobCard.branchId;
    for (const d of lines) {
      const part = currentParts.find((x) => x.id === d.partId);
      if (!part || !branchId) continue;
      const amount = d.ml ?? d.secondaryUnits ?? d.primaryCount ?? 0;
      if (!(amount > 0)) continue;
      const hasAlloc = nextStocks.some((s) => s.partId === part.id);
      if (!hasAlloc) continue;
      const applied = applyBranchCanonicalDelta(nextStocks, part, branchId, -amount, createdAt);
      if (!applied.ok) return applied;
      nextStocks = applied.stocks;
    }
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
        movementKind: "JOB_CARD",
        branchId,
        customerName: jobCard.customerName,
      });
    });
    set({
      parts: newParts,
      branchStocks: nextStocks,
      stockMovements: [...newMovements, ...get().stockMovements],
    });
    persistInventorySnapshot(get);
    return { ok: true };
  },

  revertDeductionForJobCard: (jobCardId, jobNumber) => {
    const { parts, stockMovements, branchStocks } = get();
    // Find all OUT movements for this job card.
    const jobMovements = stockMovements.filter(
      (m) => m.jobCardId === jobCardId && m.type === "OUT"
    );
    if (jobMovements.length === 0) return;

    const now = new Date().toISOString();
    let nextParts = parts.map((p) => ({ ...p }));
    let nextStocks = branchStocks;
    const reversalMovements: StockMovement[] = [];

    for (const mov of jobMovements) {
      // Add quantity back to part.
      const idx = nextParts.findIndex((p) => p.id === mov.partId);
      if (idx >= 0) {
        const p = nextParts[idx];
        nextParts[idx] = {
          ...p,
          quantity: p.quantity + (mov.displayQuantity ?? mov.quantity ?? 0),
        };
      }
      // Add back to branch stock.
      if (mov.branchId) {
        const part = nextParts.find((p) => p.id === mov.partId);
        if (part) {
          const canonicalQty = mov.stockBeforeSecondary != null && mov.stockAfterSecondary != null
            ? Math.max(0, mov.stockBeforeSecondary - mov.stockAfterSecondary)
            : mov.quantity ?? 0;
          const applied = applyBranchCanonicalDelta(nextStocks, part, mov.branchId, canonicalQty, now);
          if (applied.ok) nextStocks = applied.stocks;
        }
      }
      // Create reversal IN movement.
      reversalMovements.push({
        id: `sm-revert-${jobCardId}-${mov.id}-${Date.now()}`,
        partId: mov.partId,
        type: "IN",
        quantity: mov.quantity,
        unit: mov.unit,
        reason: `Stock returned — job card ${jobNumber} deleted`,
        jobCardId,
        performedBy: "system",
        createdAt: now,
        movementKind: "JOB_CARD",
        branchId: mov.branchId,
        displayQuantity: mov.displayQuantity,
        displayUnit: mov.displayUnit,
      });
    }

    set({
      parts: nextParts,
      branchStocks: nextStocks,
      stockMovements: [...reversalMovements, ...get().stockMovements],
    });
    persistInventorySnapshot(get);
  },
}));

export function parseLitresInput(value: string): number | null {
  const n = parseFloat(value.replace(/,/g, ""));
  if (Number.isNaN(n) || n < 0) return null;
  return litresToMl(n);
}
