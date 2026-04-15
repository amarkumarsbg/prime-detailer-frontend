import type { Request, Response, NextFunction } from "express";
import type { Branch, User } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticateUser, registerUser, signAuthToken } from "../services/auth.service.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  phone: z.string().min(5).max(32),
  password: z.string().min(6),
});

function authSuccessResponse(user: User, branch: Branch | null) {
  const token = signAuthToken({
    id: user.id,
    email: user.email,
    role: user.role,
    branchId: user.branchId,
    name: user.name,
  });
  return {
    accessToken: token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      branchId: user.branchId,
      avatar: user.avatar ?? undefined,
      isActive: user.isActive,
      emailVerified: user.emailVerified || undefined,
      attendancePin: user.attendancePin ?? undefined,
      totalJobsCompleted: user.totalJobsCompleted ?? undefined,
      totalIncentiveEarned: user.totalIncentiveEarned ?? undefined,
      birthday: user.birthday ?? undefined,
      anniversary: user.anniversary ?? undefined,
    },
    branch: branch
      ? {
          id: branch.id,
          name: branch.name,
          address: branch.address,
          phone: branch.phone,
          isActive: branch.isActive,
          qrCodeId: branch.qrCodeId ?? undefined,
          code: branch.code ?? undefined,
          city: branch.city ?? undefined,
          state: branch.state ?? undefined,
          pincode: branch.pincode ?? undefined,
          email: branch.email ?? undefined,
          managerName: branch.managerName ?? undefined,
          managerPhone: branch.managerPhone ?? undefined,
        }
      : null,
  };
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const body = loginSchema.parse(req.body);
    const user = await authenticateUser(body.email, body.password);
    if (!user) {
      res.status(401).json({ data: null, error: { message: "Invalid email or password" } });
      return;
    }
    const branch = await prisma.branch.findUnique({ where: { id: user.branchId } });
    res.json({ data: authSuccessResponse(user, branch), error: null });
  } catch (e) {
    next(e);
  }
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const body = registerSchema.parse(req.body);
    const result = await registerUser(body);
    if (!result.ok) {
      if (result.code === "EMAIL_TAKEN") {
        res
          .status(409)
          .json({ data: null, error: { message: "An account with this email already exists" } });
        return;
      }
      res.status(503).json({
        data: null,
        error: { message: "No branch available for signup. Run database seed first." },
      });
      return;
    }
    const user = result.user;
    const branch = await prisma.branch.findUnique({ where: { id: user.branchId } });
    res.status(201).json({ data: authSuccessResponse(user, branch), error: null });
  } catch (e) {
    next(e);
  }
}

export async function me(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ data: null, error: { message: "Unauthorized" } });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: req.auth.id } });
  if (!user?.isActive) {
    res.status(401).json({ data: null, error: { message: "Unauthorized" } });
    return;
  }
  const branch = await prisma.branch.findUnique({ where: { id: user.branchId } });
  res.json({
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        branchId: user.branchId,
        avatar: user.avatar ?? undefined,
        isActive: user.isActive,
        emailVerified: user.emailVerified || undefined,
        attendancePin: user.attendancePin ?? undefined,
        totalJobsCompleted: user.totalJobsCompleted ?? undefined,
        totalIncentiveEarned: user.totalIncentiveEarned ?? undefined,
        birthday: user.birthday ?? undefined,
        anniversary: user.anniversary ?? undefined,
      },
      branch: branch
        ? {
            id: branch.id,
            name: branch.name,
            address: branch.address,
            phone: branch.phone,
            isActive: branch.isActive,
            qrCodeId: branch.qrCodeId ?? undefined,
            code: branch.code ?? undefined,
            city: branch.city ?? undefined,
            state: branch.state ?? undefined,
            pincode: branch.pincode ?? undefined,
            email: branch.email ?? undefined,
            managerName: branch.managerName ?? undefined,
            managerPhone: branch.managerPhone ?? undefined,
          }
        : null,
    },
    error: null,
  });
}
