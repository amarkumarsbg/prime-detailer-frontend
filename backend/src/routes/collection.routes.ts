import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  getCollection,
  postSnapshot,
  putCollectionItem,
  deleteCollectionRow,
  postAppSettingsLogo,
} from "../controllers/collection.controller.js";
import { logoUploadHandler } from "../middleware/logo-upload.js";

export const collectionRouter = Router();

collectionRouter.use(requireAuth);

collectionRouter.post("/appSettings/logo", logoUploadHandler, postAppSettingsLogo);

const COLLECTION_PERMISSION_MAP: Record<string, string> = {
  jobCards: "JOB_CARDS",
  bookings: "BOOKINGS",
  pickupDrops: "PICKUP_DROP",
  expenses: "EXPENSES",
  vendors: "VENDORS",
  services: "SERVICES",
  inventory: "INVENTORY",
  appointments: "APPOINTMENTS",
  referrals: "REFERRALS",
  payroll: "PAYROLL",
  invoices: "BILLING",
  walletTransactions: "REFERRALS",
};

export function requireCollectionPermission(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth) {
    res.status(401).json({ data: null, error: { message: "Unauthorized" } });
    return;
  }
  if (req.auth.role === "SUPER_ADMIN") {
    next();
    return;
  }
  const collection = req.params.collection;
  if (typeof collection === "string") {
    const permission = COLLECTION_PERMISSION_MAP[collection];
    if (permission) {
      if (!req.auth.permissions || !req.auth.permissions.includes(permission)) {
        res.status(403).json({ data: null, error: { message: `Forbidden: Missing permission ${permission}` } });
        return;
      }
    }
  }
  next();
}

collectionRouter.get("/:collection", requireCollectionPermission, getCollection);
collectionRouter.post("/:collection/snapshot", requireCollectionPermission, postSnapshot);
collectionRouter.put("/:collection/:entityId", requireCollectionPermission, putCollectionItem);
collectionRouter.delete("/:collection/:entityId", requireCollectionPermission, deleteCollectionRow);
