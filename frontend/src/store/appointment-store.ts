"use client";

import { create } from "zustand";
import type { Appointment } from "@/types";
import { putCollectionDocument } from "@/lib/collection-sync";

interface AppointmentStore {
  appointments: Appointment[];
  addAppointment: (appointment: Appointment) => Promise<void>;
  updateAppointment: (id: string, updates: Partial<Appointment>) => Promise<void>;
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
    const next = { ...prev, ...updates };
    await putCollectionDocument("appointments", id, next);
    set((state) => ({
      appointments: state.appointments.map((a) => (a.id === id ? next : a)),
    }));
  },
}));
