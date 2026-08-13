import { prisma } from "../lib/prisma.js";
import { toApiCustomer } from "./customer.service.js";
import {
  ARRAY_JSON_COLLECTIONS,
  SINGLETON_COLLECTIONS,
  SINGLETON_ENTITY_ID,
} from "../constants/json-collections.js";
import { sortCollectionPayloads } from "../lib/sort-collection-payloads.js";
import { listBranchesApi } from "./branch-api.service.js";
import { listUsersApi } from "./user-api.service.js";
import { listVehiclesApi } from "./vehicle-api.service.js";

const BOOTSTRAP_COLLECTION_NAMES = [
  ...ARRAY_JSON_COLLECTIONS,
  ...SINGLETON_COLLECTIONS,
] as string[];

type AppJsonRowLite = { collection: string; entityId: string; payload: unknown };

function buildCollectionsFromRows(rows: AppJsonRowLite[]): Record<string, unknown> {
  const byCollection = new Map<string, AppJsonRowLite[]>();
  for (const row of rows) {
    const list = byCollection.get(row.collection) ?? [];
    list.push(row);
    byCollection.set(row.collection, list);
  }

  const collections: Record<string, unknown> = {};

  for (const name of ARRAY_JSON_COLLECTIONS) {
    const list = byCollection.get(name) ?? [];
    const payloads = list.map((r) => r.payload);
    collections[name] = sortCollectionPayloads(name, payloads);
  }

  for (const name of SINGLETON_COLLECTIONS) {
    const list = byCollection.get(name) ?? [];
    const row = list.find((r) => r.entityId === SINGLETON_ENTITY_ID);
    collections[name] = row?.payload ?? null;
  }

  return collections;
}

export async function getBootstrapPayload() {
  const [customers, branches, users, vehicles, appRows] = await Promise.all([
    prisma.customer.findMany({ orderBy: { createdAt: "desc" } }),
    listBranchesApi(),
    listUsersApi(),
    listVehiclesApi(),
    prisma.appJsonRow.findMany({
      where: { collection: { in: BOOTSTRAP_COLLECTION_NAMES } },
    }),
  ]);

  const collections = buildCollectionsFromRows(appRows);

  return {
    customers: customers.map(toApiCustomer),
    branches,
    users,
    vehicles,
    collections,
  };
}
