import type {
  Appointment,
  Customer,
  JobCard,
  JobCardStatus,
  PickupDropRequest,
  PickupDropStatus,
  PickupDropType,
} from "@/types";

/** Label for the request-specific address field in the create modal. */
export function pickupDropAddressFieldLabel(type: PickupDropType): string {
  return type === "PICKUP" ? "Pickup Address" : "Drop Address";
}

/** Booking / customer address for pre-fill — does not mutate stored customer data. */
export function resolvePickupDropAddressForJobCard(
  jc: JobCard,
  appointments: Appointment[],
  customers: Customer[]
): string {
  if (jc.appointmentId) {
    const apt = appointments.find((a) => a.id === jc.appointmentId);
    const fromBooking = apt?.customerAddress?.trim();
    if (fromBooking) return fromBooking;
  }
  const customer = customers.find((c) => c.id === jc.customerId);
  return customer?.address?.trim() ?? "";
}

export const PICKUP_DROP_STATUS_ORDER: PickupDropStatus[] = [
  "PENDING",
  "DRIVER_ASSIGNED",
  "PICKED_UP",
  "IN_SERVICE",
  "DELIVERED",
];

export const PICKUP_DROP_STATUS_LABEL: Record<PickupDropStatus, string> = {
  PENDING: "Pending",
  DRIVER_ASSIGNED: "Driver assigned",
  PICKED_UP: "Picked up",
  IN_SERVICE: "In service",
  DELIVERED: "Delivered",
};

export function pickupDropStatusRank(status: PickupDropStatus): number {
  return PICKUP_DROP_STATUS_ORDER.indexOf(status);
}

/** Next manual step for ops (pickup leg stops at In service; drop leg ends at Delivered). */
export function nextPickupDropStatus(
  type: PickupDropType,
  current: PickupDropStatus
): PickupDropStatus | null {
  if (type === "PICKUP") {
    switch (current) {
      case "PENDING":
        return "DRIVER_ASSIGNED";
      case "DRIVER_ASSIGNED":
        return "PICKED_UP";
      case "PICKED_UP":
        return "IN_SERVICE";
      default:
        return null;
    }
  } else {
    // DROP type
    switch (current) {
      case "PENDING":
        return "DRIVER_ASSIGNED";
      case "DRIVER_ASSIGNED":
        return "DELIVERED";
      case "IN_SERVICE":
        // Legacy fallback for previously created DROP requests.
        return "DELIVERED";
      default:
        return null;
    }
  }
}

export function getLinkedPickupRequest(
  jobCardId: string,
  requests: PickupDropRequest[]
): PickupDropRequest | undefined {
  return requests.find((r) => r.jobCardId === jobCardId && r.type === "PICKUP");
}

export function getLinkedDropRequest(
  jobCardId: string,
  requests: PickupDropRequest[]
): PickupDropRequest | undefined {
  return requests.find((r) => r.jobCardId === jobCardId && r.type === "DROP");
}

export function findPickupDropRequest(
  jobCardId: string,
  type: PickupDropType,
  requests: PickupDropRequest[]
): PickupDropRequest | undefined {
  return requests.find((r) => r.jobCardId === jobCardId && r.type === type);
}

/** Pickup trip is done when the vehicle is at the workshop (service may still be in progress). */
export function isPickupAtWorkshop(
  pickup: PickupDropRequest | undefined
): boolean {
  if (!pickup || pickup.type !== "PICKUP") return false;
  return pickupDropStatusRank(pickup.status) >= pickupDropStatusRank("IN_SERVICE");
}

/** @deprecated Use isPickupAtWorkshop — pickup complete does not mean customer delivery. */
export function isPickupLegComplete(
  pickup: PickupDropRequest | undefined,
  _requests?: PickupDropRequest[]
): boolean {
  return isPickupAtWorkshop(pickup);
}

/** Drop marked delivered before the job is Ready (car still in the workshop). */
export function dropDeliveryIsPremature(
  drop: PickupDropRequest,
  job: JobCard | null | undefined,
  requests: PickupDropRequest[] = []
): boolean {
  if (drop.type !== "DROP" || drop.status !== "DELIVERED") return false;
  if (drop.jobCardId.startsWith("new-") || drop.jobNumber === "NEW") return true;
  if (!job) return false;
  if (job.status === "CANCELLED") return true;
  if (job.status === "DELIVERED") return false;
  if (jobStatusRank(job.status) < jobStatusRank("READY")) return true;
  const pickup = getLinkedPickupRequest(drop.jobCardId, requests);
  if (pickup && !isPickupAtWorkshop(pickup)) return true;
  return false;
}

