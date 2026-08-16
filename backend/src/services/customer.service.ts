import type { Customer as CustomerRow } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { randomBytes } from "node:crypto";

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

export function toApiCustomer(row: CustomerRow) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    referralCode: row.referralCode,
    referredBy: row.referredBy ?? undefined,
    totalVisits: row.totalVisits,
    rewardPoints: row.rewardPoints,
    walletBalance: row.walletBalance,
    lastVisitDate: row.lastVisitDate ?? undefined,
    isInactive: row.isInactive || undefined,
    emailVerified: row.emailVerified || undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listCustomers(opts?: { customerIds?: Set<string> | null }) {
  if (opts?.customerIds && opts.customerIds.size === 0) {
    return [];
  }
  const rows = await prisma.customer.findMany({
    where:
      opts?.customerIds && opts.customerIds.size > 0
        ? { id: { in: [...opts.customerIds] } }
        : undefined,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toApiCustomer);
}

export async function getCustomerById(id: string) {
  const row = await prisma.customer.findUnique({ where: { id } });
  return row ? toApiCustomer(row) : null;
}

export async function createCustomer(data: {
  name: string;
  phone: string;
  email: string;
  address: string;
  referralCode: string;
  referredBy?: string;
  totalVisits?: number;
  rewardPoints?: number;
  walletBalance?: number;
  lastVisitDate?: string;
  isInactive?: boolean;
  emailVerified?: boolean;
}) {
  const norm = normalizePhone(data.phone);
  if (norm.length === 10) {
    const existing = await prisma.customer.findMany();
    const clash = existing.find((c) => normalizePhone(c.phone) === norm);
    if (clash) throw new Error("Phone already in use");
  }

  const id = `cust-${randomBytes(4).toString("hex")}`;
  const createdAt = new Date();
  const row = await prisma.customer.create({
    data: {
      id,
      name: data.name.trim(),
      phone: data.phone.trim(),
      email: data.email.trim(),
      address: data.address.trim(),
      referralCode: data.referralCode.trim(),
      referredBy: data.referredBy?.trim() || null,
      totalVisits: data.totalVisits ?? 0,
      rewardPoints: data.rewardPoints ?? 0,
      walletBalance: data.walletBalance ?? 0,
      lastVisitDate: data.lastVisitDate?.trim() || null,
      isInactive: data.isInactive ?? false,
      emailVerified: data.emailVerified ?? false,
      createdAt,
    },
  });
  return toApiCustomer(row);
}

export async function updateCustomer(
  id: string,
  data: Partial<{
    name: string;
    phone: string;
    email: string;
    address: string;
    referralCode: string;
    referredBy: string | null;
    totalVisits: number;
    rewardPoints: number;
    walletBalance: number;
    lastVisitDate: string | null;
    isInactive: boolean;
    emailVerified: boolean;
  }>
) {
  if (data.phone !== undefined) {
    const norm = normalizePhone(data.phone);
    if (norm.length === 10) {
      const others = await prisma.customer.findMany({ where: { NOT: { id } } });
      const clash = others.find((c) => normalizePhone(c.phone) === norm);
      if (clash) throw new Error("Phone already in use");
    }
  }

  const current = await prisma.customer.findUnique({ where: { id } });
  if (!current) return null;

  const row = await prisma.customer.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.phone !== undefined && { phone: data.phone.trim() }),
      ...(data.email !== undefined && { email: data.email.trim() }),
      ...(data.address !== undefined && { address: data.address.trim() }),
      ...(data.referralCode !== undefined && { referralCode: data.referralCode.trim() }),
      ...(data.referredBy !== undefined && {
        referredBy: data.referredBy === null ? null : data.referredBy.trim(),
      }),
      ...(data.totalVisits !== undefined && { totalVisits: data.totalVisits }),
      ...(data.rewardPoints !== undefined && { rewardPoints: data.rewardPoints }),
      ...(data.walletBalance !== undefined && { walletBalance: data.walletBalance }),
      ...(data.lastVisitDate !== undefined && { lastVisitDate: data.lastVisitDate }),
      ...(data.isInactive !== undefined && { isInactive: data.isInactive }),
      ...(data.emailVerified !== undefined && { emailVerified: data.emailVerified }),
    },
  });
  return toApiCustomer(row);
}

export async function deleteCustomer(id: string) {
  await prisma.vehicle.deleteMany({ where: { customerId: id } });
  try {
    await prisma.customer.delete({ where: { id } });
  } catch {
    return false;
  }
  return true;
}

