import { toast } from "sonner";
import type { ActivityEntityType } from "@/types";
import { ApiError } from "@/lib/api-client";
import { pushActivityLog } from "@/lib/activity-log-helper";
import { useNotificationStore } from "@/store/notification-store";
import {
  sendCustomerWhatsApp,
  openWhatsAppComposer,
  isWhatsAppNotConfiguredError,
} from "@/lib/whatsapp-send";

export async function executeCustomerWhatsAppAutomation(opts: {
  phone: string;
  message: string;
  titles: { api: string; composer: string };
  /** Staff notification summary line */
  notificationSummary: string;
  href?: string;
  branchId?: string;
  activityLog?: {
    entityType: ActivityEntityType;
    entityId: string;
    entityLabel: string;
    details: string;
  };
  /** Show toast when opening composer fallback (default true) */
  composerToast?: boolean;
  /** Toast title on generic failure */
  errorTitle?: string;
}): Promise<void> {
  const phone = opts.phone.trim();
  if (!phone) return;

  const pushStaffNotify = (channel: "api" | "composer") => {
    useNotificationStore.getState().addNotification({
      type: "whatsapp_sent",
      title: channel === "api" ? opts.titles.api : opts.titles.composer,
      message: opts.notificationSummary,
      href: opts.href,
      branchId: opts.branchId,
    });
  };

  try {
    await sendCustomerWhatsApp(phone, opts.message);
    pushStaffNotify("api");
    if (opts.activityLog) {
      pushActivityLog({
        action: "WHATSAPP_SENT",
        entityType: opts.activityLog.entityType,
        entityId: opts.activityLog.entityId,
        entityLabel: opts.activityLog.entityLabel,
        details: opts.activityLog.details,
      });
    }
  } catch (e) {
    if (isWhatsAppNotConfiguredError(e)) {
      const { usedClipboard } = openWhatsAppComposer(phone, opts.message);
      if (opts.composerToast !== false) {
        toast.info(opts.titles.composer, {
          description: usedClipboard
            ? "Full message copied — paste in WhatsApp. Or configure Twilio on the server."
            : "Finish sending in WhatsApp, or configure Twilio on the server.",
        });
      }
      pushStaffNotify("composer");
      if (opts.activityLog) {
        pushActivityLog({
          action: "WHATSAPP_SENT",
          entityType: opts.activityLog.entityType,
          entityId: opts.activityLog.entityId,
          entityLabel: opts.activityLog.entityLabel,
          details: `${opts.activityLog.details} (composer — Twilio not configured)`,
        });
      }
      return;
    }
    toast.error(opts.errorTitle ?? "WhatsApp failed", {
      description: e instanceof ApiError ? e.message : "Could not send",
    });
  }
}
