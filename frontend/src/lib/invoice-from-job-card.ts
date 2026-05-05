import type { Invoice, InvoiceLineItem, InvoiceStatus, JobCard, Payment } from "@/types";
import { useJobCardStore } from "@/store/job-card-store";
import { useInvoiceStore } from "@/store/invoice-store";
import { useHighEndServiceStore } from "@/store/high-end-service-store";

const TAX_RATE = 0.18;

const DEFAULT_TERMS =
  "Payment is due within 7 days of invoice date. Late payments may incur interest charges. All work is guaranteed for 30 days on parts replaced.";

function invoiceStatusFromPayments(grandTotal: number, payments: Payment[]): InvoiceStatus {
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  if (paid >= grandTotal - 0.01) return "PAID";
  if (paid > 0) return "PARTIALLY_PAID";
  return "ISSUED";
}

/** Build a billable invoice from a delivered job card (services → line items, GST). */
export function buildInvoiceFromJobCard(
  job: JobCard,
  invoiceNumber: string,
  invoiceId: string
): Invoice {
  const hesCatalog = useHighEndServiceStore.getState().services;

  const catalogLines: InvoiceLineItem[] = job.services.map((s, i) => ({
    id: `li-${invoiceId}-svc-${i}`,
    description: s.name,
    type: "SERVICE" as const,
    quantity: 1,
    unitPrice: s.price,
    total: s.price,
  }));

  const programLines: InvoiceLineItem[] = [];
  for (const hesId of job.highEndServiceIds ?? []) {
    const cfg = hesCatalog.find((h) => h.id === hesId);
    const amt = cfg?.estimateAmountInr ?? 0;
    if (amt <= 0) continue;
    programLines.push({
      id: `li-${invoiceId}-hes-${hesId}`,
      description: `${cfg?.name ?? "High-end program"} (excl. GST)`,
      type: "SERVICE",
      quantity: 1,
      unitPrice: amt,
      total: amt,
    });
  }

  const lineItems: InvoiceLineItem[] = [...catalogLines, ...programLines];

  const subtotal = lineItems.reduce((sum, li) => sum + li.total, 0);
  const taxAmount = Math.round(subtotal * TAX_RATE * 100) / 100;
  const grandTotal = Math.round((subtotal + taxAmount) * 100) / 100;

  const createdAt = new Date().toISOString();
  const payments: Payment[] = [];

  let advanceAmount = 0;
  let advanceMethod = job.highEndAdvanceMethod ?? "CASH";
  let advanceRef = job.highEndAdvanceReference;
  let advancePaidAt = job.highEndAdvanceCollectedAt ?? createdAt;

  if (!job.waiveHighEndAdvance) {
    const recorded = job.highEndAdvanceAmountInr;
    if (recorded != null && recorded > 0 && Number.isFinite(recorded)) {
      advanceAmount = recorded;
    } else {
      const pct = job.highEndAdvanceHintPercent;
      if (pct != null && pct > 0 && Number.isFinite(pct)) {
        advanceAmount = Math.round((pct / 100) * grandTotal * 100) / 100;
        advanceRef = advanceRef ?? `Advance per job: ${pct}% of invoice total`;
        advancePaidAt = job.highEndAdvanceCollectedAt ?? createdAt;
      }
    }
  }

  if (advanceAmount > 0) {
    const capped = Math.min(advanceAmount, grandTotal);
    payments.push({
      id: `pay-he-adv-${invoiceId}`,
      invoiceId,
      amount: capped,
      method: advanceMethod,
      referenceNumber: advanceRef,
      paidAt: advancePaidAt,
    });
  }

  return {
    id: invoiceId,
    invoiceNumber,
    jobCardId: job.id,
    jobNumber: job.jobNumber,
    customerId: job.customerId,
    customerName: job.customerName,
    customerPhone: job.customerPhone,
    vehicleRegNumber: job.vehicleRegNumber,
    lineItems,
    subtotal,
    taxRate: TAX_RATE,
    taxAmount,
    discountAmount: 0,
    rewardDiscount: 0,
    walletAmountUsed: 0,
    grandTotal,
    status: invoiceStatusFromPayments(grandTotal, payments),
    payments,
    termsAndConditions: job.termsAndConditions ?? DEFAULT_TERMS,
    mechanicName: job.mechanicName,
    notes: job.notes,
    createdAt,
  };
}

export type CreateInvoiceForJobResult =
  | { ok: true; invoiceId: string; invoiceNumber: string; created: boolean }
  | { ok: false; code: "NOT_FOUND" | "NOT_DELIVERED" | "NO_SERVICES" };

function jobHasInvoiceableLines(job: JobCard): boolean {
  if (job.services.length > 0) return true;
  const hesCatalog = useHighEndServiceStore.getState().services;
  for (const hesId of job.highEndServiceIds ?? []) {
    const cfg = hesCatalog.find((h) => h.id === hesId);
    if ((cfg?.estimateAmountInr ?? 0) > 0) return true;
  }
  return false;
}

/**
 * Returns an existing invoice for the job or creates one from a delivered job card.
 * Used by Billing (?jobCardId=) and job card “Generate Invoice”.
 */
export function createOrGetInvoiceForJob(jobCardId: string): CreateInvoiceForJobResult {
  const jc = useJobCardStore.getState().jobCards.find((j) => j.id === jobCardId);
  if (!jc) return { ok: false, code: "NOT_FOUND" };

  const existing = useInvoiceStore.getState().invoices.find((inv) => inv.jobCardId === jobCardId);
  if (existing) {
    return {
      ok: true,
      invoiceId: existing.id,
      invoiceNumber: existing.invoiceNumber,
      created: false,
    };
  }

  if (jc.status !== "DELIVERED") return { ok: false, code: "NOT_DELIVERED" };
  if (!jobHasInvoiceableLines(jc)) return { ok: false, code: "NO_SERVICES" };

  const invoiceId = `inv-${Date.now().toString(36)}`;
  const number = useInvoiceStore.getState().getNextInvoiceNumber();
  const inv = buildInvoiceFromJobCard(jc, number, invoiceId);
  useInvoiceStore.getState().addInvoice(inv);

  return {
    ok: true,
    invoiceId: inv.id,
    invoiceNumber: inv.invoiceNumber,
    created: true,
  };
}
