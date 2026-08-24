"use client";

import { create } from "zustand";
import type { JobCard, PickupDropRequest, PickupDropStatus, PickupDropType } from "@/types";
import { postCollectionSnapshot } from "@/lib/collection-sync";
import { ApiError } from "@/lib/api-client";
import {
  dropDeliveryIsPremature,
  findPickupDropRequest,
  nextPickupDropStatus,
  PICKUP_DROP_STATUS_LABEL,
  statusAfterRewindDrop,
  validatePickupDropAdvance,
} from "@/lib/pickup-drop-flow";

import { ApiError } from "@/lib/api-client";

/** Module-level flag: set true during bootstrap reconcile to suppress snapshot pushes. */
let _bootReconciling = false;
export function setPickupDropBootReconciling(v: boolean) { _bootReconciling = v; }

function pushPickupSnapshot(requests: PickupDropRequest[]) {
  if (_bootReconciling) return;
  if (process.env.NEXT_PUBLIC_BLOCK_PICKUP_DROP_WRITES === "true") return;
  if (usePickupDropStore.getState().writesBlocked) return;
  void postCollectionSnapshot("pickupDropRequests", requests).catch((err) => {
    if (err instanceof ApiError && err.status === 403) {
      usePickupDropStore.getState().setWritesBlocked(true);
      return;
    }
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
  odometerReading?: number;
  customerPhone?: string;
  address: string;
  scheduledTime: string;
  type: PickupDropType;
  driverId?: string;
  driverName?: string;
  notes?: string;
};

export type LinkJobCardExtras = {
  vehicleRegNumber?: string;
  vehicleMakeModel?: string;
  customerName?: string;
  customerPhone?: string;
};

interface PickupDropStore {
  requests: PickupDropRequest[];
  /** False until domain bootstrap has loaded this collection (do not persist before then). */
  hydrated: boolean;
  /** True when server returns 403 write-block — UI becomes read-only, no retries. */
  writesBlocked: boolean;
  setWritesBlocked: (blocked: boolean) => void;
  /** Hydrated by bootstrap — replaces prior browser-local persistence */
  setRequestsFromBootstrap: (requests: PickupDropRequest[]) => void;
  addRequest: (input: AddPickupDropInput) => PickupDropRequest;
  /** Same Partial patch pattern as appointments / job cards / quotations. */
  updateRequest: (id: string, updates: Partial<PickupDropRequest>) => void;
  updateStatus: (id: string, status: PickupDropStatus) => void;
  repairPrematureDropDeliveries: (jobs: JobCard[]) => void;
  assignDriver: (id: string, driverId: string | undefined, driverName: string | undefined) => void;
  advanceStatus: (id: string, job?: JobCard | null) => PickupDropStatus | null;
  /** `pickupRequestIdOrOldJobId` may be a PND id or the temporary `new-…` jobCardId. */
  linkJobCard: (
    pickupRequestIdOrOldJobId: string,
    newJobCardId: string,
    newJobNumber: string,
    extras?: LinkJobCardExtras
  ) => void;
}

export const usePickupDropStore = create<PickupDropStore>((set, get) => ({
  requests: [],
  hydrated: false,
  writesBlocked: false,

  setWritesBlocked: (blocked) => set({ writesBlocked: blocked }),

  setRequestsFromBootstrap: (requests) => set({ requests, hydrated: true }),

  addRequest: (input) => {
    const existing = findPickupDropRequest(input.jobCardId, input.type, get().requests);
    if (existing) return existing;

    const now = new Date().toISOString();
    const row: PickupDropRequest = {
      id: nextId(get().requests),
      jobCardId: input.jobCardId,
      jobNumber: input.jobNumber,
      branchId: input.branchId,
      customerName: input.customerName,
      vehicleMakeModel: input.vehicleMakeModel?.trim() || undefined,
      vehicleRegNumber: input.vehicleRegNumber?.trim() || undefined,
      odometerReading:
        input.odometerReading != null && Number.isFinite(input.odometerReading)
          ? input.odometerReading
          : undefined,
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
    if (get().hydrated) pushPickupSnapshot(requests);
    return row;
  },

  updateRequest: (id, updates) => {
    set((s) => {
      const requests = s.requests.map((r) => {
        if (r.id !== id) return r;
        const next: PickupDropRequest = {
          ...r,
          ...updates,
          id: r.id,
          createdAt: r.createdAt,
          updatedAt: new Date().toISOString(),
        };
        if ("address" in updates && updates.address !== undefined) {
          next.address = updates.address.trim();
        }
        if ("notes" in updates) {
          next.notes = updates.notes?.trim() || undefined;
        }
        if ("customerPhone" in updates) {
          next.customerPhone = updates.customerPhone?.trim() || undefined;
        }
        if ("driverId" in updates) {
          next.driverId = updates.driverId || undefined;
          next.driverName = updates.driverName || undefined;
          if (r.status === "PENDING" && next.driverId && !updates.status) {
            next.status = "DRIVER_ASSIGNED";
          }
        }
        return next;
      });
      pushPickupSnapshot(requests);
      return { requests };
    });
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

  repairPrematureDropDeliveries: (jobs) => {
    if (!get().hydrated) return;
    const jobById = new Map(jobs.map((j) => [j.id, j]));
    set((s) => {
      let changed = false;
      const requests = s.requests.map((r) => {
        if (r.type !== "DROP" || r.status !== "DELIVERED") return r;
        const job = jobById.get(r.jobCardId);
        if (!dropDeliveryIsPremature(r, job, s.requests)) return r;
        changed = true;
        return {
          ...r,
          status: statusAfterRewindDrop(r),
          updatedAt: new Date().toISOString(),
        };
      });
      if (!changed) return s;
      pushPickupSnapshot(requests);
      return { requests };
    });
  },

  assignDriver: (id, driverId, driverName) => {
    set((s) => {
      const requests = s.requests.map((r) => {
        if (r.id !== id) return r;
        const nextStatus =
          r.status === "PENDING" && driverId ? ("DRIVER_ASSIGNED" as const) : r.status;
        return {
          ...r,
          driverId,
          driverName,
          status: nextStatus,
          updatedAt: new Date().toISOString(),
        };
      });
      pushPickupSnapshot(requests);
      return { requests };
    });
  },

  advanceStatus: (id, job) => {
    const current = get().requests.find((r) => r.id === id);
    if (!current) return null;
    const block = validatePickupDropAdvance(current, { job, requests: get().requests });
    if (block) return null;
    const next = nextPickupDropStatus(current.type, current.status);
    if (!next) return null;
    get().updateStatus(id, next);
    return next;
  },

  linkJobCard: (pickupRequestIdOrOldJobId, newJobCardId, newJobNumber, extras) => {
    set((s) => {
      const source = s.requests.find((r) => r.id === pickupRequestIdOrOldJobId);
      const oldJobCardId = source?.jobCardId ?? pickupRequestIdOrOldJobId;
      const now = new Date().toISOString();
      const requests = s.requests.map((r) => {
        const linked =
          r.id === pickupRequestIdOrOldJobId ||
          (oldJobCardId && r.jobCardId === oldJobCardId);
        if (!linked) return r;
        return {
          ...r,
          jobCardId: newJobCardId,
          jobNumber: newJobNumber,
          vehicleRegNumber: extras?.vehicleRegNumber?.trim() || r.vehicleRegNumber,
          vehicleMakeModel: extras?.vehicleMakeModel?.trim() || r.vehicleMakeModel,
          customerName: extras?.customerName?.trim() || r.customerName,
          customerPhone: extras?.customerPhone?.trim() || r.customerPhone,
          updatedAt: now,
        };
      });
      if (s.hydrated) pushPickupSnapshot(requests);
      return { requests };
    });
  },
}));
