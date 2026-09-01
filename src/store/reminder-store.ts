"use client";

import { create } from "zustand";
import type { Invoice, JobCard, ServiceCatalogItem, ServiceReminder, ReminderStatus } from "@/types";
import { deleteCollectionDocument, postCollectionSnapshot, putCollectionDocument } from "@/lib/collection-sync";
import { normalizeServiceReminder, normalizeServiceReminders } from "@/lib/reminder-schedule";
import { planCategoryRemindersForDeliveredJob } from "@/lib/reminder-upsert";
import { planPaymentReminderForInvoice } from "@/lib/reminder-payment";
import { invoiceOutstanding } from "@/lib/party/ledger-math";
import type { SerializableAppSettings } from "@/store/settings-store";
import { useSettingsStore } from "@/store/settings-store";
import { useJobCardStore } from "@/store/job-card-store";

interface ReminderStore {
  reminders: ServiceReminder[];
  addReminder: (reminder: ServiceReminder) => Promise<void>;
  addReminders: (reminders: ServiceReminder[]) => Promise<void>;
  updateReminder: (id: string, updates: Partial<ServiceReminder>) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;
  /** Category-frequency SERVICE reminders on job DELIVERED (skips high-end / PPF / Ceramic). */
  applyCategoryRemindersOnDeliver: (params: {
    job: JobCard;
    serviceDateIso: string;
    settings: Pick<SerializableAppSettings, "reminderLeadDays" | "reminderCategoryFrequencies">;
    catalog: ServiceCatalogItem[];
    categories: { id: string; name: string; slug: string }[];
  }) => Promise<number>;
  /**
   * Upsert/complete PAYMENT reminders from invoice outstanding.
   * Uses existing invoiceOutstanding — does not change payment math.
   */
  syncPaymentReminderForInvoice: (
    invoice: Invoice,
    options?: { partyId?: string }
  ) => Promise<void>;
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
    const leadDays = useSettingsStore.getState().reminderLeadDays;
    const normalized = normalizeServiceReminder(reminder, leadDays);
    await putCollectionDocument("serviceReminders", normalized.id, normalized);
    set((state) => ({ reminders: [...state.reminders, normalized] }));
  },

  addReminders: async (newReminders) => {
    const leadDays = useSettingsStore.getState().reminderLeadDays;
    const normalized = normalizeServiceReminders(newReminders, leadDays);
    for (const r of normalized) {
      await putCollectionDocument("serviceReminders", r.id, r);
    }
    set((state) => ({ reminders: [...state.reminders, ...normalized] }));
  },

  updateReminder: async (id, updates) => {
    const prev = get().reminders.find((r) => r.id === id);
    if (!prev) return;
    if (updates.status === "COMPLETED" && prev.status === "COMPLETED") return;
    if (updates.status === "DISMISSED" && prev.status === "DISMISSED") return;

    const leadDays = useSettingsStore.getState().reminderLeadDays;
    const next = normalizeServiceReminder({ ...prev, ...updates }, leadDays);
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

  applyCategoryRemindersOnDeliver: async (params) => {
    const planned = planCategoryRemindersForDeliveredJob({
      job: params.job,
      serviceDateIso: params.serviceDateIso,
      settings: params.settings,
      catalog: params.catalog,
      categories: params.categories,
      existingReminders: get().reminders,
    });

    let createdOrUpdated = 0;
    let next = [...get().reminders];

    for (const item of planned) {
      if (item.action === "noop") continue;
      createdOrUpdated += 1;
      if (item.action === "create") {
        next = [...next, item.reminder];
        await putCollectionDocument("serviceReminders", item.reminder.id, item.reminder);
      } else {
        next = next.map((r) => (r.id === item.previousId ? item.reminder : r));
        await putCollectionDocument("serviceReminders", item.reminder.id, item.reminder);
      }
    }

    if (createdOrUpdated > 0) {
      set({ reminders: next });
    }
    return createdOrUpdated;
  },

  syncPaymentReminderForInvoice: async (invoice, options) => {
    const settings = useSettingsStore.getState();
    const job = invoice.jobCardId
      ? useJobCardStore.getState().jobCards.find((j) => j.id === invoice.jobCardId)
      : undefined;
    const planned = planPaymentReminderForInvoice({
      invoice,
      outstanding: invoiceOutstanding(invoice),
      frequency: settings.reminderPaymentFrequency,
      leadDays: settings.reminderLeadDays,
      existing: get().reminders,
      partyId: options?.partyId,
      vehicleId: job?.vehicleId,
      vehicleMakeModel: invoice.vehicleMakeModel ?? job?.vehicleMakeModel,
    });

    if (planned.action === "skip" || planned.action === "noop") return;

    if (planned.action === "complete") {
      let next = [...get().reminders];
      for (const reminder of planned.reminders) {
        next = next.map((r) => (r.id === reminder.id ? reminder : r));
        await putCollectionDocument("serviceReminders", reminder.id, reminder);
      }
      set({ reminders: next });
      return;
    }

    if (planned.action === "create") {
      await putCollectionDocument("serviceReminders", planned.reminder.id, planned.reminder);
      set((state) => ({ reminders: [...state.reminders, planned.reminder] }));
      return;
    }

    // update
    await putCollectionDocument("serviceReminders", planned.reminder.id, planned.reminder);
    set((state) => ({
      reminders: state.reminders.map((r) =>
        r.id === planned.previousId ? planned.reminder : r
      ),
    }));
  },

  generateHighEndReminders: async (params) => {
    const base = new Date(params.serviceDate);
    const newReminders: ServiceReminder[] = params.intervalMonths.map((months, idx) => {
      const dueDate = new Date(base);
      dueDate.setMonth(dueDate.getMonth() + months);
      const dueDateStr = dueDate.toISOString().split("T")[0];
      const yearLabel = months >= 12 ? `${months / 12}yr` : `${months}mo`;
      return normalizeServiceReminder({
        id: `rem-auto-${Date.now()}-${idx}`,
        kind: "SERVICE",
        vehicleId: params.vehicleId,
        vehicleRegNumber: params.vehicleRegNumber,
        vehicleMakeModel: params.vehicleMakeModel,
        customerId: params.customerId,
        customerName: params.customerName,
        customerPhone: params.customerPhone,
        type: "PPF_MAINTENANCE",
        frequency: "CUSTOM",
        dueDate: dueDateStr,
        lastServiceDate: params.serviceDate,
        lastJobCardId: params.jobCardId,
        status: getReminderStatus(dueDateStr),
        isHighEndService: true,
        totalDurationMonths: params.intervalMonths[params.intervalMonths.length - 1],
        intervalMonths: months,
        notes: `${params.serviceName} maintenance — ${yearLabel} follow-up`,
        whatsappSent: false,
      });
    });
    const next = [...get().reminders, ...newReminders];
    await postCollectionSnapshot("serviceReminders", next).catch((err) => {
      if (process.env.NODE_ENV !== "production") {
        console.warn("Failed to persist high end reminders", err);
      }
    });
    set({ reminders: next });
  },
}));
