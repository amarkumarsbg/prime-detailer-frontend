import type { FuelType, VehicleSegment } from "@/types";

export type VehicleImportRowStatus =
  | "ready"
  | "invalid"
  | "unmatched_customer"
  | "already_exists"
  | "duplicate_in_file";

export type VehicleImportColumnKey =
  | "registrationNumber"
  | "customerPhone"
  | "customerId"
  | "customerName"
  | "make"
  | "model"
  | "fuelType"
  | "segment"
  | "year"
  | "color"
  | "variant"
  | "notes"
  | "ignore";

export type VehicleImportColumnMapping = {
  header: string;
  index: number;
  mappedTo: VehicleImportColumnKey;
};

export type ParsedVehicleRow = {
  rowNumber: number;
  registrationNumber: string;
  customerPhone: string;
  customerId: string;
  customerName: string;
  make: string;
  model: string;
  fuelType: string;
  segment: string;
  year: string;
  color: string;
  variant: string;
  notes: string;
  raw: Record<string, string>;
  /** True when PDF parser could not confidently extract the row */
  parseUnreliable?: boolean;
};

export type ValidatedVehicleImportRow = ParsedVehicleRow & {
  status: VehicleImportRowStatus;
  message: string;
  regKey: string;
  resolvedCustomerId?: string;
  resolvedCustomerName?: string;
  resolvedFuelType?: FuelType;
  resolvedSegment?: VehicleSegment;
  resolvedYear?: number;
  resolvedColor?: string;
};

export type VehicleImportParseResult = {
  headers: string[];
  rows: string[][];
  mapping: VehicleImportColumnMapping[];
  sourceLabel: string;
};

export type VehicleImportPayloadItem = {
  registrationNumber: string;
  customerId: string;
  customerName: string;
  make: string;
  model: string;
  fuelType: FuelType;
  segment: VehicleSegment;
  year: number;
  color: string;
  variant?: string;
  notes?: string;
};

export const MAX_VEHICLE_IMPORT_ROWS = 5000;
export const MAX_VEHICLE_IMPORT_FILE_BYTES = 5 * 1024 * 1024;
