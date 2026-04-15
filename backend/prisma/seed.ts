import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(join(__dirname, "seed-data.json"), "utf8");

type SeedFile = {
  branches: {
    id: string;
    name: string;
    address: string;
    phone: string;
    isActive: boolean;
    qrCodeId?: string;
    code?: string;
    city?: string;
    state?: string;
    pincode?: string;
    email?: string;
    managerName?: string;
    managerPhone?: string;
  }[];
  staff: {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    branchId: string;
    avatar?: string;
    isActive: boolean;
    emailVerified?: boolean;
    attendancePin?: string;
    totalJobsCompleted?: number;
    totalIncentiveEarned?: number;
    birthday?: string;
    anniversary?: string;
  }[];
  customers: {
    id: string;
    name: string;
    phone: string;
    email: string;
    address: string;
    referralCode: string;
    referredBy?: string;
    totalVisits: number;
    rewardPoints: number;
    walletBalance: number;
    lastVisitDate?: string;
    isInactive?: boolean;
    emailVerified?: boolean;
    createdAt: string;
  }[];
  vehicles: {
    id: string;
    customerId: string;
    customerName: string;
    registrationNumber: string;
    make: string;
    model: string;
    segment: string;
    variant?: string;
    fuelType: string;
    color: string;
    year: number;
    notes?: string;
    previousOwners?: { customerId: string; customerName: string; transferDate: string; reason?: string }[];
  }[];
  collections?: Record<string, unknown>;
};

const file = JSON.parse(raw) as SeedFile;
const { branches, staff, customers, vehicles } = file;
const collections = file.collections ?? {};

const ARRAY_COLLECTIONS = [
  "jobCards",
  "invoices",
  "quotations",
  "appointments",
  "expenses",
  "activityLogs",
  "serviceReminders",
  "walletTransactions",
  "serviceCatalog",
  "parts",
  "stockMovements",
  "productPurchases",
  "followUps",
] as const;

const SINGLETON_COLLECTIONS = ["dashboardStats", "expenseMeta"] as const;
const SINGLETON_ENTITY_ID = "default";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password", 10);

  for (const b of branches) {
    await prisma.branch.upsert({
      where: { id: b.id },
      create: {
        id: b.id,
        name: b.name,
        address: b.address,
        phone: b.phone,
        isActive: b.isActive,
        qrCodeId: b.qrCodeId ?? null,
        code: b.code ?? null,
        city: b.city ?? null,
        state: b.state ?? null,
        pincode: b.pincode ?? null,
        email: b.email ?? null,
        managerName: b.managerName ?? null,
        managerPhone: b.managerPhone ?? null,
      },
      update: {
        name: b.name,
        address: b.address,
        phone: b.phone,
        isActive: b.isActive,
        qrCodeId: b.qrCodeId ?? null,
        code: b.code ?? null,
        city: b.city ?? null,
        state: b.state ?? null,
        pincode: b.pincode ?? null,
        email: b.email ?? null,
        managerName: b.managerName ?? null,
        managerPhone: b.managerPhone ?? null,
      },
    });
  }

  for (const u of staff) {
    await prisma.user.upsert({
      where: { id: u.id },
      create: {
        id: u.id,
        name: u.name,
        email: u.email.toLowerCase(),
        phone: u.phone,
        role: u.role as Parameters<typeof prisma.user.create>[0]["data"]["role"],
        branchId: u.branchId,
        avatar: u.avatar ?? null,
        isActive: u.isActive,
        emailVerified: u.emailVerified ?? false,
        attendancePin: u.attendancePin ?? null,
        totalJobsCompleted: u.totalJobsCompleted ?? null,
        totalIncentiveEarned: u.totalIncentiveEarned ?? null,
        birthday: u.birthday ?? null,
        anniversary: u.anniversary ?? null,
        passwordHash,
      },
      update: {
        name: u.name,
        email: u.email.toLowerCase(),
        phone: u.phone,
        role: u.role as Parameters<typeof prisma.user.update>[0]["data"]["role"],
        branchId: u.branchId,
        avatar: u.avatar ?? null,
        isActive: u.isActive,
        emailVerified: u.emailVerified ?? false,
        attendancePin: u.attendancePin ?? null,
        totalJobsCompleted: u.totalJobsCompleted ?? null,
        totalIncentiveEarned: u.totalIncentiveEarned ?? null,
        birthday: u.birthday ?? null,
        anniversary: u.anniversary ?? null,
        passwordHash,
      },
    });
  }

  for (const c of customers) {
    await prisma.customer.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        referralCode: c.referralCode,
        referredBy: c.referredBy ?? null,
        totalVisits: c.totalVisits,
        rewardPoints: c.rewardPoints,
        walletBalance: c.walletBalance,
        lastVisitDate: c.lastVisitDate ?? null,
        isInactive: c.isInactive ?? false,
        emailVerified: c.emailVerified ?? false,
        createdAt: new Date(c.createdAt),
      },
      update: {
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        referralCode: c.referralCode,
        referredBy: c.referredBy ?? null,
        totalVisits: c.totalVisits,
        rewardPoints: c.rewardPoints,
        walletBalance: c.walletBalance,
        lastVisitDate: c.lastVisitDate ?? null,
        isInactive: c.isInactive ?? false,
        emailVerified: c.emailVerified ?? false,
        createdAt: new Date(c.createdAt),
      },
    });
  }

  for (const v of vehicles) {
    await prisma.vehicle.upsert({
      where: { id: v.id },
      create: {
        id: v.id,
        customerId: v.customerId,
        customerName: v.customerName,
        registrationNumber: v.registrationNumber,
        make: v.make,
        model: v.model,
        segment: v.segment as Parameters<typeof prisma.vehicle.create>[0]["data"]["segment"],
        variant: v.variant ?? null,
        fuelType: v.fuelType as Parameters<typeof prisma.vehicle.create>[0]["data"]["fuelType"],
        color: v.color,
        year: v.year,
        notes: v.notes ?? null,
        previousOwners: v.previousOwners ? (v.previousOwners as object) : undefined,
      },
      update: {
        customerId: v.customerId,
        customerName: v.customerName,
        registrationNumber: v.registrationNumber,
        make: v.make,
        model: v.model,
        segment: v.segment as Parameters<typeof prisma.vehicle.update>[0]["data"]["segment"],
        variant: v.variant ?? null,
        fuelType: v.fuelType as Parameters<typeof prisma.vehicle.update>[0]["data"]["fuelType"],
        color: v.color,
        year: v.year,
        notes: v.notes ?? null,
        previousOwners: v.previousOwners ? (v.previousOwners as object) : undefined,
      },
    });
  }

  for (const name of ARRAY_COLLECTIONS) {
    const arr = collections[name];
    if (!Array.isArray(arr)) continue;
    await prisma.appJsonRow.deleteMany({ where: { collection: name } });
    for (const item of arr as { id: string }[]) {
      if (!item?.id) continue;
      await prisma.appJsonRow.create({
        data: {
          collection: name,
          entityId: item.id,
          payload: item as object,
        },
      });
    }
  }

  for (const name of SINGLETON_COLLECTIONS) {
    const payload = collections[name];
    if (payload === undefined || payload === null) continue;
    await prisma.appJsonRow.upsert({
      where: {
        collection_entityId: { collection: name, entityId: SINGLETON_ENTITY_ID },
      },
      create: {
        collection: name,
        entityId: SINGLETON_ENTITY_ID,
        payload: payload as object,
      },
      update: { payload: payload as object },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
