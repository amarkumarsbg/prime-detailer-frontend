import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  listCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  creditWallet,
} from "../services/customer.service.js";

const trimmed = (v: unknown) => (typeof v === "string" ? v.trim() : v);

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.preprocess(trimmed, z.union([z.literal(""), z.string().email()])),
  address: z.preprocess(trimmed, z.string()),
  referralCode: z.string().min(1),
  referredBy: z.string().optional(),
  totalVisits: z.number().int().nonnegative().optional(),
  rewardPoints: z.number().int().nonnegative().optional(),
  walletBalance: z.number().nonnegative().optional(),
  lastVisitDate: z.string().optional(),
  isInactive: z.boolean().optional(),
  emailVerified: z.boolean().optional(),
});

const updateSchema = createSchema.partial();

const walletSchema = z.object({
  amount: z.number().positive(),
});

export async function getCustomers(_req: Request, res: Response, next: NextFunction) {
  try {
    const customers = await listCustomers();
    res.json({ data: { customers }, error: null });
  } catch (e) {
    next(e);
  }
}

function paramId(req: Request): string {
  const raw = req.params.id;
  return Array.isArray(raw) ? raw[0]! : raw!;
}

export async function getCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const customer = await getCustomerById(paramId(req));
    if (!customer) {
      res.status(404).json({ data: null, error: { message: "Customer not found" } });
      return;
    }
    res.json({ data: { customer }, error: null });
  } catch (e) {
    next(e);
  }
}

export async function postCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createSchema.parse(req.body);
    const customer = await createCustomer(body);
    res.status(201).json({ data: { customer }, error: null });
  } catch (e) {
    if (e instanceof Error && e.message === "Phone already in use") {
      res.status(409).json({ data: null, error: { message: e.message } });
      return;
    }
    next(e);
  }
}

export async function putCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const body = updateSchema.parse(req.body);
    const customer = await updateCustomer(paramId(req), body);
    if (!customer) {
      res.status(404).json({ data: null, error: { message: "Customer not found" } });
      return;
    }
    res.json({ data: { customer }, error: null });
  } catch (e) {
    if (e instanceof Error && e.message === "Phone already in use") {
      res.status(409).json({ data: null, error: { message: e.message } });
      return;
    }
    next(e);
  }
}

export async function removeCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const ok = await deleteCustomer(paramId(req));
    if (!ok) {
      res.status(404).json({ data: null, error: { message: "Customer not found" } });
      return;
    }
    res.json({ data: { ok: true }, error: null });
  } catch (e) {
    next(e);
  }
}

export async function patchWallet(req: Request, res: Response, next: NextFunction) {
  try {
    const body = walletSchema.parse(req.body);
    const customer = await creditWallet(paramId(req), body.amount);
    if (!customer) {
      res.status(404).json({ data: null, error: { message: "Customer not found" } });
      return;
    }
    res.json({ data: { customer }, error: null });
  } catch (e) {
    next(e);
  }
}
