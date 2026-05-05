"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ReportScheduleRecord = {
  id: string;
  name: string;
  reportType: string;
  format: string;
  recipients: string;
  frequency: string;
  active: boolean;
  nextDelivery: string;
};

interface Store {
  schedules: ReportScheduleRecord[];
  addSchedule: (input: Omit<ReportScheduleRecord, "id" | "nextDelivery">) => void;
  removeSchedule: (id: string) => void;
}

function defaultNextDelivery(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const useAdvancedReportSchedulesStore = create<Store>()(
  persist(
    (set) => ({
      schedules: [],

      addSchedule: (input) => {
        const row: ReportScheduleRecord = {
          ...input,
          id: `sch-${Date.now()}`,
          nextDelivery: defaultNextDelivery(),
        };
        set((s) => ({ schedules: [row, ...s.schedules] }));
      },

      removeSchedule: (id) =>
        set((s) => ({ schedules: s.schedules.filter((r) => r.id !== id) })),
    }),
    { name: "prime-detailers-advanced-report-schedules", version: 1 }
  )
);
