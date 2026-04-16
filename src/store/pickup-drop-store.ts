"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PickupDropRequest, PickupDropStatus, PickupDropType } from "@/types";

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
  addRequest: (input: AddPickupDropInput) => PickupDropRequest;
  updateStatus: (id: string, status: PickupDropStatus) => void;
}

export const usePickupDropStore = create<PickupDropStore>()(
  persist(
    (set, get) => ({
      requests: [],

      addRequest: (input) => {
        const now = new Date().toISOString();
        const row: PickupDropRequest = {
          id: nextId(get().requests),
          jobCardId: input.jobCardId,
          jobNumber: input.jobNumber,
          branchId: input.branchId,
          customerName: input.customerName,
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
        set((s) => ({ requests: [row, ...s.requests] }));
        return row;
      },

      updateStatus: (id, status) => {
        set((s) => ({
          requests: s.requests.map((r) =>
            r.id === id ? { ...r, status, updatedAt: new Date().toISOString() } : r
          ),
        }));
      },
    }),
    {
      name: "prime-detailers-pickup-drop",
      version: 1,
    }
  )
);
