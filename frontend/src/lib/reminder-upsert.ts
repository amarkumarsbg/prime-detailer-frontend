import type { JobCard, ReminderType, ServiceReminder } from "@/types";
import {
  computeReminderStatus,
  nextDueDate,
  normalizeReminderKind,
  normalizeServiceReminder,
  periodKey,
  type SchedulableReminderFrequency,
} from "@/lib/reminder-schedule";
import { getCategoryReminderFrequency } from "@/store/settings-store";
import type { SerializableAppSettings } from "@/store/settings-store";
import { reminderTypesFromJobServices } from "@/lib/reminder-service-map";
import type { ServiceCatalogItem } from "@/types";

export function serviceReminderDedupeKey(input: {
  customerId: string;
  vehicleId: string;
  type: ReminderType;
  periodKey: string;
}): string {
  return `${input.customerId}|${input.vehicleId}|${input.type}|${input.periodKey}`;
}

function isOpenServiceCategoryReminder(r: ServiceReminder): boolean {
  if (normalizeReminderKind(r.kind) !== "SERVICE") return false;
  if (r.isHighEndService) return false;
  if (r.frequency === "CUSTOM") return false;
  if (r.status === "COMPLETED" || r.status === "DISMISSED") return false;
  return true;
}

/**
 * Find an open (non-completed) service-category reminder for the same
 * customer + vehicle + type — used to upsert instead of duplicating.
 */
export function findOpenServiceCategoryReminder(
  reminders: ServiceReminder[],
  customerId: string,
  vehicleId: string,
  type: ReminderType
): ServiceReminder | undefined {
  return reminders.find(
    (r) =>
      isOpenServiceCategoryReminder(r) &&
      r.customerId === customerId &&
      r.vehicleId === vehicleId &&
      r.type === type
  );
}

export type UpsertServiceCategoryReminderInput = {
  job: JobCard;
  type: ReminderType;
  frequency: SchedulableReminderFrequency;
  serviceDate: string;
  leadDays: number;
  existing: ServiceReminder[];
};

export type UpsertServiceCategoryReminderResult =
  | { action: "create"; reminder: ServiceReminder }
  | { action: "update"; reminder: ServiceReminder; previousId: string }
  | { action: "noop"; reminder: ServiceReminder };

/**
 * Build create/update for one category type on job delivery.
 * Resets due date from serviceDate + frequency; dedupes open rows for same vehicle+type.
 */
export function planServiceCategoryReminderUpsert(
  input: UpsertServiceCategoryReminderInput
): UpsertServiceCategoryReminderResult {
  const serviceDay = input.serviceDate.slice(0, 10);
  const dueDate = nextDueDate(serviceDay, input.frequency);
  const pKey = periodKey(dueDate, input.frequency);
  const nextDue = nextDueDate(dueDate, input.frequency);
  const status = computeReminderStatus(dueDate, input.leadDays);

  const open = findOpenServiceCategoryReminder(
    input.existing,
    input.job.customerId,
    input.job.vehicleId,
    input.type
  );

  const baseFields = {
    kind: "SERVICE" as const,
    vehicleId: input.job.vehicleId,
    vehicleRegNumber: input.job.vehicleRegNumber,
    vehicleMakeModel: input.job.vehicleMakeModel,
    customerId: input.job.customerId,
    customerName: input.job.customerName,
    customerPhone: input.job.customerPhone,
    type: input.type,
    frequency: input.frequency,
    dueDate,
    nextDueDate: nextDue,
    periodKey: pKey,
    lastServiceDate: serviceDay,
    lastJobCardId: input.job.id,
    status,
    isHighEndService: false,
    notes: `Scheduled after job ${input.job.jobNumber}`,
  };

  if (open) {
    // Same period already open → do not create a duplicate
    if ((open.periodKey ?? "") === pKey || open.dueDate === dueDate) {
      return { action: "noop", reminder: open };
    }
    const reminder = normalizeServiceReminder({
      ...open,
      ...baseFields,
      id: open.id,
      whatsappSent: false,
      lastMessageSentAt: undefined,
    });
    return { action: "update", reminder, previousId: open.id };
  }

  // Exact period key already exists (even if completed) — avoid duplicate for same period
  const samePeriod = input.existing.find(
    (r) =>
      normalizeReminderKind(r.kind) === "SERVICE" &&
      !r.isHighEndService &&
      r.customerId === input.job.customerId &&
      r.vehicleId === input.job.vehicleId &&
      r.type === input.type &&
      (r.periodKey ?? periodKey(r.dueDate, r.frequency === "CUSTOM" ? "MONTHLY" : r.frequency)) ===
        pKey
  );
  if (samePeriod && samePeriod.status !== "DISMISSED") {
    if (samePeriod.status === "COMPLETED") {
      // Re-open / refresh completed cycle for re-delivery in same period
      const reminder = normalizeServiceReminder({
        ...samePeriod,
        ...baseFields,
        id: samePeriod.id,
        whatsappSent: false,
        lastMessageSentAt: undefined,
      });
      return { action: "update", reminder, previousId: samePeriod.id };
    }
    const reminder = normalizeServiceReminder({
      ...samePeriod,
      ...baseFields,
      id: samePeriod.id,
    });
    return { action: "noop", reminder };
  }

  const reminder = normalizeServiceReminder({
    id: `rem-svc-${input.job.id}-${input.type}-${pKey}`,
    ...baseFields,
    whatsappSent: false,
  });
  return { action: "create", reminder };
}

export type CreateCategoryRemindersOnDeliverParams = {
  job: JobCard;
  serviceDateIso: string;
  settings: Pick<
    SerializableAppSettings,
    "reminderLeadDays" | "reminderCategoryFrequencies"
  >;
  catalog: ServiceCatalogItem[];
  categories: { id: string; name: string; slug: string }[];
  existingReminders: ServiceReminder[];
};

/**
 * Plan all category reminders for a delivered job (does not touch high-end CUSTOM).
 */
export function planCategoryRemindersForDeliveredJob(
  params: CreateCategoryRemindersOnDeliverParams
): UpsertServiceCategoryReminderResult[] {
  const catalogById = new Map(params.catalog.map((c) => [c.id, c]));
  const categoryLabelById = new Map(
    params.categories.map((c) => [c.id, { name: c.name, slug: c.slug }] as const)
  );
  const types = reminderTypesFromJobServices(
    params.job.services ?? [],
    catalogById,
    categoryLabelById
  );
  if (types.length === 0) return [];

  const results: UpsertServiceCategoryReminderResult[] = [];
  let working = [...params.existingReminders];

  for (const type of types) {
    const frequency = getCategoryReminderFrequency(params.settings, type);
    const planned = planServiceCategoryReminderUpsert({
      job: params.job,
      type,
      frequency,
      serviceDate: params.serviceDateIso,
      leadDays: params.settings.reminderLeadDays,
      existing: working,
    });
    results.push(planned);
    if (planned.action === "create") {
      working = [...working, planned.reminder];
    } else if (planned.action === "update") {
      working = working.map((r) => (r.id === planned.previousId ? planned.reminder : r));
    }
  }

  return results;
}
