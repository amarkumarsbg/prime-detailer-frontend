"use client";

import { toast } from "sonner";
import type { Invoice } from "@/types";
import { pushActivityLog } from "@/lib/activity-log-helper";
import { useNotificationStore } from "@/store/notification-store";
import {
  buildCustomerLedgerWhatsAppMessage,
  isWhatsAppNonClickableShareUrl,
  publicCustomerLedgerShareUrl,
} from "@/lib/whatsapp-customer-messages";
import {
  isWhatsAppNotConfiguredError,
  openWhatsAppComposer,
  sendCustomerWhatsApp,
} from "@/lib/whatsapp-send";

/** MyBillBook-style per-customer ledger (Parties → Ledger tab). */
export function customerLedgerHref(customerId: string): string {
  return `/parties/c:${encodeURIComponent(customerId)}?tab=ledger`;
}

/** Party id for a studio customer (`c:{customerId}`). */
export function customerPartyId(customerId: string): string {
  return `c:${customerId}`;
}

/** Share the customer ledger reminder via WhatsApp with a public ledger link. */
export async function shareCustomerLedgerWhatsApp(opts: {
  customer: { id: string; name: string; phone?: string };
  invoices: Invoice[];
  businessName: string;
}): Promise<void> {
  const phone = (opts.customer.phone ?? "").trim();
  if (!phone) {
    toast.error("No customer phone on file for this ledger");
    return;
  }

  const customerInvoices = opts.invoices.filter((inv) => inv.customerId === opts.customer.id);
  const statementUrl = publicCustomerLedgerShareUrl(opts.customer.id);
  const message = buildCustomerLedgerWhatsAppMessage(opts.customer, customerInvoices, {
    businessName: opts.businessName,
    statementUrl,
  });
  const warnLocalLink = isWhatsAppNonClickableShareUrl(statementUrl);
  const href = customerLedgerHref(opts.customer.id);

  try {
    await sendCustomerWhatsApp(phone, message);
    toast.success("Ledger reminder shared via WhatsApp", { description: phone });
    if (warnLocalLink) {
      toast.warning("Link may not be tappable in WhatsApp", {
        description:
          "WhatsApp does not open localhost links. Set NEXT_PUBLIC_APP_URL to your public https domain.",
      });
    }
    useNotificationStore.getState().addNotification({
      type: "whatsapp_sent",
      title: "Ledger reminder shared via WhatsApp",
      message: `${opts.customer.name} → ${phone}`,
      href,
    });
    pushActivityLog({
      action: "WHATSAPP_SENT",
      entityType: "CUSTOMER",
      entityId: opts.customer.id,
      entityLabel: opts.customer.name,
      details: `Ledger reminder for ${opts.customer.name} via WhatsApp`,
    });
  } catch (err) {
    if (isWhatsAppNotConfiguredError(err)) {
      openWhatsAppComposer(phone, message);
      toast.info("WhatsApp opened", {
        description: warnLocalLink
          ? "Review and send. Note: localhost links are not clickable in WhatsApp."
          : "Review the ledger reminder and send it from WhatsApp.",
      });
      if (warnLocalLink) {
        toast.warning("Link may not be tappable in WhatsApp", {
          description:
            "Set NEXT_PUBLIC_APP_URL to a public https URL (e.g. your deployed app) so the ledger link works.",
        });
      }
      useNotificationStore.getState().addNotification({
        type: "whatsapp_sent",
        title: "Ledger — WhatsApp composer",
        message: `${opts.customer.name} → ${phone}`,
        href,
      });
      pushActivityLog({
        action: "WHATSAPP_SENT",
        entityType: "CUSTOMER",
        entityId: opts.customer.id,
        entityLabel: opts.customer.name,
        details: `Ledger reminder for ${opts.customer.name} via WhatsApp`,
      });
      return;
    }
    toast.error("Could not share ledger via WhatsApp");
  }
}
