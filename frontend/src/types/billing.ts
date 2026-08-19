import type { VehicleSegment } from "./vehicle";

export type InvoiceStatus = "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID";

export type QuotationStatus = "DRAFT" | "SENT" | "APPROVED" | "REJECTED" | "CONVERTED";

export type QuotationSource = "SERVICE" | "COUNTER_SALE" | "MIXED";

export type PaymentMethod = "CASH" | "UPI" | "CARD" | "WALLET";

export interface QuotationPartLine {
  partId: string;
  name: string;
  sku: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
}

export interface Quotation {
  id: string;
  quotationNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  vehicleId: string;
  vehicleRegNumber: string;
  vehicleMakeModel: string;
  vehicleSegment: VehicleSegment;
  /** Defaults to service quotation when omitted (legacy rows). */
  source?: QuotationSource;
  services: {
    serviceCatalogId: string;
    name: string;
    price: number;
    catalogPrice?: number;
    isCustomPrice?: boolean;
    priceSource?: "CATALOG" | "CUSTOM" | "MEMBERSHIP";
  }[];
  /** Counter Sale parts on the estimate (can be combined with services). */
  parts?: QuotationPartLine[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
  status: QuotationStatus;
  sentViaWhatsApp: boolean;
  customerApproved?: boolean;
  convertedToJobCardId?: string;
  convertedToInvoiceId?: string;
  termsAndConditions?: string;
  notes?: string;
  validUntil: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  type: "SERVICE" | "PARTS" | "LABOR" | "OTHER";
  quantity: number;
  unitPrice: number;
  total: number;
  /** SAC/HSN for GST line (e.g. 998714). Defaults in UI when omitted. */
  hsnSac?: string;
  /** Line-level discount in ₹ (before tax). Edit UI enters this as a % of qty × rate. */
  lineDiscount?: number;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  referenceNumber?: string;
  paidAt: string;
  /** Cash & Bank account id when method is UPI or CARD. */
  receivedInAccountId?: string;
  /** Snapshot of account display name at payment time. */
  receivedInAccountName?: string;
}

/** Print-quality PDF cached on the invoice row (AppJsonRow) for fast email attachment. */
export interface InvoiceStoredPdf {
  filename: string;
  contentBase64: string;
  /** Matches invoice totals/line items; regenerated when invoice changes. */
  cacheKey: string;
  generatedAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  jobCardId?: string;
  jobNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  vehicleRegNumber: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
  rewardDiscount: number;
  walletAmountUsed: number;
  grandTotal: number;
  status: InvoiceStatus;
  payments: Payment[];
  termsAndConditions?: string;
  mechanicName?: string;
  notes?: string;
  createdAt: string;
  /** When set, inventory was already deducted for this invoice (idempotency). */
  inventoryDeductedAt?: string;
  /** Saved tax-invoice PDF (base64) — avoids regenerating Chrome PDF on every email. */
  storedPdf?: InvoiceStoredPdf;
  referralDiscount?: number;
  referralAdvocateId?: string;
  referralCodeUsed?: string;
  /** Snapshot of membership subscription id at invoice time (Bill To). */
  membershipId?: string;
  membershipPackageName?: string;
  /** Membership pass window (ISO), snapshotted at activation. */
  membershipStartDate?: string;
  membershipEndDate?: string;
  /** Vehicle make + model when this invoice is not tied to a job card. */
  vehicleMakeModel?: string;
  /** Counter Sale / Membership invoices have no job card. */
  source?: "COUNTER_SALE" | "MEMBERSHIP";
  branchId?: string;
}
