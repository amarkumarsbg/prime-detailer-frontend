"use client";

import { create } from "zustand";
import { putSingletonDocument } from "@/lib/collection-sync";
import type { SegmentPricing, VehicleSegment } from "@/types";

export interface HighEndServiceConfig {
  id: string;
  name: string;
  reminderIntervals: number[];
  totalYears: number;
  /** Fallback list price when segment pricing is missing. */
  estimateAmountInr?: number;
  /** List price by vehicle type (excl. GST). */
  segmentPricing?: SegmentPricing;
}

export const HIGH_END_PRICE_SEGMENTS: {
  key: keyof SegmentPricing;
  label: string;
  hint: string;
  icon: string;
}[] = [
  { key: "HATCHBACK", label: "Hatchback", hint: "Small cars", icon: "🚗" },
  { key: "SEDAN", label: "Sedan", hint: "Mid-size", icon: "🚙" },
  { key: "COMPACT_SUV", label: "Compact SUV", hint: "Small SUVs", icon: "🚙" },
  { key: "SUV", label: "SUV", hint: "Large", icon: "🚐" },
  { key: "MUV", label: "MUV", hint: "Multi-utility", icon: "🚐" },
  { key: "LUXURY", label: "Luxury", hint: "Premium cars", icon: "🏎️" },
  { key: "BIKE", label: "Bike", hint: "Two-wheeler", icon: "🏍️" },
];

export function buildHighEndSegmentPricing(input: {
  HATCHBACK: number;
  SEDAN: number;
  SUV: number;
  BIKE: number;
}): SegmentPricing {
  const h = Math.max(0, input.HATCHBACK);
  const s = Math.max(0, input.SEDAN);
  const u = Math.max(0, input.SUV);
  const bike = Math.max(0, input.BIKE);
  return {
    HATCHBACK: h,
    SEDAN: s,
    SUV: u,
    LUXURY: Math.round(Math.max(s * 1.35, u * 1.1)),
    MUV: Math.round((s + u) / 2),
    COMPACT_SUV: Math.round((h + u) / 2),
    BIKE: bike,
  };
}

export function highEndDefaultEstimate(pricing: SegmentPricing): number {
  const vals = [pricing.HATCHBACK, pricing.SEDAN, pricing.SUV, pricing.BIKE].filter((n) => n > 0);
  if (vals.length === 0) return 0;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

export function highEndPriceForSegment(
  svc: HighEndServiceConfig,
  segment?: VehicleSegment | "" | null
): number {
  if (segment && svc.segmentPricing) {
    const p = svc.segmentPricing[segment];
    if (typeof p === "number" && Number.isFinite(p) && p > 0) return p;
  }
  return svc.estimateAmountInr ?? 0;
}

export const DEFAULT_HIGH_END_SERVICES: HighEndServiceConfig[] = [
  {
    id: "hes-001",
    name: "PPF Coating",
    reminderIntervals: [6, 12, 18, 24, 30, 36, 42, 48, 54, 60],
    totalYears: 5,
    estimateAmountInr: 45_000,
    segmentPricing: buildHighEndSegmentPricing({
      HATCHBACK: 40_000,
      SEDAN: 45_000,
      SUV: 50_000,
      BIKE: 15_000,
    }),
  },
  {
    id: "hes-002",
    name: "Ceramic Coating",
    reminderIntervals: [6, 12, 18, 24, 30, 36, 42, 48, 54, 60],
    totalYears: 5,
    estimateAmountInr: 35_000,
    segmentPricing: buildHighEndSegmentPricing({
      HATCHBACK: 30_000,
      SEDAN: 35_000,
      SUV: 40_000,
      BIKE: 10_000,
    }),
  },
  {
    id: "hes-003",
    name: "Graphene Coating",
    reminderIntervals: [6, 12, 24, 36, 48, 60],
    totalYears: 5,
    estimateAmountInr: 40_000,
    segmentPricing: buildHighEndSegmentPricing({
      HATCHBACK: 35_000,
      SEDAN: 40_000,
      SUV: 45_000,
      BIKE: 12_000,
    }),
  },
  {
    id: "hes-004",
    name: "Interior Detailing",
    reminderIntervals: [12, 24, 36, 48, 60],
    totalYears: 5,
    estimateAmountInr: 8_000,
    segmentPricing: buildHighEndSegmentPricing({
      HATCHBACK: 6_000,
      SEDAN: 8_000,
      SUV: 10_000,
      BIKE: 2_000,
    }),
  },
  {
    id: "hes-005",
    name: "Paint Correction",
    reminderIntervals: [12, 24, 36],
    totalYears: 3,
    estimateAmountInr: 15_000,
    segmentPricing: buildHighEndSegmentPricing({
      HATCHBACK: 12_000,
      SEDAN: 15_000,
      SUV: 18_000,
      BIKE: 5_000,
    }),
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
