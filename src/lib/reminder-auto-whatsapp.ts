import type { ServiceReminder } from "@/types";
import {
  computeReminderStatus,
  nextDueDate,
  normalizeReminderKind,
  normalizeServiceReminder,
  periodKey,
  type SchedulableReminderFrequency,
} from "@/lib/reminder-schedule";

function resolvePeriodKey(r: ServiceReminder): string {
  if (r.periodKey) return r.periodKey;
  if (r.frequency === "CUSTOM") return periodKey(r.dueDate, "CUSTOM");
  return periodKey(r.dueDate, r.frequency);
}

/** True when a message was already recorded for the current period. */
export function alreadySentForCurrentPeriod(r: ServiceReminder): boolean {
  return Boolean(r.lastMessageSentAt || r.whatsappSent);
}

export function paymentOutstandingForReminder(
  r: ServiceReminder,
  getOutstanding?: (invoiceId: string) => number | undefined
): number {
  if (r.invoiceId && getOutstanding) {
    const live = getOutstanding(r.invoiceId);
    if (typeof live === "number" && Number.isFinite(live)) return live;
  }
  return r.outstandingAmount ?? 0;
}

export type AutoWhatsAppSelectOpts = {
  whatsappReminderEnabled: boolean;
  /** Live outstanding by invoice id (uses invoiceOutstanding — not recalculated here). */
  getOutstanding?: (invoiceId: string) => number | undefined;
};

/**
 * Reminders eligible for automatic WhatsApp (no send side effects).
 * Only SERVICE/PAYMENT in DUE or OVERDUE; respects toggle + period dedupe + paid invoices.
 */
export function selectRemindersForAutoWhatsApp(
  reminders: ServiceReminder[],
  opts: AutoWhatsAppSelectOpts
): ServiceReminder[] {
  if (!opts.whatsappReminderEnabled) return [];

  return reminders.filter((r) => {
    if (r.status !== "DUE" && r.status !== "OVERDUE") return false;
    if (!r.customerPhone?.trim()) return false;
    if (alreadySentForCurrentPeriod(r)) return false;

    const kind = normalizeReminderKind(r.kind);
    if (kind === "PAYMENT") {
      const outstanding = paymentOutstandingForReminder(r, opts.getOutstanding);
      if (outstanding <= 0.01) return false;
      return true;
    }
    // SERVICE (legacy + high-end)
    return true;
  });
}

export type AdvancePaymentAfterSendOpts = {
  leadDays: number;
  outstanding: number;
  now?: Date;
};

/**
 * After a successful PAYMENT WhatsApp send, move the open reminder to the next period
 * when the invoice is still outstanding. Clears send flags so the next period can send once due.
 */
export function advancePaymentReminderAfterSend(
  reminder: ServiceReminder,
  opts: AdvancePaymentAfterSendOpts
): ServiceReminder | null {
  if (normalizeReminderKind(reminder.kind) !== "PAYMENT") return null;
  if (opts.outstanding <= 0.01) return null;

  const frequency: SchedulableReminderFrequency =
    reminder.frequency === "CUSTOM"
      ? "MONTHLY"
      : (reminder.frequency as SchedulableReminderFrequency);

  const newDue = nextDueDate(reminder.dueDate, frequency);
  const pKey = periodKey(newDue, frequency);
  const following = nextDueDate(newDue, frequency);
  const status = computeReminderStatus(newDue, opts.leadDays, opts.now);

  return normalizeServiceReminder({
    ...reminder,
    dueDate: newDue,
    nextDueDate: following,
    periodKey: pKey,
    status,
    outstandingAmount: opts.outstanding,
    lastMessageSentAt: undefined,
    whatsappSent: false,
  });
}

/** Snapshot after a successful send for the current period (before optional payment advance). */
export function markReminderSentForPeriod(
  reminder: ServiceReminder,
  sentAtIso: string
): ServiceReminder {
  return normalizeServiceReminder({
    ...reminder,
    periodKey: resolvePeriodKey(reminder),
    whatsappSent: true,
    lastMessageSentAt: sentAtIso,
  });
}
