import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";

const RESET_TTL_MS = 60 * 60 * 1000;

export function hashPasswordResetToken(plain: string): string {
  return createHash("sha256").update(plain, "utf8").digest("hex");
}

export function createPasswordResetPlainToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function issuePasswordResetForUser(
  userId: string,
  plainToken: string
): Promise<void> {
  const tokenHash = hashPasswordResetToken(plainToken);
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: new Date(Date.now() + RESET_TTL_MS),
    },
  });
}

/** Clears a pending reset after a failed outbound email (e.g. production). */
export async function clearPasswordResetForUser(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    },
  });
}

export type ConsumeResetPasswordResult =
  | { ok: true }
  | { ok: false; reason: "INVALID" | "EXPIRED" };

export async function consumePasswordResetToken(
  plainToken: string,
  newPassword: string
): Promise<ConsumeResetPasswordResult> {
  if (!plainToken.trim() || newPassword.length < 6) {
    return { ok: false, reason: "INVALID" };
  }
  const tokenHash = hashPasswordResetToken(plainToken);
  const user = await prisma.user.findFirst({
    where: { passwordResetTokenHash: tokenHash },
  });
  if (!user || !user.isActive) return { ok: false, reason: "INVALID" };
  if (
    !user.passwordResetExpiresAt ||
    user.passwordResetExpiresAt.getTime() <= Date.now()
  ) {
    return { ok: false, reason: "EXPIRED" };
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    },
  });

  return { ok: true };
}
