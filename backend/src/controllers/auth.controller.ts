import type { Request, Response, NextFunction } from "express";
import type { Branch, User } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticateUser, registerUser, signAuthToken } from "../services/auth.service.js";
import {
  consumeLoginOtpIfValid,
  findActiveUserByTenDigitPhone,
  issueLoginOtp,
  isDemoLoginOtp,
} from "../services/login-otp.service.js";
import {
  isTwilioSmsEnabled,
  sendLoginOtpSms,
  toE164,
} from "../services/twilio-sms.service.js";

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

const otpSendSchema = z.object({
  phone: z.string().regex(/^\d{10}$/),
});

const otpVerifySchema = z.object({
  phone: z.string().regex(/^\d{10}$/),
  code: z.string().min(4).max(16),
});

function formatTwilioSendError(err: unknown): string {
  if (err && typeof err === "object" && "code" in err) {
    const e = err as {
      code?: number;
      message?: string;
      status?: number;
      moreInfo?: string;
    };
    if (typeof e.code === "number") {
      const base = `Twilio ${e.code}: ${e.message ?? "error"}`;
      return e.moreInfo ? `${base}. See ${e.moreInfo}` : base;
    }
  }
  return "Could not send SMS. Check Twilio credentials, trial verified numbers, and server logs.";
}

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

export async function sendLoginOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const body = otpSendSchema.parse(req.body);
    const user = await findActiveUserByTenDigitPhone(body.phone);
    if (!user) {
      res.status(404).json({
        data: null,
        error: { message: "No account found for this mobile number" },
      });
      return;
    }
    const code = issueLoginOtp(body.phone);
    const e164 = toE164(body.phone);
    if (isTwilioSmsEnabled()) {
      try {
        const { sid, status } = await sendLoginOtpSms(e164, code);
        console.info(
          `[auth/otp] Twilio accepted SMS sid=${sid} status=${status} to=${e164} (check Twilio Console → Monitor → Message log if not delivered)`
        );
      } catch (err) {
        console.error("[auth/otp] Twilio send failed:", err);
        console.info(`[auth/otp] OTP for ${body.phone} (${e164}): ${code}`);
        res.status(503).json({
          data: null,
          error: { message: formatTwilioSendError(err) },
        });
        return;
      }
    } else {
      console.info(`[auth/otp] Twilio not configured — OTP for ${body.phone}: ${code}`);
    }
    res.json({ data: { ok: true as const }, error: null });
  } catch (e) {
    next(e);
  }
}

export async function verifyLoginOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const body = otpVerifySchema.parse(req.body);
    const entered = body.code.replace(/\D/g, "");
    if (entered.length < 4) {
      res.status(401).json({ data: null, error: { message: "Invalid or expired OTP" } });
      return;
    }
    const user = await findActiveUserByTenDigitPhone(body.phone);
    if (!user) {
      res.status(401).json({ data: null, error: { message: "Invalid or expired OTP" } });
      return;
    }
    const valid =
      consumeLoginOtpIfValid(body.phone, entered) || isDemoLoginOtp(entered);
    if (!valid) {
      res.status(401).json({ data: null, error: { message: "Invalid or expired OTP" } });
      return;
    }
    const branch = await prisma.branch.findUnique({ where: { id: user.branchId } });
    res.json({ data: authSuccessResponse(user, branch), error: null });
  } catch (e) {
    next(e);
  }
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
      res
        .status(409)
        .json({ data: null, error: { message: "An account with this email already exists" } });
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
