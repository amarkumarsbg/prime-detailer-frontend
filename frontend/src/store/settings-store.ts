"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  businessName: string;
  /** Shown under business name on tax invoices */
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
  /** When false, /reminders blocks sending WhatsApp from the UI. Persisted locally. */
  whatsappReminderEnabled: boolean;
  setBusinessProfile: (
    profile: Partial<
      Pick<
        SettingsState,
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
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
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
      setBusinessProfile: (profile) => set((state) => ({ ...state, ...profile })),
      setReferralRewardAmount: (amount) => set({ referralRewardAmount: amount }),
      setNewCustomerDiscount: (amount) => set({ newCustomerDiscount: amount }),
      setWhatsappReminderEnabled: (whatsappReminderEnabled) => set({ whatsappReminderEnabled }),
    }),
    { name: "prime-detailers-settings" }
  )
);
