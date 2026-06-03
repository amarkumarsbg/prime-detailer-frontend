import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient, type Prisma } from "@prisma/client";
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
  "serviceCategories",
  "notifications",
  "pickupDropRequests",
] as const;

const SINGLETON_COLLECTIONS = [
  "dashboardStats",
  "expenseMeta",
  "cashBank",
  "payroll",
  "membership",
  "appSettings",
  "referralProgram",
  "balanceSheetManual",
  "highEndServices",
  "reportSchedules",
  "vehicleCatalog",
] as const;
const SINGLETON_ENTITY_ID = "default";

const prisma = new PrismaClient();

/**
 * OTP login sends 10 digits; API matches `digitsOnly(user.phone).endsWith(ten)`.
 * Accept 10-digit India mobile or full international digits.
 */
function normalizeSuperAdminPhone(raw: string | undefined): string {
  const digits = (raw ?? "").trim().replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length >= 11) return `+${digits}`;
  return "+919999999999";
}

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

  await prisma.party.upsert({
    where: { id: "c:cust-hitech" },
    create: {
      id: "c:cust-hitech",
      kind: "CUSTOMER",
      name: "HI TECH CAR SPA & DETAILING",
      mobile: "+919876543299",
      email: "hitech@example.test",
      gstin: "09AABCU9603R1ZM",
      pan: "AABCU9603R",
      billingAddress: "Sector 63, Noida, Uttar Pradesh",
      shippingAddress: "Sector 63, Noida, Uttar Pradesh",
      customerId: "cust-hitech",
    },
    update: {
      name: "HI TECH CAR SPA & DETAILING",
      gstin: "09AABCU9603R1ZM",
      pan: "AABCU9603R",
    },
  });

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

  const allowedBranchIds = branches.map((b) => b.id);
  const fallbackBranchId = allowedBranchIds[0] ?? "br-main";

  const superEmail = (process.env.SUPER_ADMIN_EMAIL ?? "superadmin@company.com").trim().toLowerCase();
  const superPassword = process.env.SUPER_ADMIN_PASSWORD ?? "ChangeMe!SuperAdmin1";
  const superBranchRaw = process.env.SUPER_ADMIN_BRANCH_ID?.trim();
  const superBranchId =
    superBranchRaw && allowedBranchIds.includes(superBranchRaw) ? superBranchRaw : fallbackBranchId;
  const superHash = await bcrypt.hash(superPassword, 10);
  const superPhone = normalizeSuperAdminPhone(process.env.SUPER_ADMIN_PHONE);

  const emailConflict = await prisma.user.findFirst({
    where: { email: superEmail, NOT: { id: "usr-admin" } },
    select: { id: true },
  });
  if (emailConflict) {
    const freedEmail = `${emailConflict.id}-archived-${Date.now()}@seed.local`;
    await prisma.user.update({
      where: { id: emailConflict.id },
      data: { email: freedEmail },
    });
    console.warn(
      `[seed] Email "${superEmail}" was already used by ${emailConflict.id}; moved that account to ${freedEmail} so bootstrap Super Admin can use it.`
    );
  }

  const bootstrapNow = new Date();

  await prisma.user.upsert({
    where: { id: "usr-admin" },
    create: {
      id: "usr-admin",
      name: "Super Admin",
      email: superEmail,
      phone: superPhone,
      role: "SUPER_ADMIN",
      branchId: superBranchId,
      passwordHash: superHash,
      mustChangePassword: false,
      isActive: true,
      emailVerified: true,
      attendancePin: "1000",
      totalJobsCompleted: 120,
      totalIncentiveEarned: 45000,
      passwordUpdatedAt: bootstrapNow,
    } as Prisma.UserUncheckedCreateInput,
    update: {
      name: "Super Admin",
      email: superEmail,
      phone: superPhone,
      branchId: superBranchId,
      passwordHash: superHash,
      role: "SUPER_ADMIN",
      mustChangePassword: false,
      isActive: true,
      passwordUpdatedAt: bootstrapNow,
    } as Prisma.UserUncheckedUpdateInput,
  });

  if (allowedBranchIds.length > 0) {
    await prisma.user.updateMany({
      where: { branchId: { notIn: allowedBranchIds } },
      data: { branchId: fallbackBranchId },
    });
  }
  await prisma.branch.deleteMany({
    where: { id: { notIn: allowedBranchIds } },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
