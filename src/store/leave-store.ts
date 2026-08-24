"use client";

import { create } from "zustand";
import { putCollectionDocument, putSingletonDocument } from "@/lib/collection-sync";
import {
  adjustBalance,
  availableLeaveDays,
  countLeaveDays,
  defaultLeaveTypes,
  ensureBalanceRow,
  findBalance,
  hasOverlappingLeave,
  yearFromDate,
} from "@/lib/leave/calculations";
import type {
  LeaveBalance,
  LeaveConfig,
  LeaveRequest,
  LeaveType,
  User,
} from "@/types";

export type LeaveMutationResult =
  | { ok: true; request?: LeaveRequest }
  | { ok: false; error: string };

function persistConfig(leaveTypes: LeaveType[], balances: LeaveBalance[]): void {
  const payload: LeaveConfig = { leaveTypes, balances };
  void putSingletonDocument("leaveConfig", payload).catch((err) => {
    if (process.env.NODE_ENV !== "production") console.error(err);
  });
}

function persistRequest(request: LeaveRequest): void {
  void putCollectionDocument("leaveRequests", request.id, request).catch((err) => {
    if (process.env.NODE_ENV !== "production") console.error(err);
  });
}

interface LeaveStoreState {
  leaveTypes: LeaveType[];
  balances: LeaveBalance[];
  requests: LeaveRequest[];
  applyLeave: (input: {
    staff: User;
    leaveTypeId: string;
    fromDate: string;
    toDate: string;
    reason: string;
  }) => LeaveMutationResult;
  approveLeave: (input: {
    requestId: string;
    actorId: string;
    actorName: string;
    comments?: string;
  }) => LeaveMutationResult;
  rejectLeave: (input: {
    requestId: string;
    actorId: string;
    actorName: string;
    comments?: string;
  }) => LeaveMutationResult;
  cancelLeave: (input: {
    requestId: string;
    actorId: string;
    actorName: string;
    comments?: string;
  }) => LeaveMutationResult;
  upsertLeaveType: (
    input: Omit<LeaveType, "id"> & { id?: string }
  ) => LeaveMutationResult;
  setLeaveTypeActive: (id: string, isActive: boolean) => void;
  setEntitledDays: (
    staffId: string,
    leaveTypeId: string,
    year: number,
    entitled: number,
    branchId: string
  ) => LeaveMutationResult;
}

