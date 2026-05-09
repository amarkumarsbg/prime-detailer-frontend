"use client";

import { create } from "zustand";
import { putSingletonDocument } from "@/lib/collection-sync";

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

export interface ReportSchedulesPayload {
  schedules: ReportScheduleRecord[];
}

export function mergeReportSchedulesPayload(raw: unknown): ReportScheduleRecord[] {
  if (!raw || typeof raw !== "object") return [];
  const o = raw as Record<string, unknown>;
  return Array.isArray(o.schedules) ? (o.schedules as ReportScheduleRecord[]) : [];
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

function pushSchedulesSnapshot(schedules: ReportScheduleRecord[]): void {
  void putSingletonDocument("reportSchedules", { schedules }).catch((err) => {
    if (process.env.NODE_ENV !== "production") console.error(err);
  });
}

interface AdvancedReportSchedulesStore {
  schedules: ReportScheduleRecord[];
  hydrateFromBootstrap: (schedules: ReportScheduleRecord[]) => void;
  addSchedule: (input: Omit<ReportScheduleRecord, "id" | "nextDelivery">) => void;
  removeSchedule: (id: string) => void;
}

export const useAdvancedReportSchedulesStore = create<AdvancedReportSchedulesStore>((set, get) => ({
  schedules: [],

  hydrateFromBootstrap: (schedules) => set({ schedules }),

  addSchedule: (input) => {
    const row: ReportScheduleRecord = {
      ...input,
      id: `sch-${Date.now()}`,
      nextDelivery: defaultNextDelivery(),
    };
    const schedules = [row, ...get().schedules];
    set({ schedules });
    pushSchedulesSnapshot(schedules);
  },

  removeSchedule: (id) => {
    const schedules = get().schedules.filter((r) => r.id !== id);
    set({ schedules });
    pushSchedulesSnapshot(schedules);
  },
}));
