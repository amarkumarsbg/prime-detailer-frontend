import { prisma } from "../lib/prisma.js";
import { sortCollectionPayloads } from "../lib/sort-collection-payloads.js";
import {
  isArrayCollection,
  isSingletonCollection,
  SINGLETON_ENTITY_ID,
} from "../constants/json-collections.js";
import { handleInvoiceWalletSync } from "./wallet-sync.service.js";

export async function listCollectionItems(collection: string): Promise<unknown[]> {
  if (isSingletonCollection(collection)) {
    const row = await prisma.appJsonRow.findUnique({
      where: { collection_entityId: { collection, entityId: SINGLETON_ENTITY_ID } },
    });
    return row ? [row.payload] : [];
  }
  const rows = await prisma.appJsonRow.findMany({
    where: { collection },
  });
  const payloads = rows.map((r) => r.payload);
  return sortCollectionPayloads(collection, payloads);
}

export async function getCollectionItem(collection: string, entityId: string): Promise<unknown | null> {
  const row = await prisma.appJsonRow.findUnique({
    where: { collection_entityId: { collection, entityId } },
  });
  return row?.payload ?? null;
}

export async function upsertCollectionItem(
  collection: string,
  entityId: string,
  payload: unknown
): Promise<void> {
  if (collection === "invoices") {
    await handleInvoiceWalletSync(entityId, payload);
  }

  await prisma.appJsonRow.upsert({
    where: { collection_entityId: { collection, entityId } },
    create: { collection, entityId, payload: payload as object },
    update: { payload: payload as object },
  });
}

export async function deleteCollectionItem(collection: string, entityId: string): Promise<boolean> {
  try {
    await prisma.appJsonRow.delete({
      where: { collection_entityId: { collection, entityId } },
    });
    return true;
  } catch {
    return false;
  }
}

export async function replaceCollectionArray(collection: string, items: { id: string }[]): Promise<void> {
  if (!isArrayCollection(collection)) {
    throw new Error("replaceCollectionArray only for array collections");
  }
  // Last-wins dedupe by id (guards duplicate payloads from the client).
  const byId = new Map<string, { id: string }>();
  for (const item of items) {
    if (!item || typeof item.id !== "string") continue;
    const id = item.id.trim();
    if (!id) continue;
    byId.set(id, { ...item, id });
  }
  const uniqueItems = [...byId.values()];

  await prisma.$transaction(
    async (tx) => {
      // Serialize concurrent snapshot replaces for the same collection (delete+insert race).
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`appJsonRow:${collection}`}))`;
      await tx.appJsonRow.deleteMany({ where: { collection } });
      if (uniqueItems.length === 0) return;
      await tx.appJsonRow.createMany({
        data: uniqueItems.map((item) => ({
          collection,
          entityId: item.id,
          payload: item as object,
        })),
        skipDuplicates: true,
      });
    },
    { timeout: 30_000 }
  );
}

export async function upsertSingleton(collection: string, payload: unknown): Promise<void> {
  if (!isSingletonCollection(collection)) {
    throw new Error("Not a singleton collection");
  }
  await upsertCollectionItem(collection, SINGLETON_ENTITY_ID, payload);
}
