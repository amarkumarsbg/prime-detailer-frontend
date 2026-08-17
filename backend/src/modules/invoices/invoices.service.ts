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
  await handleInvoiceWalletSync(organizationId, entityId, payload);
  await upsertCollectionItem("invoices", entityId, payload, organizationId);
}

export async function deleteInvoice(organizationId: string, entityId: string): Promise<boolean> {
  return deleteCollectionItem("invoices", entityId, organizationId);
}

export async function replaceInvoices(
  organizationId: string,
  items: { id: string }[]
): Promise<void> {
  await replaceCollectionArray("invoices", items, organizationId);
}
