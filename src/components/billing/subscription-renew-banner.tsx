"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiPost } from "@/lib/api-client";
import { useOrganizationStore } from "@/store/organization-store";
import { formatPaymentStatus, termLabelFromMonths } from "@/lib/subscription-export-lock";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogMobileSheetContentClasses,
  dialogMobileSheetHeaderClasses,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { OrganizationEntitlement } from "@/types";

type RenewResult = {
  entitlement: OrganizationEntitlement;
  payment: { id: string; status: string };
};

export function SubscriptionRenewDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const entitlement = useOrganizationStore((s) => s.entitlement);
  const setEntitlement = useOrganizationStore((s) => s.setEntitlement);
  const [submitting, setSubmitting] = useState(false);

  const sub = entitlement?.subscription;
  const termMonths = sub?.termMonths ?? 12;

  const submit = async () => {
    setSubmitting(true);
    try {
      const data = await apiPost<RenewResult>("/api/organization/subscription/renew", {
        method: "MANUAL",
        notes: "Renewal requested from studio Pay Now",
      });
      setEntitlement(data.entitlement);
      toast.success("Renewal request submitted", {
        description: "Payment status is Pending. Our team will verify and restore exports.",
      });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit renewal");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(dialogMobileSheetContentClasses, "sm:max-w-md")}>
        <DialogHeader className={dialogMobileSheetHeaderClasses}>
          <DialogTitle>Renew subscription</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 px-6 py-4 text-sm">
          <p>
            Plan: <span className="font-medium">{sub?.planName ?? "—"}</span>
          </p>
          <p>
            Term: <span className="font-medium">{termLabelFromMonths(termMonths)}</span>
          </p>
          <p>
            Expires:{" "}
            <span className="font-medium">
              {sub?.expiresAt || sub?.currentPeriodEnd
                ? formatDate(sub.expiresAt ?? sub.currentPeriodEnd!)
                : "—"}
            </span>
          </p>
          <p>
            Payment status:{" "}
            <span className="font-medium">{formatPaymentStatus(sub?.paymentStatus)}</span>
          </p>
          <p className="text-muted-foreground">
            Submit Pay Now to create a pending renewal. After payment is verified, your expiry
            date extends and exports unlock automatically. Your business data is never deleted.
          </p>
        </div>
        <DialogFooter className="gap-2 border-t px-6 py-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={submitting}>
            {submitting ? "Submitting…" : "Pay now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SubscriptionRenewBanner() {
  const entitlement = useOrganizationStore((s) => s.entitlement);
  const [renewOpen, setRenewOpen] = useState(false);

  useEffect(() => {
    const handler = () => setRenewOpen(true);
    window.addEventListener("subscription:open-renew", handler);
    return () => window.removeEventListener("subscription:open-renew", handler);
  }, []);

  const locked = entitlement?.subscription.exportLocked === true || entitlement?.canExportData === false;
  const days = entitlement?.subscription.daysRemaining;
  const show =
    !!entitlement &&
    (locked || (typeof days === "number" && days <= 30));

  if (!show) {
    return <SubscriptionRenewDialog open={renewOpen} onOpenChange={setRenewOpen} />;
  }

  const expired = (days ?? 0) < 0;
  const message = expired
    ? "Subscription expired. Exports and downloads are locked until you renew."
    : `Subscription expires in ${days} day${days === 1 ? "" : "s"}. Exports are locked until renewal.`;

  return (
    <>
      <div className="border-b border-orange-200 bg-orange-50 px-4 py-2.5 dark:border-orange-900/50 dark:bg-orange-950/40">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-orange-950 dark:text-orange-100">{message}</p>
          <Button
            type="button"
            size="sm"
            className="shrink-0 bg-orange-600 text-white hover:bg-orange-700"
            onClick={() => setRenewOpen(true)}
          >
            Renew subscription / Pay now
          </Button>
        </div>
      </div>
      <SubscriptionRenewDialog open={renewOpen} onOpenChange={setRenewOpen} />
    </>
  );
}
