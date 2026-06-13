import { format, parseISO } from "date-fns";
import type { Appointment } from "@/types";
import { getAppointmentDisplayId, resolveAppointmentKind } from "@/lib/appointment-ids";

function firstName(apt: Appointment): string {
  if (apt.customerFirstName?.trim()) return apt.customerFirstName.trim();
  return apt.customerName.split(/\s+/)[0] ?? apt.customerName;
}

function formatDisplayDate(dateIso: string): string {
  return format(parseISO(dateIso), "dd MMM yyyy");
}

function formatDisplayTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h)) return time;
  const d = new Date();
  d.setHours(h, m ?? 0, 0, 0);
  return format(d, "h:mm a");
}

export function buildBookingConfirmedMessage(apt: Appointment, businessName: string): string {
  const name = firstName(apt);
  const id = getAppointmentDisplayId(apt);
  return [
    `Hello ${name},`,
    ``,
    `Your booking has been confirmed.`,
    ``,
    `Booking ID: ${id}`,
    `Service: ${apt.serviceType}`,
    `Date: ${formatDisplayDate(apt.date)}`,
    `Time: ${formatDisplayTime(apt.time)}`,
    ``,
    `Thank you for choosing ${businessName}.`,
  ].join("\n");
}

export function buildAppointmentConfirmedMessage(apt: Appointment, businessName: string): string {
  const name = firstName(apt);
  const id = getAppointmentDisplayId(apt);
  return [
    `Hello ${name},`,
    ``,
    `Your appointment has been confirmed.`,
    ``,
    `Appointment ID: ${id}`,
    `Date: ${formatDisplayDate(apt.date)}`,
    `Time: ${formatDisplayTime(apt.time)}`,
    ``,
    `Thank you for choosing ${businessName}.`,
  ].join("\n");
}

export function buildReservationConfirmedMessage(apt: Appointment, businessName: string): string {
  return resolveAppointmentKind(apt) === "APPOINTMENT"
    ? buildAppointmentConfirmedMessage(apt, businessName)
    : buildBookingConfirmedMessage(apt, businessName);
}

export function buildBookingReminderMessage(apt: Appointment): string {
  const name = firstName(apt);
  const id = getAppointmentDisplayId(apt);
  const kind = resolveAppointmentKind(apt);
  const label = kind === "APPOINTMENT" ? "appointment" : "service booking";
  return [
    `Good Morning ${name},`,
    ``,
    `This is a reminder for your ${label} today.`,
    ``,
    `${kind === "APPOINTMENT" ? "Appointment" : "Booking"} ID: ${id}`,
    `Time: ${formatDisplayTime(apt.time)}`,
    ``,
    `We look forward to serving you.`,
  ].join("\n");
}
