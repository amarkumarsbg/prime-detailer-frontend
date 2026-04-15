"use client";

import { create } from "zustand";
import type { Vehicle } from "@/types";
import { postVehicleSnapshot } from "@/lib/collection-sync";

let vehicleSyncTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleVehicleSync(vehicles: Vehicle[]): void {
  if (vehicleSyncTimer) clearTimeout(vehicleSyncTimer);
  vehicleSyncTimer = setTimeout(() => {
    vehicleSyncTimer = null;
    void postVehicleSnapshot(vehicles).catch(() => {});
  }, 450);
}

interface VehicleStore {
  vehicles: Vehicle[];
  setVehicles: (value: Vehicle[] | ((prev: Vehicle[]) => Vehicle[])) => void;
}

export const useVehicleStore = create<VehicleStore>((set) => ({
  vehicles: [],
  setVehicles: (value) =>
    set((state) => {
      const vehicles = typeof value === "function" ? value(state.vehicles) : value;
      scheduleVehicleSync(vehicles);
      return { vehicles };
    }),
}));
