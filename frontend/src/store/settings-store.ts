"use client";

import { create } from "zustand";
import { putSingletonDocument } from "@/lib/collection-sync";
import { DEFAULT_BRAND_PRIMARY, normalizeHex } from "@/lib/brand-color";
import {
  DEFAULT_LOGIN_HERO_FEATURES,
  normalizeLoginHeroFeatures,
  type LoginHeroFeature,
} from "@/lib/login-hero-content";
import {
  CATEGORY_REMINDER_TYPES,
  parseReminderFrequency,
  type SchedulableReminderFrequency,
} from "@/lib/reminder-schedule";
import type { ReminderType } from "@/types";

export type ReminderCategoryFrequencies = Partial<
  Record<(typeof CATEGORY_REMINDER_TYPES)[number], SchedulableReminderFrequency>
>;

export const DEFAULT_REMINDER_CATEGORY_FREQUENCIES: ReminderCategoryFrequencies = {
  GENERAL_SERVICE: "MONTHLY",
  OIL_CHANGE: "QUARTERLY",
  BRAKE_INSPECTION: "BIANNUAL",
  TIRE_ROTATION: "QUARTERLY",
  AC_SERVICE: "QUARTERLY",
  BATTERY_CHECK: "BIANNUAL",
  INSURANCE: "YEARLY",
  PUC: "BIANNUAL",
};

export interface SerializableAppSettings {
  gstRegistrationStatus: "REGISTERED" | "NOT_REGISTERED";
  businessName: string;
  businessLogo: string;
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
  /** Days before due date when a reminder becomes DUE / eligible to send. */
  reminderLeadDays: number;
  /** Default cadence for pending-payment reminders. */
  reminderPaymentFrequency: SchedulableReminderFrequency;
  /** Default cadence per service category (high-end stays CUSTOM month lists). */
  reminderCategoryFrequencies: ReminderCategoryFrequencies;
  /** Company-wide accent (#RRGGBB). Drives --primary / sidebar active. */
  brandPrimary: string;
  /** Login page left-panel background image URL (optional). */
  loginBackgroundImage: string;
  /** Login hero copy (empty heading/description → product defaults at display time). */
  loginHeroHeading: string;
  loginHeroDescription: string;
  /**
   * Feature highlights on the login hero.
   * Empty array hides the block; bootstrap omit uses {@link DEFAULT_LOGIN_HERO_FEATURES}.
   */
  loginHeroFeatures: LoginHeroFeature[];
}

export const DEFAULT_SERIALIZABLE_APP_SETTINGS: SerializableAppSettings = {
  gstRegistrationStatus: "REGISTERED",
  businessName: "Prime Detailers",
  businessLogo: "",
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
  reminderLeadDays: 7,
  reminderPaymentFrequency: "MONTHLY",
  reminderCategoryFrequencies: { ...DEFAULT_REMINDER_CATEGORY_FREQUENCIES },
  brandPrimary: DEFAULT_BRAND_PRIMARY,
  loginBackgroundImage: "",
  loginHeroHeading: "",
  loginHeroDescription: "",
  loginHeroFeatures: [...DEFAULT_LOGIN_HERO_FEATURES],
};

function normalizeCategoryFrequencies(raw: unknown): ReminderCategoryFrequencies {
  const base: ReminderCategoryFrequencies = { ...DEFAULT_REMINDER_CATEGORY_FREQUENCIES };
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  for (const type of CATEGORY_REMINDER_TYPES) {
    const v = o[type];
    if (typeof v === "string") {
      base[type] = parseReminderFrequency(v, base[type] ?? "MONTHLY");
    }
  }
  return base;
}

