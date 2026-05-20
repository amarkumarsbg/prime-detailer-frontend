import type { Branch } from "@prisma/client";
import { SINGLETON_ENTITY_ID } from "../constants/json-collections.js";
import { prisma } from "../lib/prisma.js";

export type BranchDeletionBlocker = {
  kind: "employees" | "job_cards" | "expenses" | "pickup_drop" | "payroll" | "last_branch" | "not_found";
  count: number;
  message: string;
};

async function countJsonCollectionBranchRefs(collection: string, branchId: string): Promise<number> {
  const rows = await prisma.appJsonRow.findMany({
    where: { collection },
    select: { payload: true },
  });
  return rows.filter((row) => {
    const payload = row.payload as Record<string, unknown> | null;
    return payload?.branchId === branchId;
  }).length;
}

async function countPayrollBranchRefs(branchId: string): Promise<number> {
  const row = await prisma.appJsonRow.findUnique({
    where: { collection_entityId: { collection: "payroll", entityId: SINGLETON_ENTITY_ID } },
    select: { payload: true },
  });
  if (!row) return 0;
  const payload = row.payload as { payrollRecords?: { branchId?: string }[] };
  return (payload.payrollRecords ?? []).filter((r) => r.branchId === branchId).length;
}

export async function getBranchDeletionBlockers(branchId: string): Promise<BranchDeletionBlocker[]> {
  const blockers: BranchDeletionBlocker[] = [];

  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) {
    return [{ kind: "not_found", count: 0, message: "Site not found." }];
  }

  const totalBranches = await prisma.branch.count();
  if (totalBranches <= 1) {
    blockers.push({
      kind: "last_branch",
      count: 1,
      message: "Cannot delete the only remaining site.",
    });
  }

  const employeeCount = await prisma.user.count({ where: { branchId } });
  if (employeeCount > 0) {
    blockers.push({
      kind: "employees",
      count: employeeCount,
      message: `${employeeCount} employee${employeeCount === 1 ? "" : "s"} assigned to this site`,
    });
  }

  const jobCardCount = await countJsonCollectionBranchRefs("jobCards", branchId);
  if (jobCardCount > 0) {
    blockers.push({
      kind: "job_cards",
      count: jobCardCount,
      message: `${jobCardCount} job card${jobCardCount === 1 ? "" : "s"} linked to this site`,
    });
  }

  const expenseCount = await countJsonCollectionBranchRefs("expenses", branchId);
  if (expenseCount > 0) {
    blockers.push({
      kind: "expenses",
      count: expenseCount,
      message: `${expenseCount} expense${expenseCount === 1 ? "" : "s"} linked to this site`,
    });
  }

  const pickupCount = await countJsonCollectionBranchRefs("pickupDropRequests", branchId);
  if (pickupCount > 0) {
    blockers.push({
      kind: "pickup_drop",
      count: pickupCount,
      message: `${pickupCount} pickup/drop request${pickupCount === 1 ? "" : "s"} linked to this site`,
    });
  }

  const payrollCount = await countPayrollBranchRefs(branchId);
  if (payrollCount > 0) {
    blockers.push({
      kind: "payroll",
      count: payrollCount,
      message: `${payrollCount} payroll record${payrollCount === 1 ? "" : "s"} linked to this site`,
    });
  }

  return blockers;
}

export async function deleteBranchApi(branchId: string): Promise<boolean> {
  const blockers = await getBranchDeletionBlockers(branchId);
  if (blockers.length > 0) return false;
  await prisma.branch.delete({ where: { id: branchId } });
  return true;
}

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
