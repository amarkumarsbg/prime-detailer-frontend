import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import type { User, UserRole } from "@prisma/client";

export async function authenticateUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user?.isActive) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  return user;
}

export type RegisterResult =
  | { ok: true; user: User }
  | { ok: false; code: "EMAIL_TAKEN" };

/** Self-signup: first active branch, or creates a default branch if the database is empty. Role ADMIN. */
export async function registerUser(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
}): Promise<RegisterResult> {
  const emailNorm = input.email.trim().toLowerCase();

  const user = await prisma.$transaction(async (tx) => {
    const taken = await tx.user.findUnique({ where: { email: emailNorm } });
    if (taken) return null;

    let branch = await tx.branch.findFirst({
      where: { isActive: true },
      orderBy: { id: "asc" },
    });
    if (!branch) {
      const anyBranch = await tx.branch.findFirst({ orderBy: { id: "asc" } });
      if (anyBranch) {
        branch = await tx.branch.update({
          where: { id: anyBranch.id },
          data: { isActive: true },
        });
      } else {
        branch = await tx.branch.create({
          data: {
            id: "br-main",
            name: "Delhi",
            address: "Set in Branches settings",
            phone: "—",
            isActive: true,
            qrCodeId: "qr-br-main",
            code: "DEL",
          },
        });
      }
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const id = `usr-${randomUUID().replace(/-/g, "").slice(0, 12)}`;

    return tx.user.create({
      data: {
        id,
        name: input.name.trim(),
        email: emailNorm,
        phone: input.phone.trim(),
        role: "ADMIN",
        branchId: branch.id,
        passwordHash,
        isActive: true,
        emailVerified: false,
      },
    });
  });

  if (!user) return { ok: false, code: "EMAIL_TAKEN" };
  return { ok: true, user };
}

export function signAuthToken(user: {
  id: string;
  email: string;
  role: UserRole;
  branchId: string;
  name: string;
}) {
  const expiresSeconds = 7 * 24 * 60 * 60;
  const options: jwt.SignOptions = { expiresIn: expiresSeconds };
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      branchId: user.branchId,
      name: user.name,
    },
    env.JWT_SECRET,
    options
  );
}
