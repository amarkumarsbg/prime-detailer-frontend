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

/** Collect unique category ReminderTypes from completed job services. */
export function reminderTypesFromJobServices(
  services: ServiceItem[],
  catalogById: Map<string, ServiceCatalogItem>,
  categoryLabelById: Map<string, { name: string; slug: string }>
): ReminderType[] {
  const out = new Set<ReminderType>();
  for (const line of services) {
    const catalog = catalogById.get(line.serviceCatalogId);
    const catId = catalog?.category;
    const catMeta = catId ? categoryLabelById.get(catId) : undefined;
    const mapped = mapServiceToReminderType({
      name: line.name ?? catalog?.name,
      category: catalog?.category,
      categoryName: catMeta?.name,
      categorySlug: catMeta?.slug,
      isHighEnd: catalog?.isHighEnd === true,
    });
    if (mapped && isCategoryReminderType(mapped)) out.add(mapped);
  }
  return [...out];
}
