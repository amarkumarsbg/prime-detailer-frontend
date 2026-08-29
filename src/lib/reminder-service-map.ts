import type { ReminderType, ServiceCatalogItem, ServiceItem } from "@/types";
import { CATEGORY_REMINDER_TYPES } from "@/lib/reminder-schedule";

/**
 * Map a job service line (+ optional catalog row / category label) to a
 * category ReminderType. Returns null for high-end / PPF / Ceramic (those use
 * CUSTOM month schedules via generateHighEndReminders).
 */
export function mapServiceToReminderType(input: {
  name?: string;
  category?: string;
  categoryName?: string;
  categorySlug?: string;
  isHighEnd?: boolean;
}): ReminderType | null {
  if (input.isHighEnd) return null;

  const haystack = [
    input.name,
    input.category,
    input.categoryName,
    input.categorySlug,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!haystack.trim()) return "GENERAL_SERVICE";

  // High-end product names — never create category-frequency reminders
  if (/\bppf\b|paint\s*protection|ceramic/.test(haystack)) return null;

  if (/\boil\b|lubricant|lube/.test(haystack)) return "OIL_CHANGE";
  if (/\bbrake/.test(haystack)) return "BRAKE_INSPECTION";
  if (/\btyre\b|\btire\b|rotation|wheel\s*align/.test(haystack)) return "TIRE_ROTATION";
  if (/\bac\b|a\/c|air\s*cond|airconditioning/.test(haystack)) return "AC_SERVICE";
  if (/\bbattery\b/.test(haystack)) return "BATTERY_CHECK";
  if (/\binsurance\b/.test(haystack)) return "INSURANCE";
  if (/\bpuc\b|pollution/.test(haystack)) return "PUC";

  return "GENERAL_SERVICE";
}

export function isCategoryReminderType(type: ReminderType): boolean {
  return (CATEGORY_REMINDER_TYPES as readonly ReminderType[]).includes(type);
}

function resolveCategoryRef(
  categoryRef: string | undefined,
  categoryLabelById: Map<string, { name: string; slug: string }>
): { id: string; name: string; slug: string } | null {
  const raw = categoryRef?.trim();
  if (!raw) return null;

  const byId = categoryLabelById.get(raw);
  if (byId) {
    return { id: raw, name: byId.name, slug: byId.slug };
  }

  const needle = raw.toLowerCase();
  for (const [id, meta] of categoryLabelById.entries()) {
    if (meta.name.trim().toLowerCase() === needle || meta.slug.trim().toLowerCase() === needle) {
      return { id, name: meta.name, slug: meta.slug };
    }
  }

  return { id: raw, name: raw, slug: raw };
}

/** Collect unique category ReminderTypes from completed job services. */
export function reminderTypesFromJobServices(
  services: ServiceItem[],
  catalogById: Map<string, ServiceCatalogItem>,
  categoryLabelById: Map<string, { name: string; slug: string }>
): ReminderType[] {
  const out = new Set<ReminderType>();
  for (const line of services) {
    const catalog = catalogById.get(line.serviceCatalogId);
    const cat = resolveCategoryRef(catalog?.category, categoryLabelById);
    const mapped = mapServiceToReminderType({
      name: line.name ?? catalog?.name,
      category: catalog?.category,
      categoryName: cat?.name,
      categorySlug: cat?.slug,
      isHighEnd: catalog?.isHighEnd === true,
    });
    if (mapped && isCategoryReminderType(mapped)) out.add(mapped);
  }
  return [...out];
}


/** High-end categories use custom month schedules under High-End Services settings. */
export function isHighEndReminderCategory(slug: string, name: string): boolean {
  const hay = `${slug} ${name}`.toLowerCase();
  return /\bppf\b|ceramic|paint\s*protection/.test(hay);
}

export type JobServiceCategoryRef = {
  categoryId: string;
  name: string;
  slug: string;
};

/**
 * Unique service categories on a job (from catalog category ids).
 * Skips catalog rows flagged `isHighEnd` (those use High-End Services month schedules).
 * Category name alone (e.g. PPF / Ceramic) does not exclude a non–high-end service.
 */
export function serviceCategoriesFromJobServices(
  services: ServiceItem[],
  catalogById: Map<string, ServiceCatalogItem>,
  categoryLabelById: Map<string, { name: string; slug: string }>
): JobServiceCategoryRef[] {
  const out = new Map<string, JobServiceCategoryRef>();
  for (const line of services) {
    const catalog = catalogById.get(line.serviceCatalogId);
    if (!catalog || catalog.isHighEnd === true) continue;
    const cat = resolveCategoryRef(catalog.category, categoryLabelById);
    if (!cat) continue;
    const categoryId = cat.id.trim();
    if (!categoryId) continue;
    const name = cat.name.trim() || categoryId;
    const slug = cat.slug.trim() || categoryId;
    if (!out.has(categoryId)) {
      out.set(categoryId, { categoryId, name, slug });
    }
  }
  return [...out.values()];
}
