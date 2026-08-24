import type { Appointment, AppointmentKind } from "@/types";

export function getNextBookingId(appointments: Appointment[], year = new Date().getFullYear()): string {
  let max = 0;
  for (const a of appointments) {
    const ref = a.bookingId ?? "";
    const m = ref.match(/^BK-(\d{4})-(\d+)/i);
    if (m && Number(m[1]) === year) max = Math.max(max, Number(m[2]));
  }
  return `BK-${year}-${String(max + 1).padStart(5, "0")}`;
}

export function getNextAppointmentNumber(
  appointments: Appointment[],
  year = new Date().getFullYear()
): string {
  let max = 0;
  for (const a of appointments) {
    const ref = a.appointmentNumber ?? "";
    const m = ref.match(/^AP-(\d{4})-(\d+)/i);
    if (m && Number(m[1]) === year) max = Math.max(max, Number(m[2]));
  }
  return `AP-${year}-${String(max + 1).padStart(5, "0")}`;
}

export function resolveAppointmentKind(apt: Appointment): AppointmentKind {
  if (apt.kind) return apt.kind;
  if (apt.appointmentNumber?.startsWith("AP-")) return "APPOINTMENT";
  if (apt.bookingId?.match(/^AP-/i)) return "APPOINTMENT";
  return "BOOKING";
}

/** Human-facing reference — BK-* or AP-* */
export function getAppointmentDisplayId(apt: Appointment): string {
  const kind = resolveAppointmentKind(apt);
  if (kind === "APPOINTMENT" && apt.appointmentNumber) return apt.appointmentNumber;
  return apt.bookingId;
}
