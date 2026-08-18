import type { Part } from "@/types";

export type PartUsedIn = "SERVICES" | "DIRECT_SALE";

export const PART_USED_IN_OPTIONS: { id: PartUsedIn; label: string }[] = [
  { id: "SERVICES", label: "Services" },
  { id: "DIRECT_SALE", label: "Direct Sale" },
];

/** New catalog rows default to Services so job cards keep working. */
export const DEFAULT_PART_USED_IN: PartUsedIn[] = ["SERVICES"];

export function normalizePartUsedIn(usedIn: PartUsedIn[] | undefined | null): PartUsedIn[] {
  if (!usedIn || usedIn.length === 0) return [...DEFAULT_PART_USED_IN];
  const set = new Set(usedIn);
  return PART_USED_IN_OPTIONS.map((o) => o.id).filter((id) => set.has(id));
}

/** Job cards / service consumption. Legacy parts with no field stay available. */
export function partUsedInServices(part: Pick<Part, "usedIn">): boolean {
  if (!part.usedIn || part.usedIn.length === 0) return true;
  return part.usedIn.includes("SERVICES");
}

/** Counter Sale catalog. Legacy parts are excluded until Direct Sale is ticked. */
export function partUsedInDirectSale(part: Pick<Part, "usedIn">): boolean {
  return (part.usedIn ?? []).includes("DIRECT_SALE");
}

export function togglePartUsedIn(current: PartUsedIn[], id: PartUsedIn): PartUsedIn[] {
  const set = new Set(normalizePartUsedIn(current));
  if (set.has(id)) set.delete(id);
  else set.add(id);
  const next = PART_USED_IN_OPTIONS.map((o) => o.id).filter((x) => set.has(x));
  return next.length > 0 ? next : [...DEFAULT_PART_USED_IN];
}

export function filterCounterSaleParts(parts: Part[]): Part[] {
  return parts.filter((p) => p.isActive !== false && partUsedInDirectSale(p));
}
