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
  | { ok: false; code: "EMAIL_TAKEN" | "NO_BRANCH" };

/** Demo self-signup: assigns first active branch and ADMIN role. */
export async function registerUser(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
}): Promise<RegisterResult> {
  const emailNorm = input.email.trim().toLowerCase();
  const taken = await prisma.user.findUnique({ where: { email: emailNorm } });
  if (taken) return { ok: false, code: "EMAIL_TAKEN" };

  const branch = await prisma.branch.findFirst({
    where: { isActive: true },
    orderBy: { id: "asc" },
  });
  if (!branch) return { ok: false, code: "NO_BRANCH" };

  const passwordHash = await bcrypt.hash(input.password, 10);
  const id = `usr-${randomUUID().replace(/-/g, "").slice(0, 12)}`;

  const user = await prisma.user.create({
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
