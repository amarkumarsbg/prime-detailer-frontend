import { BUILTIN_PART_CATEGORIES } from "@/types";
import type { Part, PartCategoryRecord } from "@/types";

export function normalizePartCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function mergePartCategoryNames(
  parts: Part[],
  saved: PartCategoryRecord[] = []
): string[] {
  const seen = new Map<string, string>();
  const remember = (raw: string) => {
    const name = normalizePartCategoryName(raw);
    if (!name) return;
    const key = name.toLowerCase();
    if (!seen.has(key)) seen.set(key, name);
  };
  for (const name of BUILTIN_PART_CATEGORIES) remember(name);
  for (const row of saved) remember(row.name);
  for (const part of parts) remember(part.category);
  const builtins = new Set(BUILTIN_PART_CATEGORIES.map((c) => c.toLowerCase()));
  const extra = [...seen.values()]
    .filter((name) => !builtins.has(name.toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return [...BUILTIN_PART_CATEGORIES, ...extra];
}
