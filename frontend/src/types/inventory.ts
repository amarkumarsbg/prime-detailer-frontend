import type { PaymentMethod } from "./billing";

export const BUILTIN_PART_CATEGORIES = [
  "Engine",
  "Brakes",
  "Electrical",
  "Filters",
  "Suspension",
  "AC",
  "Body",
  "Lubricants",
  "Tires",
  "Detailing",
  "Other",
] as const;
  "Engine",
  "Brakes",
  "Electrical",
  "Filters",
  "Suspension",
  "AC",
  "Body",
  "Lubricants",
  "Tires",
  "Detailing",
  "Other",
] as const;

/** Builtin or a custom name created from the catalog form. */
export type PartCategory = string;

export interface PartCategoryRecord {
  id: string;
  name: string;
}

export interface Part {
  id: string;
  name: string;
  /** Manufacturer or product brand (optional). */
  brand?: string;
  sku: string;
  /** Optional barcode for search / scanning. */
  barcode?: string;
  category: PartCategory;
  description?: string;
  /** Primary-unit stock count (e.g. BOX). Synced from stockQuantitySecondary for dual-unit parts. */
  quantity: number;
  primaryUnit: string;
  secondaryUnit: string;
  /** 1 primaryUnit = conversionFactor secondaryUnit (e.g. 1 BOX = 100 PCS). */
  conversionFactor: number;
  /** Cost / purchase price per primary unit. */
  costPrice?: number;
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
  gstRate?: number;
  hsnCode?: string;
  gstApplicable?: boolean;
  /** Default true when omitted (legacy rows). */
  isActive?: boolean;
  /** `GLOBAL` or a branch id. Catalog metadata — stock is still tracked per branch when branch stocks exist. */
  branchScope?: string;
  /**
   * Where this part can be consumed. Omitted on legacy rows = Services only.
   * `DIRECT_SALE` is the internal flag; Counter Sale filters on it.
   */
  usedIn?: Array<"SERVICES" | "DIRECT_SALE">;
}

export type StockMovementKind =
  | "PURCHASE"
  | "ADJUSTMENT"
  | "TRANSFER_OUT"
  | "TRANSFER_IN"
  | "JOB_CARD"
  | "DIRECT_ISSUE"
  | "RETURN"
  | "OTHER";

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
  transferId?: string;
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
  movementKind?: StockMovementKind;
  branchId?: string;
  customerName?: string;
  notes?: string;
}

export type InventoryPaymentStatus = "UNPAID" | "PARTIAL" | "PAID";

export interface InventoryPurchasePayment {
  id: string;
  amount: number;
  method: PaymentMethod;
  paidAt: string;
  receivedInAccountId?: string;
  receivedInAccountName?: string;
  referenceNumber?: string;
}

export interface InventoryPurchaseLine {
  partId: string;
  partName: string;
  sku: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount: number;
  gstRate: number;
  taxableAmount: number;
  gstAmount: number;
  lineTotal: number;
}

/** Legacy fluid intake uses partId + quantityMl. Full purchase bills use `items` + `grandTotal`. */
export interface ProductPurchase {
  id: string;
  partId: string;
  vendorName: string;
  quantityMl: number;
  unitCost?: number;
  reference?: string;
  purchasedAt: string;
  recordedBy: string;
  purchaseNumber?: string;
  branchId?: string;
  supplierId?: string;
  dueDate?: string;
  supplierInvoiceNumber?: string;
  invoiceFileName?: string;
  notes?: string;
  items?: InventoryPurchaseLine[];
  subtotal?: number;
  discountTotal?: number;
  gstTotal?: number;
  roundOff?: number;
  grandTotal?: number;
  amountPaid?: number;
  paymentStatus?: InventoryPaymentStatus;
  payments?: InventoryPurchasePayment[];
}

export interface BranchStock {
  id: string;
  partId: string;
  branchId: string;
  /** Canonical on-hand quantity (same units as part canonical secondary / ml). */
  quantity: number;
  location?: string;
  minStock?: number;
  updatedAt: string;
}

export type StockTransferStatus =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "IN_TRANSIT"
  | "RECEIVED"
  | "REJECTED"
  | "CANCELLED";

export type TransferSettlementStatus = "UNSETTLED" | "SETTLED";

export interface StockTransferItem {
  partId: string;
  partName: string;
  sku: string;
  quantity: number;
  unit: string;
  unitCost: number;
  lineValue: number;
}

export interface StockTransfer {
  id: string;
  transferNumber: string;
  fromBranchId: string;
  toBranchId: string;
  items: StockTransferItem[];
  reason: string;
  notes?: string;
  status: StockTransferStatus;
  settlementStatus: TransferSettlementStatus;
  costAcknowledged: boolean;
  requestedBy: string;
  requestedByName: string;
  createdAt: string;
  updatedAt: string;
  receivedAt?: string;
  transferValue: number;
}
