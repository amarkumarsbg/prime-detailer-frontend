import type { Invoice, ServiceReminder } from "@/types";
import {
  computeReminderStatus,
  nextDueDate,
  normalizeReminderKind,
  normalizeServiceReminder,
  periodKey,
  type SchedulableReminderFrequency,
} from "@/lib/reminder-schedule";

/** Dedupe key for open payment reminders: invoice + period. */
export function paymentReminderDedupeKey(invoiceId: string, periodKeyValue: string): string {
  return `${invoiceId}|${periodKeyValue}`;
}

export function isOpenPaymentReminder(r: ServiceReminder): boolean {
  if (normalizeReminderKind(r.kind) !== "PAYMENT") return false;
  if (r.status === "COMPLETED" || r.status === "DISMISSED") return false;
  return true;
}

export function findOpenPaymentRemindersForInvoice(
  reminders: ServiceReminder[],
  invoiceId: string
): ServiceReminder[] {
  return reminders.filter((r) => isOpenPaymentReminder(r) && r.invoiceId === invoiceId);
}

export type PlanPaymentReminderInput = {
  invoice: Invoice;
  /** Precomputed with invoiceOutstanding — do not reimplement payment math here. */
  outstanding: number;
  frequency: SchedulableReminderFrequency;
  leadDays: number;
  existing: ServiceReminder[];
  partyId?: string;
  vehicleId?: string;
  vehicleMakeModel?: string;
};

export type PlanPaymentReminderResult =
  | { action: "skip" }
  | {
      action: "complete";
      reminders: ServiceReminder[];
    }
  | { action: "create"; reminder: ServiceReminder }
  | { action: "update"; reminder: ServiceReminder; previousId: string }
  | { action: "noop"; reminder: ServiceReminder };

/**
 * Plan PAYMENT reminder create/update/complete for one invoice.
 * Anchor = invoice.createdAt; cadence from reminderPaymentFrequency.
 * At most one open PAYMENT reminder per invoice (period dedupe on create).
 */
export function planPaymentReminderForInvoice(
  input: PlanPaymentReminderInput
): PlanPaymentReminderResult {
  const { invoice, outstanding, frequency, leadDays, existing } = input;
  const open = findOpenPaymentRemindersForInvoice(existing, invoice.id);

  if (outstanding <= 0.01) {
    if (open.length === 0) return { action: "skip" };
    return {
      action: "complete",
      reminders: open.map((r) =>
        normalizeServiceReminder({
          ...r,
          status: "COMPLETED",
          outstandingAmount: 0,
        })
      ),
    };
  }

  // Do not chase drafts
  if (invoice.status === "DRAFT") return { action: "skip" };

  const anchorDay = (invoice.createdAt || new Date().toISOString()).slice(0, 10);
  const dueDate = nextDueDate(anchorDay, frequency);
  const pKey = periodKey(dueDate, frequency);
  const nextDue = nextDueDate(dueDate, frequency);
  const status = computeReminderStatus(dueDate, leadDays);
  const vehicleMakeModel =
    input.vehicleMakeModel?.trim() ||
    invoice.vehicleMakeModel?.trim() ||
    invoice.vehicleRegNumber ||
    "—";

  const baseFields = {
    kind: "PAYMENT" as const,
    vehicleId: input.vehicleId?.trim() || open[0]?.vehicleId || "",
    vehicleRegNumber: invoice.vehicleRegNumber || open[0]?.vehicleRegNumber || "",
    vehicleMakeModel,
    customerId: invoice.customerId,
    customerName: invoice.customerName,
    customerPhone: invoice.customerPhone,
    type: "GENERAL_SERVICE" as const,
    frequency,
    dueDate,
    nextDueDate: nextDue,
    periodKey: pKey,
    status,
    isHighEndService: false,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    outstandingAmount: outstanding,
    partyId: input.partyId ?? open[0]?.partyId,
    notes: `Pending payment — ${invoice.invoiceNumber}`,
  };

  const primary = open[0];
  if (primary) {
    const samePeriod =
      (primary.periodKey ?? "") === pKey || primary.dueDate === dueDate;
    const outstandingUnchanged =
      Math.abs((primary.outstandingAmount ?? 0) - outstanding) < 0.005;
    if (
      samePeriod &&
      outstandingUnchanged &&
      primary.invoiceNumber === invoice.invoiceNumber &&
      primary.frequency === frequency
    ) {
      return { action: "noop", reminder: primary };
    }
    // Update open row (partial pay / refresh) — never create a second open reminder
    const reminder = normalizeServiceReminder({
      ...primary,
      ...baseFields,
      id: primary.id,
      whatsappSent: primary.whatsappSent,
      lastMessageSentAt: primary.lastMessageSentAt,
    });
    return { action: "update", reminder, previousId: primary.id };
  }

  // Avoid recreating the same invoice+period if a non-dismissed row already exists
  const samePeriodExisting = existing.find(
    (r) =>
      normalizeReminderKind(r.kind) === "PAYMENT" &&
      r.invoiceId === invoice.id &&
      (r.periodKey ?? "") === pKey &&
      r.status !== "DISMISSED"
  );
  if (samePeriodExisting) {
    if (samePeriodExisting.status === "COMPLETED") {
      // Re-open if balance returned (rare) — update in place
      const reminder = normalizeServiceReminder({
        ...samePeriodExisting,
        ...baseFields,
        id: samePeriodExisting.id,
        whatsappSent: false,
        lastMessageSentAt: undefined,
      });
      return { action: "update", reminder, previousId: samePeriodExisting.id };
    }
    return { action: "noop", reminder: samePeriodExisting };
  }

  const reminder = normalizeServiceReminder({
    id: `rem-pay-${invoice.id}-${pKey}`,
    ...baseFields,
    whatsappSent: false,
  });
  return { action: "create", reminder };
}