function sliceSerializable(s: SerializableAppSettings): SerializableAppSettings {
  return {
    gstRegistrationStatus: s.gstRegistrationStatus,
    businessName: s.businessName,
    businessLogo: s.businessLogo,
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
    reminderLeadDays: s.reminderLeadDays,
    reminderPaymentFrequency: s.reminderPaymentFrequency,
    reminderCategoryFrequencies: { ...s.reminderCategoryFrequencies },
    brandPrimary: s.brandPrimary,
    loginBackgroundImage: s.loginBackgroundImage,
    loginHeroHeading: s.loginHeroHeading,
    loginHeroDescription: s.loginHeroDescription,
    loginHeroFeatures: s.loginHeroFeatures.slice(0, 3),
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
    "businessLogo",
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
    "bankUpi",
    "loginHeroHeading",
    "loginHeroDescription"
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
  const lead = num("reminderLeadDays");
  if (lead !== undefined) next.reminderLeadDays = Math.max(0, Math.floor(lead));
  if (typeof o.reminderPaymentFrequency === "string") {
    next.reminderPaymentFrequency = parseReminderFrequency(o.reminderPaymentFrequency, "MONTHLY");
  }
  if ("reminderCategoryFrequencies" in o) {
    next.reminderCategoryFrequencies = normalizeCategoryFrequencies(o.reminderCategoryFrequencies);
  }
  const brandRaw = str("brandPrimary");
  if (brandRaw !== undefined) {
    next.brandPrimary = normalizeHex(brandRaw) ?? DEFAULT_BRAND_PRIMARY;
  }
  const loginBg = str("loginBackgroundImage");
  if (loginBg !== undefined) next.loginBackgroundImage = loginBg;
  if ("loginHeroFeatures" in o) {
    if (o.loginHeroFeatures === null || o.loginHeroFeatures === undefined) {
      /* leave unset so store defaults apply */
    } else {
      next.loginHeroFeatures = normalizeLoginHeroFeatures(o.loginHeroFeatures);
    }
  }
  return next;
}

interface SettingsState extends SerializableAppSettings {
  setBusinessProfile: (
    profile: Partial<
      Pick<
        SerializableAppSettings,
        | "gstRegistrationStatus"
        | "businessName"
        | "businessLogo"
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
        | "loginBackgroundImage"
        | "loginHeroHeading"
        | "loginHeroDescription"
        | "loginHeroFeatures"
      >
    >
  ) => void;
  setReferralRewardAmount: (amount: number) => void;
  setNewCustomerDiscount: (amount: number) => void;
  setWhatsappReminderEnabled: (enabled: boolean) => void;
  setReminderLeadDays: (days: number) => void;
  setReminderPaymentFrequency: (frequency: SchedulableReminderFrequency) => void;
  setReminderCategoryFrequency: (
    type: (typeof CATEGORY_REMINDER_TYPES)[number],
    frequency: SchedulableReminderFrequency
  ) => void;
  setReminderCategoryFrequencies: (map: ReminderCategoryFrequencies) => void;
  setBrandPrimary: (hex: string) => boolean;
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

  setReminderLeadDays: (days) => {
    set({ reminderLeadDays: Math.max(0, Math.floor(days)) });
    scheduleAppSettingsSync(get);
  },

  setReminderPaymentFrequency: (reminderPaymentFrequency) => {
    set({ reminderPaymentFrequency });
    scheduleAppSettingsSync(get);
  },

  setReminderCategoryFrequency: (type, frequency) => {
    set((state) => ({
      reminderCategoryFrequencies: {
        ...state.reminderCategoryFrequencies,
        [type]: frequency,
      },
    }));
    scheduleAppSettingsSync(get);
  },

  setReminderCategoryFrequencies: (reminderCategoryFrequencies) => {
    set({
      reminderCategoryFrequencies: normalizeCategoryFrequencies(reminderCategoryFrequencies),
    });
    scheduleAppSettingsSync(get);
  },

  setBrandPrimary: (hex) => {
    const normalized = normalizeHex(hex);
    if (!normalized) return false;
    set({ brandPrimary: normalized });
    scheduleAppSettingsSync(get);
    return true;
  },
}));

/** Resolve frequency for a service category from settings (with defaults). */
export function getCategoryReminderFrequency(
  settings: Pick<SerializableAppSettings, "reminderCategoryFrequencies">,
  type: ReminderType
): SchedulableReminderFrequency {
  if (!(CATEGORY_REMINDER_TYPES as readonly string[]).includes(type)) {
    return "MONTHLY";
  }
  return (
    settings.reminderCategoryFrequencies[type as (typeof CATEGORY_REMINDER_TYPES)[number]] ??
    DEFAULT_REMINDER_CATEGORY_FREQUENCIES[type as (typeof CATEGORY_REMINDER_TYPES)[number]] ??
    "MONTHLY"
  );
}
