import type { Appointment } from "@/types";
import { isActiveReservation } from "@/lib/appointment-reminders";

/** Booking/appointment editable while active reservation (no linked job). */
export function appointmentIsEditable(a: Appointment): boolean {
  return isActiveReservation(a);
}

/** System patches allowed after lock (convert, WhatsApp, stale reconcile). */
const LOCKED_ALLOWED_KEYS = new Set([
  "status",
  "jobCardId",
  "whatsappSent",
  "reminderSent",
  "updatedAt",
]);

export function appointmentUpdateAllowed(
  prev: Appointment,
  patch: Partial<Appointment>
): boolean {
  if (appointmentIsEditable(prev)) return true;
  return Object.keys(patch).every((k) => LOCKED_ALLOWED_KEYS.has(k));
}
