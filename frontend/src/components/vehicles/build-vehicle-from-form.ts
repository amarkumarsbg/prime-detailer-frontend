import type { Customer, Vehicle } from "@/types";
import {
  findVehicleByNormalizedReg,
  normalizeRegistrationNumber,
} from "@/lib/vehicle-registration";
import type { AddVehicleFormData } from "./add-vehicle-form-types";

export type BuildVehicleFromFormResult =
  | { ok: true; vehicle: Vehicle }
  | { ok: false; error: string; description?: string };

export function resolveStoredVehicleIdentifier(data: AddVehicleFormData): {
  isVin: boolean;
  regStored: string;
} {
  const isVin = data.identifierType === "VIN";
  const regStored = isVin
    ? data.identifierValue.trim().toUpperCase()
    : normalizeRegistrationNumber(data.identifierValue);
  return { isVin, regStored };
}

export function buildVehicleFromForm(
  data: AddVehicleFormData,
  opts: {
    customers: Customer[];
    vehicles: Vehicle[];
    /** Override when customer is not yet in the customers list */
    customerName?: string;
    vehicleId?: string;
  }
): BuildVehicleFromFormResult {
  const { isVin, regStored } = resolveStoredVehicleIdentifier(data);
  if (!regStored) {
    return { ok: false, error: "Identifier is required" };
  }
  if (!data.customerId.trim()) {
    return { ok: false, error: "Customer is required" };
  }
  if (!data.make.trim() || !data.model.trim()) {
    return { ok: false, error: "Make and model are required" };
  }

  const dup = findVehicleByNormalizedReg(opts.vehicles, regStored);
  if (dup) {
    if (dup.customerId === data.customerId) {
      return {
        ok: false,
        error: "This vehicle identifier is already listed for this customer",
        description: `${dup.registrationNumber} — ${dup.make} ${dup.model}`,
      };
    }
    return {
      ok: false,
      error: "Vehicle identifier already assigned to another customer",
      description: `${dup.registrationNumber} belongs to ${dup.customerName}. Transfer ownership first if the vehicle changed hands.`,
    };
  }

  const customer = opts.customers.find((c) => c.id === data.customerId);
  const odometerRaw =
    data.odometer === "" || data.odometer == null ? undefined : Number(data.odometer);
  const odometer =
    odometerRaw != null && Number.isFinite(odometerRaw) ? odometerRaw : undefined;

  const vehicle: Vehicle = {
    id: opts.vehicleId ?? `veh-${Date.now()}`,
    customerId: data.customerId,
    customerName: opts.customerName?.trim() || customer?.name || "Unknown",
    registrationNumber: regStored,
    make: data.make.trim(),
    model: data.model.trim(),
    variant: data.variant?.trim() || undefined,
    fuelType: data.fuelType,
    segment: data.segment,
    color: data.color?.trim() || "—",
    year: Number(data.year) || new Date().getFullYear(),
    notes: data.notes?.trim() || undefined,
    odometer,
    insuranceProvider: data.insuranceProvider?.trim() || undefined,
    insurancePolicyNumber: data.insurancePolicyNumber?.trim() || undefined,
    insuranceDueDate: data.insuranceDueDate || undefined,
    vinNumber: isVin ? regStored : undefined,
  };

  return { ok: true, vehicle };
}
