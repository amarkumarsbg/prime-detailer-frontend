import { apiClient } from "@/lib/api-client";
import type { PricingQuote, SubscriptionRenewalHistoryRow, SubscriptionBillRow } from "@/types";

export async function getPricingQuote(input: {
  termMonths: 12 | 24 | 36 | 60;
  extraBranches?: number;
  extraUsers?: number;
  referralCode?: string | null;
}): Promise<PricingQuote> {
  return apiClient.post<PricingQuote>("/api/organization/subscription/pricing", input);
}

export async function submitRenewal(input: {
  termMonths?: 12 | 24 | 36 | 60;
  extraBranches?: number;
  extraUsers?: number;
  referralCode?: string | null;
  method?: string;
  notes?: string;
}): Promise<unknown> {
  return apiClient.post("/api/organization/subscription/renew", input);
}

export async function getRenewals(): Promise<{ renewals: SubscriptionRenewalHistoryRow[] }> {
  return apiClient.get("/api/organization/subscription/renewals");
}

export async function getBills(): Promise<{ bills: SubscriptionBillRow[] }> {
  return apiClient.get("/api/organization/subscription/bills");
}

export async function getBill(billId: string): Promise<SubscriptionBillRow> {
  return apiClient.get<SubscriptionBillRow>(`/api/organization/subscription/bills/${billId}`);
}
