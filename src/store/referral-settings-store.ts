"use client";

import { create } from "zustand";
import { putSingletonDocument } from "@/lib/collection-sync";

export type ReferralRewardMode = "fixed_inr" | "percent_job";

export interface ReferralProgramSerializable {
  programEnabled: boolean;
  advocateRewardMode: ReferralRewardMode;
  advocateAmount: string;
  newCustomerRewardMode: ReferralRewardMode;
  newCustomerAmount: string;
  minJobAmountInr: string;
}

const DEFAULT_SERIALIZABLE: ReferralProgramSerializable = {
  programEnabled: true,
  advocateRewardMode: "fixed_inr",
  advocateAmount: "100",
  newCustomerRewardMode: "fixed_inr",
  newCustomerAmount: "100",
  minJobAmountInr: "0",
};

interface ReferralSettingsStore extends ReferralProgramSerializable {
  setProgramEnabled: (v: boolean) => void;
  setAdvocateRewardMode: (m: ReferralRewardMode) => void;
  setAdvocateAmount: (s: string) => void;
  setNewCustomerRewardMode: (m: ReferralRewardMode) => void;
  setNewCustomerAmount: (s: string) => void;
  setMinJobAmountInr: (s: string) => void;
  resetToDefaults: () => void;
  patchFromBootstrap: (patch: Partial<ReferralProgramSerializable>) => void;
}

function pushReferralSnapshot(get: () => ReferralSettingsStore): void {
  const s = get();
  const payload: ReferralProgramSerializable = {
    programEnabled: s.programEnabled,
    advocateRewardMode: s.advocateRewardMode,
    advocateAmount: s.advocateAmount,
    newCustomerRewardMode: s.newCustomerRewardMode,
    newCustomerAmount: s.newCustomerAmount,
    minJobAmountInr: s.minJobAmountInr,
  };
  void putSingletonDocument("referralProgram", payload).catch((err) => {
    if (process.env.NODE_ENV !== "production") console.error(err);
  });
}

export function mergeReferralProgramPayload(raw: unknown): Partial<ReferralProgramSerializable> {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const next: Partial<ReferralProgramSerializable> = {};
  if (typeof o.programEnabled === "boolean") next.programEnabled = o.programEnabled;
  if (o.advocateRewardMode === "fixed_inr" || o.advocateRewardMode === "percent_job") {
    next.advocateRewardMode = o.advocateRewardMode;
  }
  if (typeof o.advocateAmount === "string") next.advocateAmount = o.advocateAmount;
  if (o.newCustomerRewardMode === "fixed_inr" || o.newCustomerRewardMode === "percent_job") {
    next.newCustomerRewardMode = o.newCustomerRewardMode;
  }
  if (typeof o.newCustomerAmount === "string") next.newCustomerAmount = o.newCustomerAmount;
  if (typeof o.minJobAmountInr === "string") next.minJobAmountInr = o.minJobAmountInr;
  return next;
}

export const useReferralSettingsStore = create<ReferralSettingsStore>((set, get) => ({
  ...DEFAULT_SERIALIZABLE,

  patchFromBootstrap: (patch) => set((state) => ({ ...state, ...patch })),

  setProgramEnabled: (programEnabled) => {
    set({ programEnabled });
    pushReferralSnapshot(get);
  },

  setAdvocateRewardMode: (advocateRewardMode) => {
    set({ advocateRewardMode });
    pushReferralSnapshot(get);
  },

  setAdvocateAmount: (advocateAmount) => {
    set({ advocateAmount });
    pushReferralSnapshot(get);
  },

  setNewCustomerRewardMode: (newCustomerRewardMode) => {
    set({ newCustomerRewardMode });
    pushReferralSnapshot(get);
  },

  setNewCustomerAmount: (newCustomerAmount) => {
    set({ newCustomerAmount });
    pushReferralSnapshot(get);
  },

  setMinJobAmountInr: (minJobAmountInr) => {
    set({ minJobAmountInr });
    pushReferralSnapshot(get);
  },

  resetToDefaults: () => {
    set({ ...DEFAULT_SERIALIZABLE });
    pushReferralSnapshot(get);
  },
}));
