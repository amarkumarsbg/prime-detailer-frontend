export type PartCategory =
  | "Engine"
  | "Brakes"
  | "Electrical"
  | "Filters"
  | "Suspension"
  | "AC"
  | "Body"
  | "Lubricants"
  | "Tires"
  | "Detailing"
  | "Other";

export interface Part {
  id: string;
  name: string;
  /** Manufacturer or product brand (optional). */
  brand?: string;
  sku: string;
  /** Optional barcode for search / scanning. */
  barcode?: string;
  category: PartCategory;
  /** Primary-unit stock count (e.g. BOX). Synced from stockQuantitySecondary for dual-unit parts. */
  quantity: number;
  primaryUnit: string;
  secondaryUnit: string;
  /** 1 primaryUnit = conversionFactor secondaryUnit (e.g. 1 BOX = 100 PCS). */
  conversionFactor: number;
  /** Sale price per primary unit (e.g. ₹500/BOX). */
  unitPrice: number;
  /** Sale price per secondary unit (e.g. ₹5/PCS). Derived from unitPrice ÷ conversionFactor when omitted. */
  unitPriceSecondary?: number;
  /** Canonical on-hand stock in secondary units (PCS, ML, GM). Authoritative for dual-unit parts. */
  stockQuantitySecondary?: number;
  /** Reorder threshold for count-based parts. */
  reorderLevel: number;
  supplier: string;
  vendor?: string;
  purchaseDate?: string;
  lastRestocked: string;
  /**
   * Fluid stock in millilitres (canonical). When set, internal calculations use ml;
   * primary display unit is litres (1 L = 1000 ml).
   */
  stockQuantityMl?: number;
  /** Reorder threshold in ml for fluid parts. */
  reorderLevelMl?: number;
}

export interface StockMovement {
  id: string;
  partId: string;
  type: "IN" | "OUT";
  quantity: number;
  unit: string;
  reason: string;
  jobCardId?: string;
  invoiceId?: string;
  purchaseId?: string;
  vendor?: string;
  performedBy: string;
  createdAt: string;
  /** Canonical stock before movement (secondary units / ml). */
  stockBeforeSecondary?: number;
  /** Canonical stock after movement (secondary units / ml). */
  stockAfterSecondary?: number;
  /** User-facing consumed/adjusted quantity in the movement unit. */
  displayQuantity?: number;
  displayUnit?: string;
}

export interface ProductPurchase {
  id: string;
  partId: string;
  vendorName: string;
  quantityMl: number;
  unitCost?: number;
  reference?: string;
  purchasedAt: string;
  recordedBy: string;
}
