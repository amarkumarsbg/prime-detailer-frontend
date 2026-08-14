import type { JobCard, ServiceItem } from "@/types";
import { jobCardPricingEditable } from "@/lib/job-card-edit-policy";

/** Top-level Job Card fields that are direct user pricing inputs (not derived totals). */
export const JOB_CARD_PRICING_TOP_LEVEL_KEYS = [
  "highEndAdvanceAmountInr",
  "highEndAdvanceHintPercent",
  "waiveHighEndAdvance",
  "highEndAdvanceCollectedAt",
  "highEndAdvanceMethod",
  "highEndAdvanceReference",
] as const;

type PricingTopKey = (typeof JOB_CARD_PRICING_TOP_LEVEL_KEYS)[number];

function numEq(a: unknown, b: unknown): boolean {
  const na = typeof a === "number" && Number.isFinite(a) ? a : null;
  const nb = typeof b === "number" && Number.isFinite(b) ? b : null;
  if (na === null && nb === null) return true;
  if (na === null || nb === null) return false;
  return Math.abs(na - nb) < 0.001;
}

function serviceLineKey(s: Pick<ServiceItem, "id" | "serviceCatalogId">): string {
  return s.id || s.serviceCatalogId || "";
}

/**
 * True when user-editable service/custom price inputs differ between prev and next.
 * Does NOT treat estimatedAmount / incentiveAmount as pricing inputs (derived).
 */
export function jobCardHasPricingDelta(
  prev: Pick<JobCard, "services"> & Partial<JobCard>,
  next: Pick<JobCard, "services"> & Partial<JobCard>
): boolean {
  for (const key of JOB_CARD_PRICING_TOP_LEVEL_KEYS) {
    const pk = key as PricingTopKey;
    const a = prev[pk];
    const b = next[pk];
    if (pk === "waiveHighEndAdvance") {
      if (Boolean(a) !== Boolean(b)) return true;
      continue;
    }
    if (pk === "highEndAdvanceMethod" || pk === "highEndAdvanceReference" || pk === "highEndAdvanceCollectedAt") {
      if (String(a ?? "") !== String(b ?? "")) return true;
      continue;
    }
    if (!numEq(a, b)) return true;
  }

  const prevServices = prev.services ?? [];
  const nextServices = next.services ?? [];
  const prevByKey = new Map(prevServices.map((s) => [serviceLineKey(s), s]));
  const nextByKey = new Map(nextServices.map((s) => [serviceLineKey(s), s]));

  for (const [key, n] of nextByKey) {
    const p = prevByKey.get(key);
    if (!p) {
      // New line: custom/membership override counts; catalog default does not.
      if (n.isCustomPrice === true || n.priceSource === "CUSTOM") return true;
      continue;
    }
    if (!numEq(p.price, n.price)) return true;
    if (Boolean(p.isCustomPrice) !== Boolean(n.isCustomPrice)) return true;
    if (String(p.priceSource ?? "") !== String(n.priceSource ?? "")) {
      // Ignore CATALOG <-> MEMBERSHIP noise only if price unchanged (already checked).
      if (n.priceSource === "CUSTOM" || p.priceSource === "CUSTOM") return true;
      if (Boolean(n.isCustomPrice) || Boolean(p.isCustomPrice)) return true;
    }
  }

  // Removed lines do not count as a pricing edit by themselves.
  return false;
}

export type JobCardPricingWriteDecision =
  | { ok: true }
  | { ok: false; reason: "MISSING_PERMISSION" | "STATUS_OR_INVOICE_LOCK"; message: string };

/**
 * Permission + status/invoice lock for changing job-card pricing inputs.
 * SUPER_ADMIN / hasPricingPermission callers should pass hasPricingPermission=true for super admin.
 */
export function evaluateJobCardPricingWrite(opts: {
  hasPricingPermission: boolean;
  prev: JobCard;
  next: JobCard;
  hasInvoice: boolean;
}): JobCardPricingWriteDecision {
  if (!jobCardHasPricingDelta(opts.prev, opts.next)) {
    return { ok: true };
  }
  if (!opts.hasPricingPermission) {
    return {
      ok: false,
      reason: "MISSING_PERMISSION",
      message: "Forbidden: Missing permission JOB_CARD_PRICING",
    };
  }
  if (!jobCardPricingEditable(opts.prev, opts.hasInvoice)) {
    return {
      ok: false,
      reason: "STATUS_OR_INVOICE_LOCK",
      message: opts.hasInvoice
        ? "Job card pricing is locked because an invoice already exists"
        : "Job card pricing is locked for this status",
    };
  }
  return { ok: true };
}
