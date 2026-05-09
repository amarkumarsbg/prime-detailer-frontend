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

import { env } from "../config/env.js";
import {
  isPasswordResetEmailConfigured,
  sendPasswordResetEmail,
} from "../services/password-reset-email.service.js";
import {
  consumePasswordResetToken,
  createPasswordResetPlainToken,
  issuePasswordResetForUser,
  clearPasswordResetForUser,
  isPasswordResetTokenPending,
} from "../services/password-reset.service.js";

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

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(24),
  password: z.string().min(6),
});

const resetTokenQuerySchema = z.object({
  token: z.string().min(24).max(2048),
});

function parseResetTokenFromQuery(req: Request): string {
  const raw = req.query.token;
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0].trim();
  return "";
}

/** Read-only: whether this reset URL can still complete once (token stored & unexpired). */
export async function getResetPasswordTokenStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = resetTokenQuerySchema.safeParse({ token: parseResetTokenFromQuery(req) });
    if (!parsed.success) {
      res.status(400).json({
        data: null,
        error: { message: "Missing or invalid token." },
      });
      return;
    }
    const pending = await isPasswordResetTokenPending(parsed.data.token);
    res.json({ data: { pending }, error: null });
  } catch (e) {
    next(e);
  }
}

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
  const isProduction = process.env.NODE_ENV === "production";
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

    /** Real SMS vs console-only — never put the OTP in HTTP responses */
    let delivery: "sms" | "log_only" = "log_only";

    if (isTwilioSmsEnabled()) {
      try {
        const { sid, status } = await sendLoginOtpSms(e164, code);
        delivery = "sms";
        if (!isProduction) {
          console.info(
            `[auth/otp] Twilio accepted SMS sid=${sid} status=${status} to=${e164} (check Twilio Console → Monitor → Message log if not delivered)`
          );
        }
      } catch (err) {
        if (!isProduction) {
          console.error("[auth/otp] Twilio send failed:", err);
          console.info(`[auth/otp] OTP for ${body.phone} (${e164}): ${code}`);
        } else {
          console.error("[auth/otp] Twilio send failed");
        }
        res.status(503).json({
          data: null,
          error: { message: formatTwilioSendError(err) },
        });
        return;
      }
    } else if (!isProduction) {
      console.info(`[auth/otp] Twilio not configured — OTP for ${body.phone}: ${code}`);
    }

    const bypassDisabled = process.env.LOGIN_OTP_DEMO_CODE === "";
    const demoBypassCode = bypassDisabled ? undefined : (process.env.LOGIN_OTP_DEMO_CODE ?? "1234");
    const isDev = process.env.NODE_ENV !== "production";

    res.json({
      data: {
        ok: true as const,
        delivery,
        ...(delivery === "log_only" && {
          hint: isDev
            ? demoBypassCode !== undefined
              ? "SMS not configured — OTP is printed in the API terminal, or use the dev bypass code."
              : "SMS not configured — OTP is printed only in the API terminal (demo bypass disabled via LOGIN_OTP_DEMO_CODE)."
            : "SMS is not configured for this server. Contact your administrator.",
          ...(isDev && demoBypassCode !== undefined ? { devDemoCode: demoBypassCode } : {}),
        }),
      },
      error: null,
    });
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

/**
 * Opaque success if the email is unknown. Issues a time-limited reset token and sends email via Resend when configured.
 * In development without Resend, prints the reset URL in the API terminal.
 */
