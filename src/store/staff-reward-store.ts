"use client";

import { create } from "zustand";
import {
  deleteCollectionDocument,
  putCollectionDocument,
  putSingletonDocument,
} from "@/lib/collection-sync";
import {
  calculateJobReward,
  defaultStaffRewardSettings,
  type JobRewardInput,
  type StaffRewardServiceOverride,
} from "@/lib/staff-rewards/calculate-job-reward";
import type {
  StaffRewardLedgerEntry,
  StaffRewardSettings,
  StaffTarget,
} from "@/types";
import { useStaffStore } from "@/store/staff-store";

function persistSettings(settings: StaffRewardSettings): void {
  void putSingletonDocument("staffRewardSettings", settings).catch((err) => {
    if (process.env.NODE_ENV !== "production") console.error(err);
  });
}

function persistLedgerEntry(entry: StaffRewardLedgerEntry): void {
  void putCollectionDocument("staffRewardLedger", entry.id, entry).catch((err) => {
    if (process.env.NODE_ENV !== "production") console.error(err);
  });
}

function persistTarget(target: StaffTarget): void {
  void putCollectionDocument("staffTargets", target.id, target).catch((err) => {
    if (process.env.NODE_ENV !== "production") console.error(err);
  });
}

function nextLedgerId(existing: StaffRewardLedgerEntry[]): string {
  return `srl-${Date.now()}-${existing.length}`;
}

function nextTargetId(existing: StaffTarget[]): string {
  return `st-${Date.now()}-${existing.length}`;
}

export type StaffRewardMutationResult =
  | { ok: true; entry?: StaffRewardLedgerEntry; target?: StaffTarget }
  | { ok: false; error: string };

interface StaffRewardStoreState {
  settings: StaffRewardSettings;
  ledger: StaffRewardLedgerEntry[];
  targets: StaffTarget[];
  updateSettings: (patch: Partial<StaffRewardSettings>) => void;
  addManualEntry: (input: {
    staffId: string;
    staffName: string;
    branchId: string;
    amount: number;
    kind: "CREDIT" | "DEBIT";
    reason: string;
    periodMonth: number;
    periodYear: number;
    createdById?: string;
    createdByName?: string;
  }) => StaffRewardMutationResult;
  approveEntry: (entryId: string) => StaffRewardMutationResult;
  cancelEntry: (entryId: string) => StaffRewardMutationResult;
  /** Mark ledger rows as paid when their payroll record is marked PAID. */
  markLedgerPaidInPayroll: (entryIds: string[]) => void;
  /** Revert PAID_IN_PAYROLL → APPROVED when payroll leaves PAID. */
  revertLedgerPaidInPayroll: (entryIds: string[]) => void;
  upsertTarget: (
    input: Omit<StaffTarget, "id" | "createdAt" | "updatedAt"> & {
      id?: string;
    }
  ) => StaffRewardMutationResult;
  removeTarget: (targetId: string) => StaffRewardMutationResult;
  recordJobDeliveryRewards: (
    job: JobRewardInput,
    serviceOverride?: StaffRewardServiceOverride
  ) => { added: StaffRewardLedgerEntry[]; skipped: number };
}