export async function adjustWallet(
  customerId: string,
  amount: number,
  type: "CREDIT" | "DEBIT",
  reason: string
) {
  if (amount <= 0 || !Number.isFinite(amount)) throw new Error("Invalid amount");

  return await prisma.$transaction(async (tx) => {
    const current = await tx.customer.findUnique({ where: { id: customerId } });
    if (!current) return null;

    let newBalance = current.walletBalance;
    if (type === "CREDIT") {
      newBalance = Math.round((newBalance + amount) * 100) / 100;
    } else {
      newBalance = Math.round((newBalance - amount) * 100) / 100;
      if (newBalance < 0) {
        throw new Error("Wallet balance cannot be negative");
      }
    }

    // Update customer balance
    const updatedCustomer = await tx.customer.update({
      where: { id: customerId },
      data: { walletBalance: newBalance },
    });

    // Create wallet transaction record
    const txId = `wtx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const transaction = {
      id: txId,
      customerId,
      customerName: current.name,
      type,
      amount,
      source: "ADMIN_CREDIT" as const,
      description: reason,
      balanceAfter: newBalance,
      createdAt: new Date().toISOString(),
    };

    // Save transaction in AppJsonRow
    await tx.appJsonRow.create({
      data: {
        collection: "walletTransactions",
        entityId: txId,
        payload: transaction as any,
      },
    });

    return toApiCustomer(updatedCustomer);
  });
}

export async function creditWallet(customerId: string, amount: number) {
  return adjustWallet(customerId, amount, "CREDIT", "Referral Reward");
}

function generateReferralCode(): string {
  return `REF-${randomBytes(2).toString("hex").toUpperCase()}`;
}

export type BulkCustomerInput = {
  name: string;
  phone: string;
  email?: string;
  address?: string;
};

export type BulkCustomerSkipped = {
  index: number;
  name: string;
  phone: string;
  reason: "DUPLICATE" | "INVALID" | "DUPLICATE_IN_BATCH";
  message: string;
};

/**
 * Creates many customers in one pass. Skips rows that clash on last-10 phone digits
 * (existing DB or earlier rows in this batch). Does not update existing customers.
 */
export async function createCustomersBulk(inputs: BulkCustomerInput[]): Promise<{
  created: ReturnType<typeof toApiCustomer>[];
  skipped: BulkCustomerSkipped[];
}> {
  const existing = await prisma.customer.findMany({ select: { phone: true } });
  const usedPhones = new Set(
    existing
      .map((c) => normalizePhone(c.phone))
      .filter((p) => p.length === 10)
  );

  const skipped: BulkCustomerSkipped[] = [];
  const toCreate: Array<{
    id: string;
    name: string;
    phone: string;
    email: string;
    address: string;
    referralCode: string;
    createdAt: Date;
  }> = [];

  for (let index = 0; index < inputs.length; index++) {
    const raw = inputs[index]!;
    const name = (raw.name ?? "").trim();
    const phone = (raw.phone ?? "").trim();
    const email = (raw.email ?? "").trim();
    const address = (raw.address ?? "").trim();
    const norm = normalizePhone(phone);

    if (!name || norm.length !== 10) {
      skipped.push({
        index,
        name,
        phone,
        reason: "INVALID",
        message: !name ? "Name is required" : "Phone must contain 10 digits",
      });
      continue;
    }

    if (usedPhones.has(norm)) {
      const alreadyInBatch = toCreate.some((c) => normalizePhone(c.phone) === norm);
      skipped.push({
        index,
        name,
        phone,
        reason: alreadyInBatch ? "DUPLICATE_IN_BATCH" : "DUPLICATE",
        message: alreadyInBatch
          ? "Duplicate phone in this import batch"
          : "Phone already in use",
      });
      continue;
    }

    usedPhones.add(norm);
    toCreate.push({
      id: `cust-${randomBytes(4).toString("hex")}`,
      name,
      phone,
      email,
      address,
      referralCode: generateReferralCode(),
      createdAt: new Date(),
    });
  }

  if (toCreate.length === 0) {
    return { created: [], skipped };
  }

  await prisma.customer.createMany({ data: toCreate });
  const ids = toCreate.map((c) => c.id);
  const rows = await prisma.customer.findMany({
    where: { id: { in: ids } },
    orderBy: { createdAt: "desc" },
  });

  return { created: rows.map(toApiCustomer), skipped };
}
