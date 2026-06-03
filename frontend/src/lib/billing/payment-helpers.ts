import type { Invoice, Payment } from "@/types";

/** Short label shown in lists (e.g. Payment In #8). */
export function paymentDisplayNumber(paymentId: string): string {
  return paymentId.replace(/^pay-(?:hitech-)?/, "") || paymentId.slice(-6);
}

export function findPaymentInInvoices(
  invoices: Invoice[],
  paymentId: string
): { payment: Payment; invoice: Invoice } | null {
  for (const invoice of invoices) {
    const payment = invoice.payments.find((p) => p.id === paymentId);
    if (payment) return { payment, invoice };
  }
  return null;
}

export function salesInvoiceDetailPath(invoiceId: string): string {
  return `/billing/invoices/${encodeURIComponent(invoiceId)}`;
}

export function paymentInDetailPath(paymentId: string): string {
  return `/billing/payments/${encodeURIComponent(paymentId)}`;
}

export function statementLineHref(lineId: string): string | undefined {
  if (lineId.startsWith("inv-")) return salesInvoiceDetailPath(lineId.slice(4));
  if (lineId.startsWith("pay-")) return paymentInDetailPath(lineId.slice(4));
  return undefined;
}
