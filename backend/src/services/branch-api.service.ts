import type { Branch } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export function toApiBranch(b: Branch) {
  return {
    id: b.id,
    name: b.name,
    address: b.address,
    phone: b.phone,
    isActive: b.isActive,
    qrCodeId: b.qrCodeId ?? undefined,
    code: b.code ?? undefined,
    city: b.city ?? undefined,
    state: b.state ?? undefined,
    pincode: b.pincode ?? undefined,
    email: b.email ?? undefined,
    managerName: b.managerName ?? undefined,
    managerPhone: b.managerPhone ?? undefined,
  };
}

export async function listBranchesApi() {
  const rows = await prisma.branch.findMany({ orderBy: { id: "asc" } });
  return rows.map(toApiBranch);
}

export async function upsertBranchApi(data: {
  id: string;
  name: string;
  address: string;
  phone: string;
  isActive?: boolean;
  qrCodeId?: string | null;
  code?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  email?: string | null;
  managerName?: string | null;
  managerPhone?: string | null;
}) {
  const row = await prisma.branch.upsert({
    where: { id: data.id },
    create: {
      id: data.id,
      name: data.name,
      address: data.address,
      phone: data.phone,
      isActive: data.isActive ?? true,
      qrCodeId: data.qrCodeId ?? null,
      code: data.code ?? null,
      city: data.city ?? null,
      state: data.state ?? null,
      pincode: data.pincode ?? null,
      email: data.email ?? null,
      managerName: data.managerName ?? null,
      managerPhone: data.managerPhone ?? null,
    },
    update: {
      name: data.name,
      address: data.address,
      phone: data.phone,
      isActive: data.isActive ?? true,
      qrCodeId: data.qrCodeId ?? null,
      code: data.code ?? null,
      city: data.city ?? null,
      state: data.state ?? null,
      pincode: data.pincode ?? null,
      email: data.email ?? null,
      managerName: data.managerName ?? null,
      managerPhone: data.managerPhone ?? null,
    },
  });
  return toApiBranch(row);
}

export async function patchBranchApi(
  id: string,
  patch: Partial<Omit<Branch, "id">>
): Promise<ReturnType<typeof toApiBranch> | null> {
  try {
    const row = await prisma.branch.update({
      where: { id },
      data: patch,
    });
    return toApiBranch(row);
  } catch {
    return null;
  }
}
