"use client";

import { create } from "zustand";
import { putSingletonDocument } from "@/lib/collection-sync";
import {
  DEFAULT_CUSTOMER_REWARD_CONFIG,
  normalizeCustomerRewardConfig,
  type CustomerRewardConfig,
} from "@/lib/customer-reward-config";

export type CustomerRewardSettingsSerializable = CustomerRewardConfig & {
  updatedAt?: string;
};

interface CustomerRewardSettingsStore extends CustomerRewardConfig {
  patchFromBootstrap: (patch: Partial<CustomerRewardConfig>) => void;
  saveConfig: (next: Partial<CustomerRewardConfig>) => void;
  resetToDefaults: () => void;
}

function pushSnapshot(get: () => CustomerRewardSettingsStore): void {
  const s = get();
  const payload: CustomerRewardSettingsSerializable = {
    pointsPer100: s.pointsPer100,
    pointValue: s.pointValue,
    referralBonus: s.referralBonus,
    minRedeem: s.minRedeem,
    ...(s.maxRedeem != null ? { maxRedeem: s.maxRedeem } : {}),
    updatedAt: new Date().toISOString(),
  };
  void putSingletonDocument("customerRewardSettings", payload).catch((err) => {
    if (process.env.NODE_ENV !== "production") console.error(err);
  });
}

export function mergeCustomerRewardSettingsPayload(
  raw: unknown
): Partial<CustomerRewardConfig> {
  if (!raw || typeof raw !== "object") return {};
  return normalizeCustomerRewardConfig(raw as Partial<CustomerRewardConfig>);
}

export const useCustomerRewardSettingsStore = create<CustomerRewardSettingsStore>((set, get) => ({
  ...DEFAULT_CUSTOMER_REWARD_CONFIG,

  patchFromBootstrap: (patch) => {
    set(normalizeCustomerRewardConfig({ ...get(), ...patch }));
  },

  saveConfig: (next) => {
    set(normalizeCustomerRewardConfig({ ...get(), ...next }));
    pushSnapshot(get);
  },

  resetToDefaults: () => {
    set({ ...DEFAULT_CUSTOMER_REWARD_CONFIG });
    pushSnapshot(get);
  },
}));
