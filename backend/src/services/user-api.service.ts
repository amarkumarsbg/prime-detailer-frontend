import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import type { User as PrismaUser } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

function pickChar(set: string): string {
  return set[randomInt(0, set.length)]!;
}

/** Meets application password policy (mixed case, digit, symbol, length ≥ 8). */
export function generateTemporaryPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const special = "#@$%&*!?+-";
  const all = upper + lower + digits + special;
  const targetLen = 10;
  const chars: string[] = [
    pickChar(upper),
    pickChar(lower),
    pickChar(digits),
    pickChar(special),
  ];
  while (chars.length < targetLen) chars.push(pickChar(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    const a = chars[i]!;
    const b = chars[j]!;
    chars[i] = b;
    chars[j] = a;
  }
  return chars.join("");
}

export function toApiUser(u: PrismaUser) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    branchId: u.branchId,
    avatar: u.avatar ?? undefined,
    isActive: u.isActive,
    emailVerified: u.emailVerified || undefined,
    attendancePin: u.attendancePin ?? undefined,
    totalJobsCompleted: u.totalJobsCompleted ?? undefined,
    totalIncentiveEarned: u.totalIncentiveEarned ?? undefined,
    birthday: u.birthday ?? undefined,
    anniversary: u.anniversary ?? undefined,
    mustChangePassword: u.mustChangePassword === true ? true : undefined,
    passwordCreatedBy: u.passwordCreatedBy ?? undefined,
    passwordUpdatedAt: u.passwordUpdatedAt?.toISOString(),
  };
}

export async function listUsersApi() {
  const rows = await prisma.user.findMany({ orderBy: { id: "asc" } });
  return rows.map(toApiUser);
}

export async function createUserApi(input: {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: PrismaUser["role"];
  branchId: string;
  password?: string;
  avatar?: string | null;
  isActive?: boolean;
  emailVerified?: boolean;
  attendancePin?: string | null;
  totalJobsCompleted?: number | null;
  totalIncentiveEarned?: number | null;
  birthday?: string | null;
  anniversary?: string | null;
  /** Creator `User.id` when provisioned by an authenticated admin. */
  createdById?: string | null;
}): Promise<{ user: ReturnType<typeof toApiUser>; temporaryPassword?: string }> {
  const useExplicitPassword = input.password !== undefined && input.password.trim() !== "";
  const plainPassword = useExplicitPassword ? input.password!.trim() : generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(plainPassword, 10);
  const now = new Date();
  const row = await prisma.user.create({
    data: {
      id: input.id,
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone,
      role: input.role,
      branchId: input.branchId,
      passwordHash,
      mustChangePassword: !useExplicitPassword,
      passwordCreatedBy: input.createdById ?? null,
      passwordUpdatedAt: now,
      avatar: input.avatar ?? null,
      isActive: input.isActive ?? true,
      emailVerified: input.emailVerified ?? false,
      attendancePin: input.attendancePin ?? null,
      totalJobsCompleted: input.totalJobsCompleted ?? null,
      totalIncentiveEarned: input.totalIncentiveEarned ?? null,
      birthday: input.birthday ?? null,
      anniversary: input.anniversary ?? null,
    },
  });
  return {
    user: toApiUser(row),
    ...(!useExplicitPassword ? { temporaryPassword: plainPassword } : {}),
  };
}

export async function updateUserApi(
  id: string,
  patch: Partial<{
    name: string;
    email: string;
    phone: string;
    role: PrismaUser["role"];
    branchId: string;
    avatar: string | null;
    isActive: boolean;
    emailVerified: boolean;
    attendancePin: string | null;
    totalJobsCompleted: number | null;
    totalIncentiveEarned: number | null;
    birthday: string | null;
    anniversary: string | null;
  }>
): Promise<ReturnType<typeof toApiUser> | null> {
  try {
    const data = { ...patch };
    if (patch.email !== undefined) data.email = patch.email.toLowerCase();
    const row = await prisma.user.update({ where: { id }, data });
    return toApiUser(row);
  } catch {
    return null;
  }
}