export function statusAfterRewindDrop(drop: PickupDropRequest): PickupDropStatus {
  return drop.driverId ? "DRIVER_ASSIGNED" : "PENDING";
}

export function effectivePickupDropStatus(
  req: PickupDropRequest,
  job: JobCard | null | undefined,
  requests: PickupDropRequest[] = []
): PickupDropStatus {
  if (dropDeliveryIsPremature(req, job, requests)) return statusAfterRewindDrop(req);
  return req.status;
}

export function pickupDropDisplayLabel(
  req: PickupDropRequest,
  requests: PickupDropRequest[] = [],
  job?: JobCard | null
): string {
  if (req.type === "DROP") {
    if (dropDeliveryIsPremature(req, job, requests)) {
      return req.driverId ? "Waiting for workshop" : "Pending";
    }
    if (req.status === "IN_SERVICE") return "Drop-off in progress";
    if (req.status === "DELIVERED") return "Delivered to customer";
  } else if (req.status === "IN_SERVICE") {
    const drop = getLinkedDropRequest(req.jobCardId, requests);
    const dropDone =
      drop?.status === "DELIVERED" && !dropDeliveryIsPremature(drop, job, requests);
    const jobFinished = job ? jobStatusRank(job.status) >= jobStatusRank("DELIVERED") : false;
    if (dropDone || jobFinished) return "Pickup complete";
    return req.jobNumber === "NEW" ? "At workshop (Needs Job Card)" : "At workshop";
  }
  return PICKUP_DROP_STATUS_LABEL[req.status];
}

/** Vehicle must be picked up before any workshop step (inspection, service, etc.). */
export function pickupBlocksJobAdvance(
  jobCardId: string,
  requests: PickupDropRequest[],
  nextJobStatus: JobCardStatus
): string | null {
  const pickup = getLinkedPickupRequest(jobCardId, requests);
  if (!pickup) return null;

  const needsPickupComplete: JobCardStatus[] = [
    "INSPECTION",
    "AWAITING_SERVICE",
    "QUALITY_CHECK",
    "READY",
    "DELIVERED",
  ];
  if (!needsPickupComplete.includes(nextJobStatus)) return null;
  if (pickupDropStatusRank(pickup.status) >= pickupDropStatusRank("PICKED_UP")) return null;

  return `Pickup is "${PICKUP_DROP_STATUS_LABEL[pickup.status]}". Assign the driver (if needed), then mark the vehicle picked up before continuing the job.`;
}

/** @deprecated Use pickupBlocksJobAdvance */
export function pickupGateForWorkshopStart(
  jobCardId: string,
  requests: PickupDropRequest[]
): string | null {
  return pickupBlocksJobAdvance(jobCardId, requests, "AWAITING_SERVICE");
}

export function pickupAtWorkshop(pickup: PickupDropRequest | undefined): boolean {
  return isPickupAtWorkshop(pickup);
}

export type PickupDropAdvanceContext = {
  job?: JobCard | null;
  requests?: PickupDropRequest[];
};

export function resolveJobCardForPickupDrop(
  req: Pick<PickupDropRequest, "jobCardId" | "jobNumber">,
  jobs: JobCard[]
): JobCard | undefined {
  const byId = jobs.find((j) => j.id === req.jobCardId);
  if (byId) return byId;
  if (!req.jobNumber || req.jobNumber === "NEW") return undefined;
  return jobs.find((j) => j.jobNumber === req.jobNumber);
}

