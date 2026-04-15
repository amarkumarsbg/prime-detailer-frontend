import { prisma } from "../lib/prisma.js";
import { toApiCustomer } from "./customer.service.js";
import { listCollectionItems } from "./collection.service.js";
import {
  ARRAY_JSON_COLLECTIONS,
  SINGLETON_COLLECTIONS,
  SINGLETON_ENTITY_ID,
} from "../constants/json-collections.js";
import { listBranchesApi } from "./branch-api.service.js";
import { listUsersApi } from "./user-api.service.js";
import { listVehiclesApi } from "./vehicle-api.service.js";

export async function getBootstrapPayload() {
  const [customers, branches, users, vehicles] = await Promise.all([
    prisma.customer.findMany({ orderBy: { createdAt: "desc" } }),
    listBranchesApi(),
    listUsersApi(),
    listVehiclesApi(),
  ]);

  const collections: Record<string, unknown> = {};

  for (const name of ARRAY_JSON_COLLECTIONS) {
    collections[name] = await listCollectionItems(name);
  }

  for (const name of SINGLETON_COLLECTIONS) {
    const row = await prisma.appJsonRow.findUnique({
      where: { collection_entityId: { collection: name, entityId: SINGLETON_ENTITY_ID } },
    });
    collections[name] = row?.payload ?? null;
  }

  return {
    customers: customers.map(toApiCustomer),
    branches,
    users,
    vehicles,
    collections,
  };
}
