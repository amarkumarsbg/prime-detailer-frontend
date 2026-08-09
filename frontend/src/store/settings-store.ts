"use client";

import { create } from "zustand";
import { putSingletonDocument } from "@/lib/collection-sync";

export interface SerializableAppSettings {
  gstRegistrationStatus: "REGISTERED" | "NOT_REGISTERED";
  businessName: string;
  businessTagline: string;
  businessPhone: string;
  businessWhatsApp: string;
  businessEmail: string;
  businessAddress: string;
  businessWebsite: string;
  gstin: string;
  companyPan: string;
  bankName: string;
  bankBranch: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankUpi: string;
  referralRewardAmount: number;
  newCustomerDiscount: number;
  whatsappReminderEnabled: boolean;
}

export const DEFAULT_SERIALIZABLE_APP_SETTINGS: SerializableAppSettings = {
  gstRegistrationStatus: "REGISTERED",
  businessName: "Prime Detailers",
  businessTagline: "Car Wash & Detailing Studio",
  businessPhone: "+91-80-4123-4567",
  businessWhatsApp: "+91-80-4123-4567",
  businessEmail: "hello@primedetailers.in",
  businessAddress: "80 Feet Road, Koramangala 4th Block, Bengaluru 560034",
  businessWebsite: "www.primedetailers.com",
  gstin: "29AABCT1234F1ZP",
  companyPan: "[Your PAN]",
  bankName: "[Your Bank Name]",
  bankBranch: "[Branch Name]",
  bankAccountNumber: "[Account Number]",
  bankIfsc: "[IFSC Code]",
  bankUpi: "[UPI ID or Number]",
  referralRewardAmount: 500,
  newCustomerDiscount: 200,
  whatsappReminderEnabled: true,
};

function sliceSerializable(s: SerializableAppSettings): SerializableAppSettings {
  return {
    gstRegistrationStatus: s.gstRegistrationStatus,
    businessName: s.businessName,
    businessTagline: s.businessTagline,
    businessPhone: s.businessPhone,
    businessWhatsApp: s.businessWhatsApp,
    businessEmail: s.businessEmail,
    businessAddress: s.businessAddress,
    businessWebsite: s.businessWebsite,
    gstin: s.gstin,
    companyPan: s.companyPan,
    bankName: s.bankName,
    bankBranch: s.bankBranch,
    bankAccountNumber: s.bankAccountNumber,
    bankIfsc: s.bankIfsc,
    bankUpi: s.bankUpi,
    referralRewardAmount: s.referralRewardAmount,
    newCustomerDiscount: s.newCustomerDiscount,
    whatsappReminderEnabled: s.whatsappReminderEnabled,
  };
}

/** Merge API payload into serializable defaults (ignores unknown keys). */
export function mergeAppSettingsPayload(raw: unknown): Partial<SerializableAppSettings> {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const next: Partial<SerializableAppSettings> = {};
  const str = (k: keyof SerializableAppSettings) =>
    typeof o[k] === "string" ? (o[k] as string) : undefined;
  const num = (k: keyof SerializableAppSettings) =>
    typeof o[k] === "number" && Number.isFinite(o[k] as number)
      ? (o[k] as number)
      : undefined;
  const bool = (k: keyof SerializableAppSettings) =>
    typeof o[k] === "boolean" ? (o[k] as boolean) : undefined;

  const assignStr = (...keys: (keyof SerializableAppSettings)[]) => {
    for (const k of keys) {
      const v = str(k);
      if (v !== undefined) next[k] = v as never;
    }
  };
  assignStr(
    "gstRegistrationStatus",
    "businessName",
    "businessTagline",
    "businessPhone",
    "businessWhatsApp",
    "businessEmail",
    "businessAddress",
    "businessWebsite",
    "gstin",
    "companyPan",
    "bankName",
    "bankBranch",
    "bankAccountNumber",
    "bankIfsc",
    "bankUpi"
  );
  if (o.gstRegistrationStatus === "REGISTERED" || o.gstRegistrationStatus === "NOT_REGISTERED") {
    next.gstRegistrationStatus = o.gstRegistrationStatus;
  }
  const rr = num("referralRewardAmount");
  if (rr !== undefined) next.referralRewardAmount = rr;
  const nd = num("newCustomerDiscount");
  if (nd !== undefined) next.newCustomerDiscount = nd;
  const wa = bool("whatsappReminderEnabled");
  if (wa !== undefined) next.whatsappReminderEnabled = wa;
  return next;
}

interface SettingsState extends SerializableAppSettings {
  setBusinessProfile: (
    profile: Partial<
      Pick<
        SerializableAppSettings,
        | "gstRegistrationStatus"
        | "businessName"
        | "businessTagline"
        | "businessPhone"
        | "businessWhatsApp"
        | "businessEmail"
        | "businessAddress"
        | "businessWebsite"
        | "gstin"
        | "companyPan"
        | "bankName"
        | "bankBranch"
        | "bankAccountNumber"
        | "bankIfsc"
        | "bankUpi"
      >
    >
  ) => void;
  setReferralRewardAmount: (amount: number) => void;
  setNewCustomerDiscount: (amount: number) => void;
  setWhatsappReminderEnabled: (enabled: boolean) => void;
  patchFromBootstrap: (patch: Partial<SerializableAppSettings>) => void;
}

let settingsSyncTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleAppSettingsSync(get: () => SettingsState): void {
  if (settingsSyncTimer) clearTimeout(settingsSyncTimer);
  settingsSyncTimer = setTimeout(() => {
    settingsSyncTimer = null;
    const s = get();
    void putSingletonDocument("appSettings", sliceSerializable(s)).catch((err) => {
      if (process.env.NODE_ENV !== "production") console.error(err);
    });
  }, 450);
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULT_SERIALIZABLE_APP_SETTINGS,

  patchFromBootstrap: (patch) => set((state) => ({ ...state, ...patch })),

  setBusinessProfile: (profile) => {
    set((state) => ({ ...state, ...profile }));
    scheduleAppSettingsSync(get);
  },

  setReferralRewardAmount: (referralRewardAmount) => {
    set({ referralRewardAmount });
    scheduleAppSettingsSync(get);
  },

  setNewCustomerDiscount: (newCustomerDiscount) => {
    set({ newCustomerDiscount });
    scheduleAppSettingsSync(get);
  },

  setWhatsappReminderEnabled: (whatsappReminderEnabled) => {
    set({ whatsappReminderEnabled });
    scheduleAppSettingsSync(get);
  },
}));