export function validatePickupDropAdvance(
  req: PickupDropRequest,
  ctx?: PickupDropAdvanceContext
): string | null {
  const next = nextPickupDropStatus(req.type, req.status);
  if (!next) return "This request is already at its final status.";
  if (!req.driverId) {
    return "Assign a driver before advancing the status.";
  }
  if (req.type === "DROP" && next === "DELIVERED") {
    const requests = ctx?.requests ?? [];
    const pickup = getLinkedPickupRequest(req.jobCardId, requests);
    const job = ctx?.job;
    if (pickup && !isPickupAtWorkshop(pickup) && job?.status !== "DELIVERED") {
      return "Finish pickup first. The vehicle must be at the workshop before drop-off.";
    }
    const linkedToOpenJob = Boolean(job) && job!.status !== "CANCELLED";
    const stillUnlinked =
      !linkedToOpenJob && (req.jobCardId.startsWith("new-") || req.jobNumber === "NEW");
    if (stillUnlinked) {
      return "The vehicle is at the workshop. Create the job card and finish service before drop-off.";
    }
    if (job?.status === "CANCELLED") {
      return "This job is cancelled.";
    }
    if (job && jobStatusRank(job.status) < jobStatusRank("READY")) {
      return "The vehicle is at the workshop under maintenance. Finish service and mark the job Ready before drop-off.";
    }
  }
  return null;
}

export function jobHasPickupIntent(job: JobCard, requests: PickupDropRequest[]): boolean {
  if (requests.some((r) => r.jobCardId === job.id && r.type === "PICKUP")) return true;
  return /pickup requested/i.test(job.reportedIssues ?? "");
}

function jobNotesBlob(job: JobCard): string {
  return `${job.notes ?? ""}\n${job.reportedIssues ?? ""}`;
}

/** Explicit decline from booking wizard — do not auto-create a return trip. */
export function jobDeclinesDropOff(job: JobCard): boolean {
  return /drop-off required:\s*no/i.test(jobNotesBlob(job));
}

export function jobHasDropIntent(job: JobCard, requests: PickupDropRequest[]): boolean {
  if (requests.some((r) => r.jobCardId === job.id && r.type === "DROP")) return true;
  return /drop-off required:\s*yes/i.test(jobNotesBlob(job));
}

/** Show the drop-off form on Deliver Vehicle when a return trip exists or was requested. */
export function jobNeedsDropOffForm(job: JobCard, requests: PickupDropRequest[]): boolean {
  if (jobDeclinesDropOff(job)) return false;
  const drop = getLinkedDropRequest(job.id, requests);
  if (drop?.status === "DELIVERED") return false;
  if (drop) return true;
  return jobHasDropIntent(job, requests);
}

/** Pickup request id whose group should be attached to this job (still sitting on a temporary NEW id). */
export function orphanPickupRequestIdForJob(
  job: JobCard,
  requests: PickupDropRequest[]
): string | undefined {
  if (requests.some((r) => r.jobCardId === job.id)) return undefined;
  const orphans = requests.filter(
    (r) => r.jobCardId.startsWith("new-") || r.jobNumber === "NEW"
  );
  if (!orphans.length) return undefined;

  const jobReg = (job.vehicleRegNumber ?? "").replace(/[\s-]/g, "").toUpperCase();
  const jobPhone = (job.customerPhone ?? "").replace(/\D/g, "");
  const byReg = jobReg
    ? orphans.filter(
        (r) => (r.vehicleRegNumber ?? "").replace(/[\s-]/g, "").toUpperCase() === jobReg
      )
    : [];
  const pool = byReg.length
    ? byReg
    : jobPhone.length >= 10
      ? orphans.filter((r) => (r.customerPhone ?? "").replace(/\D/g, "") === jobPhone)
      : [];
  if (!pool.length) return undefined;
  return [...pool].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0]?.id;
}

export function buildDropRequestInput(
  job: JobCard,
  pickupRequest: PickupDropRequest | undefined
): {
  jobCardId: string;
  jobNumber: string;
  branchId: string;
  customerName: string;
  vehicleMakeModel?: string;
  vehicleRegNumber?: string;
  customerPhone?: string;
  address: string;
  scheduledTime: string;
  type: "DROP";
  notes?: string;
} {
  const brFallback = pickupRequest?.address ?? "Return address — confirm with customer";
  return {
    jobCardId: job.id,
    jobNumber: job.jobNumber,
    branchId: job.branchId,
    customerName: job.customerName,
    vehicleMakeModel: job.vehicleMakeModel,
    vehicleRegNumber: job.vehicleRegNumber,
    customerPhone: job.customerPhone ?? pickupRequest?.customerPhone,
    address: brFallback,
    scheduledTime: job.expectedDelivery,
    type: "DROP",
    notes: "Auto-created when job reached Ready and pickup is at workshop",
  };
}

