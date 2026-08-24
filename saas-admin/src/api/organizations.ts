import { apiClient } from "@/lib/api-client";
import type {
  OrgListItem,
  OrgDetail,
  PatchSubscriptionInput,
} from "@/types";

export interface ListOrganizationsResponse {
  organizations: OrgListItem[];
}

export async function listOrganizations(): Promise<OrgListItem[]> {
  const res = await apiClient.get<ListOrganizationsResponse>("/api/platform/organizations");
  return res.organizations ?? [];
}

export async function getOrganization(orgId: string): Promise<OrgDetail> {
  return apiClient.get<OrgDetail>(`/api/platform/organizations/${orgId}`);
}

export async function patchOrganizationSubscription(
  orgId: string,
  input: PatchSubscriptionInput
): Promise<OrgDetail> {
  return apiClient.patch<OrgDetail>(
    `/api/platform/organizations/${orgId}/subscription`,
    input
  );
}

export async function verifyPayment(
  orgId: string,
  input: {
    paymentId: string;
    outcome: "PAID" | "FAILED";
    txnReference?: string | null;
    amount?: number | null;
    notes?: string | null;
  }
): Promise<unknown> {
  return apiClient.post(
    `/api/platform/organizations/${orgId}/subscription/verify-payment`,
    input
  );
}

export async function markPaid(
  orgId: string,
  input: {
    txnReference?: string | null;
    amount?: number | null;
    termMonths?: 12 | 24 | 36 | 60;
    notes?: string | null;
  }
): Promise<unknown> {
  return apiClient.post(
    `/api/platform/organizations/${orgId}/subscription/mark-paid`,
    input
  );
}
