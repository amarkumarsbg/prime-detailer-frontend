"use client";

import { create } from "zustand";
import { putSingletonDocument } from "@/lib/collection-sync";
import type { VehicleSegment } from "@/types";

export interface VehicleModel {
  name: string;
  segment: VehicleSegment;
}

export interface VehicleBrand {
  id: string;
  name: string;
  models: VehicleModel[];
}

const H: VehicleSegment = "HATCHBACK";
const S: VehicleSegment = "SEDAN";
const SUV: VehicleSegment = "SUV";
const CS: VehicleSegment = "COMPACT_SUV";
const MUV: VehicleSegment = "MUV";
const L: VehicleSegment = "LUXURY";

/** Exported for bootstrap fallback when API has no catalog yet. */
export const DEFAULT_BRANDS: VehicleBrand[] = [
  { id: "b-maruti", name: "Maruti", models: [
    { name: "Swift", segment: H }, { name: "Baleno", segment: H }, { name: "Alto", segment: H }, { name: "WagonR", segment: H },
    { name: "Dzire", segment: S }, { name: "Brezza", segment: CS }, { name: "Ertiga", segment: MUV }, { name: "XL6", segment: MUV },
    { name: "Grand Vitara", segment: SUV }, { name: "Fronx", segment: CS }, { name: "Jimny", segment: SUV }, { name: "Invicto", segment: MUV },
  ]},
  { id: "b-hyundai", name: "Hyundai", models: [
    { name: "i20", segment: H }, { name: "Creta", segment: CS }, { name: "Venue", segment: CS }, { name: "Verna", segment: S },
    { name: "Grand i10 Nios", segment: H }, { name: "Aura", segment: S }, { name: "Tucson", segment: SUV }, { name: "Alcazar", segment: SUV },
    { name: "Exter", segment: CS }, { name: "Ioniq 5", segment: L },
  ]},
  { id: "b-tata", name: "Tata", models: [
    { name: "Nexon", segment: CS }, { name: "Punch", segment: CS }, { name: "Harrier", segment: SUV }, { name: "Safari", segment: SUV },
    { name: "Tiago", segment: H }, { name: "Altroz", segment: H }, { name: "Tigor", segment: S },
    { name: "Nexon EV", segment: CS }, { name: "Tiago EV", segment: H }, { name: "Curvv", segment: CS },
  ]},
  { id: "b-honda", name: "Honda", models: [
    { name: "City", segment: S }, { name: "Amaze", segment: S }, { name: "Elevate", segment: CS }, { name: "WR-V", segment: CS },
  ]},
  { id: "b-toyota", name: "Toyota", models: [
    { name: "Innova Crysta", segment: MUV }, { name: "Innova Hycross", segment: MUV }, { name: "Fortuner", segment: SUV },
    { name: "Glanza", segment: H }, { name: "Urban Cruiser Hyryder", segment: CS }, { name: "Hilux", segment: SUV },
    { name: "Camry", segment: L }, { name: "Vellfire", segment: L }, { name: "Land Cruiser", segment: L },
  ]},
  { id: "b-mahindra", name: "Mahindra", models: [
    { name: "Thar", segment: SUV }, { name: "XUV700", segment: SUV }, { name: "Scorpio-N", segment: SUV },
    { name: "XUV400", segment: CS }, { name: "XUV300", segment: CS }, { name: "Bolero", segment: SUV },
    { name: "Bolero Neo", segment: CS }, { name: "Scorpio Classic", segment: SUV }, { name: "XUV 3XO", segment: CS },
  ]},
  { id: "b-kia", name: "Kia", models: [
    { name: "Seltos", segment: CS }, { name: "Sonet", segment: CS }, { name: "Carens", segment: MUV },
    { name: "EV6", segment: L }, { name: "EV9", segment: L },
  ]},
  { id: "b-mg", name: "MG", models: [
    { name: "Hector", segment: SUV }, { name: "Hector Plus", segment: SUV }, { name: "Astor", segment: CS },
    { name: "Gloster", segment: SUV }, { name: "ZS EV", segment: CS }, { name: "Comet EV", segment: H },
  ]},
  { id: "b-volkswagen", name: "Volkswagen", models: [
    { name: "Taigun", segment: CS }, { name: "Virtus", segment: S }, { name: "Tiguan", segment: SUV },
  ]},
  { id: "b-skoda", name: "Skoda", models: [
    { name: "Slavia", segment: S }, { name: "Kushaq", segment: CS }, { name: "Kodiaq", segment: SUV }, { name: "Superb", segment: L },
  ]},
  { id: "b-bmw", name: "BMW", models: [
    { name: "3 Series", segment: L }, { name: "5 Series", segment: L }, { name: "7 Series", segment: L },
    { name: "X1", segment: L }, { name: "X3", segment: L }, { name: "X5", segment: L }, { name: "X7", segment: L },
    { name: "iX", segment: L }, { name: "i4", segment: L }, { name: "i7", segment: L }, { name: "2 Series Gran Coupe", segment: L },
  ]},
  { id: "b-mercedes", name: "Mercedes", models: [
    { name: "A-Class", segment: L }, { name: "C-Class", segment: L }, { name: "E-Class", segment: L }, { name: "S-Class", segment: L },
    { name: "GLA", segment: L }, { name: "GLB", segment: L }, { name: "GLC", segment: L }, { name: "GLE", segment: L },
    { name: "GLS", segment: L }, { name: "EQS", segment: L }, { name: "EQB", segment: L }, { name: "AMG GT", segment: L },
  ]},
  { id: "b-audi", name: "Audi", models: [
    { name: "A4", segment: L }, { name: "A6", segment: L }, { name: "A8", segment: L },
    { name: "Q3", segment: L }, { name: "Q5", segment: L }, { name: "Q7", segment: L }, { name: "Q8", segment: L },
    { name: "e-tron", segment: L }, { name: "RS5", segment: L }, { name: "RS Q8", segment: L },
  ]},
  { id: "b-renault", name: "Renault", models: [
    { name: "Kwid", segment: H }, { name: "Triber", segment: MUV }, { name: "Kiger", segment: CS },
  ]},
  { id: "b-nissan", name: "Nissan", models: [
    { name: "Magnite", segment: CS }, { name: "X-Trail", segment: SUV },
  ]},
  { id: "b-jeep", name: "Jeep", models: [
    { name: "Compass", segment: SUV }, { name: "Meridian", segment: SUV },
    { name: "Wrangler", segment: L }, { name: "Grand Cherokee", segment: L },
  ]},
  { id: "b-citroen", name: "Citroen", models: [
    { name: "C3", segment: H }, { name: "C3 Aircross", segment: CS }, { name: "C5 Aircross", segment: SUV }, { name: "eC3", segment: H },
  ]},
];

