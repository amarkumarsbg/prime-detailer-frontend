"use client";

import Link from "next/link";
import { ArrowLeft, CalendarDays, User } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { JobCardStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { JobCardStatus } from "@/types";

export interface JobCardHeaderCardProps {
  jobNumber: string;
  currentStatus: JobCardStatus;
  createdAt: string;
  customerName: string;
  /** When set, shows a full-width Notify Customer (WhatsApp) action under the header meta. */
  onNotifyCustomer?: () => void;
  notifyDisabled?: boolean;
  notifyDisabledTitle?: string;
}

export function JobCardHeaderCard({
  jobNumber,
  currentStatus,
  createdAt,
  customerName,
  onNotifyCustomer,
  notifyDisabled = false,
  notifyDisabledTitle,
}: JobCardHeaderCardProps) {
  return (
    <Card className="overflow-hidden border-border/80 shadow-sm">
      <div className="h-1.5 bg-linear-to-r from-emerald-600/90 via-emerald-500/70 to-primary/60" aria-hidden />
      <CardContent className="pt-4 pb-4 sm:pt-5 sm:pb-5 sm:p-6">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 mb-2 hidden h-8 text-muted-foreground hover:text-foreground md:inline-flex"
          asChild
        >
          <Link href="/job-cards">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            All job cards
          </Link>
        </Button>
        <p className="hidden text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:block">
          Job card
        </p>
        <div className="mt-0 flex flex-col gap-2 sm:mt-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <h1 className="text-xl font-bold font-mono tracking-tight sm:text-2xl md:text-3xl">
            {jobNumber}
          </h1>
          <JobCardStatusBadge status={currentStatus} className="hidden sm:inline-flex" />
        </div>
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="w-4 h-4 shrink-0 text-emerald-600/90" />
            <span>{formatDate(createdAt)}</span>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <User className="w-4 h-4 shrink-0 text-muted-foreground" />
            <span className="font-medium text-foreground truncate">{customerName}</span>
          </div>
        </div>
        {onNotifyCustomer ? (
          <Button
            type="button"
            variant="outline"
            className="mt-4 h-11 w-full gap-2 border-border/80 bg-muted/30 font-medium text-foreground hover:bg-muted/50"
            onClick={onNotifyCustomer}
            disabled={notifyDisabled}
            title={notifyDisabled ? notifyDisabledTitle : "Notify customer on WhatsApp"}
          >
            <WhatsAppIcon className="h-4 w-4 text-[#25D366]" />
            Notify Customer
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
