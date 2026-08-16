import type { JobCard } from "@/types";
import { usePickupDropStore } from "@/store/pickup-drop-store";

type BookingJobFields = Pick<
  JobCard,
  | "id"
  | "jobNumber"
  | "branchId"
  | "customerName"
  | "customerPhone"
  | "vehicleMakeModel"
  | "vehicleRegNumber"
  | "expectedDelivery"
>;

type BranchRef = { id: string; name: string; address: string };

function workshopLabel(job: BookingJobFields, branches: BranchRef[]): string {
  const br = branches.find((b) => b.id === job.branchId);
  return br ? `${br.name} — ${br.address}` : job.branchId;
}

/** When booking opts into pickup, mirror into Pickup & Drop operations list. */
export function queuePickupDropFromBooking(params: {
  job: BookingJobFields;
  customerAddress: string;
  pickupDriverId?: string;
  pickupDriverName?: string;
  branches: BranchRef[];
}) {
  const { job, customerAddress, pickupDriverId, pickupDriverName, branches } = params;
  const workshop = workshopLabel(job, branches);
  const address =
    customerAddress.trim() ||
    `Pickup address pending — confirm with customer · Workshop: ${workshop}`;
  usePickupDropStore.getState().addRequest({
    jobCardId: job.id,
    jobNumber: job.jobNumber,
    branchId: job.branchId,
    customerName: job.customerName,
    vehicleMakeModel: job.vehicleMakeModel,
    vehicleRegNumber: job.vehicleRegNumber,
    customerPhone: job.customerPhone,
    address,
    scheduledTime: job.expectedDelivery,
    type: "PICKUP",
    driverId: pickupDriverId,
    driverName: pickupDriverName,
    notes: pickupDriverId ? "Created from booking — driver assigned" : "Created from booking wizard",
  });
}

/** When booking opts into drop-off, create the DROP leg up front (skips auto-create at Ready). */
export function queueDropFromBooking(params: {
  job: BookingJobFields;
  dropAddress: string;
  dropDriverId?: string;
  dropDriverName?: string;
  branches: BranchRef[];
}) {
  const { job, dropAddress, dropDriverId, dropDriverName, branches } = params;
  const workshop = workshopLabel(job, branches);
  const address =
    dropAddress.trim() ||
    `Drop address pending — confirm with customer · Workshop: ${workshop}`;
  usePickupDropStore.getState().addRequest({
    jobCardId: job.id,
    jobNumber: job.jobNumber,
    branchId: job.branchId,
    customerName: job.customerName,
    vehicleMakeModel: job.vehicleMakeModel,
    vehicleRegNumber: job.vehicleRegNumber,
    customerPhone: job.customerPhone,
    address,
    scheduledTime: job.expectedDelivery,
    type: "DROP",
    driverId: dropDriverId,
    driverName: dropDriverName,
    notes: dropDriverId
      ? "Created from booking — drop driver assigned"
      : "Created from booking wizard — drop-off",
  });
}
