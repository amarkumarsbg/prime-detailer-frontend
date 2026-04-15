"use client";

import { create } from "zustand";
import type { DashboardStats } from "@/types";

interface DashboardStatsState {
  stats: DashboardStats | null;
  setStats: (stats: DashboardStats | null) => void;
}

export const useDashboardStatsStore = create<DashboardStatsState>((set) => ({
  stats: null,
  setStats: (stats) => set({ stats }),
}));
