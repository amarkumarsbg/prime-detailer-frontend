import { describe, expect, it } from "vitest";
import { buildVehicleFromForm } from "./build-vehicle-from-form";
import { ADD_VEHICLE_FORM_DEFAULTS } from "./add-vehicle-form-types";
import type { Customer, Vehicle } from "@/types";

const customer: Customer = {
  id: "cust-1",
  name: "Ada",
  phone: "9876543210",
  email: "",
  address: "",
  referralCode: "REF-A",
  totalVisits: 0,
  rewardPoints: 0,
  walletBalance: 0,
  createdAt: new Date().toISOString(),
};

describe("buildVehicleFromForm", () => {
  it("builds a REG vehicle", () => {
    const result = buildVehicleFromForm(
      {
        ...ADD_VEHICLE_FORM_DEFAULTS,
        customerId: "cust-1",
        identifierType: "REG",
        identifierValue: "KA-01-AB-1234",
        make: "Hyundai",
        model: "Creta",
        color: "Blue",
        odometer: "12000",
      },
      { customers: [customer], vehicles: [] }
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.vehicle.registrationNumber).toBe("KA-01-AB-1234");
    expect(result.vehicle.vinNumber).toBeUndefined();
    expect(result.vehicle.odometer).toBe(12000);
  });

  it("builds a VIN vehicle", () => {
    const result = buildVehicleFromForm(
      {
        ...ADD_VEHICLE_FORM_DEFAULTS,
        customerId: "cust-1",
        identifierType: "VIN",
        identifierValue: "VIN54312435",
        make: "BMW",
        model: "3 Series",
      },
      { customers: [customer], vehicles: [] }
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.vehicle.vinNumber).toBe("VIN54312435");
  });

  it("rejects duplicate registration for another customer", () => {
    const existing: Vehicle = {
      id: "veh-1",
      customerId: "cust-other",
      customerName: "Other",
      registrationNumber: "KA01AB1234",
      make: "Maruti",
      model: "Swift",
      segment: "HATCHBACK",
      fuelType: "PETROL",
      color: "White",
      year: 2020,
    };
    const result = buildVehicleFromForm(
      {
        ...ADD_VEHICLE_FORM_DEFAULTS,
        customerId: "cust-1",
        identifierType: "REG",
        identifierValue: "KA-01-AB-1234",
        make: "Hyundai",
        model: "Creta",
      },
      { customers: [customer], vehicles: [existing] }
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/another customer/i);
  });
});
