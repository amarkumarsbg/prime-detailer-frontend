"use client";

import { create } from "zustand";
import { putSingletonDocument } from "@/lib/collection-sync";

export interface HighEndServiceConfig {
  id: string;
  name: string;
  reminderIntervals: number[];
  totalYears: number;
  estimateAmountInr?: number;
}

export const DEFAULT_HIGH_END_SERVICES: HighEndServiceConfig[] = [
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

export interface HighEndServicesPayload {
  services: HighEndServiceConfig[];
}

export function mergeHighEndServicesPayload(raw: unknown): HighEndServiceConfig[] | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.services)) return null;
  return o.services as HighEndServiceConfig[];
}

interface HighEndServiceStore {
  services: HighEndServiceConfig[];
  hydrateFromBootstrap: (services: HighEndServiceConfig[]) => void;
  addService: (service: Omit<HighEndServiceConfig, "id">) => void;
  removeService: (id: string) => void;
  updateService: (id: string, updates: Partial<HighEndServiceConfig>) => void;
}

let hesTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleHighEndSync(get: () => HighEndServiceStore): void {
  if (hesTimer) clearTimeout(hesTimer);
  hesTimer = setTimeout(() => {
    hesTimer = null;
    const services = get().services;
    void putSingletonDocument("highEndServices", { services }).catch((err) => {
      if (process.env.NODE_ENV !== "production") console.error(err);
    });
  }, 450);
}

export const useHighEndServiceStore = create<HighEndServiceStore>((set, get) => ({
  services: DEFAULT_HIGH_END_SERVICES,

  hydrateFromBootstrap: (services) =>
    set({ services: services.length > 0 ? services : DEFAULT_HIGH_END_SERVICES }),

  addService: (service) => {
    set((state) => ({
      services: [...state.services, { ...service, id: `hes-${Date.now()}` }],
    }));
    scheduleHighEndSync(get);
  },

  removeService: (id) => {
    set((state) => ({
      services: state.services.filter((s) => s.id !== id),
    }));
    scheduleHighEndSync(get);
  },

  updateService: (id, updates) => {
    set((state) => ({
      services: state.services.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    }));
    scheduleHighEndSync(get);
  },
}));
