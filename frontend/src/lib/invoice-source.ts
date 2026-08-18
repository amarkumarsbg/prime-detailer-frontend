import type { Invoice } from "@/types";

export function isCounterSaleInvoice(inv: Pick<Invoice, "source">): boolean {
  return inv.source === "COUNTER_SALE";
}

export function isMembershipInvoice(inv: Pick<Invoice, "source">): boolean {
  return inv.source === "MEMBERSHIP";
}

/** Job / source column on billing lists. */
export function invoiceSourceColumnLabel(inv: Pick<Invoice, "source" | "jobNumber">): string {
  if (inv.source === "COUNTER_SALE") return "Counter Sale";
  if (inv.source === "MEMBERSHIP") return "Membership";
  return inv.jobNumber;
}

/** Page heading on invoice detail. */
export function invoiceSourceTitle(inv: Pick<Invoice, "source">): string {
  if (inv.source === "COUNTER_SALE") return "Counter Sale";
  if (inv.source === "MEMBERSHIP") return "Membership";
  return "Sales Invoice";
}

/** Customer ledger type / voucher. */
export function invoiceSourceLedgerLabel(inv: Pick<Invoice, "source">): string {
  if (inv.source === "COUNTER_SALE") return "Counter Sale";
  if (inv.source === "MEMBERSHIP") return "Membership";
  return "Sales Invoices";
}

export function invoicePrintDocumentTitle(
  inv: Pick<Invoice, "source">,
  gstRegistered: boolean
): string {
  if (inv.source === "COUNTER_SALE") return "COUNTER SALE";
  if (inv.source === "MEMBERSHIP") return "MEMBERSHIP";
  return gstRegistered ? "TAX INVOICE" : "INVOICE";
}