export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  const isProduction = process.env.NODE_ENV === "production";
  try {
    const body = forgotPasswordSchema.parse(req.body);
    const normalized = body.email.trim().toLowerCase();
    const mailOk = isPasswordResetEmailConfigured();

    if (isProduction && !mailOk) {
      console.error(
        "[auth/forgot-password] RESEND_API_KEY is missing — cannot send password reset email in production."
      );
      res.status(503).json({
        data: null,
        error: {
          message:
            "Password reset email is not configured on this server. Please contact your administrator.",
        },
      });
      return;
    }

    const user = await prisma.user.findFirst({
      where: { email: normalized, isActive: true },
      select: { id: true, email: true },
    });

    if (user) {
      const plainToken = createPasswordResetPlainToken();
      await issuePasswordResetForUser(user.id, plainToken);
      const base = env.FRONTEND_ORIGIN.replace(/\/+$/, "");
      const resetUrl = `${base}/reset-password?token=${encodeURIComponent(plainToken)}`;

      if (mailOk) {
        const sendResult = await sendPasswordResetEmail(user.email, resetUrl);
        if (!sendResult.ok) {
          if (!isProduction) {
            console.info(
              `[auth/forgot-password] Resend failed — dev-only reset link (still valid ~1h) for ${user.email}:\n${resetUrl}`
            );
            const trialToBlock =
              sendResult.detail.includes("only send testing") ||
              sendResult.detail.includes("verify a domain");
            const devTip = trialToBlock
              ? "On a Resend trial, mail only goes to your Resend-login email until you add and verify your domain at resend.com/domains (then MAIL_FROM must use that domain, e.g. support@primedetailers.in). Until then you can copy the reset URL from the backend terminal, or test with a DB user whose email is your Resend account address."
              : "Try MAIL_FROM=Prime Detailers <onboarding@resend.dev> until your domain is verified, copy the reset URL from the backend terminal, and confirm RESEND_API_KEY is valid.";
            res.status(503).json({
              data: null,
              error: {
                message: `Resend could not send the email (${sendResult.detail}). ${devTip}`,
              },
            });
          } else {
            await clearPasswordResetForUser(user.id);
            res.status(503).json({
              data: null,
              error: {
                message:
                  "We could not send the reset email right now. Please try again in a few minutes.",
              },
            });
          }
          return;
        }
      } else if (!isProduction) {
        console.info(
          `[auth/forgot-password] RESEND_API_KEY not set — reset link for ${user.email}:\n${resetUrl}`
        );
      }
    } else if (!isProduction) {
      console.warn(
        `[auth/forgot-password] No active User has email "${normalized}" — no reset mail sent (API still returns generic success). Seed/demo accounts often use admin@local.dev or *@prime-detailers.test. Sign up first if you're using a new Gmail address on this database.`
      );
    }

    const mailInboxMessage =
      "If an account exists for this email, we've sent password reset instructions. Please check your inbox and spam folder.";

    /** Dev/local only: no SMTP/Resend — nothing is mailed. Users must copy the URL from backend logs if an account existed. */
    const devTerminalMessage =
      "This setup does not send email until you configure the backend (add RESEND_API_KEY to backend .env). If your email is registered, the full reset link is printed where the backend API runs (the terminal showing “API listening on …”). Scroll for `[auth/forgot-password]` followed by two lines—a second line starts with http and contains `/reset-password?token=`. Copy that URL into your browser. If nothing like that printed, this email may not be registered on this server.";

    res.json({
      data: {
        ok: true as const,
        message: mailOk ? mailInboxMessage : devTerminalMessage,
        ...(!mailOk && !isProduction ? { passwordResetDelivery: "dev-console" as const } : {}),
      },
      error: null,
    });
  } catch (e) {
    next(e);
  }
}

export async function completePasswordReset(req: Request, res: Response, next: NextFunction) {
  try {
    const body = resetPasswordSchema.parse(req.body);
    const outcome = await consumePasswordResetToken(body.token, body.password);
    if (!outcome.ok) {
      const msg =
        outcome.reason === "EXPIRED"
          ? "This reset link has expired. Request a new one from Forgot password."
          : "Invalid or expired reset link.";
      res.status(400).json({ data: null, error: { message: msg } });
      return;
    }
    res.json({
      data: {
        ok: true as const,
        message: "Your password was updated. Sign in with your new password.",
      },
      error: null,
    });
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
