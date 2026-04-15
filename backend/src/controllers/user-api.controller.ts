import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { listUsersApi, createUserApi, updateUserApi } from "../services/user-api.service.js";

function paramId(req: Request): string {
  const raw = req.params.id;
  return Array.isArray(raw) ? raw[0]! : raw!;
}

const roleEnum = z.enum([
  "SUPER_ADMIN",
  "ADMIN",
  "BRANCH_MANAGER",
  "MANAGER",
  "SUPERVISOR",
  "RECEPTIONIST",
  "MECHANIC",
]);

const createUserSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  role: roleEnum,
  branchId: z.string().min(1),
  password: z.string().optional(),
  avatar: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  emailVerified: z.boolean().optional(),
  attendancePin: z.string().nullable().optional(),
  totalJobsCompleted: z.number().nullable().optional(),
  totalIncentiveEarned: z.number().nullable().optional(),
  birthday: z.string().nullable().optional(),
  anniversary: z.string().nullable().optional(),
});

const updateUserSchema = createUserSchema.partial().omit({ id: true, password: true });

export async function getUsers(_req: Request, res: Response, next: NextFunction) {
  try {
    const users = await listUsersApi();
    res.json({ data: { users }, error: null });
  } catch (e) {
    next(e);
  }
}

export async function postUser(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createUserSchema.parse(req.body);
    const user = await createUserApi({
      ...body,
      role: body.role as UserRole,
    });
    res.status(201).json({ data: { user }, error: null });
  } catch (e) {
    next(e);
  }
}

export async function putUser(req: Request, res: Response, next: NextFunction) {
  try {
    const id = paramId(req);
    const body = updateUserSchema.parse(req.body);
    const user = await updateUserApi(id, {
      ...body,
      role: body.role as UserRole | undefined,
    });
    if (!user) {
      res.status(404).json({ data: null, error: { message: "User not found" } });
      return;
    }
    res.json({ data: { user }, error: null });
  } catch (e) {
    next(e);
  }
}
