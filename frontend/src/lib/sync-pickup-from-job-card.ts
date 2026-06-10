import type { JobCardStatus } from "@/types";
import { useJobCardStore } from "@/store/job-card-store";
import { usePickupDropStore } from "@/store/pickup-drop-store";
import {
  buildDropRequestInput,
  getLinkedDropRequest,
  getLinkedPickupRequest,
  jobHasPickupIntent,
  jobStatusRank,
  pickupAtWorkshop,
  pickupDropStatusRank,
} from "@/lib/pickup-drop-flow";

/** Create a drop request when the car is ready to return (pickup confirmed at workshop). */
export function ensureDropRequestForJob(jobCardId: string): void {
  const job = useJobCardStore.getState().jobCards.find((j) => j.id === jobCardId);
  if (!job) return;

  const store = usePickupDropStore.getState();
  const linked = store.requests.filter((r) => r.jobCardId === jobCardId);
  if (!jobHasPickupIntent(job, linked)) return;
  if (linked.some((r) => r.type === "DROP")) return;

  const pickup = getLinkedPickupRequest(jobCardId, linked);
  if (!pickupAtWorkshop(pickup)) return;

  store.addRequest(buildDropRequestInput(job, pickup));
}

/**
 * Limited sync from job → drop only. Pickup leg is always manual (driver ops).
 * Drop is auto-created at Ready when pickup is at workshop; drop completes on job
 * Delivered only if a driver was assigned for the return trip.
 */
export function syncPickupFromJobCard(jobCardId: string, jobStatus: JobCardStatus): void {
  const store = usePickupDropStore.getState();
  const linked = store.requests.filter((r) => r.jobCardId === jobCardId);
  const pickup = getLinkedPickupRequest(jobCardId, linked);

  if (jobStatusRank(jobStatus) >= jobStatusRank("READY")) {
    ensureDropRequestForJob(jobCardId);
  }

  if (jobStatus !== "DELIVERED") return;

  const drop = getLinkedDropRequest(jobCardId, store.requests);
  if (!drop || !pickupAtWorkshop(pickup)) return;
  if (pickupDropStatusRank(drop.status) >= pickupDropStatusRank("DELIVERED")) return;
  if (!drop.driverId) return;
  if (pickupDropStatusRank(drop.status) < pickupDropStatusRank("DRIVER_ASSIGNED")) return;

  store.updateStatus(drop.id, "DELIVERED");
}

/** Create missing drop rows for ready jobs; never rewrite pickup status from job card. */
export function reconcilePickupWithJobCards(): void {
  const jobCards = useJobCardStore.getState().jobCards;
  for (const jc of jobCards) {
    if (jobStatusRank(jc.status) >= jobStatusRank("READY")) {
      ensureDropRequestForJob(jc.id);
    }
    if (jc.status === "DELIVERED") {
      syncPickupFromJobCard(jc.id, "DELIVERED");
    }
  }
}
