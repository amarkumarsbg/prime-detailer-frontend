"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { useFollowUpStore } from "@/store/follow-up-store";
import { useBranchScope } from "@/lib/branch-scope";
import { useScopedFollowUps } from "@/hooks/use-scoped-data";
import { useNotificationStore } from "@/store/notification-store";
import { ApiError } from "@/lib/api-client";
import { buildFollowUpWhatsAppMessage } from "@/lib/whatsapp-customer-messages";
import {
  sendCustomerWhatsApp,
  openWhatsAppComposer,
  isWhatsAppNotConfiguredError,
} from "@/lib/whatsapp-send";
import { UserX, Phone } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import type { FollowUp } from "@/types";

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "success" | "warning"> = {
  PENDING: "warning",
  CALLED: "secondary",
  SCHEDULED: "default",
  NOT_INTERESTED: "outline",
  REENGAGED: "success",
};

export default function FollowUpsPage() {
  const followUps = useScopedFollowUps();
  const { viewingLabel } = useBranchScope();

  const handleFollowUpWhatsApp = async (fu: FollowUp) => {
    const phone = fu.customerPhone?.trim();
    if (!phone) {
      toast.error("No phone number", { description: "Open the customer profile to add a number." });
      return;
    }
    const lastVisitLabel = formatDate(fu.lastVisitDate);
    const message = buildFollowUpWhatsAppMessage(fu, lastVisitLabel);
    const notify = (channel: "api" | "composer") => {
      useNotificationStore.getState().addNotification({
        type: "whatsapp_sent",
        title: channel === "api" ? "Follow-up sent via WhatsApp" : "Follow-up — WhatsApp composer",
        message: `${fu.customerName} → ${phone}`,
        href: `/follow-ups`,
      });
    };
    try {
      await sendCustomerWhatsApp(phone, message);
      toast.success("WhatsApp sent", { description: phone });
      notify("api");
    } catch (e) {
      if (isWhatsAppNotConfiguredError(e)) {
        openWhatsAppComposer(phone, message);
        toast.info("WhatsApp opened", {
          description: "Finish sending in the app, or configure Twilio on the server.",
        });
        notify("composer");
        return;
      }
      toast.error("WhatsApp failed", {
        description: e instanceof ApiError ? e.message : "Could not send",
      });
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Follow-ups"
        description={`Inactive customers and follow-up tasks for ${viewingLabel}.`}
        hideDescriptionOnMobile
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <UserX className="h-4 w-4 text-muted-foreground" />
            Inactive Customers
            <Badge
              variant="secondary"
              className="h-5 px-1.5 text-[10px] font-semibold tabular-nums"
            >
              {followUps.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4 md:pb-6">
          {followUps.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No follow-ups pending
            </p>
          ) : (
            <div className="space-y-2 md:space-y-3">
              {followUps.map((fu) => (
                <div
                  key={fu.id}
                  className="flex items-start gap-2 rounded-lg border border-border p-2.5 transition-colors hover:bg-muted/50 sm:p-3"
                >
                  <Link href={`/customers/${fu.customerId}`} className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium leading-tight">
                        {fu.customerName}
                      </span>
                      <Badge
                        variant={STATUS_VARIANTS[fu.status] ?? "secondary"}
                        className="h-5 shrink-0 px-1.5 text-[10px] font-medium"
                      >
                        {fu.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <a
                      href={`tel:${fu.customerPhone?.replace(/\s/g, "") ?? ""}`}
                      className="mt-0.5 flex items-center gap-1 text-[11px] leading-tight text-primary"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Phone className="h-3 w-3 shrink-0" aria-hidden />
                      {fu.customerPhone}
                    </a>
                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                      Last visit: {formatDate(fu.lastVisitDate)} · {fu.daysSinceLastVisit} days ago
                    </p>
                  </Link>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => void handleFollowUpWhatsApp(fu)}
                    aria-label={`WhatsApp ${fu.customerName}`}
                  >
                    <WhatsAppIcon className="h-4 w-4 text-[#25D366]" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
