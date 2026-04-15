import { apiDelete, apiPost, apiPut } from "./api-client";

export async function putCollectionDocument(
  collection: string,
  entityId: string,
  payload: unknown
): Promise<void> {
  await apiPut(`/api/collections/${collection}/${entityId}`, payload);
}

export async function postCollectionSnapshot(
  collection: string,
  items: unknown[]
): Promise<void> {
  await apiPost(`/api/collections/${collection}/snapshot`, { items });
}

export async function deleteCollectionDocument(
  collection: string,
  entityId: string
): Promise<void> {
  await apiDelete(`/api/collections/${collection}/${entityId}`);
}

export async function putSingletonDocument(
  collection: string,
  payload: unknown
): Promise<void> {
  await apiPut(`/api/collections/${collection}/default`, payload);
}

export async function postVehicleSnapshot(vehicles: unknown[]): Promise<void> {
  await apiPost(`/api/vehicles/snapshot`, { vehicles });
}
