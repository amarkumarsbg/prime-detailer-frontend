import { apiClient } from "@/lib/api-client";
import type { SubscriptionPaymentRow, SubscriptionBillRow } from "@/types";

// ─── Renewal ──────────────────────────────────────────────────────────────────

export interface PlatformRenewalRow {
  billId: string;
  billNumber: string;
  organizationId: string;
  organizationName: string;
  planName: string;
  termMonths: number;
  termLabel: string;
  previousExpiry: string;
  newExpiry: string;
  baseAmount: number;
  referralDiscount: number;
  gstAmount: number;
  totalAmount: number;
  currency: string;
  paymentStatus: string | null;
  txnReference: string | null;
  renewalDate: string;
}

export async function listPlatformRenewals(params?: {
  orgId?: string;
  paymentStatus?: string;
  since?: string;
  until?: string;
  page?: number;
  limit?: number;
}): Promise<{ renewals: PlatformRenewalRow[]; total: number }> {
  const q = new URLSearchParams();
  if (params?.orgId) q.set("orgId", params.orgId);
  if (params?.paymentStatus) q.set("paymentStatus", params.paymentStatus);
  if (params?.since) q.set("since", params.since);
  if (params?.until) q.set("until", params.until);
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  const qs = q.toString() ? `?${q}` : "";
  return apiClient.get(`/api/platform/renewals${qs}`);
}

// ─── Bills ────────────────────────────────────────────────────────────────────

export interface PlatformBillRow extends SubscriptionBillRow {
  organizationId: string;
  organizationName: string;
  verifiedAt: string | null;
}

export async function listPlatformBills(params?: {
  orgId?: string;
  search?: string;
  paymentStatus?: string;
  since?: string;
  until?: string;
  page?: number;
  limit?: number;
}): Promise<{ bills: PlatformBillRow[]; total: number }> {
  const q = new URLSearchParams();
  if (params?.orgId) q.set("orgId", params.orgId);
  if (params?.search) q.set("search", params.search);
  if (params?.paymentStatus) q.set("paymentStatus", params.paymentStatus);
  if (params?.since) q.set("since", params.since);
  if (params?.until) q.set("until", params.until);
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  const qs = q.toString() ? `?${q}` : "";
  return apiClient.get(`/api/platform/bills${qs}`);
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export interface PlatformPaymentRow extends SubscriptionPaymentRow {
  organizationId: string;
  organizationName: string;
  planCode: string;
  planName: string;
  billNumber: string | null;
}

export async function listPlatformPayments(params?: {
  orgId?: string;
  status?: string;
  since?: string;
  until?: string;
  page?: number;
  limit?: number;
}): Promise<{ payments: PlatformPaymentRow[]; total: number }> {
  const q = new URLSearchParams();
  if (params?.orgId) q.set("orgId", params.orgId);
  if (params?.status) q.set("status", params.status);
  if (params?.since) q.set("since", params.since);
  if (params?.until) q.set("until", params.until);
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  const qs = q.toString() ? `?${q}` : "";
  return apiClient.get(`/api/platform/payments${qs}`);
}

// ─── Audit ────────────────────────────────────────────────────────────────────

export interface PlatformAuditRow {
  id: string;
  organizationId: string;
  organizationName: string;
  actor: string;
  action: string;
  before: unknown;
  after: unknown;
  createdAt: string;
}

export async function listPlatformAudit(params?: {
  orgId?: string;
  action?: string;
  since?: string;
  until?: string;
  page?: number;
  limit?: number;
}): Promise<{ logs: PlatformAuditRow[]; total: number }> {
  const q = new URLSearchParams();
  if (params?.orgId) q.set("orgId", params.orgId);
  if (params?.action) q.set("action", params.action);
  if (params?.since) q.set("since", params.since);
  if (params?.until) q.set("until", params.until);
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  const qs = q.toString() ? `?${q}` : "";
  return apiClient.get(`/api/platform/audit${qs}`);
}

// ─── Referrals ────────────────────────────────────────────────────────────────

export interface PlatformReferralCode {
  id: string;
  code: string;
  discountAmount: number;
  isActive: boolean;
  createdBy: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listPlatformReferrals(showInactive = false): Promise<{
  referralCodes: PlatformReferralCode[];
}> {
  const qs = showInactive ? "?showInactive=true" : "";
  return apiClient.get(`/api/platform/referrals${qs}`);
}

export async function createPlatformReferral(input: {
  code: string;
  discountAmount?: number;
  notes?: string;
}): Promise<PlatformReferralCode> {
  return apiClient.post("/api/platform/referrals", input);
}

// ─── Suspend / Restore ────────────────────────────────────────────────────────

export async function suspendOrg(orgId: string, reason: string): Promise<{ suspended: boolean; reason: string }> {
  return apiClient.post(`/api/platform/organizations/${orgId}/suspend`, { reason });
}

export async function restoreOrg(orgId: string, reason?: string): Promise<{ restored: boolean }> {
  return apiClient.post(`/api/platform/organizations/${orgId}/restore`, { reason });
}
