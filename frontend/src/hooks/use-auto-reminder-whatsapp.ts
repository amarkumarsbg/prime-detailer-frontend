"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useReminderStore } from "@/store/reminder-store";
import { useSettingsStore } from "@/store/settings-store";
import { useInvoiceStore } from "@/store/invoice-store";
import { runAutoReminderWhatsAppSends } from "@/lib/run-auto-reminder-whatsapp";

/**
 * On Reminders page load / data change: auto-send DUE/OVERDUE reminders when
 * WhatsApp reminders are enabled. Not a cron — runs in-session like reservation day-of.
 */
export function useAutoReminderWhatsApp(): void {
  const reminders = useReminderStore((s) => s.reminders);
  const invoices = useInvoiceStore((s) => s.invoices);
  const whatsappReminderEnabled = useSettingsStore((s) => s.whatsappReminderEnabled);
  const runningRef = useRef(false);
  const lastSignatureRef = useRef("");

  useEffect(() => {
    if (!whatsappReminderEnabled) return;
    if (runningRef.current) return;

    const signature = `${whatsappReminderEnabled}:${reminders
      .map((r) => `${r.id}:${r.status}:${r.lastMessageSentAt ?? ""}:${r.periodKey ?? ""}`)
      .join("|")}`;
    if (signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;

    runningRef.current = true;
    void runAutoReminderWhatsAppSends({
      reminders,
      invoices,
      whatsappReminderEnabled,
    })
      .then((result) => {
        if (result.sent > 0) {
          toast.success(
            result.sent === 1
              ? "1 automatic reminder sent"
              : `${result.sent} automatic reminders sent`
          );
        }
      })
      .finally(() => {
        runningRef.current = false;
      });
  }, [reminders, invoices, whatsappReminderEnabled]);
}
