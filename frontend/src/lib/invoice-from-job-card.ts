import type {
  Invoice,
  InvoiceLineItem,
  InvoiceStatus,
  JobCard,
  Payment,
  ServiceCatalogItem,
  ServiceItem,
  VehicleSegment,
} from "@/types";
import { useJobCardStore } from "@/store/job-card-store";
import { useInvoiceStore } from "@/store/invoice-store";
import { useHighEndServiceStore, highEndPriceForSegment } from "@/store/high-end-service-store";
import { useMembershipStore } from "@/store/membership-store";
import { useServiceCatalogStore } from "@/store/service-catalog-store";
import { useSettingsStore } from "@/store/settings-store";
import { computeGstFromSubtotal } from "@/lib/gst-tax";

function currentInvoiceTaxTotals(subtotal: number) {
  const gstStatus = useSettingsStore.getState().gstRegistrationStatus;
  return computeGstFromSubtotal(subtotal, gstStatus);
}

function highEndSubtotalExclGst(job: JobCard): number {
  const hesCatalog = useHighEndServiceStore.getState().services;
  let sum = 0;
  for (const hesId of job.highEndServiceIds ?? []) {
    const cfg = hesCatalog.find((h) => h.id === hesId);
    sum += cfg ? highEndPriceForSegment(cfg, job.vehicleSegment) : 0;
  }
  return sum;
}

/** Align stored line prices with job estimate (fixes legacy ÷100 coupon rounding bug).
 * Skipped when any line has a custom price, or when estimate already matches (incl. parts).
 */
function normalizedServicePrices(job: JobCard): ServiceItem[] {
  if (job.services.some((s) => s.isCustomPrice || s.priceSource === "CUSTOM")) {
    return job.services;
  }
  const hesSubtotal = highEndSubtotalExclGst(job);
  const partsSubtotal = (job.parts ?? []).reduce((s, p) => s + p.lineTotal, 0);
  const catalogTarget = Math.max(0, job.estimatedAmount - hesSubtotal - partsSubtotal);
  const rawSubtotal = job.services.reduce((s, x) => s + x.price, 0);
  if (rawSubtotal <= 0 || Math.abs(rawSubtotal - catalogTarget) < 0.01) {
    return job.services;
  }
  // Only rescale when the estimate is clearly the services-only target (legacy coupon bug).
  // If estimate looks tax-inclusive vs services (≈1.18×), skip rescaling.
  if (rawSubtotal > 0 && Math.abs(job.estimatedAmount / rawSubtotal - 1.18) < 0.05) {
    return job.services;
  }
  const factor = catalogTarget / rawSubtotal;
  return job.services.map((s) => {
    const price = Math.round(s.price * factor * 100) / 100;
    return { ...s, price: Math.max(0, price) };
  });
}

const DEFAULT_TERMS =
  "Payment is due within 7 days of invoice date. Late payments may incur interest charges. All work is guaranteed for 30 days on parts replaced.";

function invoiceStatusFromPayments(grandTotal: number, payments: Payment[]): InvoiceStatus {
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  if (paid >= grandTotal - 0.01) return "PAID";
  if (paid > 0) return "PARTIALLY_PAID";
  return "ISSUED";
}

function catalogPriceForSegment(item: ServiceCatalogItem, segment: VehicleSegment): number {
  const key = segment as keyof ServiceCatalogItem["segmentPricing"];
  return item.segmentPricing[key] ?? item.defaultPrice;
}

/** Included services redeemed on this job (from membership usage history). */
function membershipRedeemedCatalogIds(jobCardId: string): Set<string> {
  const ids = new Set<string>();
  for (const sub of useMembershipStore.getState().subscriptions) {
    for (const usage of sub.usageHistory ?? []) {
      if (usage.jobCardId === jobCardId) ids.add(usage.serviceCatalogId);
    }
  }
  return ids;
}

function serviceLineItem(
  s: ServiceItem,
  job: JobCard,
  invoiceId: string,
  index: number,
  membershipRedeemed: Set<string>,
  catalog: ServiceCatalogItem[]
): InvoiceLineItem {
  const isMembershipBenefit =
    membershipRedeemed.has(s.serviceCatalogId) || s.priceSource === "MEMBERSHIP";
  if (isMembershipBenefit) {
    const cat = catalog.find((c) => c.id === s.serviceCatalogId);
    const fullRate =
      s.catalogPrice ??
      (cat ? catalogPriceForSegment(cat, job.vehicleSegment) : 0);
    if (fullRate > 0) {
      return {
        id: `li-${invoiceId}-svc-${index}`,
        description: `${s.name} (Membership benefit)`,
        type: "SERVICE",
        quantity: 1,
        unitPrice: fullRate,
        lineDiscount: fullRate,
        total: 0,
      };
    }
  }

  return {
    id: `li-${invoiceId}-svc-${index}`,
    description: s.name,
    type: "SERVICE" as const,
    quantity: 1,
    unitPrice: s.price,
    total: s.price,
  };
}

