"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface HighEndServiceConfig {
  id: string;
  name: string;
  reminderIntervals: number[];
  totalYears: number;
  /** Flat amount (excl. GST) added to the job estimate when this program is selected on the job card. */
  estimateAmountInr?: number;
}

const DEFAULT_HIGH_END_SERVICES: HighEndServiceConfig[] = [
  {
    id: "hes-001",
    name: "PPF Coating",
    reminderIntervals: [6, 12, 18, 24, 30, 36, 42, 48, 54, 60],
    totalYears: 5,
    estimateAmountInr: 45_000,
  },
  {
    id: "hes-002",
    name: "Ceramic Coating",
    reminderIntervals: [6, 12, 18, 24, 30, 36, 42, 48, 54, 60],
    totalYears: 5,
    estimateAmountInr: 35_000,
  },
  {
    id: "hes-003",
    name: "Graphene Coating",
    reminderIntervals: [6, 12, 24, 36, 48, 60],
    totalYears: 5,
    estimateAmountInr: 40_000,
  },
  {
    id: "hes-004",
    name: "Interior Detailing",
    reminderIntervals: [12, 24, 36, 48, 60],
    totalYears: 5,
    estimateAmountInr: 8_000,
  },
  {
    id: "hes-005",
    name: "Paint Correction",
    reminderIntervals: [12, 24, 36],
    totalYears: 3,
    estimateAmountInr: 15_000,
  },
];

interface HighEndServiceStore {
  services: HighEndServiceConfig[];
  addService: (service: Omit<HighEndServiceConfig, "id">) => void;
  removeService: (id: string) => void;
  updateService: (id: string, updates: Partial<HighEndServiceConfig>) => void;
}

export const useHighEndServiceStore = create<HighEndServiceStore>()(
  persist(
    (set) => ({
      services: DEFAULT_HIGH_END_SERVICES,

      addService: (service) =>
        set((state) => ({
          services: [
            ...state.services,
            { ...service, id: `hes-${Date.now()}` },
          ],
        })),

      removeService: (id) =>
        set((state) => ({
          services: state.services.filter((s) => s.id !== id),
        })),

      updateService: (id, updates) =>
        set((state) => ({
          services: state.services.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        })),
    }),
    { name: "prime-detailers-high-end-services" }
  )
);
