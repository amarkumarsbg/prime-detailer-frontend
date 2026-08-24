import type { ServiceCatalogItem, ServiceItem, VehicleSegment } from "@/types";

export type ServicePriceSource = "CATALOG" | "CUSTOM" | "MEMBERSHIP";

export type ServiceLinePriceFields = {
  price: number;
  catalogPrice: number;
  isCustomPrice: boolean;
  priceSource: ServicePriceSource;
};

/** Segment list price from catalog (ex-GST). */
export function catalogPriceForSegment(
  item: Pick<ServiceCatalogItem, "defaultPrice" | "segmentPricing">,
  segment: VehicleSegment | "" | undefined
): number {
  if (!segment) return item.defaultPrice;
  const key = segment as keyof ServiceCatalogItem["segmentPricing"];
  return item.segmentPricing[key] ?? item.defaultPrice;
}

export function withCatalogPrice(
  catalogPrice: number,
  opts?: { membership?: boolean }
): ServiceLinePriceFields {
  if (opts?.membership) {
    return {
      price: 0,
      catalogPrice,
      isCustomPrice: false,
      priceSource: "MEMBERSHIP",
    };
  }
  return {
    price: catalogPrice,
    catalogPrice,
    isCustomPrice: false,
    priceSource: "CATALOG",
  };
}

export function withCustomPrice(
  catalogPrice: number,
  customPrice: number
): ServiceLinePriceFields {
  const price = Math.max(0, Math.round(customPrice * 100) / 100);
  return {
    price,
    catalogPrice,
    isCustomPrice: true,
    priceSource: "CUSTOM",
  };
}

/** Effective billable price for totals (never re-lookup catalog when custom/membership). */
export function effectiveServicePrice(
  line: Pick<ServiceItem, "price" | "isCustomPrice" | "priceSource" | "catalogPrice">,
  fallbackCatalogPrice?: number
): number {
  if (line.priceSource === "MEMBERSHIP") return 0;
  if (line.isCustomPrice || line.priceSource === "CUSTOM") return Math.max(0, line.price);
  if (typeof line.price === "number" && Number.isFinite(line.price)) return Math.max(0, line.price);
  return Math.max(0, fallbackCatalogPrice ?? line.catalogPrice ?? 0);
}

export function isMembershipPricedLine(
  line: Pick<ServiceItem, "price" | "priceSource">
): boolean {
  return line.priceSource === "MEMBERSHIP" || (line.priceSource == null && line.price <= 0);
}
