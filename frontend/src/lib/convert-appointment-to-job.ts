import type { Appointment, Branch, JobCard, ServiceCatalogItem, Vehicle } from "@/types";
import { useJobCardStore } from "@/store/job-card-store";
import { useAppointmentStore } from "@/store/appointment-store";
import { pushActivityLog } from "@/lib/activity-log-helper";
import {
  buildJobCardFromAppointment,
  findCatalogServiceForAppointment,
  resolveJobBranchId,
} from "@/lib/job-from-appointment";
import { getAppointmentDisplayId } from "@/lib/appointment-ids";

export async function convertAppointmentToJobCard(params: {
  apt: Appointment;
  vehicles: Vehicle[];
  catalog: ServiceCatalogItem[];
  branches: Branch[];
  currentBranch: Branch | null | undefined;
  createdBy: string;
}): Promise<JobCard> {
  const { apt, vehicles, catalog, branches, currentBranch, createdBy } = params;
  const { addJobCard, getNextJobNumber } = useJobCardStore.getState();
  const { updateAppointment } = useAppointmentStore.getState();

  const jobId = `jc-apt-${Date.now().toString(36)}`;
  const jobNumber = getNextJobNumber();
  const branchId = apt.branchId ?? resolveJobBranchId(currentBranch, branches);
  const vehicle = vehicles.find((v) => v.id === apt.vehicleId);
  const job = buildJobCardFromAppointment({
    apt,
    jobId,
    jobNumber,
    branchId,
    vehicle,
    catalog,
    createdBy,
  });

  await addJobCard(job);
  await updateAppointment(apt.id, { jobCardId: job.id, status: "IN_PROGRESS" });

  const ref = getAppointmentDisplayId(apt);
  pushActivityLog({
    action: "CREATED",
    entityType: "JOB_CARD",
    entityId: job.id,
    entityLabel: job.jobNumber,
    details: `${job.jobNumber} created from ${ref}`,
  });
  pushActivityLog({
    action: "STATUS_CHANGED",
    entityType: "APPOINTMENT",
    entityId: apt.id,
    entityLabel: ref,
    details: `Linked to job ${job.jobNumber}`,
  });

  if (!findCatalogServiceForAppointment(catalog, apt.serviceType)) {
    return job;
  }
  return job;
}
