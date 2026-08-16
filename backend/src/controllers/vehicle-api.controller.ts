import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  listVehiclesApi,
  createVehicleApi,
  updateVehicleApi,
  deleteVehicleApi,
  replaceAllVehiclesApi,
  createVehiclesBulk,
} from "../services/vehicle-api.service.js";
import { FuelType, VehicleSegment } from "@prisma/client";
import { resolveBranchScope } from "../lib/data-scope.js";

function paramId(req: Request): string {
  const raw = req.params.id;
  return Array.isArray(raw) ? raw[0]! : raw!;
}

const segmentEnum = z.enum([
  "HATCHBACK",
  "SEDAN",
  "SUV",
  "LUXURY",
  "MUV",
  "COMPACT_SUV",
  "BIKE",
]);

const fuelEnum = z.enum(["PETROL", "DIESEL", "CNG", "ELECTRIC", "HYBRID"]);

const vehicleSchema = z.object({
  id: z.string().min(1),
  customerId: z.string().min(1),
  customerName: z.string().min(1),
  registrationNumber: z.string().min(1),
  make: z.string().min(1),
  model: z.string().min(1),
  segment: segmentEnum,
  variant: z.string().nullable().optional(),
  fuelType: fuelEnum,
  color: z.string().min(1),
  year: z.number().int(),
  notes: z.string().nullable().optional(),
  previousOwners: z.array(z.unknown()).nullable().optional(),
});

const patchVehicleSchema = vehicleSchema.partial().omit({ id: true });

const bulkItemSchema = z.object({
  registrationNumber: z.string().min(1),
  customerId: z.string().min(1),
  customerName: z.string().min(1),
  make: z.string().min(1),
  model: z.string().min(1),
  fuelType: fuelEnum.default("PETROL"),
  segment: segmentEnum.default("HATCHBACK"),
  year: z.number().int().optional(),
  color: z.string().optional(),
  variant: z.string().optional(),
  notes: z.string().optional(),
});

const bulkSchema = z.object({
  vehicles: z.array(bulkItemSchema).min(1).max(5000),
});

export async function getVehicles(req: Request, res: Response, next: NextFunction) {
  try {
    // Vehicle rows lack organizationId; return full list for permitted callers.
    // Branch isolation is enforced on collections that reference vehicles.
    if (req.auth) {
      const scope = await resolveBranchScope(req.auth);
      if (!scope) {
        res.json({ data: { vehicles: [] }, error: null });
        return;
      }
    }
    const vehicles = await listVehiclesApi();
    res.json({ data: { vehicles }, error: null });
  } catch (e) {
    next(e);
  }
}

export async function postVehicle(req: Request, res: Response, next: NextFunction) {
  try {
    const body = vehicleSchema.parse(req.body);
    const vehicle = await createVehicleApi({
      ...body,
      segment: body.segment as VehicleSegment,
      fuelType: body.fuelType as FuelType,
    });
    res.status(201).json({ data: { vehicle }, error: null });
  } catch (e) {
    next(e);
  }
}

export async function postVehiclesBulk(req: Request, res: Response, next: NextFunction) {
  try {
    const body = bulkSchema.parse(req.body);
    const yearDefault = new Date().getFullYear();
    const result = await createVehiclesBulk(
      body.vehicles.map((v) => ({
        registrationNumber: v.registrationNumber,
        customerId: v.customerId,
        customerName: v.customerName,
        make: v.make,
        model: v.model,
        fuelType: v.fuelType as FuelType,
        segment: v.segment as VehicleSegment,
        year: v.year ?? yearDefault,
        color: v.color?.trim() ? v.color : "—",
        variant: v.variant,
        notes: v.notes,
      }))
    );
    res.status(201).json({
      data: {
        created: result.created,
        skipped: result.skipped,
        createdCount: result.created.length,
        skippedCount: result.skipped.length,
      },
      error: null,
    });
  } catch (e) {
    next(e);
  }
}

export async function putVehicle(req: Request, res: Response, next: NextFunction) {
  try {
    const id = paramId(req);
    const body = patchVehicleSchema.parse(req.body);
    const vehicle = await updateVehicleApi(id, {
      ...body,
      segment: body.segment as VehicleSegment | undefined,
      fuelType: body.fuelType as FuelType | undefined,
    });
    if (!vehicle) {
      res.status(404).json({ data: null, error: { message: "Vehicle not found" } });
      return;
    }
    res.json({ data: { vehicle }, error: null });
  } catch (e) {
    next(e);
  }
}

export async function removeVehicle(req: Request, res: Response, next: NextFunction) {
  try {
    const ok = await deleteVehicleApi(paramId(req));
    if (!ok) {
      res.status(404).json({ data: null, error: { message: "Vehicle not found" } });
      return;
    }
    res.json({ data: { ok: true }, error: null });
  } catch (e) {
    next(e);
  }
}

const snapshotBodySchema = z.object({
  vehicles: z.array(vehicleSchema),
});

export async function postVehicleSnapshot(req: Request, res: Response, next: NextFunction) {
  try {
    const body = snapshotBodySchema.parse(req.body);
    await replaceAllVehiclesApi(
      body.vehicles.map((v) => ({
        ...v,
        segment: v.segment as VehicleSegment,
        fuelType: v.fuelType as FuelType,
      }))
    );
    res.json({ data: { ok: true }, error: null });
  } catch (e) {
    next(e);
  }
}
