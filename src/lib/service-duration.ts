import type { ServiceCatalogItem } from "@/types";

/** Human-readable estimated duration for service cards and booking UI. */
export function formatServiceDurationLabel(s: ServiceCatalogItem): string {
  const a = s.durationMinutes;
  const b = s.maxDurationMinutes;
  if (a != null && b != null && b > a) return `${a}–${b} min`;
  if (a != null) return `${a} min`;
  return "—";
}
