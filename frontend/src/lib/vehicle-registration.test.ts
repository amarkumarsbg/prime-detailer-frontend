import { describe, expect, it } from "vitest";
import {
  isValidIndianVehicleRegistration,
  registrationDuplicateKey,
  findVehicleByNormalizedReg,
} from "./vehicle-registration";
import type { Vehicle } from "@/types";

describe("vehicle-registration validation", () => {
  it("accepts standard registration", () => {
    expect(isValidIndianVehicleRegistration("KA01AB1234")).toBe(true);
    expect(isValidIndianVehicleRegistration("UP24BH5177H")).toBe(true);
  });

  it("accepts hyphenated registration", () => {
    expect(isValidIndianVehicleRegistration("KA-01-AB-1234")).toBe(true);
    expect(isValidIndianVehicleRegistration("UP-24-BH-5177-H")).toBe(true);
  });

  it("accepts 9-character registration", () => {
    expect(isValidIndianVehicleRegistration("KA01AB123")).toBe(true);
    expect(isValidIndianVehicleRegistration("DL3CAY123")).toBe(true);
  });

  it("accepts 10-character registration", () => {
    expect(isValidIndianVehicleRegistration("KA01AB1234")).toBe(true);
    expect(isValidIndianVehicleRegistration("MH02RK9001")).toBe(true);
  });

  it("accepts BH-series registration", () => {
    expect(isValidIndianVehicleRegistration("22BH1234AA")).toBe(true);
    expect(isValidIndianVehicleRegistration("22BH1234A")).toBe(true);
  });

  it("accepts lowercase input", () => {
    expect(isValidIndianVehicleRegistration("ka-01-ab-1234")).toBe(true);
    expect(isValidIndianVehicleRegistration("up24bh5177h")).toBe(true);
  });

  it("accepts leading/trailing spaces", () => {
    expect(isValidIndianVehicleRegistration("  KA-01-AB-1234  ")).toBe(true);
    expect(isValidIndianVehicleRegistration("  22BH1234AA  ")).toBe(true);
  });

  it("rejects invalid special characters", () => {
    expect(isValidIndianVehicleRegistration("KA-01-AB-1234$")).toBe(false);
    expect(isValidIndianVehicleRegistration("KA-01-AB-1234@")).toBe(false);
    expect(isValidIndianVehicleRegistration("KA 01 AB 1234")).toBe(false); // space in the middle is invalid
  });

  it("rejects empty registration", () => {
    expect(isValidIndianVehicleRegistration("")).toBe(false);
    expect(isValidIndianVehicleRegistration("   ")).toBe(false);
  });

  it("identifies duplicate registration correctly", () => {
    const existing: Vehicle[] = [
      {
        id: "veh-1",
        customerId: "cust-1",
        customerName: "Ada",
        registrationNumber: "KA-01-AB-1234",
        make: "Hyundai",
        model: "Creta",
        segment: "SUV",
        fuelType: "PETROL",
        color: "Blue",
        year: 2022,
      },
    ];

    // Same registration with different format (no hyphens)
    const dup1 = findVehicleByNormalizedReg(existing, "KA01AB1234");
    expect(dup1).toBeDefined();
    expect(dup1?.id).toBe("veh-1");

    // Same registration with lowercase and spaces
    const dup2 = findVehicleByNormalizedReg(existing, "  ka-01-ab-1234  ");
    expect(dup2).toBeDefined();
    expect(dup2?.id).toBe("veh-1");

    // Different registration
    const nonDup = findVehicleByNormalizedReg(existing, "KA01AB5678");
    expect(nonDup).toBeUndefined();
  });
});
