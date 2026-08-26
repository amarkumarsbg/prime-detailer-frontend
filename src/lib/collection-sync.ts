import { apiDelete, apiGet, apiPost, apiPut } from "./api-client";

/**
 * Graduated AppJsonRow modules (Phase 4): FE talks to dedicated aliases.
 * Collections gateway remains on the API for compatibility / other domains.
 */
const GRADUATED_DOCUMENT_BASE: Record<string, string> = {
  jobCards: "/api/job-cards",
  invoices: "/api/invoices",
  quotations: "/api/quotations",
};

export function documentCollectionBasePath(collection: string): string {
  return GRADUATED_DOCUMENT_BASE[collection] ?? `/api/collections/${collection}`;
}

export function isGraduatedDocumentCollection(collection: string): boolean {
  return Object.prototype.hasOwnProperty.call(GRADUATED_DOCUMENT_BASE, collection);
}

export async function putCollectionDocument(
  collection: string,
  entityId: string,
  payload: unknown
): Promise<void> {
  const base = documentCollectionBasePath(collection);
  await apiPut(`${base}/${entityId}`, payload);
}

export async function postCollectionSnapshot(
  collection: string,
  items: unknown[]
): Promise<void> {
  const base = documentCollectionBasePath(collection);
  await apiPost(`${base}/snapshot`, { items });
}

export async function deleteCollectionDocument(
  collection: string,
  entityId: string
): Promise<void> {
  const base = documentCollectionBasePath(collection);
  await apiDelete(`${base}/${entityId}`);
}

export async function getCollectionDocument<T>(
  collection: string,
  entityId: string
): Promise<T> {
  const base = documentCollectionBasePath(collection);
  const data = await apiGet<{ item: T }>(`${base}/${entityId}`);
  return data.item;
}

export async function putSingletonDocument(
  collection: string,
  payload: unknown
): Promise<void> {
  // Singletons are not graduated; always use collections gateway.
  await apiPut(`/api/collections/${collection}/default`, payload);
}

export async function postVehicleSnapshot(vehicles: unknown[]): Promise<void> {
  await apiPost(`/api/vehicles/snapshot`, { vehicles });
}
