import type { Appointment, AppointmentStatus, JobCard } from "@/types";
import { isAppointmentSlotInPast } from "@/lib/booking-calendar-validation";

/** Grace after slot time before an open booking is treated as missed. */
export const APPOINTMENT_STALE_GRACE_MS = 2 * 60 * 60 * 1000;

export const APPOINTMENT_TERMINAL_STATUSES: AppointmentStatus[] = [
  "COMPLETED",
  "CANCELLED",
  "NOT_ATTENDED",
];

export function isAppointmentSlotElapsed(
  dateStr: string,
  timeStr: string,
  graceMs: number = APPOINTMENT_STALE_GRACE_MS
): boolean {
  return isAppointmentSlotInPast(dateStr, timeStr, graceMs);
}

export function isAppointmentStatusTerminal(status: AppointmentStatus): boolean {
  return APPOINTMENT_TERMINAL_STATUSES.includes(status);
}

export function resolveLinkedJobForAppointment(
  apt: Appointment,
  jobCards: JobCard[]
): JobCard | undefined {
  if (apt.jobCardId) {
    const byId = jobCards.find((j) => j.id === apt.jobCardId);
    if (byId) return byId;
  }
  return jobCards.find((j) => j.appointmentId === apt.id);
}

/**
 * Derive the status an appointment should have once its slot has passed.
 * Active future bookings are returned unchanged.
 */
export function resolveStaleAppointmentStatus(
  apt: Appointment,
  linkedJob?: JobCard | null
): AppointmentStatus {
  if (isAppointmentStatusTerminal(apt.status)) return apt.status;
  if (!isAppointmentSlotElapsed(apt.date, apt.time)) return apt.status;

  const job = linkedJob ?? null;

  if (apt.status === "SCHEDULED") return "NOT_ATTENDED";

  if (job?.status === "DELIVERED") return "COMPLETED";
  if (job?.status === "CANCELLED") return "CANCELLED";

  if (apt.status === "CONFIRMED") {
    return apt.jobCardId || job ? apt.status : "NOT_ATTENDED";
  }

  if (apt.status === "IN_PROGRESS") {
    return apt.jobCardId || job ? apt.status : "NOT_ATTENDED";
  }

  return apt.status;
}

export function listStaleAppointmentPatches(
  appointments: Appointment[],
  jobCards: JobCard[]
): { id: string; status: AppointmentStatus }[] {
  const patches: { id: string; status: AppointmentStatus }[] = [];
  for (const apt of appointments) {
    const job = resolveLinkedJobForAppointment(apt, jobCards);
    const next = resolveStaleAppointmentStatus(apt, job);
    if (next !== apt.status) patches.push({ id: apt.id, status: next });
  }
  return patches;
}
