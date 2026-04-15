import { prisma } from "../lib/prisma.js";
import {
  isArrayCollection,
  isSingletonCollection,
  SINGLETON_ENTITY_ID,
} from "../constants/json-collections.js";

export async function listCollectionItems(collection: string): Promise<unknown[]> {
  if (isSingletonCollection(collection)) {
    const row = await prisma.appJsonRow.findUnique({
      where: { collection_entityId: { collection, entityId: SINGLETON_ENTITY_ID } },
    });
    return row ? [row.payload] : [];
  }
  const rows = await prisma.appJsonRow.findMany({
    where: { collection },
    orderBy: { entityId: "asc" },
  });
  return rows.map((r) => r.payload);
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
  await prisma.$transaction(async (tx) => {
    await tx.appJsonRow.deleteMany({ where: { collection } });
    if (items.length === 0) return;
    await tx.appJsonRow.createMany({
      data: items.map((item) => ({
        collection,
        entityId: item.id,
        payload: item as object,
      })),
    });
  });
}

export async function upsertSingleton(collection: string, payload: unknown): Promise<void> {
  if (!isSingletonCollection(collection)) {
    throw new Error("Not a singleton collection");
  }
  await upsertCollectionItem(collection, SINGLETON_ENTITY_ID, payload);
}