export const useLeaveStore = create<LeaveStoreState>((set, get) => ({
  leaveTypes: [],
  balances: [],
  requests: [],

  setEntitledDays: (staffId, leaveTypeId, year, entitled, branchId) => {
    const leaveType = get().leaveTypes.find((t) => t.id === leaveTypeId);
    if (!leaveType) return { ok: false, error: "Leave type not found." };
    const ensured = ensureBalanceRow({
      balances: get().balances,
      staffId,
      leaveTypeId,
      branchId,
      year,
      entitled: leaveType.defaultDaysPerYear,
    });
    const balances = adjustBalance(ensured.balances, ensured.balance.id, {
      entitled: Math.max(0, entitled),
    });
    set({ balances });
    persistConfig(get().leaveTypes, balances);
    return { ok: true };
  },

  upsertLeaveType: (input) => {
    const name = input.name.trim();
    if (!name) return { ok: false, error: "Leave type name is required." };
    const types = get().leaveTypes;
    if (input.id) {
      const leaveTypes = types.map((t) =>
        t.id === input.id
          ? {
              ...t,
              name,
              paid: input.paid,
              tracksBalance: input.tracksBalance,
              defaultDaysPerYear: Math.max(0, input.defaultDaysPerYear),
              isActive: input.isActive,
            }
          : t
      );
      set({ leaveTypes });
      persistConfig(leaveTypes, get().balances);
      return { ok: true };
    }
    const row: LeaveType = {
      id: `lt-${Date.now()}-${types.length}`,
      name,
      paid: input.paid,
      tracksBalance: input.tracksBalance,
      defaultDaysPerYear: Math.max(0, input.defaultDaysPerYear),
      isActive: input.isActive,
    };
    const leaveTypes = [...types, row];
    set({ leaveTypes });
    persistConfig(leaveTypes, get().balances);
    return { ok: true };
  },

  setLeaveTypeActive: (id, isActive) => {
    const leaveTypes = get().leaveTypes.map((t) =>
      t.id === id ? { ...t, isActive } : t
    );
    set({ leaveTypes });
    persistConfig(leaveTypes, get().balances);
  },

  applyLeave: (input) => {
    const { staff, leaveTypeId, fromDate, toDate, reason } = input;
    if (!staff.isActive) {
      return { ok: false, error: "Inactive staff cannot apply for leave." };
    }
    const leaveType = get().leaveTypes.find(
      (t) => t.id === leaveTypeId && t.isActive
    );
    if (!leaveType) return { ok: false, error: "Select an active leave type." };
    const days = countLeaveDays(fromDate, toDate);
    if (days <= 0) return { ok: false, error: "Invalid date range." };
    if (!reason.trim()) return { ok: false, error: "Reason is required." };

    if (hasOverlappingLeave(get().requests, staff.id, fromDate, toDate)) {
      return {
        ok: false,
        error: "Overlapping leave request already exists for this staff member.",
      };
    }

    const year = yearFromDate(fromDate);
    let balances = get().balances;

    if (leaveType.tracksBalance) {
      const ensured = ensureBalanceRow({
        balances,
        staffId: staff.id,
        leaveTypeId,
        branchId: staff.branchId,
        year,
        entitled: leaveType.defaultDaysPerYear,
      });
      balances = ensured.balances;
      const available = availableLeaveDays(ensured.balance);
      if (days > available) {
        return {
          ok: false,
          error: `Insufficient leave balance (${available} day(s) available).`,
        };
      }
      balances = adjustBalance(balances, ensured.balance.id, {
        pending: ensured.balance.pending + days,
      });
    }

    const request: LeaveRequest = {
      id: `lr-${Date.now()}-${get().requests.length}`,
      staffId: staff.id,
      staffName: staff.name,
      leaveTypeId: leaveType.id,
      leaveTypeName: leaveType.name,
      branchId: staff.branchId,
      fromDate,
      toDate,
      days,
      reason: reason.trim(),
      status: "PENDING",
      appliedAt: new Date().toISOString(),
    };

    set({ requests: [request, ...get().requests], balances });
    persistRequest(request);
    persistConfig(get().leaveTypes, balances);
    return { ok: true, request };
  },

  approveLeave: ({ requestId, actorId, actorName, comments }) => {
    const request = get().requests.find((r) => r.id === requestId);
    if (!request) return { ok: false, error: "Leave request not found." };
    if (request.status !== "PENDING") {
      return { ok: false, error: "Only pending requests can be approved." };
    }

    const leaveType = get().leaveTypes.find((t) => t.id === request.leaveTypeId);
    let balances = get().balances;

    if (leaveType?.tracksBalance) {
      const year = yearFromDate(request.fromDate);
      const ensured = ensureBalanceRow({
        balances,
        staffId: request.staffId,
        leaveTypeId: request.leaveTypeId,
        branchId: request.branchId,
        year,
        entitled: leaveType.defaultDaysPerYear,
      });
      balances = ensured.balances;
      balances = adjustBalance(balances, ensured.balance.id, {
        pending: Math.max(0, ensured.balance.pending - request.days),
        used: ensured.balance.used + request.days,
      });
    }

    const updated: LeaveRequest = {
      ...request,
      status: "APPROVED",
      decidedById: actorId,
      decidedByName: actorName,
      decidedAt: new Date().toISOString(),
      comments: comments?.trim() || request.comments,
    };
    set({
      requests: get().requests.map((r) => (r.id === requestId ? updated : r)),
      balances,
    });
    persistRequest(updated);
    persistConfig(get().leaveTypes, balances);
    return { ok: true, request: updated };
  },

  rejectLeave: ({ requestId, actorId, actorName, comments }) => {
    const request = get().requests.find((r) => r.id === requestId);
    if (!request) return { ok: false, error: "Leave request not found." };
    if (request.status !== "PENDING") {
      return { ok: false, error: "Only pending requests can be rejected." };
    }

    const leaveType = get().leaveTypes.find((t) => t.id === request.leaveTypeId);
    let balances = get().balances;

    if (leaveType?.tracksBalance) {
      const year = yearFromDate(request.fromDate);
      const row = findBalance(
        balances,
        request.staffId,
        request.leaveTypeId,
        year
      );
      if (row) {
        balances = adjustBalance(balances, row.id, {
          pending: Math.max(0, row.pending - request.days),
        });
      }
    }

    const updated: LeaveRequest = {
      ...request,
      status: "REJECTED",
      decidedById: actorId,
      decidedByName: actorName,
      decidedAt: new Date().toISOString(),
      comments: comments?.trim() || undefined,
    };
    set({
      requests: get().requests.map((r) => (r.id === requestId ? updated : r)),
      balances,
    });
    persistRequest(updated);
    persistConfig(get().leaveTypes, balances);
    return { ok: true, request: updated };
  },

  cancelLeave: ({ requestId, actorId, actorName, comments }) => {
    const request = get().requests.find((r) => r.id === requestId);
    if (!request) return { ok: false, error: "Leave request not found." };
    if (request.status !== "PENDING" && request.status !== "APPROVED") {
      return {
        ok: false,
        error: "Only pending or approved leave can be cancelled.",
      };
    }

    const leaveType = get().leaveTypes.find((t) => t.id === request.leaveTypeId);
    let balances = get().balances;

    if (leaveType?.tracksBalance) {
      const year = yearFromDate(request.fromDate);
      const row = findBalance(
        balances,
        request.staffId,
        request.leaveTypeId,
        year
      );
      if (row) {
        if (request.status === "PENDING") {
          balances = adjustBalance(balances, row.id, {
            pending: Math.max(0, row.pending - request.days),
          });
        } else {
          balances = adjustBalance(balances, row.id, {
            used: Math.max(0, row.used - request.days),
          });
        }
      }
    }

    const updated: LeaveRequest = {
      ...request,
      status: "CANCELLED",
      decidedById: actorId,
      decidedByName: actorName,
      decidedAt: new Date().toISOString(),
      comments: comments?.trim() || request.comments,
    };
    set({
      requests: get().requests.map((r) => (r.id === requestId ? updated : r)),
      balances,
    });
    persistRequest(updated);
    persistConfig(get().leaveTypes, balances);
    return { ok: true, request: updated };
  },
}));

/** Hydrate from domain loader; seed default types when empty. */
export function hydrateLeaveStore(opts: {
  leaveTypes?: LeaveType[];
  balances?: LeaveBalance[];
  requests?: LeaveRequest[];
}): void {
  const leaveTypes =
    Array.isArray(opts.leaveTypes) && opts.leaveTypes.length > 0
      ? opts.leaveTypes
      : defaultLeaveTypes();
  const balances = Array.isArray(opts.balances) ? opts.balances : [];
  const requests = Array.isArray(opts.requests) ? opts.requests : [];
  useLeaveStore.setState({ leaveTypes, balances, requests });
  if (!opts.leaveTypes || opts.leaveTypes.length === 0) {
    persistConfig(leaveTypes, balances);
  }
}