export const useStaffRewardStore = create<StaffRewardStoreState>((set, get) => ({
  settings: defaultStaffRewardSettings(),
  ledger: [],
  targets: [],

  updateSettings: (patch) => {
    const settings: StaffRewardSettings = {
      ...get().settings,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    set({ settings });
    persistSettings(settings);
  },

  addManualEntry: (input) => {
    const reason = input.reason.trim();
    if (!reason) return { ok: false, error: "Reason is required." };
    if (!input.staffId.trim()) return { ok: false, error: "Staff is required." };
    if (!Number.isFinite(input.amount) || input.amount === 0) {
      return { ok: false, error: "Amount must be a non-zero number." };
    }

    const rewardType = input.kind === "CREDIT" ? "MANUAL_CREDIT" : "MANUAL_DEBIT";
    const amount =
      input.kind === "CREDIT"
        ? Math.abs(input.amount)
        : -Math.abs(input.amount);
    const createdAt = new Date().toISOString();
    const entry: StaffRewardLedgerEntry = {
      id: nextLedgerId(get().ledger),
      staffId: input.staffId,
      staffName: input.staffName,
      branchId: input.branchId,
      rewardType,
      amount,
      status: "APPROVED",
      periodMonth: input.periodMonth,
      periodYear: input.periodYear,
      reason,
      createdById: input.createdById,
      createdByName: input.createdByName,
      createdAt,
      idempotencyKey: `manual:${input.staffId}:${rewardType}:${createdAt}:${get().ledger.length}`,
    };

    set({ ledger: [entry, ...get().ledger] });
    persistLedgerEntry(entry);
    return { ok: true, entry };
  },

  approveEntry: (entryId) => {
    const entry = get().ledger.find((e) => e.id === entryId);
    if (!entry) return { ok: false, error: "Ledger entry not found." };
    if (entry.status !== "PENDING") {
      return { ok: false, error: "Only pending entries can be approved." };
    }
    const updated: StaffRewardLedgerEntry = { ...entry, status: "APPROVED" };
    set({
      ledger: get().ledger.map((e) => (e.id === entryId ? updated : e)),
    });
    persistLedgerEntry(updated);
    return { ok: true, entry: updated };
  },

  cancelEntry: (entryId) => {
    const entry = get().ledger.find((e) => e.id === entryId);
    if (!entry) return { ok: false, error: "Ledger entry not found." };
    if (entry.status === "CANCELLED") {
      return { ok: false, error: "Entry is already cancelled." };
    }
    if (entry.status === "PAID_IN_PAYROLL") {
      return { ok: false, error: "Cannot cancel an entry already paid in payroll." };
    }
    const updated: StaffRewardLedgerEntry = { ...entry, status: "CANCELLED" };
    set({
      ledger: get().ledger.map((e) => (e.id === entryId ? updated : e)),
    });
    persistLedgerEntry(updated);
    return { ok: true, entry: updated };
  },

  markLedgerPaidInPayroll: (entryIds) => {
    if (!entryIds.length) return;
    const idSet = new Set(entryIds);
    const ledger = get().ledger.map((e) => {
      if (!idSet.has(e.id)) return e;
      if (e.status !== "APPROVED" && e.status !== "PENDING") return e;
      const updated: StaffRewardLedgerEntry = { ...e, status: "PAID_IN_PAYROLL" };
      persistLedgerEntry(updated);
      return updated;
    });
    set({ ledger });
  },

  revertLedgerPaidInPayroll: (entryIds) => {
    if (!entryIds.length) return;
    const idSet = new Set(entryIds);
    const ledger = get().ledger.map((e) => {
      if (!idSet.has(e.id)) return e;
      if (e.status !== "PAID_IN_PAYROLL") return e;
      const updated: StaffRewardLedgerEntry = { ...e, status: "APPROVED" };
      persistLedgerEntry(updated);
      return updated;
    });
    set({ ledger });
  },

  upsertTarget: (input) => {
    if (!input.staffId.trim()) return { ok: false, error: "Staff is required." };
    if (!Number.isFinite(input.targetValue) || input.targetValue < 0) {
      return { ok: false, error: "Target value must be a non-negative number." };
    }
    const now = new Date().toISOString();
    const existing = input.id
      ? get().targets.find((t) => t.id === input.id)
      : undefined;

    if (existing) {
      const target: StaffTarget = {
        ...existing,
        staffId: input.staffId,
        staffName: input.staffName,
        branchId: input.branchId,
        periodMonth: input.periodMonth,
        periodYear: input.periodYear,
        metric: input.metric,
        targetValue: input.targetValue,
        notes: input.notes?.trim() || undefined,
        updatedAt: now,
      };
      set({
        targets: get().targets.map((t) => (t.id === target.id ? target : t)),
      });
      persistTarget(target);
      return { ok: true, target };
    }

    const target: StaffTarget = {
      id: nextTargetId(get().targets),
      staffId: input.staffId,
      staffName: input.staffName,
      branchId: input.branchId,
      periodMonth: input.periodMonth,
      periodYear: input.periodYear,
      metric: input.metric,
      targetValue: input.targetValue,
      notes: input.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };
    set({ targets: [target, ...get().targets] });
    persistTarget(target);
    return { ok: true, target };
  },

  removeTarget: (targetId) => {
    const target = get().targets.find((t) => t.id === targetId);
    if (!target) return { ok: false, error: "Target not found." };
    set({ targets: get().targets.filter((t) => t.id !== targetId) });
    void deleteCollectionDocument("staffTargets", targetId).catch((err) => {
      if (process.env.NODE_ENV !== "production") console.error(err);
    });
    return { ok: true, target };
  },

  recordJobDeliveryRewards: (job, serviceOverride) => {
    const drafts = calculateJobReward({
      job,
      settings: get().settings,
      serviceOverride,
    });
    const existingKeys = new Set(get().ledger.map((e) => e.idempotencyKey));
    const toAdd: StaffRewardLedgerEntry[] = [];
    let skipped = 0;

    const staffStoreStaff = useStaffStore.getState().staff;
    const superAdminIds = new Set(
      staffStoreStaff.filter((s) => s.role === "SUPER_ADMIN").map((s) => s.id)
    );

    for (const draft of drafts) {
      if (superAdminIds.has(draft.staffId)) {
        skipped += 1;
        continue;
      }
      if (existingKeys.has(draft.idempotencyKey)) {
        skipped += 1;
        continue;
      }
      const entry: StaffRewardLedgerEntry = {
        ...draft,
        id: nextLedgerId([...get().ledger, ...toAdd]),
      };
      toAdd.push(entry);
      existingKeys.add(entry.idempotencyKey);
    }

    if (toAdd.length === 0) {
      return { added: [], skipped };
    }

    set({ ledger: [...toAdd, ...get().ledger] });
    for (const entry of toAdd) {
      persistLedgerEntry(entry);
    }
    persistSettings(get().settings);
    return { added: toAdd, skipped };
  },
}));

/** Hydrate from domain loader; seed default settings when empty. */
export function hydrateStaffRewardStore(opts: {
  settings?: StaffRewardSettings | null;
  ledger?: StaffRewardLedgerEntry[];
  targets?: StaffTarget[];
}): void {
  const settings =
    opts.settings && typeof opts.settings === "object"
      ? { ...defaultStaffRewardSettings(), ...opts.settings }
      : defaultStaffRewardSettings();
  const ledger = Array.isArray(opts.ledger) ? opts.ledger : [];
  const targets = Array.isArray(opts.targets) ? opts.targets : [];
  useStaffRewardStore.setState({ settings, ledger, targets });
  if (!opts.settings) {
    persistSettings(settings);
  }
}
