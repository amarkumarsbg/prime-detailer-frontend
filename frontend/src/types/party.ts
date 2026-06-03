/** Unified party (customer / supplier) for MyBillBook-style ledger. */

export type PartyKind = "customer" | "supplier";

export interface PartyCustomField {
  key: string;
  value: string;
}

export type OpeningBalanceSide = "toCollect" | "toPay";

export interface PartyBankAccount {
  id: string;
  accountNumber: string;
  ifsc?: string;
  accountHolderName?: string;
  bankName?: string;
  branchName?: string;
  upiId?: string;
}

export interface PartyShippingAddress {
  id: string;
  name: string;
  street: string;
  state?: string;
  pincode?: string;
  city?: string;
  isDefault?: boolean;
}

export interface Party {
  id: string;
  kind: PartyKind;
  name: string;
  category?: string;
  mobile?: string;
  email?: string;
  gstin?: string;
  pan?: string;
  billingAddress?: string;
  /** Primary shipping line for profile display (synced from default shippingAddresses entry). */
  shippingAddress?: string;
  shippingAddresses?: PartyShippingAddress[];
  /** Ledger opening balance amount (INR, non-negative). Direction from openingBalanceSide. */
  openingBalance: number;
  openingBalanceSide?: OpeningBalanceSide;
  creditPeriodDays?: number;
  creditLimit?: number;
  contactPersonName?: string;
  /** ISO date yyyy-MM-dd */
  dateOfBirth?: string;
  bankAccounts?: PartyBankAccount[];
  customFields: PartyCustomField[];
  /** Link to existing Customer row when kind is customer */
  customerId?: string;
  /** Normalized vendor name key when kind is supplier */
  vendorKey?: string;
  createdAt: string;
  updatedAt: string;
}

export type PartyTransactionRow = {
  id: string;
  at: string;
  typeLabel: string;
  reference: string;
  amount: number;
  /** Shown under amount for partially paid sales invoices */
  unpaidAmount?: number;
  status: string;
  statusTone: "success" | "warning" | "muted";
  /** Optional link target */
  href?: string;
};

export type PartyStatementLine = {
  id: string;
  date: string;
  voucher: string;
  serialNo: string;
  paymentMode: string;
  credit?: number;
  debit?: number;
  balance: number;
  dueLabel?: string;
  isSummary?: boolean;
};

export type PartyItemWiseRow = {
  itemName: string;
  itemCode: string;
  salesQuantity: number;
  salesUnit: string;
  salesAmount: number;
  purchaseQuantity: number;
  purchaseUnit: string;
  purchaseAmount: number;
};

export type PartyLedgerSummary = {
  totalReceivableOrPayable: number;
  overdueAmount: number;
  totalSalesOrPurchases: number;
  totalReceivedOrPaid: number;
};