export function mergeVehicleCatalogPayload(raw: unknown): VehicleBrand[] | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.brands)) return null;
  return o.brands as VehicleBrand[];
}

interface VehicleCatalogStore {
  brands: VehicleBrand[];
  hydrateFromBootstrap: (brands: VehicleBrand[]) => void;
  addBrand: (name: string) => void;
  removeBrand: (id: string) => void;
  addModel: (brandId: string, name: string, segment: VehicleSegment) => void;
  removeModel: (brandId: string, modelName: string) => void;
  getBrandNames: () => string[];
  getModels: (brandName: string) => VehicleModel[];
  getModelSegment: (brandName: string, modelName: string) => VehicleSegment | null;
}

let catalogTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleVehicleCatalogSync(get: () => VehicleCatalogStore): void {
  if (catalogTimer) clearTimeout(catalogTimer);
  catalogTimer = setTimeout(() => {
    catalogTimer = null;
    const brands = get().brands;
    void putSingletonDocument("vehicleCatalog", { brands }).catch((err) => {
      if (process.env.NODE_ENV !== "production") console.error(err);
    });
  }, 450);
}

export const useVehicleCatalogStore = create<VehicleCatalogStore>((set, get) => ({
  brands: DEFAULT_BRANDS,

  hydrateFromBootstrap: (brands) =>
    set({ brands: brands.length > 0 ? brands : DEFAULT_BRANDS }),

  addBrand: (name) => {
    set((state) => ({
      brands: [...state.brands, { id: `b-${Date.now()}`, name: name.trim(), models: [] }],
    }));
    scheduleVehicleCatalogSync(get);
  },

  removeBrand: (id) => {
    set((state) => ({
      brands: state.brands.filter((b) => b.id !== id),
    }));
    scheduleVehicleCatalogSync(get);
  },

  addModel: (brandId, name, segment) => {
    set((state) => ({
      brands: state.brands.map((b) =>
        b.id === brandId && !b.models.some((m) => m.name === name.trim())
          ? { ...b, models: [...b.models, { name: name.trim(), segment }] }
          : b
      ),
    }));
    scheduleVehicleCatalogSync(get);
  },

  removeModel: (brandId, modelName) => {
    set((state) => ({
      brands: state.brands.map((b) =>
        b.id === brandId ? { ...b, models: b.models.filter((m) => m.name !== modelName) } : b
      ),
    }));
    scheduleVehicleCatalogSync(get);
  },

  getBrandNames: () => get().brands.map((b) => b.name).sort(),

  getModels: (brandName) => {
    const brand = get().brands.find((b) => b.name === brandName);
    return brand ? [...brand.models].sort((a, b) => a.name.localeCompare(b.name)) : [];
  },

  getModelSegment: (brandName, modelName) => {
    const brand = get().brands.find((b) => b.name === brandName);
    const model = brand?.models.find((m) => m.name === modelName);
    return model?.segment ?? null;
  },
}));
