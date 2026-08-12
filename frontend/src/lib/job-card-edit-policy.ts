import type { JobCard } from "@/types";

/** Core / service edits allowed until delivered or cancelled. */
export function jobCardIsEditable(job: Pick<JobCard, "status">): boolean {
  return job.status !== "DELIVERED" && job.status !== "CANCELLED";
}

/** Parts editable until delivered/cancelled and stock not consumed (Ready). */
export function jobCardPartsEditable(
  job: Pick<JobCard, "status" | "inventoryConsumedAt">
): boolean {
  return jobCardIsEditable(job) && !job.inventoryConsumedAt;
}

/** Pricing / advance edits blocked once an invoice exists. */
export function jobCardPricingEditable(
  job: Pick<JobCard, "status">,
  hasInvoice: boolean
): boolean {
  return jobCardIsEditable(job) && !hasInvoice;
}

/** Status workflow transitions (and delivery snapshot) from an open job. */
const LOCKED_ALLOWED_KEYS = new Set([
  "status",
  "updatedAt",
  "actualDelivery",
  "serviceTimerDeliverySnapshot",
  "totalPausedMs",
  "timerIsPaused",
  "timerPausedAt",
  "inspectionPhotos",
  "whatsappLog",
]);

export function jobCardUpdateAllowed(
  prev: JobCard,
  patch: Partial<JobCard>
): boolean {
  if (jobCardIsEditable(prev)) {
    if ("parts" in patch && !jobCardPartsEditable(prev) && patch.parts !== prev.parts) {
      return false;
    }
    return true;
  }
  return Object.keys(patch).every((k) => LOCKED_ALLOWED_KEYS.has(k));
}
