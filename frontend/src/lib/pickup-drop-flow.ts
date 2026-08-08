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
  const idx = pickupDropStatusRank(current);
  if (idx < 0 || idx >= PICKUP_DROP_STATUS_ORDER.length - 1) return null;
  const next = PICKUP_DROP_STATUS_ORDER[idx + 1]!;
  if (type === "PICKUP" && next === "DELIVERED") return null;
  return next;
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

/** Pickup leg is done once the vehicle is at the workshop and the return (drop) trip exists. */
export function isPickupLegComplete(
  pickup: PickupDropRequest | undefined,
  requests: PickupDropRequest[]
): boolean {
  if (!pickup || pickup.type !== "PICKUP") return false;
  if (pickupDropStatusRank(pickup.status) < pickupDropStatusRank("IN_SERVICE")) return false;
  return Boolean(getLinkedDropRequest(pickup.jobCardId, requests));
}

export function pickupDropDisplayLabel(
  req: PickupDropRequest,
  requests: PickupDropRequest[]
): string {
  if (isPickupLegComplete(req, requests)) return "Pickup complete";
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

export function validatePickupDropAdvance(req: PickupDropRequest): string | null {
  const next = nextPickupDropStatus(req.type, req.status);
  if (!next) return "This request is already at its final status.";
  if (!req.driverId) {
    return "Assign a driver before advancing the status.";
  }
  return null;
}

export function pickupAtWorkshop(pickup: PickupDropRequest | undefined): boolean {
  if (!pickup) return false;
  return pickupDropStatusRank(pickup.status) >= pickupDropStatusRank("IN_SERVICE");
}

export function jobHasPickupIntent(job: JobCard, requests: PickupDropRequest[]): boolean {
  if (requests.some((r) => r.jobCardId === job.id && r.type === "PICKUP")) return true;
  return /pickup requested/i.test(job.reportedIssues ?? "");
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
  return pickupDropStatusRank(incoming.status) > pickupDropStatusRank(current.status)
    ? incoming
    : current;
}

/** One UI row per job — pickup + drop-off are legs of the same booking, not duplicate jobs. */
export function groupPickupDropByJob(requests: PickupDropRequest[]): PickupDropJobGroup[] {
  const byJob = new Map<
    string,
    { pickup?: PickupDropRequest; drop?: PickupDropRequest }
  >();
  const orphans: PickupDropRequest[] = [];

  for (const r of requests) {
    if (!r.jobCardId || r.jobCardId.startsWith("new-")) {
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