const JOB_RANK: JobCardStatus[] = [
  "RECEIVED",
  "INSPECTION",
  "AWAITING_SERVICE",
  "QUALITY_CHECK",
  "READY",
  "DELIVERED",
];

export function jobStatusRank(status: JobCardStatus): number {
  return JOB_RANK.indexOf(status);
}

export type PickupDropJobGroup = {
  jobCardId: string;
  jobNumber: string;
  customerName: string;
  vehicleRegNumber?: string;
  scheduledTime: string;
  address: string;
  branchId: string;
  pickup?: PickupDropRequest;
  drop?: PickupDropRequest;
  /** Standalone request (no linked job card row in the system). */
  orphan?: PickupDropRequest;
};

function pickPreferredLeg(
  current: PickupDropRequest | undefined,
  incoming: PickupDropRequest
): PickupDropRequest {
  if (!current) return incoming;
  const incomingCreated = Date.parse(incoming.createdAt) || 0;
  const currentCreated = Date.parse(current.createdAt) || 0;
  if (incomingCreated !== currentCreated) {
    return incomingCreated > currentCreated ? incoming : current;
  }
  return pickupDropStatusRank(incoming.status) > pickupDropStatusRank(current.status)
    ? incoming
    : current;
}

function groupCreatedAtMs(group: PickupDropJobGroup): number {
  const legs = [group.pickup, group.drop, group.orphan].filter(
    (x): x is PickupDropRequest => x != null
  );
  return Math.max(0, ...legs.map((leg) => Date.parse(leg.createdAt) || 0));
}

/** One UI row per job — pickup + drop-off are legs of the same booking, not duplicate jobs. */
export function groupPickupDropByJob(requests: PickupDropRequest[]): PickupDropJobGroup[] {
  const byJob = new Map<
    string,
    { pickup?: PickupDropRequest; drop?: PickupDropRequest }
  >();
  const orphans: PickupDropRequest[] = [];

  for (const r of requests) {
    if (!r.jobCardId) {
      orphans.push(r);
      continue;
    }
    const cur = byJob.get(r.jobCardId) ?? {};
    if (r.type === "PICKUP") cur.pickup = pickPreferredLeg(cur.pickup, r);
    else cur.drop = pickPreferredLeg(cur.drop, r);
    byJob.set(r.jobCardId, cur);
  }

  const groups: PickupDropJobGroup[] = [];

  for (const [jobCardId, legs] of byJob) {
    const ref = legs.pickup ?? legs.drop;
    if (!ref) continue;
    groups.push({
      jobCardId,
      jobNumber: ref.jobNumber,
      customerName: ref.customerName,
      vehicleRegNumber: ref.vehicleRegNumber,
      scheduledTime: ref.scheduledTime,
      address: ref.address,
      branchId: ref.branchId,
      pickup: legs.pickup,
      drop: legs.drop,
    });
  }

  for (const o of orphans) {
    groups.push({
      jobCardId: o.jobCardId,
      jobNumber: o.jobNumber,
      customerName: o.customerName,
      vehicleRegNumber: o.vehicleRegNumber,
      scheduledTime: o.scheduledTime,
      address: o.address,
      branchId: o.branchId,
      orphan: o,
    });
  }

  return groups.sort((a, b) => {
    const createdDiff = groupCreatedAtMs(b) - groupCreatedAtMs(a);
    if (createdDiff !== 0) return createdDiff;
    const ta = new Date(a.scheduledTime).getTime();
    const tb = new Date(b.scheduledTime).getTime();
    if (tb !== ta) return tb - ta;
    return b.jobNumber.localeCompare(a.jobNumber);
  });
}

export function pickupDropGroupMatchesFilters(
  group: PickupDropJobGroup,
  statusFilter: PickupDropStatus | "ALL",
  typeFilter: PickupDropType | "ALL"
): boolean {
  const legs = [group.pickup, group.drop, group.orphan].filter(
    (x): x is PickupDropRequest => x != null
  );
  return legs.some((leg) => {
    if (statusFilter !== "ALL" && leg.status !== statusFilter) return false;
    if (typeFilter !== "ALL" && leg.type !== typeFilter) return false;
    return true;
  });
}
