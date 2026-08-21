"use client";

import { create } from "zustand";
import { toast } from "sonner";
import type { JobCard } from "@/types";
import { deleteCollectionDocument, putCollectionDocument } from "@/lib/collection-sync";
import { syncPickupFromJobCard } from "@/lib/sync-pickup-from-job-card";
import { jobCardUpdateAllowed } from "@/lib/job-card-edit-policy";
import { evaluateJobCardPricingWrite } from "@/lib/job-card-pricing-rbac";
import { userHasPermission } from "@/lib/rbac";
import { useAuthStore } from "@/store/auth-store";
import { useInvoiceStore } from "@/store/invoice-store";

interface JobCardStore {
  jobCards: JobCard[];
  addJobCard: (jobCard: JobCard) => Promise<void>;
  updateJobCard: (id: string, updates: Partial<JobCard>) => Promise<boolean>;
  deleteJobCard: (id: string) => Promise<void>;
  getNextJobNumber: () => string;
}

export const useJobCardStore = create<JobCardStore>((set, get) => ({
  jobCards: [],

  addJobCard: async (jobCard) => {
    await putCollectionDocument("jobCards", jobCard.id, jobCard);
    set((state) => ({
      jobCards: [jobCard, ...state.jobCards.filter((jc) => jc.id !== jobCard.id)],
    }));
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
