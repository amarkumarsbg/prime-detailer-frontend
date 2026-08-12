"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, MapPin, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { PickupDriverSelect } from "@/components/pickup-drop/pickup-driver-select";
import { pickupAdvanceActionLabel } from "@/components/pickup-drop/pickup-leg-stepper";
import type { PickupDropJobGroup } from "@/lib/pickup-drop-flow";
import {
  isPickupLegComplete,
  nextPickupDropStatus,
  pickupDropDisplayLabel,
  PICKUP_DROP_STATUS_LABEL,
} from "@/lib/pickup-drop-flow";
import { cn, formatDateTime } from "@/lib/utils";
import type { PickupDropRequest, PickupDropStatus } from "@/types";

const STATUS_STYLE: Record<PickupDropStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  DRIVER_ASSIGNED: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
  PICKED_UP: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  IN_SERVICE: "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300",
  DELIVERED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
};

type LegRowProps = {
  leg: PickupDropRequest;
  allRequests: PickupDropRequest[];
  branchScoped: boolean;
  hasPhone: boolean;
  onAssignDriver: (requestId: string, driverId: string, driverName?: string) => void;
  onAdvance: (request: PickupDropRequest) => void;
  onWhatsApp: (request: PickupDropRequest) => void;
};

function LegRow({
  leg,
  allRequests,
  branchScoped,
  hasPhone,
  onAssignDriver,
  onAdvance,
  onWhatsApp,
}: LegRowProps) {
  const router = useRouter();
  const pickupLegComplete = isPickupLegComplete(leg, allRequests);
  const displayStatus = pickupLegComplete ? "DELIVERED" : leg.status;
  const statusLabel = pickupDropDisplayLabel(leg, allRequests);
  const nextStatus = pickupLegComplete ? null : nextPickupDropStatus(leg.type, leg.status);
  const legTitle = leg.type === "PICKUP" ? "1. Pickup" : "2. Drop-off";
  const legHint =
    leg.type === "PICKUP"
      ? "Driver collects the vehicle from the customer"
      : "Driver returns the vehicle after service";

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{legTitle}</p>
          <p className="text-[11px] text-muted-foreground">{legHint}</p>
          <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{leg.id}</p>
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
            STATUS_STYLE[displayStatus]
          )}
        >
          {statusLabel}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-background/80 px-3 py-2.5 border border-border/50">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground shrink-0">
            Driver
          </span>
          <PickupDriverSelect
            branchId={leg.branchId}
            value={leg.driverId ?? "unassigned"}
            onValueChange={(id, name) => onAssignDriver(leg.id, id, name)}
            size="compact"
            branchScoped={branchScoped}
          />
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          {leg.type === "PICKUP" && leg.status === "IN_SERVICE" && leg.jobNumber === "NEW" ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-750 hover:bg-emerald-700 text-white font-semibold"
              onClick={() => {
                router.push(`/job-cards/new?pickupId=${leg.id}`);
              }}
            >
              Create Job Card
            </Button>
          ) : (
            <Button
              type="button"
              variant={nextStatus ? "default" : "secondary"}
              size="sm"
              className="h-8 text-xs"
              disabled={!nextStatus}
              title={
                nextStatus
                  ? pickupAdvanceActionLabel(leg.type, nextStatus)
                  : PICKUP_DROP_STATUS_LABEL[leg.status]
              }
              onClick={() => onAdvance(leg)}
            >
              {nextStatus ? pickupAdvanceActionLabel(leg.type, nextStatus) : "Complete"}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0 bg-background"
            disabled={!hasPhone}
            title={hasPhone ? "WhatsApp customer" : "No phone on file"}
            onClick={() => onWhatsApp(leg)}
          >
            <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export type PickupDropJobGroupCardProps = {
  group: PickupDropJobGroup;
  allRequests: PickupDropRequest[];
  branchScoped: boolean;
  customerPhone?: string;
  onAssignDriver: (requestId: string, driverId: string, driverName?: string) => void;
  onAdvance: (request: PickupDropRequest) => void;
  onWhatsApp: (request: PickupDropRequest) => void;
};

export function PickupDropJobGroupCard({
  group,
  allRequests,
  branchScoped,
  customerPhone,
  onAssignDriver,
  onAdvance,
  onWhatsApp,
}: PickupDropJobGroupCardProps) {
  const jobHref =
    group.jobCardId && !group.jobCardId.startsWith("new-")
      ? `/job-cards/${group.jobCardId}`
      : null;
  const hasPhone = Boolean(customerPhone?.trim());
  const showBothLegs = Boolean(group.pickup && group.drop);

  if (group.orphan) {
    return (
      <Card className="overflow-hidden border border-border/80 shadow-sm">
        <CardContent className="!p-4 sm:!p-5">
          <LegRow
            leg={group.orphan}
            allRequests={allRequests}
            branchScoped={branchScoped}
            hasPhone={hasPhone}
            onAssignDriver={onAssignDriver}
            onAdvance={onAdvance}
            onWhatsApp={onWhatsApp}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border border-border/80 shadow-sm">
      <CardContent className="!p-4 sm:!p-5 space-y-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-950/55 dark:text-sky-400">
            <Truck className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-base">{group.customerName}</h3>
              {showBothLegs ? (
                <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Pickup &amp; drop-off
                </span>
              ) : group.pickup ? (
                <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Pickup only
                </span>
              ) : (
                <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Drop-off only
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              {jobHref ? (
                <Link href={jobHref} className="font-medium text-primary hover:underline">
                  {group.jobNumber}
                </Link>
              ) : (
                <span>{group.jobNumber}</span>
              )}
              {group.vehicleRegNumber ? (
                <>
                  <span aria-hidden>·</span>
                  <span>{group.vehicleRegNumber}</span>
                </>
              ) : null}
            </div>
            <p className="flex items-start gap-2 text-sm text-muted-foreground pt-1">
              <MapPin className="h-4 w-4 shrink-0 mt-0.5 opacity-70" />
              <span className="min-w-0 break-words">{group.address}</span>
            </p>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 shrink-0 opacity-70" />
              <span className="tabular-nums">{formatDateTime(group.scheduledTime)}</span>
            </p>
            {showBothLegs ? (
              <p className="text-[11px] text-muted-foreground pt-1">
                This is one job with two trips: pickup brings the car in; drop-off returns it after
                service.
              </p>
            ) : null}
          </div>
        </div>

        {group.pickup ? (
          <LegRow
            leg={group.pickup}
            allRequests={allRequests}
            branchScoped={branchScoped}
            hasPhone={hasPhone}
            onAssignDriver={onAssignDriver}
            onAdvance={onAdvance}
            onWhatsApp={onWhatsApp}
          />
        ) : null}

        {group.drop ? (
          <LegRow
            leg={group.drop}
            allRequests={allRequests}
            branchScoped={branchScoped}
            hasPhone={hasPhone}
            onAssignDriver={onAssignDriver}
            onAdvance={onAdvance}
            onWhatsApp={onWhatsApp}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
