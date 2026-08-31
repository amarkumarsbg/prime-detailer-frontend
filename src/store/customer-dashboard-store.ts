"use client";

import { create } from "zustand";
import type { Customer, JobCard, Invoice, Vehicle, CustomerMembership, WalletTransaction } from "@/types";
import type { ServiceItem } from "@/types/job-card";
import { buildApiUrl } from "@/lib/api-base";
import { useCustomerAuthStore } from "@/store/customer-auth-store";

// Helper function to calculate total paid from payments array
function getTotalPaid(invoice: Invoice): number {
  return (invoice.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
}

export interface RewardConfig {
  pointsPer100: number;
  pointValue: number;
  referralBonus: number;
  minRedeem: number;
}

const DEFAULT_REWARD_CONFIG: RewardConfig = {
  pointsPer100: 1,
  pointValue: 0.25,
  referralBonus: 100,
  minRedeem: 200,
};

interface CustomerDashboardData {
  customer: Customer | null;
  jobCards: JobCard[];
  invoices: Invoice[];
  vehicles: Vehicle[];
  memberships: CustomerMembership[];
  walletTransactions: WalletTransaction[];
  serviceHistory: Array<{
    id: string;
    jobCardNumber: string;
    date: string;
    vehicle: string;
    services: string[];
    amount: number;
    status: string;
  }>;
  rewardConfig: RewardConfig;
  isLoading: boolean;
  error: string | null;
}

interface CustomerDashboardStore extends CustomerDashboardData {
  /** Fetch all customer dashboard data */
  bootstrap: () => Promise<void>;

  /** Refetch data */
  refresh: () => Promise<void>;

  /** Get current job card (most recent active) */
  getCurrentJobCard: () => JobCard | null;

  /** Get recent invoice (most recent) */
  getRecentInvoice: () => Invoice | null;

  /** Get customer's total outstanding amount */
  getTotalOutstanding: () => number;

  /** Get customer's primary vehicle */
  getPrimaryVehicle: () => Vehicle | null;

  /** Get active memberships */
  getActiveMemberships: () => CustomerMembership[];

  /** Clear all data */
  clear: () => void;
}

export const useCustomerDashboardStore = create<CustomerDashboardStore>((set, get) => ({
  customer: null,
  jobCards: [],
  invoices: [],
  vehicles: [],
  memberships: [],
  walletTransactions: [],
  serviceHistory: [],
  rewardConfig: DEFAULT_REWARD_CONFIG,
  isLoading: false,
  error: null,

  bootstrap: async () => {
    set({ isLoading: true, error: null });
    try {
      // Use the customer JWT token, NOT the staff apiGet (which uses the staff token)
      const token = useCustomerAuthStore.getState().accessToken;
      const res = await fetch(buildApiUrl("/api/customer/bootstrap"), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: "no-store",
      });
      const body = await res.json() as {
        data?: {
          customer: Customer;
          jobCards: JobCard[];
          invoices: Invoice[];
          vehicles: Vehicle[];
          memberships: CustomerMembership[];
          walletTransactions: WalletTransaction[];
          serviceHistory: Array<{
            id: string;
            jobCardNumber: string;
            date: string;
            vehicle: string;
            services: string[];
            amount: number;
            status: string;
          }>;
          rewardConfig?: RewardConfig;
        } | null;
        error?: { message?: string } | null;
      };

      if (!res.ok || body.error || !body.data) {
        const errorMessage = body.error?.message ?? "Failed to load customer data";
        set({ error: errorMessage, isLoading: false });
        return;
      }

      const data = body.data;

      set({
        customer: data.customer,
        jobCards: data.jobCards || [],
        invoices: data.invoices || [],
        vehicles: data.vehicles || [],
        memberships: data.memberships || [],
        walletTransactions: data.walletTransactions || [],
        serviceHistory: data.serviceHistory || [],
        rewardConfig: data.rewardConfig ?? DEFAULT_REWARD_CONFIG,
        isLoading: false,
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Failed to load customer data";
      set({
        error: errorMessage,
        isLoading: false,
      });
    }
  },

  refresh: async () => {
    await get().bootstrap();
  },

  getCurrentJobCard: () => {
    const jobs = get().jobCards;
    if (jobs.length === 0) return null;

    const statusPriority: Record<string, number> = {
      RECEIVED: 0,
      INSPECTION: 1,
      AWAITING_SERVICE: 2,
      QUALITY_CHECK: 3,
      READY: 4,
      INVOICED: 5,
      DELIVERED: 6,
      CANCELLED: 7,
    };

    const active = jobs.filter((j) => !["DELIVERED", "CANCELLED"].includes(j.status));
    const pool = active.length > 0 ? active : jobs;

    const toMs = (iso?: string) => {
      if (!iso) return 0;
      const ms = new Date(iso).getTime();
      return Number.isFinite(ms) ? ms : 0;
    };

    return [...pool].sort((a, b) => {
      const timeDiff = toMs(b.updatedAt) - toMs(a.updatedAt);
      if (timeDiff !== 0) return timeDiff;

      const createdDiff = toMs(b.createdAt) - toMs(a.createdAt);
      if (createdDiff !== 0) return createdDiff;

      return (statusPriority[a.status] ?? 999) - (statusPriority[b.status] ?? 999);
    })[0] ?? null;
  },

  getRecentInvoice: () => {
    const invoices = get().invoices;
    if (invoices.length === 0) return null;

    return [...invoices].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
  },

  getTotalOutstanding: () => {
    const invoices = get().invoices;
    return invoices.reduce((sum, inv) => {
      const outstanding = (inv.grandTotal ?? 0) - getTotalPaid(inv);
      return sum + Math.max(0, outstanding);
    }, 0);
  },

  getPrimaryVehicle: () => {
    const vehicles = get().vehicles;
    if (vehicles.length === 0) return null;

    // Return most recently used vehicle (from service history)
    return vehicles[0];
  },

  getActiveMemberships: () => {
    const memberships = get().memberships;
    const now = new Date().toISOString();

    return memberships.filter((m) => {
      const endDate = m.endDate;
      return !endDate || new Date(endDate).getTime() > new Date(now).getTime();
    });
  },

  clear: () => {
    set({
      customer: null,
      jobCards: [],
      invoices: [],
      vehicles: [],
      memberships: [],
      walletTransactions: [],
      serviceHistory: [],
      rewardConfig: DEFAULT_REWARD_CONFIG,
      error: null,
    });
  },

}));

