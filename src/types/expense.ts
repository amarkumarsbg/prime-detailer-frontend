export type ExpenseCategory = "RENT" | "SALARY" | "UTILITIES" | "SUPPLIES" | "MAINTENANCE" | "MARKETING" | "INSURANCE" | "MISCELLANEOUS";

/** Recorded payment state for an expense row. */
export type ExpensePaymentStatus = "PAID" | "PENDING" | "PARTIAL" | "OVERDUE";

export type ExpensePaymentMethod =
  | "CASH"
  | "CARD"
  | "UPI"
  | "BANK_TRANSFER"
  | "OTHER";

export interface ExpenseVendorProfile {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  paymentTerms?: string;
  address?: string;
  gstNumber?: string;
  panNumber?: string;
  notes?: string;
  /** Default true when omitted (legacy directory rows). */
  isActive?: boolean;
  /** Optional home branch for display; vendors remain usable org-wide. */
  branchId?: string;
}

export interface Expense {
  id: string;
  /** Short label for tables (e.g. "Office supplies"). */
  title: string;
  /** Category key or custom label (matches expense category pickers). */
  category: string;
  /** Optional long-form notes. */
  description?: string;
  amount: number;
  /** When status is PARTIAL, amount already paid (must be less than amount). */
  amountPaid?: number;
  date: string;
  vendorName?: string;
  paymentStatus: ExpensePaymentStatus;
  paymentMethod: ExpensePaymentMethod;
  /** Stored receipt file name for display (demo; no upload backend). */
  receipt?: string;
  createdBy: string;
  createdByName: string;
  branchId: string;
  createdAt: string;
  /** Inventory purchase this expense represents (vendor bill). */
  purchaseId?: string;
}
