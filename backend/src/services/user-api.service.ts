import bcrypt from "bcryptjs";
import type { User as PrismaUser } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

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
}) {
  const passwordHash = await bcrypt.hash(input.password ?? "password", 10);
  const row = await prisma.user.create({
    data: {
      id: input.id,
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone,
      role: input.role,
      branchId: input.branchId,
      passwordHash,
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
  return toApiUser(row);
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
