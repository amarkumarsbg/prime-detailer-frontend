"use client";

import { create } from "zustand";
import type { Customer, JobCard, Invoice, Vehicle, CustomerMembership, WalletTransaction } from "@/types";
import type { ServiceItem } from "@/types/job-card";
import { apiGet } from "@/lib/api-client";

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
      const data = await apiGet<{
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
      }>("/api/customer/bootstrap");

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

    // Sort by created date, most recent first
    const sorted = [...jobs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Return first active/recent job (not completed or delivered)
    const active = sorted.find(
      (j) => !["DELIVERED", "CANCELLED"].includes(j.status)
    );
    return active || sorted[0];
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

