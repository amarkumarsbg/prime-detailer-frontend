"use client";

import { create } from "zustand";

export const DASHBOARD_FILTER = {
  OVERDUE: "overdue",
  LOW_STOCK: "low-stock",
  PENDING_PAYMENT: "pending-payment",
  DUE_SOON: "due-soon",
  INACTIVE: "inactive",
  /** Job cards created today (local calendar date; matches dashboard widget). */
  TODAYS_BOOKINGS: "todays-bookings",
  READY_FOR_DELIVERY: "ready-for-delivery",
} as const;

interface DashboardFilterStore {
  activeFilter: string | null;
  setActiveFilter: (value: string | null) => void;
}

export const useDashboardFilterStore = create<DashboardFilterStore>((set) => ({
  activeFilter: null,
  setActiveFilter: (value) => set({ activeFilter: value }),
}));
