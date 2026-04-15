import type { Vehicle as VehicleRow } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export function toApiVehicle(v: VehicleRow) {
  return {
    id: v.id,
    customerId: v.customerId,
    customerName: v.customerName,
    registrationNumber: v.registrationNumber,
    make: v.make,
    model: v.model,
    segment: v.segment,
    variant: v.variant ?? undefined,
    fuelType: v.fuelType,
    color: v.color,
    year: v.year,
    notes: v.notes ?? undefined,
    previousOwners: (v.previousOwners as VehicleRow["previousOwners"]) ?? undefined,
  };
}

export async function listVehiclesApi() {
  const rows = await prisma.vehicle.findMany({ orderBy: { id: "asc" } });
  return rows.map(toApiVehicle);
}

export async function createVehicleApi(data: {
  id: string;
  customerId: string;
  customerName: string;
  registrationNumber: string;
  make: string;
  model: string;
  segment: VehicleRow["segment"];
  variant?: string | null;
  fuelType: VehicleRow["fuelType"];
  color: string;
  year: number;
  notes?: string | null;
  previousOwners?: unknown;
}) {
  const row = await prisma.vehicle.create({
    data: {
      id: data.id,
      customerId: data.customerId,
      customerName: data.customerName,
      registrationNumber: data.registrationNumber,
      make: data.make,
      model: data.model,
      segment: data.segment,
      variant: data.variant ?? null,
      fuelType: data.fuelType,
      color: data.color,
      year: data.year,
      notes: data.notes ?? null,
      previousOwners: data.previousOwners ? (data.previousOwners as object) : undefined,
    },
  });
  return toApiVehicle(row);
}

export async function updateVehicleApi(
  id: string,
  patch: Partial<{
    customerId: string;
    customerName: string;
    registrationNumber: string;
    make: string;
    model: string;
    segment: VehicleRow["segment"];
    variant: string | null;
    fuelType: VehicleRow["fuelType"];
    color: string;
    year: number;
    notes: string | null;
    previousOwners: unknown;
  }>
): Promise<ReturnType<typeof toApiVehicle> | null> {
  try {
    const data: Record<string, unknown> = { ...patch };
    if (patch.previousOwners !== undefined) {
      data.previousOwners = patch.previousOwners ? (patch.previousOwners as object) : null;
    }
    const row = await prisma.vehicle.update({
      where: { id },
      data: data as Parameters<typeof prisma.vehicle.update>[0]["data"],
    });
    return toApiVehicle(row);
  } catch {
    return null;
  }
}

export async function deleteVehicleApi(id: string): Promise<boolean> {
  try {
    await prisma.vehicle.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

type VehicleUpsertInput = {
  id: string;
  customerId: string;
  customerName: string;
  registrationNumber: string;
  make: string;
  model: string;
  segment: VehicleRow["segment"];
  variant?: string | null;
  fuelType: VehicleRow["fuelType"];
  color: string;
  year: number;
  notes?: string | null;
  previousOwners?: unknown;
};

/** Replace all vehicles with the given list (demo/local-first sync). */
export async function replaceAllVehiclesApi(items: VehicleUpsertInput[]): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.vehicle.deleteMany();
    for (const data of items) {
      await tx.vehicle.create({
        data: {
          id: data.id,
          customerId: data.customerId,
          customerName: data.customerName,
          registrationNumber: data.registrationNumber,
          make: data.make,
          model: data.model,
          segment: data.segment,
          variant: data.variant ?? null,
          fuelType: data.fuelType,
          color: data.color,
          year: data.year,
          notes: data.notes ?? null,
          previousOwners: data.previousOwners ? (data.previousOwners as object) : undefined,
        },
      });
    }
  });
}
