"use client";

import { create } from "zustand";
import type { ServiceReminder, ReminderStatus } from "@/types";
import { deleteCollectionDocument, postCollectionSnapshot, putCollectionDocument } from "@/lib/collection-sync";

interface ReminderStore {
  reminders: ServiceReminder[];
  addReminder: (reminder: ServiceReminder) => Promise<void>;
  addReminders: (reminders: ServiceReminder[]) => Promise<void>;
  updateReminder: (id: string, updates: Partial<ServiceReminder>) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;
  generateHighEndReminders: (params: {
    jobCardId: string;
    serviceName: string;
    serviceDate: string;
    customerId: string;
    customerName: string;
    customerPhone: string;
    vehicleId: string;
    vehicleRegNumber: string;
    vehicleMakeModel: string;
    intervalMonths: number[];
  }) => Promise<void>;
}

function getReminderStatus(dueDate: string): ReminderStatus {
  const now = new Date();
  const due = new Date(dueDate);
  const diffDays = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < -7) return "OVERDUE";
  if (diffDays < 0) return "DUE";
  return "UPCOMING";
}

export const useReminderStore = create<ReminderStore>((set, get) => ({
  reminders: [],

  addReminder: async (reminder) => {
    await putCollectionDocument("serviceReminders", reminder.id, reminder);
    set((state) => ({ reminders: [...state.reminders, reminder] }));
  },

  addReminders: async (newReminders) => {
    for (const r of newReminders) {
      await putCollectionDocument("serviceReminders", r.id, r);
    }
    set((state) => ({ reminders: [...state.reminders, ...newReminders] }));
  },

  updateReminder: async (id, updates) => {
    const prev = get().reminders.find((r) => r.id === id);
    if (!prev) return;
    if (updates.status === "COMPLETED" && prev.status === "COMPLETED") return;
    if (updates.status === "DISMISSED" && prev.status === "DISMISSED") return;

    const next = { ...prev, ...updates };
    set((state) => ({
      reminders: state.reminders.map((r) => (r.id === id ? next : r)),
    }));

    try {
      await putCollectionDocument("serviceReminders", id, next);
    } catch {
      set((state) => ({
        reminders: state.reminders.map((r) => (r.id === id ? prev : r)),
      }));
      throw new Error("Failed to sync reminder");
    }
  },

  deleteReminder: async (id) => {
    await deleteCollectionDocument("serviceReminders", id);
    set((state) => ({
      reminders: state.reminders.filter((r) => r.id !== id),
    }));
  },

  generateHighEndReminders: async (params) => {
    const base = new Date(params.serviceDate);
    const newReminders: ServiceReminder[] = params.intervalMonths.map((months, idx) => {
      const dueDate = new Date(base);
      dueDate.setMonth(dueDate.getMonth() + months);
      const dueDateStr = dueDate.toISOString().split("T")[0];
      const yearLabel = months >= 12 ? `${months / 12}yr` : `${months}mo`;
      return {
        id: `rem-auto-${Date.now()}-${idx}`,
        vehicleId: params.vehicleId,
        vehicleRegNumber: params.vehicleRegNumber,
        vehicleMakeModel: params.vehicleMakeModel,
        customerId: params.customerId,
        customerName: params.customerName,
        customerPhone: params.customerPhone,
        type: "PPF_MAINTENANCE" as const,
        frequency: "CUSTOM" as const,
        dueDate: dueDateStr,
        lastServiceDate: params.serviceDate,
        lastJobCardId: params.jobCardId,
        status: getReminderStatus(dueDateStr),
        isHighEndService: true,
        totalDurationMonths: params.intervalMonths[params.intervalMonths.length - 1],
        intervalMonths: months,
        notes: `${params.serviceName} maintenance — ${yearLabel} follow-up`,
        whatsappSent: false,
      };
    });
    const next = [...get().reminders, ...newReminders];
    await postCollectionSnapshot("serviceReminders", next);
    set({ reminders: next });
  },
}));
