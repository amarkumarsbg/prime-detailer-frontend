"use client";

import { create } from "zustand";
import type { Vehicle } from "@/types";
import { postVehicleSnapshot } from "@/lib/collection-sync";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client";
import type { VehicleImportPayloadItem } from "@/lib/vehicle-import/types";

let vehicleSyncTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleVehicleSync(vehicles: Vehicle[]): void {
  if (vehicleSyncTimer) clearTimeout(vehicleSyncTimer);
  vehicleSyncTimer = setTimeout(() => {
    vehicleSyncTimer = null;
    void postVehicleSnapshot(vehicles).catch(() => {});
  }, 450);
}

export type VehicleBulkImportResult = {
  created: Vehicle[];
  skipped: Array<{
    index: number;
    registrationNumber: string;
    reason: "DUPLICATE" | "INVALID" | "DUPLICATE_IN_BATCH" | "CUSTOMER_NOT_FOUND";
    message: string;
  }>;
  createdCount: number;
  skippedCount: number;
};

interface VehicleStore {
  vehicles: Vehicle[];
  setVehicles: (value: Vehicle[] | ((prev: Vehicle[]) => Vehicle[])) => void;
  /** Refresh from API without triggering snapshot replace. */
  fetchVehicles: () => Promise<void>;
  /** Bulk-create via API; merges created rows into the store (no snapshot). */
  importVehicles: (vehicles: VehicleImportPayloadItem[]) => Promise<VehicleBulkImportResult>;
  addVehicle: (vehicle: Omit<Vehicle, "createdAt">) => Promise<Vehicle | null>;
  updateVehicle: (id: string, updates: Partial<Vehicle>) => Promise<Vehicle | null>;
  deleteVehicle: (id: string) => Promise<boolean>;
}

export const useVehicleStore = create<VehicleStore>((set) => ({
  vehicles: [],
  setVehicles: (value) =>
    set((state) => {
      const vehicles = typeof value === "function" ? value(state.vehicles) : value;
      scheduleVehicleSync(vehicles);
      return { vehicles };
    }),

  fetchVehicles: async () => {
    const data = await apiGet<{ vehicles: Vehicle[] }>("/api/vehicles");
    set({ vehicles: data.vehicles });
  },

  importVehicles: async (vehicles) => {
    const data = await apiPost<VehicleBulkImportResult>("/api/vehicles/bulk", {
      vehicles,
    });
    if (data.created.length > 0) {
      set((state) => ({ vehicles: [...data.created, ...state.vehicles] }));
    }
    return data;
  },

  addVehicle: async (vehicle) => {
    try {
      const data = await apiPost<{ vehicle: Vehicle }>("/api/vehicles", vehicle);
      set((state) => ({
        vehicles: [data.vehicle, ...state.vehicles.filter((v) => v.id !== vehicle.id)],
      }));
      return data.vehicle;
    } catch (e) {
      console.error("Failed to add vehicle via API:", e);
      return null;
    }
  },

  updateVehicle: async (id, updates) => {
    try {
      const data = await apiPut<{ vehicle: Vehicle }>(`/api/vehicles/${id}`, updates);
      set((state) => ({
        vehicles: state.vehicles.map((v) => (v.id === id ? data.vehicle : v)),
      }));
      return data.vehicle;
    } catch (e) {
      console.error("Failed to update vehicle via API:", e);
      return null;
    }
  },

  deleteVehicle: async (id) => {
    try {
      await apiDelete<{ ok: boolean }>(`/api/vehicles/${id}`);
      set((state) => ({
        vehicles: state.vehicles.filter((v) => v.id !== id),
      }));
      return true;
    } catch (e) {
      console.error("Failed to delete vehicle via API:", e);
      return false;
    }
  },
}));
