import { describe, expect, it } from "vitest";
import {
  filterCounterSaleParts,
  partAvailableInJobCard,
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

  it("does not treat an explicit empty usedIn as Services", () => {
    const none = { ...base, usedIn: [] as const };
    expect(partUsedInServices(none)).toBe(false);
    expect(partUsedInDirectSale(none)).toBe(false);
  });

  it("shows Direct Sale parts in Counter Sale and hides Services-only", () => {
    const both = { ...base, id: "a", usedIn: ["SERVICES", "DIRECT_SALE"] as const };
    const servicesOnly = { ...base, id: "b", usedIn: ["SERVICES"] as const };
    const saleOnly = { ...base, id: "c", usedIn: ["DIRECT_SALE"] as const };
    const ids = filterCounterSaleParts([both, servicesOnly, saleOnly, base]).map((p) => p.id);
    expect(ids).toEqual(["a", "c"]);
  });

  it("includes Direct Sale in job card picker", () => {
    const both = { ...base, id: "a", usedIn: ["SERVICES", "DIRECT_SALE"] as const };
    const servicesOnly = { ...base, id: "b", usedIn: ["SERVICES"] as const };
    const saleOnly = { ...base, id: "c", usedIn: ["DIRECT_SALE"] as const };
    const none = { ...base, id: "d", usedIn: [] as const };
    expect(partAvailableInJobCard(both)).toBe(true);
    expect(partAvailableInJobCard(servicesOnly)).toBe(false);
    expect(partAvailableInJobCard(saleOnly)).toBe(true);
    expect(partAvailableInJobCard(base)).toBe(false);
    expect(partAvailableInJobCard(none)).toBe(false);
  });

  it("toggles Services and Direct Sale independently, including none selected", () => {
    expect(togglePartUsedIn(["SERVICES"], "DIRECT_SALE")).toEqual(["SERVICES", "DIRECT_SALE"]);
    expect(togglePartUsedIn(["SERVICES", "DIRECT_SALE"], "DIRECT_SALE")).toEqual(["SERVICES"]);
    expect(togglePartUsedIn(["SERVICES"], "SERVICES")).toEqual([]);
    expect(togglePartUsedIn([], "DIRECT_SALE")).toEqual(["DIRECT_SALE"]);
  });
});
