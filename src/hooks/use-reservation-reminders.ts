"use client";

import { useEffect, useRef } from "react";
import { useAppointmentStore } from "@/store/appointment-store";
import { reservationsNeedingReminder } from "@/lib/appointment-reminders";
import { notifyReservationReminderWhatsApp } from "@/lib/whatsapp-automation-triggers";

/** Sends day-of WhatsApp reminders for today's unconverted bookings/appointments (once per reservation). */
export function useReservationReminders(): void {
  const appointments = useAppointmentStore((s) => s.appointments);
  const updateAppointment = useAppointmentStore((s) => s.updateAppointment);
  const processedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const due = reservationsNeedingReminder(appointments);
    for (const apt of due) {
      if (processedRef.current.has(apt.id)) continue;
      processedRef.current.add(apt.id);
      notifyReservationReminderWhatsApp(apt);
      void updateAppointment(apt.id, {
        reminderSent: true,
        reminderSentAt: new Date().toISOString(),
      });
    }
  }, [appointments, updateAppointment]);
}
