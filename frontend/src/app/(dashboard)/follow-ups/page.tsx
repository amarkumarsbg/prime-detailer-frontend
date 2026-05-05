"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { useFollowUpStore } from "@/store/follow-up-store";
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
  const followUps = useFollowUpStore((s) => s.followUps);

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
        description="Inactive customers and follow-up tasks"
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <UserX className="w-4 h-4 text-muted-foreground" />
            Inactive Customers ({followUps.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {followUps.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No follow-ups pending
            </p>
          ) : (
            <div className="space-y-3">
              {followUps.map((fu) => (
                <div
                  key={fu.id}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <Link href={`/customers/${fu.customerId}`} className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{fu.customerName}</span>
                      <Badge variant={STATUS_VARIANTS[fu.status] ?? "secondary"}>
                        {fu.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <Phone className="w-3 h-3" />
                      {fu.customerPhone}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Last visit: {formatDate(fu.lastVisitDate)} &middot; {fu.daysSinceLastVisit} days ago
                    </p>
                  </Link>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 h-8 text-xs"
                    onClick={() => void handleFollowUpWhatsApp(fu)}
                  >
                    <WhatsAppIcon className="w-3.5 h-3.5 mr-1.5 text-[#25D366]" />
                    WhatsApp
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