/** Build a billable invoice from a delivered job card (services → line items, GST). */
export function buildInvoiceFromJobCard(
  job: JobCard,
  invoiceNumber: string,
  invoiceId: string
): Invoice {
  const hesCatalog = useHighEndServiceStore.getState().services;
  const services = normalizedServicePrices(job);
  const membershipRedeemed = membershipRedeemedCatalogIds(job.id);
  const catalog = useServiceCatalogStore.getState().catalog;

  const catalogLines: InvoiceLineItem[] = services.map((s, i) =>
    serviceLineItem(s, job, invoiceId, i, membershipRedeemed, catalog)
  );

  const programLines: InvoiceLineItem[] = [];
  for (const hesId of job.highEndServiceIds ?? []) {
    const cfg = hesCatalog.find((h) => h.id === hesId);
    const amt = cfg ? highEndPriceForSegment(cfg, job.vehicleSegment) : 0;
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

  const partLines: InvoiceLineItem[] = (job.parts ?? []).map((p, i) => ({
    id: `li-${invoiceId}-part-${i}`,
    description: `${p.name} — ${p.quantity} ${p.unit}`,
    type: "PARTS" as const,
    quantity: p.quantity,
    unitPrice: p.unitPrice,
    total: p.lineTotal,
  }));

  const lineItems: InvoiceLineItem[] = [...catalogLines, ...programLines, ...partLines];

  const subtotal = lineItems.reduce((sum, li) => sum + li.total, 0);
  const { taxRate: effectiveTaxRate, taxAmount, grandTotal } = currentInvoiceTaxTotals(subtotal);

  const createdAt = new Date().toISOString();
  const payments: Payment[] = [];

  let advanceAmount = 0;
  const advanceMethod = job.highEndAdvanceMethod ?? "CASH";
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

  const membershipStore = useMembershipStore.getState();
  const membership =
    membershipStore.subscriptions.find((sub) =>
      (sub.usageHistory ?? []).some((u) => u.jobCardId === job.id)
    ) ??
    membershipStore.getActiveMembership(job.customerId, job.vehicleId) ??
    membershipStore.getActiveMembership(job.customerId);
  const membershipPackageName = membership
    ? membershipStore.packages.find((p) => p.id === membership.packageId)?.name
    : undefined;

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
    taxRate: effectiveTaxRate,
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
    membershipId: membership?.id,
    membershipPackageName,
  };
}

export type CreateInvoiceForJobResult =
  | { ok: true; invoiceId: string; invoiceNumber: string; created: boolean }
  | { ok: false; code: "NOT_FOUND" | "NOT_DELIVERED" | "NO_SERVICES" };

function jobHasInvoiceableLines(job: JobCard): boolean {
  if (job.services.length > 0) return true;
  if ((job.parts?.length ?? 0) > 0) return true;
  const hesCatalog = useHighEndServiceStore.getState().services;
  for (const hesId of job.highEndServiceIds ?? []) {
    const cfg = hesCatalog.find((h) => h.id === hesId);
    if (cfg && highEndPriceForSegment(cfg, job.vehicleSegment) > 0) return true;
  }
  return false;
}

/**
 * Returns an existing invoice for the job or creates one from a ready/delivered job card.
 * Used by Billing (?jobCardId=) and job card “Generate Invoice”.
 * Invoice can be created at READY; delivery is a separate step with checklist.
 */
export function createOrGetInvoiceForJob(
  jobCardId: string,
  jobOverride?: JobCard
): CreateInvoiceForJobResult {
  const jc =
    jobOverride ?? useJobCardStore.getState().jobCards.find((j) => j.id === jobCardId);
  if (!jc || jc.id !== jobCardId) return { ok: false, code: "NOT_FOUND" };

  const existing = useInvoiceStore.getState().invoices.find((inv) => inv.jobCardId === jobCardId);
  if (existing) {
    return {
      ok: true,
      invoiceId: existing.id,
      invoiceNumber: existing.invoiceNumber,
      created: false,
    };
  }

  if (jc.status !== "DELIVERED" && jc.status !== "READY") {
    return { ok: false, code: "NOT_DELIVERED" };
  }
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
