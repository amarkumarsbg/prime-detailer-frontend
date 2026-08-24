import type { JobCardStatus } from "@/types";
import { useJobCardStore } from "@/store/job-card-store";
import { usePickupDropStore } from "@/store/pickup-drop-store";
import {
  buildDropRequestInput,
  getLinkedPickupRequest,
  jobDeclinesDropOff,
  jobHasDropIntent,
  jobHasPickupIntent,
  jobStatusRank,
  pickupAtWorkshop,
} from "@/lib/pickup-drop-flow";

/**
 * Create a drop request when the car is ready to return.
 * Skips when booking already queued DROP, or booking said drop-off is not required.
 */
export function ensureDropRequestForJob(jobCardId: string): void {
  const job = useJobCardStore.getState().jobCards.find((j) => j.id === jobCardId);
  if (!job) return;

  const store = usePickupDropStore.getState();
  if (!store.hydrated) return;
  const linked = store.requests.filter((r) => r.jobCardId === jobCardId);
  if (linked.some((r) => r.type === "DROP")) return;
  if (jobDeclinesDropOff(job)) return;

  const pickup = getLinkedPickupRequest(jobCardId, linked);

  // Drop-only (or drop requested in notes) — create at Ready without waiting on pickup.
  if (jobHasDropIntent(job, linked) && !pickup) {
    store.addRequest(buildDropRequestInput(job, undefined));
    return;
  }

  // Pickup jobs without an explicit decline: auto-create return trip once at workshop.
  if (!jobHasPickupIntent(job, linked)) return;
  if (!pickupAtWorkshop(pickup)) return;

  store.addRequest(buildDropRequestInput(job, pickup));
}

/**
 * Limited sync from job → drop only. Pickup and drop legs stay manual (driver ops).
 * Drop may already exist from booking; otherwise auto-created at Ready when allowed.
 * Never mark drop-off Delivered from the job card — that happens after service is Ready.
 */
export function syncPickupFromJobCard(jobCardId: string, jobStatus: JobCardStatus): void {
  if (jobStatusRank(jobStatus) >= jobStatusRank("READY")) {
    ensureDropRequestForJob(jobCardId);
  }
}

/** Create missing drop rows for ready jobs; rewind drop-off marked delivered too early. */
export function reconcilePickupWithJobCards(): void {
  if (!usePickupDropStore.getState().hydrated) return;
  const jobCards = useJobCardStore.getState().jobCards;
  for (const jc of jobCards) {
    if (jobStatusRank(jc.status) >= jobStatusRank("READY")) {
      ensureDropRequestForJob(jc.id);
    }
  }
  usePickupDropStore.getState().repairPrematureDropDeliveries(jobCards);
}
