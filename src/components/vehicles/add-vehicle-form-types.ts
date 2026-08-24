import type { FuelType, VehicleSegment } from "@/types";

export const ADD_VEHICLE_FUEL_TYPES: FuelType[] = [
  "PETROL",
  "DIESEL",
  "CNG",
  "ELECTRIC",
  "HYBRID",
];

export const ADD_VEHICLE_SEGMENTS: VehicleSegment[] = [
  "HATCHBACK",
  "SEDAN",
  "SUV",
  "LUXURY",
  "MUV",
  "COMPACT_SUV",
  "BIKE",
];

export interface AddVehicleFormData {
  make: string;
  model: string;
  variant?: string;
  fuelType: FuelType;
  segment: VehicleSegment;
  color: string;
  year: number;
  customerId: string;
  notes?: string;
  odometer?: number | string;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  insuranceDueDate?: string;
  identifierType: "REG" | "VIN";
  identifierValue: string;
}

export const ADD_VEHICLE_FORM_DEFAULTS: AddVehicleFormData = {
  make: "",
  model: "",
  variant: "",
  fuelType: "PETROL",
  segment: "HATCHBACK",
  color: "",
  year: new Date().getFullYear(),
  customerId: "",
  notes: "",
  odometer: "",
  insuranceProvider: "",
  insurancePolicyNumber: "",
  insuranceDueDate: "",
  identifierType: "REG",
  identifierValue: "",
};
