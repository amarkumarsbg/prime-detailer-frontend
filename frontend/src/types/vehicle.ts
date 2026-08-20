export type VehicleSegment =
  | "HATCHBACK"
  | "SEDAN"
  | "SUV"
  | "LUXURY"
  | "MUV"
  | "COMPACT_SUV"
  | "BIKE";

export type FuelType = "PETROL" | "DIESEL" | "CNG" | "ELECTRIC" | "HYBRID";

export interface Vehicle {
  id: string;
  customerId: string;
  customerName: string;
  registrationNumber: string;
  make: string;
  model: string;
  segment: VehicleSegment;
  variant?: string;
  fuelType: FuelType;
  color: string;
  year: number;
  notes?: string;
  odometer?: number;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  insuranceDueDate?: string;
  /** Outgoing owners in chronological order (matches ownership_transfers from_customer chain). */
  previousOwners?: {
    customerId: string;
    customerName: string;
    transferDate: string;
    reason?: string;
  }[];
}
