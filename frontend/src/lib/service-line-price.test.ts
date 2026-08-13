import { describe, expect, it } from "vitest";
import {
  catalogPriceForSegment,
  effectiveServicePrice,
  isMembershipPricedLine,
  withCatalogPrice,
  withCustomPrice,
} from "@/lib/service-line-price";
import type { ServiceCatalogItem } from "@/types";

const item = {
  defaultPrice: 1000,
  segmentPricing: {
    HATCHBACK: 900,
    SEDAN: 1100,
    SUV: 1300,
    LUXURY: 2000,
    MUV: 1200,
    COMPACT_SUV: 1250,
    BIKE: 400,
  },
} as Pick<ServiceCatalogItem, "defaultPrice" | "segmentPricing">;

describe("catalogPriceForSegment", () => {
  it("uses segment price or default", () => {
    expect(catalogPriceForSegment(item, "")).toBe(1000);
    expect(catalogPriceForSegment(item, "SEDAN")).toBe(1100);
  });
});

describe("withCatalogPrice / withCustomPrice / effectiveServicePrice", () => {
  it("marks membership lines as zero billable", () => {
    expect(withCatalogPrice(1100, { membership: true })).toMatchObject({
      price: 0,
      catalogPrice: 1100,
      priceSource: "MEMBERSHIP",
    });
  });

  it("rounds custom prices", () => {
    expect(withCustomPrice(1100, 999.999).price).toBe(1000);
  });

  it("effectiveServicePrice respects source", () => {
    expect(
      effectiveServicePrice({ price: 50, priceSource: "MEMBERSHIP", isCustomPrice: false, catalogPrice: 1000 })
    ).toBe(0);
    expect(
      effectiveServicePrice({ price: 888, priceSource: "CUSTOM", isCustomPrice: true, catalogPrice: 1000 })
    ).toBe(888);
    expect(
      effectiveServicePrice({ price: 1100, priceSource: "CATALOG", isCustomPrice: false, catalogPrice: 1100 })
    ).toBe(1100);
  });

  it("detects membership priced lines", () => {
    expect(isMembershipPricedLine({ price: 0, priceSource: "MEMBERSHIP" })).toBe(true);
    expect(isMembershipPricedLine({ price: 100, priceSource: "CATALOG" })).toBe(false);
  });
});
