import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import type { UserRole } from "@prisma/client";
import {
  isArrayCollection,
  isSingletonCollection,
  SINGLETON_ENTITY_ID,
} from "../constants/json-collections.js";
import { PAYROLL_ACCESS_ROLES } from "../lib/rbac.js";
import {
  listCollectionItems,
  upsertCollectionItem,
  deleteCollectionItem,
  replaceCollectionArray,
} from "../services/collection.service.js";

function forbidden(res: Response, message: string) {
  res.status(403).json({ data: null, error: { message } });
}

function assertPayrollAccess(
  res: Response,
  collection: string,
  role: UserRole | undefined
): boolean {
  if (collection !== "payroll") return true;
  if (role && (PAYROLL_ACCESS_ROLES as readonly string[]).includes(role)) return true;
  forbidden(res, "You do not have access to payroll data.");
  return false;
}

function collectionParam(req: Request): string {
  const raw = req.params.collection;
  return Array.isArray(raw) ? raw[0]! : raw!;
}

function entityParam(req: Request): string {
  const raw = req.params.entityId;
  return Array.isArray(raw) ? raw[0]! : raw!;
}

export async function getCollection(req: Request, res: Response, next: NextFunction) {
  try {
    const collection = collectionParam(req);
    if (!isArrayCollection(collection) && !isSingletonCollection(collection)) {
      res.status(400).json({ data: null, error: { message: "Unknown collection" } });
      return;
    }
    if (!assertPayrollAccess(res, collection, req.auth?.role)) return;
    const items = await listCollectionItems(collection);
    res.json({ data: { items }, error: null });
  } catch (e) {
    next(e);
  }
}

const snapshotSchema = z.object({
  items: z.array(z.unknown()),
});

export async function postSnapshot(req: Request, res: Response, next: NextFunction) {
  try {
    const collection = collectionParam(req);
    if (!isArrayCollection(collection)) {
      res.status(400).json({ data: null, error: { message: "Snapshot only for array collections" } });
      return;
    }
    if (!assertPayrollAccess(res, collection, req.auth?.role)) return;
    const body = snapshotSchema.parse(req.body);
    const items = body.items as { id: string }[];
    for (const it of items) {
      if (!it.id || typeof it.id !== "string") {
        res.status(400).json({ data: null, error: { message: "Each item must have string id" } });
        return;
      }
    }
    await replaceCollectionArray(collection, items);
    res.json({ data: { ok: true }, error: null });
  } catch (e) {
    next(e);
  }
}

export async function putCollectionItem(req: Request, res: Response, next: NextFunction) {
  try {
    const collection = collectionParam(req);
    const entityId = entityParam(req);
    if (!isArrayCollection(collection) && !isSingletonCollection(collection)) {
      res.status(400).json({ data: null, error: { message: "Unknown collection" } });
      return;
    }
    if (isSingletonCollection(collection) && entityId !== SINGLETON_ENTITY_ID) {
      res.status(400).json({ data: null, error: { message: "Invalid singleton id" } });
      return;
    }
    if (!assertPayrollAccess(res, collection, req.auth?.role)) return;
    const payload = req.body;
    if (payload === null || typeof payload !== "object") {
      res.status(400).json({ data: null, error: { message: "Body must be a JSON object" } });
      return;
    }
    await upsertCollectionItem(collection, entityId, payload);
    res.json({ data: { ok: true }, error: null });
  } catch (e) {
    next(e);
  }
}

export async function deleteCollectionRow(req: Request, res: Response, next: NextFunction) {
  try {
    const collection = collectionParam(req);
    const entityId = entityParam(req);
    if (!isArrayCollection(collection)) {
      res.status(400).json({ data: null, error: { message: "Delete only for array collections" } });
      return;
    }
    if (!assertPayrollAccess(res, collection, req.auth?.role)) return;
    const ok = await deleteCollectionItem(collection, entityId);
    if (!ok) {
      res.status(404).json({ data: null, error: { message: "Not found" } });
      return;
    }
    res.json({ data: { ok: true }, error: null });
  } catch (e) {
    next(e);
  }
}
