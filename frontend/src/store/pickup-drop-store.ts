"use client";

import { create } from "zustand";
import type { PickupDropRequest, PickupDropStatus, PickupDropType } from "@/types";
import { postCollectionSnapshot } from "@/lib/collection-sync";

function pushPickupSnapshot(requests: PickupDropRequest[]) {
  void postCollectionSnapshot("pickupDropRequests", requests).catch((err) => {
    if (process.env.NODE_ENV !== "production") console.error(err);
  });
}

function nextId(requests: PickupDropRequest[]): string {
  const nums = requests.map((r) => {
    const m = /^PND-\d{4}-(\d+)$/.exec(r.id);
    return m ? parseInt(m[1], 10) : 0;
  });
  const max = nums.length ? Math.max(...nums) : 0;
  return `PND-2026-${String(max + 1).padStart(4, "0")}`;
}

export type AddPickupDropInput = {
  jobCardId: string;
  jobNumber: string;
  branchId: string;
  customerName: string;
  vehicleMakeModel?: string;
  vehicleRegNumber?: string;
  customerPhone?: string;
  address: string;
  scheduledTime: string;
  type: PickupDropType;
  driverId?: string;
  driverName?: string;
  notes?: string;
};

interface PickupDropStore {
  requests: PickupDropRequest[];
  /** Hydrated by bootstrap — replaces prior browser-local persistence */
  setRequestsFromBootstrap: (requests: PickupDropRequest[]) => void;
  addRequest: (input: AddPickupDropInput) => PickupDropRequest;
  updateStatus: (id: string, status: PickupDropStatus) => void;
}

export const usePickupDropStore = create<PickupDropStore>((set, get) => ({
  requests: [],

  setRequestsFromBootstrap: (requests) => set({ requests }),

  addRequest: (input) => {
    const now = new Date().toISOString();
    const row: PickupDropRequest = {
      id: nextId(get().requests),
      jobCardId: input.jobCardId,
      jobNumber: input.jobNumber,
      branchId: input.branchId,
      customerName: input.customerName,
      vehicleMakeModel: input.vehicleMakeModel?.trim() || undefined,
      vehicleRegNumber: input.vehicleRegNumber?.trim() || undefined,
      customerPhone: input.customerPhone?.trim() || undefined,
      address: input.address,
      scheduledTime: input.scheduledTime,
      type: input.type,
      driverId: input.driverId,
      driverName: input.driverName,
      status: input.driverId ? "DRIVER_ASSIGNED" : "PENDING",
      notes: input.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };
    const requests = [row, ...get().requests];
    set({ requests });
    pushPickupSnapshot(requests);
    return row;
  },

  updateStatus: (id, status) => {
    set((s) => {
      const requests = s.requests.map((r) =>
        r.id === id ? { ...r, status, updatedAt: new Date().toISOString() } : r
      );
      pushPickupSnapshot(requests);
      return { requests };
    });
  },
}));
