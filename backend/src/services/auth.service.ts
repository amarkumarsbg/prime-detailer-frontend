import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import type { UserRole } from "@prisma/client";

export async function authenticateUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user?.isActive) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  return user;
}

export function signAuthToken(user: {
  id: string;
  email: string;
  role: UserRole;
  branchId: string;
  name: string;
  mustChangePassword?: boolean;
  permissions?: string[];
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
      mustChangePassword: user.mustChangePassword === true,
      permissions: user.permissions || [],
    },
    env.JWT_SECRET,
    options
  );
}
