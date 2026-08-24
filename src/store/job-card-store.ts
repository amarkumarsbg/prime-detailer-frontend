"use client";

import { create } from "zustand";
import { toast } from "sonner";
import type { JobCard, PaginationParams } from "@/types";
import { deleteCollectionDocument, putCollectionDocument } from "@/lib/collection-sync";
import { apiGet, ApiError } from "@/lib/api-client";
import { refreshJobCardFromServer } from "@/lib/job-card-inspection-photo-upload";
import { syncPickupFromJobCard } from "@/lib/sync-pickup-from-job-card";
import { jobCardUpdateAllowed } from "@/lib/job-card-edit-policy";
import { evaluateJobCardPricingWrite } from "@/lib/job-card-pricing-rbac";
import { userHasPermission } from "@/lib/rbac";
import { useAuthStore } from "@/store/auth-store";
import { useInvoiceStore } from "@/store/invoice-store";

interface JobCardStore {
  jobCards: JobCard[];
  jobCardsLoading: boolean;
  jobCardsError: string | null;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  isInitialLoaded: boolean;

  fetchPaginatedJobCards: (params: PaginationParams, append?: boolean) => Promise<void>;
  addJobCard: (jobCard: JobCard) => Promise<void>;
  updateJobCard: (id: string, updates: Partial<JobCard>) => Promise<boolean>;
  deleteJobCard: (id: string) => Promise<void>;
  getNextJobNumber: () => string;
}

export const useJobCardStore = create<JobCardStore>((set, get) => ({
  jobCards: [],
  jobCardsLoading: false,
  jobCardsError: null,
  total: 0,
  page: 1,
  pageSize: 50,
  totalPages: 1,
  isInitialLoaded: false,

  fetchPaginatedJobCards: async (params, append = false) => {
    set({ jobCardsLoading: true, jobCardsError: null });
    try {
      const query = new URLSearchParams();
      query.append("page", params.page.toString());
      query.append("pageSize", params.pageSize.toString());
      if (params.search) query.append("search", params.search);
      if (params.sortBy) query.append("sortBy", params.sortBy);
      if (params.sortDir) query.append("sortDir", params.sortDir);
      if (params.filters) {
        Object.entries(params.filters).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== "") {
            query.append(k, String(v));
          }
        });
      }

      const data = await apiGet<{ 
        items: JobCard[]; 
        metadata?: { total: number; page: number; pageSize: number; totalPages: number } 
      }>(`/api/collections/jobCards?${query.toString()}`);
      
      const newItems = data.items;
      
      set((state) => ({ 
        jobCards: append ? [...state.jobCards, ...newItems] : newItems, 
        jobCardsLoading: false,
        isInitialLoaded: true,
        total: data.metadata?.total ?? (append ? state.total + newItems.length : newItems.length),
        page: data.metadata?.page ?? params.page,
        pageSize: data.metadata?.pageSize ?? params.pageSize,
        totalPages: data.metadata?.totalPages ?? 1,
      }));
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Failed to load job cards";
      set({ jobCardsError: message, jobCardsLoading: false });
    }
  },

  addJobCard: async (jobCard) => {
    await putCollectionDocument("jobCards", jobCard.id, jobCard);
    set((state) => ({
      jobCards: [jobCard, ...state.jobCards.filter((jc) => jc.id !== jobCard.id)],
    }));
    // Re-fetch from server so secureToken (server-signed) is populated immediately,
    // enabling "Customer Photos" sharing without requiring a page reload.
    refreshJobCardFromServer(jobCard.id).catch(() => {
      // Non-critical: token will be available on next full page load
    });
  },

  updateJobCard: async (id, updates) => {
    const prev = get().jobCards.find((jc) => jc.id === id);
    if (!prev) return false;
    if (!jobCardUpdateAllowed(prev, updates)) {
      toast.error("This job card can no longer be edited");
      return false;
    }
    const next = { ...prev, ...updates };
    const user = useAuthStore.getState().user;
    const hasInvoice = useInvoiceStore.getState().invoices.some((inv) => inv.jobCardId === id);
    const pricingDecision = evaluateJobCardPricingWrite({
      hasPricingPermission: userHasPermission(user, "JOB_CARD_PRICING"),
      prev,
      next,
      hasInvoice,
    });
    if (!pricingDecision.ok) {
      toast.error(
        pricingDecision.reason === "MISSING_PERMISSION"
          ? "You do not have permission to change job card prices"
          : pricingDecision.message
      );
      return false;
    }
    // Apply locally first so same-click flows (e.g. deliver + invoice) see the new status.
    set((state) => ({
      jobCards: state.jobCards.map((jc) => (jc.id === id ? next : jc)),
    }));
    if (updates.status) {
      syncPickupFromJobCard(id, next.status);
    }
    try {
      await putCollectionDocument("jobCards", id, next);
      return true;
    } catch (err) {
      set((state) => ({
        jobCards: state.jobCards.map((jc) => (jc.id === id ? prev : jc)),
      }));
      if (updates.status) {
        syncPickupFromJobCard(id, prev.status);
      }
      throw err;
    }
  },

  deleteJobCard: async (id) => {
    await deleteCollectionDocument("jobCards", id);
    set((state) => ({
      jobCards: state.jobCards.filter((jc) => jc.id !== id),
    }));
  },

  getNextJobNumber: () => {
    const all = get().jobCards;
    const maxNum = all.reduce((max, jc) => {
      const match = jc.jobNumber.match(/JC-\d{4}-(\d+)/);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);
    return `JC-2026-${String(maxNum + 1).padStart(4, "0")}`;
  },
}));
