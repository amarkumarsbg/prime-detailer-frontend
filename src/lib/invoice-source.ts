import type { Invoice } from "@/types";

function isUnpaidInvoice(inv: Pick<Invoice, "status">): boolean {
  return inv.status === "ISSUED";
}

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
  inv: Pick<Invoice, "source" | "status">,
  gstRegistered: boolean
): string {
  if (inv.source === "COUNTER_SALE") return "COUNTER SALE";
  if (inv.source === "MEMBERSHIP") return "MEMBERSHIP";
  if (isUnpaidInvoice(inv)) return gstRegistered ? "TAX PRE INVOICE" : "PRE INVOICE";
  return gstRegistered ? "TAX INVOICE" : "INVOICE";
}

export function invoiceCustomerDocumentLabel(
  inv: Pick<Invoice, "source" | "status">,
  gstRegistered: boolean
): { titleCase: string; sentenceCase: string } {
  if (inv.source === "COUNTER_SALE") {
    return {
      titleCase: "Counter Sale",
      sentenceCase: "counter sale",
    };
  }
  if (inv.source === "MEMBERSHIP") {
    return {
      titleCase: "Membership",
      sentenceCase: "membership",
    };
  }
  if (isUnpaidInvoice(inv)) {
    return {
      titleCase: gstRegistered ? "Tax Pre Invoice" : "Pre Invoice",
      sentenceCase: gstRegistered ? "tax pre invoice" : "pre invoice",
    };
  }
  return {
    titleCase: gstRegistered ? "Tax Invoice" : "Invoice",
    sentenceCase: gstRegistered ? "tax invoice" : "invoice",
  };
}
