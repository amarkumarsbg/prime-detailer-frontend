import { describe, expect, it } from "vitest";
import { buildAutoMapping, refineAutoMapping } from "./normalize";
import { parseVehiclePdfDataLine, VEHICLE_PDF_HEADERS } from "./parse-pdf";
import { applyColumnMapping, validateImportRows } from "./validate-rows";
import type { Customer } from "@/types";

describe("parseVehiclePdfDataLine — 8-column structure", () => {
  it("maps Reg, Phone, Make, Model, Fuel, Segment, Year, Color without shifting", () => {
    const line = "DL04EF7821, 8765432101, Honda, City, Petrol, Sedan, 2021, Silver";
    const row = parseVehiclePdfDataLine(line);
    expect(row).toEqual([
      "DL04EF7821",
      "8765432101",
      "Honda",
      "City",
      "Petrol",
      "Sedan",
      "2021",
      "Silver",
    ]);
  });

  it("keeps Make/Model aligned through auto-mapping + validation", () => {
    const line = "DL04EF7821, 8765432101, Honda, City, Petrol, Sedan, 2021, Silver";
    const cells = parseVehiclePdfDataLine(line)!;
    const headers = [...VEHICLE_PDF_HEADERS];
    const mapping = refineAutoMapping(buildAutoMapping(headers), [cells]);
    const parsed = applyColumnMapping(headers, [cells], mapping);

    expect(parsed[0]?.registrationNumber).toBe("DL04EF7821");
    expect(parsed[0]?.customerPhone).toBe("8765432101");
    expect(parsed[0]?.make).toBe("Honda");
    expect(parsed[0]?.model).toBe("City");
    expect(parsed[0]?.fuelType).toBe("Petrol");
    expect(parsed[0]?.segment).toBe("Sedan");
    expect(parsed[0]?.year).toBe("2021");
    expect(parsed[0]?.color).toBe("Silver");

    const customers: Customer[] = [
      {
        id: "c-honda-owner",
        name: "Rahul Sharma",
        phone: "8765432101",
        email: "r@example.com",
        address: "",
        referralCode: "REF-R",
        totalVisits: 0,
        rewardPoints: 0,
        walletBalance: 0,
        createdAt: new Date().toISOString(),
      },
    ];

    const validated = validateImportRows(parsed, customers, new Set());
    expect(validated[0]?.status).toBe("ready");
    expect(validated[0]?.resolvedCustomerName).toBe("Rahul Sharma");
    expect(validated[0]?.make).toBe("Honda");
    expect(validated[0]?.model).toBe("City");
    expect(validated[0]?.resolvedFuelType).toBe("PETROL");
    expect(validated[0]?.resolvedSegment).toBe("SEDAN");
    expect(validated[0]?.resolvedYear).toBe(2021);
    expect(validated[0]?.resolvedColor).toBe("Silver");
  });
});
