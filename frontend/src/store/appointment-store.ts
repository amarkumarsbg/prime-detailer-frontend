"use client";

import { create } from "zustand";
import { toast } from "sonner";
import type { Appointment, JobCard } from "@/types";
import { putCollectionDocument } from "@/lib/collection-sync";
import { listStaleAppointmentPatches } from "@/lib/appointment-status";
import { appointmentUpdateAllowed } from "@/lib/appointment-edit-policy";

interface AppointmentStore {
  appointments: Appointment[];
  addAppointment: (appointment: Appointment) => Promise<void>;
  updateAppointment: (id: string, updates: Partial<Appointment>) => Promise<void>;
  /** Persist status fixes for bookings whose slot has passed (missed, completed, cancelled). */
  reconcileStaleAppointments: (jobCards: JobCard[]) => Promise<void>;
}

export const useAppointmentStore = create<AppointmentStore>((set, get) => ({
  appointments: [],

  addAppointment: async (appointment) => {
    await putCollectionDocument("appointments", appointment.id, appointment);
    set((state) => ({
      appointments: [appointment, ...state.appointments],
    }));
  },

  updateAppointment: async (id, updates) => {
    const prev = get().appointments.find((a) => a.id === id);
    if (!prev) return;
    if (!appointmentUpdateAllowed(prev, updates)) {
      toast.error("This booking can no longer be edited");
      return;
    }
    const next = { ...prev, ...updates };
    await putCollectionDocument("appointments", id, next);
    set((state) => ({
      appointments: state.appointments.map((a) => (a.id === id ? next : a)),
    }));
  },

  reconcileStaleAppointments: async (jobCards) => {
    const patches = listStaleAppointmentPatches(get().appointments, jobCards);
    if (patches.length === 0) return;
    await Promise.all(
      patches.map(({ id, status }) => get().updateAppointment(id, { status }))
    );
  },
}));
