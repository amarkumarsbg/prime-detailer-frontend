import { describe, expect, it } from "vitest";
import {
  filterCounterSaleParts,
  partUsedInDirectSale,
  partUsedInServices,
  togglePartUsedIn,
} from "./part-used-in";
import type { Part } from "@/types";

const base = {
  id: "p1",
  name: "Car Shampoo",
  sku: "SH-1",
  category: "Detailing",
  quantity: 10,
  primaryUnit: "Piece",
  secondaryUnit: "Piece",
  conversionFactor: 1,
  unitPrice: 100,
  reorderLevel: 0,
  supplier: "—",
  lastRestocked: "2026-08-18T00:00:00.000Z",
  isActive: true,
} as Part;

describe("part usedIn", () => {
  it("treats omitted usedIn as Services only", () => {
    expect(partUsedInServices(base)).toBe(true);
    expect(partUsedInDirectSale(base)).toBe(false);
  });

  it("shows Direct Sale parts in Counter Sale and hides Services-only", () => {
    const both = { ...base, id: "a", usedIn: ["SERVICES", "DIRECT_SALE"] as const };
    const servicesOnly = { ...base, id: "b", usedIn: ["SERVICES"] as const };
    const saleOnly = { ...base, id: "c", usedIn: ["DIRECT_SALE"] as const };
    const ids = filterCounterSaleParts([both, servicesOnly, saleOnly, base]).map((p) => p.id);
    expect(ids).toEqual(["a", "c"]);
  });

  it("does not drop the last usedIn value", () => {
    expect(togglePartUsedIn(["SERVICES"], "SERVICES")).toEqual(["SERVICES"]);
  });
});
