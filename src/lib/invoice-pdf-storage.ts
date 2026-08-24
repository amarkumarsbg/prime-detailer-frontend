import type { Invoice, InvoiceStoredPdf } from "@/types";
import { useInvoiceStore } from "@/store/invoice-store";

export function getStoredPdfAttachment(
  invoice: Invoice,
  cacheKey: string
): { filename: string; content: string } | null {
  const stored = invoice.storedPdf;
  if (!stored?.contentBase64 || stored.cacheKey !== cacheKey) return null;
  return { filename: stored.filename, content: stored.contentBase64 };
}

export async function persistInvoicePdf(
  invoiceId: string,
  data: Omit<InvoiceStoredPdf, "generatedAt"> & { generatedAt?: string }
): Promise<void> {
  const storedPdf: InvoiceStoredPdf = {
    ...data,
    generatedAt: data.generatedAt ?? new Date().toISOString(),
  };
  await useInvoiceStore.getState().updateInvoice(invoiceId, { storedPdf });
}

export async function clearInvoiceStoredPdf(invoiceId: string): Promise<void> {
  const inv = useInvoiceStore.getState().invoices.find((i) => i.id === invoiceId);
  if (!inv?.storedPdf) return;
  await useInvoiceStore.getState().updateInvoice(invoiceId, { storedPdf: undefined });
}
