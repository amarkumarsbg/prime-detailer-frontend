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
  evaluateJobCardPricingWrite,
  type JobCardLike,
} from "../lib/job-card-pricing-guard.js";
import {
  listCollectionItems,
  getCollectionItem,
  upsertCollectionItem,
  deleteCollectionItem,
  replaceCollectionArray,
} from "../services/collection.service.js";
import { persistBusinessLogoFile } from "../services/object-storage.service.js";
import {
  assertPayloadEntityIdMatch,
  parseCollectionPayload,
  parseCollectionSnapshotItems,
} from "../validations/collection-payloads.js";
import { ApiErrorCode } from "../lib/app-error.js";

function forbidden(res: Response, message: string) {
  res.status(403).json({
    data: null,
    error: { message, code: ApiErrorCode.FORBIDDEN },
  });
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

function actorHasJobCardPricing(req: Request): boolean {
  if (!req.auth) return false;
  if (req.auth.role === "SUPER_ADMIN") return true;
  return Boolean(req.auth.permissions?.includes("JOB_CARD_PRICING"));
}

async function invoiceExistsForJobCard(jobCardId: string): Promise<boolean> {
  const invoices = await listCollectionItems("invoices");
  return invoices.some((raw) => {
    if (!raw || typeof raw !== "object") return false;
    return (raw as { jobCardId?: string }).jobCardId === jobCardId;
  });
}

/**
 * Reject job-card writes that change protected pricing without JOB_CARD_PRICING
 * (or when status/invoice locks apply). Creates (no previous row) skip comparison.
 */
async function assertJobCardPricingOrForbid(
  req: Request,
  res: Response,
  prev: unknown | null,
  next: unknown
): Promise<boolean> {
  if (!prev || typeof prev !== "object") return true;
  if (!next || typeof next !== "object") return true;
  const prevJc = prev as JobCardLike & { id?: string };
  const nextJc = next as JobCardLike & { id?: string };
  const jobId =
    typeof nextJc.id === "string" ? nextJc.id : typeof prevJc.id === "string" ? prevJc.id : "";
  const hasInvoice = jobId ? await invoiceExistsForJobCard(jobId) : false;
  const decision = evaluateJobCardPricingWrite({
    hasPricingPermission: actorHasJobCardPricing(req),
    prev: prevJc,
    next: nextJc,
    hasInvoice,
  });
  if (decision.ok) return true;
  forbidden(res, decision.message);
  return false;
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
    const items = parseCollectionSnapshotItems(collection, body.items);

    if (collection === "jobCards") {
      const existing = await listCollectionItems("jobCards");
      const prevById = new Map<string, unknown>();
      for (const row of existing) {
        if (row && typeof row === "object" && typeof (row as { id?: string }).id === "string") {
          prevById.set((row as { id: string }).id, row);
        }
      }
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const id = (item as { id?: string }).id;
        if (typeof id !== "string" || !id) continue;
        const prev = prevById.get(id) ?? null;
        if (!(await assertJobCardPricingOrForbid(req, res, prev, item))) return;
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
      res.status(400).json({
        data: null,
        error: { message: "Unknown collection", code: ApiErrorCode.VALIDATION },
      });
      return;
    }
    if (isSingletonCollection(collection) && entityId !== SINGLETON_ENTITY_ID) {
      res.status(400).json({
        data: null,
        error: { message: "Invalid singleton id", code: ApiErrorCode.VALIDATION },
      });
      return;
    }
    if (!assertPayrollAccess(res, collection, req.auth?.role)) return;
    const payload = parseCollectionPayload(collection, req.body);
    assertPayloadEntityIdMatch(collection, entityId, payload);

    if (collection === "jobCards") {
      const prev = await getCollectionItem(collection, entityId);
      if (!(await assertJobCardPricingOrForbid(req, res, prev, payload))) return;
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

export async function postAppSettingsLogo(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth) {
      res.status(401).json({ data: null, error: { message: "Unauthorized" } });
      return;
    }
    const file = req.file;
    if (!file?.buffer) {
      res.status(400).json({ data: null, error: { message: "No image file provided." } });
      return;
    }
    const url = await persistBusinessLogoFile({
      buffer: file.buffer,
      mimeType: file.mimetype,
      uploadedBy: req.auth.id,
    });
    res.json({ data: { url }, error: null });
  } catch (e) {
    next(e);
  }
}
