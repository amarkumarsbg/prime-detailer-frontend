import { describe, expect, it } from "vitest";
import { buildAutoMapping } from "./normalize";
import { parseCsvText } from "./parse-tabular";
import { applyColumnMapping, validateImportRows } from "./validate-rows";
import type { Customer } from "@/types";

const customers: Customer[] = [
  {
    id: "c1",
    name: "Alice",
    phone: "9876543210",
    email: "a@example.com",
    address: "",
    referralCode: "REF-A",
    totalVisits: 0,
    rewardPoints: 0,
    walletBalance: 0,
    createdAt: new Date().toISOString(),
  },
];

describe("vehicle import", () => {
  it("maps headers and validates ready / unmatched / duplicate", () => {
    const csv = [
      "Registration Number,Customer Phone,Make,Model,Fuel Type",
      "KA01AB1234,9876543210,Maruti,Swift,Petrol",
      "KA01AB1234,9876543210,Honda,City,Diesel",
      "MH12CD9999,9000000000,Tata,Nexon,Petrol",
    ].join("\n");

    const { headers, rows } = parseCsvText(csv);
    const mapping = buildAutoMapping(headers);
    expect(mapping.find((m) => m.mappedTo === "registrationNumber")?.header).toBe(
      "Registration Number"
    );

    const parsed = applyColumnMapping(headers, rows, mapping);
    const validated = validateImportRows(parsed, customers, new Set());

    expect(validated[0]?.status).toBe("ready");
    expect(validated[1]?.status).toBe("duplicate_in_file");
    expect(validated[2]?.status).toBe("unmatched_customer");
  });
});
