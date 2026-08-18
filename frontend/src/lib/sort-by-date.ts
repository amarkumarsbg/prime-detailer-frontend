/** Newest-first list ordering for createdAt / date fields. */

export function dateSortValue(value: unknown): number {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const t = Date.parse(value);
    return Number.isNaN(t) ? 0 : t;
  }
  return 0;
}

export function compareByDateDesc(a: unknown, b: unknown): number {
  return dateSortValue(b) - dateSortValue(a);
}

function fieldValue(item: unknown, field: string): unknown {
  if (!item || typeof item !== "object") return undefined;
  return (item as Record<string, unknown>)[field];
}

export function sortByNewest<T>(
  items: readonly T[],
  primaryField: string,
  secondaryField?: string
): T[] {
  return [...items].sort((a, b) => {
    const primary = compareByDateDesc(fieldValue(a, primaryField), fieldValue(b, primaryField));
    if (primary !== 0) return primary;
    if (secondaryField) {
      const secondary = compareByDateDesc(
        fieldValue(a, secondaryField),
        fieldValue(b, secondaryField)
      );
      if (secondary !== 0) return secondary;
    }
    const aid = fieldValue(a, "id");
    const bid = fieldValue(b, "id");
    if (typeof aid === "string" && typeof bid === "string") {
      return bid.localeCompare(aid);
    }
    return 0;
  });
}

/** Numeric rank for job numbers like JC-2026-0110 so 0110 sorts after 0109 and 105. */
export function jobNumberSortKey(jobNumber: string): number {
  const match = /^JC-(\d{4})-(\d+)$/i.exec(jobNumber.trim());
  if (match) return Number(match[1]) * 1_000_000 + Number(match[2]);
  const tail = jobNumber.match(/(\d+)$/);
  return tail ? Number(tail[1]) : 0;
}

/** Newest job number first, then newest createdAt. */
export function sortJobCardsByNumberThenCreated<
  T extends { jobNumber: string; createdAt: string },
>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    const byNumber = jobNumberSortKey(b.jobNumber) - jobNumberSortKey(a.jobNumber);
    if (byNumber !== 0) return byNumber;
    return dateSortValue(b.createdAt) - dateSortValue(a.createdAt);
  });
}

/** DataTable / generic comparator — handles ISO date strings and numbers. */
export function compareFieldValues(
  aVal: unknown,
  bVal: unknown,
  sortDir: "asc" | "desc"
): number {
  const mul = sortDir === "asc" ? 1 : -1;

  if (typeof aVal === "number" && typeof bVal === "number") {
    return mul * (aVal - bVal);
  }

  if (typeof aVal === "string" && typeof bVal === "string") {
    const ad = Date.parse(aVal);
    const bd = Date.parse(bVal);
    const aLooksDate = !Number.isNaN(ad) && /^\d{4}-\d{2}/.test(aVal);
    const bLooksDate = !Number.isNaN(bd) && /^\d{4}-\d{2}/.test(bVal);
    if (aLooksDate && bLooksDate) {
      return mul * (ad - bd);
    }
    return mul * aVal.localeCompare(bVal);
  }

  return 0;
}
