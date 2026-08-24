import { format } from "date-fns";
import type { Appointment } from "@/types";
import { buildBookingReminderMessage } from "@/lib/appointment-messages";

const ACTIVE_STATUSES = new Set(["SCHEDULED", "CONFIRMED"]);

export function isAppointmentToday(apt: Appointment, today = format(new Date(), "yyyy-MM-dd")): boolean {
  return apt.date === today;
}

export function isUpcomingAppointment(apt: Appointment, today = format(new Date(), "yyyy-MM-dd")): boolean {
  return apt.date > today;
}

export function isActiveReservation(apt: Appointment): boolean {
  return ACTIVE_STATUSES.has(apt.status) && !apt.jobCardId;
}

export function appointmentsScheduledToday(
  appointments: Appointment[],
  today = format(new Date(), "yyyy-MM-dd")
): Appointment[] {
  return appointments.filter((a) => isActiveReservation(a) && isAppointmentToday(a, today));
}

export function upcomingReservations(
  appointments: Appointment[],
  today = format(new Date(), "yyyy-MM-dd")
): Appointment[] {
  return appointments.filter((a) => isActiveReservation(a) && isUpcomingAppointment(a, today));
}

export function reservationsNeedingReminder(
  appointments: Appointment[],
  today = format(new Date(), "yyyy-MM-dd")
): Appointment[] {
  return appointmentsScheduledToday(appointments, today).filter((a) => !a.reminderSent);
}

export function reminderMessageFor(apt: Appointment): string {
  return buildBookingReminderMessage(apt);
}
