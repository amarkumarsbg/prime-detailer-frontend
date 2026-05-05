"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ReferralRewardMode = "fixed_inr" | "percent_job";

export interface ReferralSettingsState {
  programEnabled: boolean;
  advocateRewardMode: ReferralRewardMode;
  advocateAmount: string;
  newCustomerRewardMode: ReferralRewardMode;
  newCustomerAmount: string;
  minJobAmountInr: string;
}

const DEFAULTS: ReferralSettingsState = {
  programEnabled: true,
  advocateRewardMode: "fixed_inr",
  advocateAmount: "100",
  newCustomerRewardMode: "fixed_inr",
  newCustomerAmount: "100",
  minJobAmountInr: "0",
};

interface ReferralSettingsStore extends ReferralSettingsState {
  setProgramEnabled: (v: boolean) => void;
  setAdvocateRewardMode: (m: ReferralRewardMode) => void;
  setAdvocateAmount: (s: string) => void;
  setNewCustomerRewardMode: (m: ReferralRewardMode) => void;
  setNewCustomerAmount: (s: string) => void;
  setMinJobAmountInr: (s: string) => void;
  resetToDefaults: () => void;
}

export const useReferralSettingsStore = create<ReferralSettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULTS,

      setProgramEnabled: (programEnabled) => set({ programEnabled }),
      setAdvocateRewardMode: (advocateRewardMode) => set({ advocateRewardMode }),
      setAdvocateAmount: (advocateAmount) => set({ advocateAmount }),
      setNewCustomerRewardMode: (newCustomerRewardMode) => set({ newCustomerRewardMode }),
      setNewCustomerAmount: (newCustomerAmount) => set({ newCustomerAmount }),
      setMinJobAmountInr: (minJobAmountInr) => set({ minJobAmountInr }),
      resetToDefaults: () => set({ ...DEFAULTS }),
    }),
    {
      name: "prime-detailers-referral-settings",
      version: 1,
    }
  )
);
