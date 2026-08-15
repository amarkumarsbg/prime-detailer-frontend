#!/usr/bin/env tsx
/**
 * Ensure YOUR SaaS vendor login exists (PLATFORM_OWNER).
 * Safe for production — does not wipe customer data or re-seed demos.
 *
 * Env (set on Render):
 *   PLATFORM_OWNER_EMAIL=you@yourcompany.com
 *   PLATFORM_OWNER_PASSWORD=a-strong-secret
 *   PLATFORM_OWNER_PHONE=+91…          (optional)
 *   PLATFORM_OWNER_NAME=Platform Owner (optional)
 *
 * Local defaults (dev only):
 *   platform@prime.local / ChangeMe!PlatformOwner1
 *
 * Usage:
 *   npx tsx scripts/ensure-platform-owner.ts
 *   npm run saas:ensure-platform-owner
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";

const PLATFORM_USER_ID = "usr-platform";

function normalizePhone(raw: string | undefined): string {
  const digits = (raw ?? "").trim().replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length >= 11) return `+${digits}`;
  return "+919999999998";
}

async function main() {
  const email = (process.env.PLATFORM_OWNER_EMAIL ?? "platform@prime.local").trim().toLowerCase();
  const password = process.env.PLATFORM_OWNER_PASSWORD ?? "ChangeMe!PlatformOwner1";
  const name = (process.env.PLATFORM_OWNER_NAME ?? "Platform Owner").trim() || "Platform Owner";
  const phone = normalizePhone(process.env.PLATFORM_OWNER_PHONE);

  if (!email.includes("@")) {
    throw new Error("PLATFORM_OWNER_EMAIL must be a valid email");
  }
  if (password.length < 8) {
    throw new Error("PLATFORM_OWNER_PASSWORD must be at least 8 characters");
  }

  const org =
    (await prisma.organization.findUnique({ where: { id: "org-default" } })) ??
    (await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } }));
  const branch =
    (await prisma.branch.findFirst({
      where: org ? { organizationId: org.id } : undefined,
      orderBy: { id: "asc" },
    })) ?? (await prisma.branch.findFirst({ orderBy: { id: "asc" } }));

  if (!org || !branch) {
    throw new Error(
      "Organization or Branch missing. Apply SaaS migrations / create org+branch before ensuring platform owner."
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();

  /** If email is taken by a different user id, free it (rare on prod). */
  const emailOwner = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });
  if (emailOwner && emailOwner.id !== PLATFORM_USER_ID) {
    if (emailOwner.role === UserRole.PLATFORM_OWNER) {
      await prisma.user.update({
        where: { id: emailOwner.id },
        data: {
          name,
          phone,
          passwordHash,
          role: UserRole.PLATFORM_OWNER,
          isActive: true,
          emailVerified: true,
          mustChangePassword: false,
          organizationId: org.id,
          branchId: branch.id,
          passwordUpdatedAt: now,
        },
      });
      console.log(`Updated existing PLATFORM_OWNER ${emailOwner.id} <${email}>`);
      return;
    }
    throw new Error(
      `Email ${email} is already used by non-platform user ${emailOwner.id} (${emailOwner.role}). Pick another PLATFORM_OWNER_EMAIL.`
    );
  }

  await prisma.user.upsert({
    where: { id: PLATFORM_USER_ID },
    create: {
      id: PLATFORM_USER_ID,
      name,
      email,
      phone,
      role: UserRole.PLATFORM_OWNER,
      branchId: branch.id,
      organizationId: org.id,
      passwordHash,
      mustChangePassword: false,
      isActive: true,
      emailVerified: true,
      permissions: [],
      passwordUpdatedAt: now,
    },
    update: {
      name,
      email,
      phone,
      role: UserRole.PLATFORM_OWNER,
      branchId: branch.id,
      organizationId: org.id,
      passwordHash,
      mustChangePassword: false,
      isActive: true,
      emailVerified: true,
      passwordUpdatedAt: now,
    },
  });

  console.log(`PLATFORM_OWNER ready: ${email}`);
  console.log(`Login at your app /login → lands on /saas-admin/organizations`);
  console.log(`Customers use SUPER_ADMIN for their studio; they cannot access saas-admin.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
