import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { listBranchesApi, upsertBranchApi, patchBranchApi } from "../services/branch-api.service.js";

function paramId(req: Request): string {
  const raw = req.params.id;
  return Array.isArray(raw) ? raw[0]! : raw!;
}

const branchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  address: z.string().min(1),
  phone: z.string().min(1),
  isActive: z.boolean().optional(),
  qrCodeId: z.string().nullable().optional(),
  code: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  pincode: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  managerName: z.string().nullable().optional(),
  managerPhone: z.string().nullable().optional(),
});

export async function getBranches(_req: Request, res: Response, next: NextFunction) {
  try {
    const branches = await listBranchesApi();
    res.json({ data: { branches }, error: null });
  } catch (e) {
    next(e);
  }
}

export async function postBranch(req: Request, res: Response, next: NextFunction) {
  try {
    const body = branchSchema.parse(req.body);
    const branch = await upsertBranchApi(body);
    res.status(201).json({ data: { branch }, error: null });
  } catch (e) {
    next(e);
  }
}

const patchBranchSchema = branchSchema.partial().omit({ id: true });

export async function putBranch(req: Request, res: Response, next: NextFunction) {
  try {
    const id = paramId(req);
    const body = patchBranchSchema.parse(req.body);
    const branch = await patchBranchApi(id, body);
    if (!branch) {
      res.status(404).json({ data: null, error: { message: "Branch not found" } });
      return;
    }
    res.json({ data: { branch }, error: null });
  } catch (e) {
    next(e);
  }
}
