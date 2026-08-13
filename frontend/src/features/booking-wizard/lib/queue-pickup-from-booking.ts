import type { JobCard } from "@/types";
import { usePickupDropStore } from "@/store/pickup-drop-store";

/** When booking opts into pickup, mirror into Pickup & Drop operations list. */
export function queuePickupDropFromBooking(params: {
  job: Pick<
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
  customerAddress: string;
  pickupDriverId?: string;
  pickupDriverName?: string;
  branches: { id: string; name: string; address: string }[];
}) {
  const { job, customerAddress, pickupDriverId, pickupDriverName, branches } = params;
  const br = branches.find((b) => b.id === job.branchId);
  const workshop = br ? `${br.name} — ${br.address}` : job.branchId;
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
