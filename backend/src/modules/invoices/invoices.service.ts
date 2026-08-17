/**
 * Invoices / billing domain service.
 * HTTP: `/api/invoices` aliases + `/api/collections/invoices` (+ public view).
 */
import {
  deleteCollectionItem,
  getCollectionItem,
  listCollectionItems,
  replaceCollectionArray,
  upsertCollectionItem,
} from "../collections/app-json-store.js";
import {
  applyInvoiceGstGuard,
  getOrgGstRegistrationStatus,
} from "../../lib/gst-settings.js";
import { handleInvoiceWalletSync } from "./wallet-sync.service.js";

export async function listInvoices(
  organizationId: string,
  allowedBranchIds?: string[] | null
) {
  return listCollectionItems("invoices", { organizationId, allowedBranchIds });
}

export async function getInvoice(organizationId: string, entityId: string) {
  return getCollectionItem("invoices", entityId, organizationId);
}

export async function upsertInvoice(
  organizationId: string,
  entityId: string,
  payload: unknown
): Promise<void> {
  const previous = await getCollectionItem("invoices", entityId, organizationId);
  const gstStatus = await getOrgGstRegistrationStatus(organizationId);
  const guarded = applyInvoiceGstGuard(payload, previous, gstStatus);
  await handleInvoiceWalletSync(organizationId, entityId, guarded);
  await upsertCollectionItem("invoices", entityId, guarded, organizationId);
}

export async function deleteInvoice(organizationId: string, entityId: string): Promise<boolean> {
  return deleteCollectionItem("invoices", entityId, organizationId);
}

export async function replaceInvoices(
  organizationId: string,
  items: { id: string }[]
): Promise<void> {
  const gstStatus = await getOrgGstRegistrationStatus(organizationId);
  const existing = await listCollectionItems("invoices", { organizationId });
  const prevById = new Map<string, unknown>();
  for (const row of existing) {
    if (row && typeof row === "object" && typeof (row as { id?: string }).id === "string") {
      prevById.set((row as { id: string }).id, row);
    }
  }
  const guarded = items.map((item) => {
    if (!item || typeof item !== "object") return item;
    const id = (item as { id?: string }).id;
    const prev = typeof id === "string" ? prevById.get(id) ?? null : null;
    return applyInvoiceGstGuard(item, prev, gstStatus) as { id: string };
  });
  await replaceCollectionArray("invoices", guarded, organizationId);
}
