import type { Quotation, QuotationPartLine, QuotationSource } from "@/types";

export function quotationHasServices(q: Pick<Quotation, "services">): boolean {
  return q.services.length > 0;
}

export function quotationHasParts(q: Pick<Quotation, "parts">): boolean {
  return (q.parts ?? []).length > 0;
}

export function deriveQuotationSource(
  services: Quotation["services"],
  parts: QuotationPartLine[] | undefined
): QuotationSource {
  const hasServices = services.length > 0;
  const hasParts = (parts ?? []).length > 0;
  if (hasServices && hasParts) return "MIXED";
  if (hasParts) return "COUNTER_SALE";
  return "SERVICE";
}

export function quotationSourceOf(
  q: Pick<Quotation, "source" | "services" | "parts">
): QuotationSource {
  if (q.source === "MIXED" || q.source === "COUNTER_SALE" || q.source === "SERVICE") {
    if (quotationHasServices(q) && quotationHasParts(q)) return "MIXED";
    if (quotationHasParts(q) && !quotationHasServices(q)) return "COUNTER_SALE";
    if (quotationHasServices(q)) return "SERVICE";
  }
  return deriveQuotationSource(q.services, q.parts);
}

/** Parts-only estimate with no workshop services. */
export function isCounterSaleOnlyQuotation(
  q: Pick<Quotation, "source" | "services" | "parts">
): boolean {
  return quotationHasParts(q) && !quotationHasServices(q);
}

export function isCounterSaleQuotation(
  q: Pick<Quotation, "source" | "services" | "parts">
): boolean {
  return isCounterSaleOnlyQuotation(q);
}

export function quotationSourceLabel(
  q: Pick<Quotation, "source" | "services" | "parts">
): string {
  const source = quotationSourceOf(q);
  if (source === "MIXED") return "Service & Counter Sale";
  if (source === "COUNTER_SALE") return "Counter Sale";
  return "Service";
}

export function quotationLineItemsLabel(
  q: Pick<Quotation, "source" | "services" | "parts">
): string {
  if (quotationHasServices(q) && quotationHasParts(q)) return "Services & parts";
  if (quotationHasParts(q)) return "Parts";
  return "Services";
}
