"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  Truck,
  User,
  UserCheck,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { PickupDriverSelect } from "@/components/pickup-drop/pickup-driver-select";
import { pickupAdvanceActionLabel } from "@/components/pickup-drop/pickup-leg-stepper";
import { nextPickupDropStatus, PICKUP_DROP_STATUS_LABEL } from "@/lib/pickup-drop-flow";
import { cn, formatDateTime } from "@/lib/utils";
import type { PickupDropRequest, PickupDropStatus, PickupDropType } from "@/types";

const STATUS_LABEL: Record<PickupDropStatus, string> = {
  PENDING: "Pending",
  DRIVER_ASSIGNED: "Driver assigned",
  PICKED_UP: "Picked up",
  IN_SERVICE: "In service",
  DELIVERED: "Delivered",
};

const STATUS_STYLE: Record<PickupDropStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  DRIVER_ASSIGNED: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
  PICKED_UP: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  IN_SERVICE: "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300",
  DELIVERED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
};

const TYPE_CONFIG: Record<
  PickupDropType,
  {
    label: string;
    cardBorder: string;
  }
> = {
  PICKUP: {
    label: "Pickup",
    cardBorder: "border-sky-200/70 dark:border-sky-900/45",
  },
  DROP: {
    label: "Drop-off",
    cardBorder: "border-emerald-200/70 dark:border-emerald-900/45",
  },
};

const STATUS_ICON_CONFIG: Record<
  PickupDropStatus,
  { icon: LucideIcon; iconBox: string; accentBar: string }
> = {
  PENDING: {
    icon: Clock,
    iconBox: "bg-amber-100 text-amber-700 dark:bg-amber-950/55 dark:text-amber-400",
    accentBar: "bg-amber-500",
  },
  DRIVER_ASSIGNED: {
    icon: UserCheck,
    iconBox: "bg-blue-100 text-blue-700 dark:bg-blue-950/55 dark:text-blue-400",
    accentBar: "bg-blue-500",
  },
  PICKED_UP: {
    icon: Truck,
    iconBox: "bg-sky-100 text-sky-700 dark:bg-sky-950/55 dark:text-sky-400",
    accentBar: "bg-sky-500",
  },
  IN_SERVICE: {
    icon: Wrench,
    iconBox: "bg-violet-100 text-violet-700 dark:bg-violet-950/55 dark:text-violet-400",
    accentBar: "bg-violet-500",
  },
  DELIVERED: {
    icon: CheckCircle2,
    iconBox: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/55 dark:text-emerald-400",
    accentBar: "bg-emerald-500",
  },
};

function StatusBadge({ status }: { status: PickupDropStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
        STATUS_STYLE[status]
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export type PickupDropRequestCardProps = {
  request: PickupDropRequest;
  branchScoped: boolean;
  hasPhone: boolean;
  onAssignDriver: (requestId: string, driverId: string, driverName?: string) => void;
  onAdvance: (request: PickupDropRequest) => void;
  onWhatsApp: (request: PickupDropRequest) => void;
};

export function PickupDropRequestCard({
  request: r,
  branchScoped,
  hasPhone,
  onAssignDriver,
  onAdvance,
  onWhatsApp,
}: PickupDropRequestCardProps) {
  const typeConfig = TYPE_CONFIG[r.type];
  const statusVisual = STATUS_ICON_CONFIG[r.status];
  const StatusIcon = statusVisual.icon;
  const nextStatus = nextPickupDropStatus(r.type, r.status);
  const jobHref =
    r.jobCardId && !r.jobCardId.startsWith("new-") ? `/job-cards/${r.jobCardId}` : null;

  return (
    <Card
      className={cn(
        "overflow-hidden border shadow-sm transition-all hover:shadow-md",
        typeConfig.cardBorder
      )}
    >
      <div className="flex min-h-full">
        <div className={cn("w-1 shrink-0", statusVisual.accentBar)} aria-hidden />
        <CardContent className="flex-1 !p-4 sm:!p-5 min-w-0">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                statusVisual.iconBox
              )}
              title={STATUS_LABEL[r.status]}
            >
              <StatusIcon className="h-5 w-5" />
            </div>

            <div className="flex-1 min-w-0 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-base leading-tight truncate max-w-full">
                      {r.customerName}
                    </h3>
                    <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {typeConfig.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="font-mono text-primary/90">{r.id}</span>
                    {jobHref ? (
                      <>
                        <span aria-hidden>·</span>
                        <Link href={jobHref} className="font-medium text-primary hover:underline">
                          {r.jobNumber}
                        </Link>
                      </>
                    ) : (
                      <>
                        <span aria-hidden>·</span>
                        <span>{r.jobNumber}</span>
                      </>
                    )}
                    {r.vehicleRegNumber && (
                      <>
                        <span aria-hidden>·</span>
                        <span>{r.vehicleRegNumber}</span>
                      </>
                    )}
                  </div>
                </div>
                <StatusBadge status={r.status} />
              </div>

              <div className="grid gap-2 text-sm">
                <p className="flex items-start gap-2 text-muted-foreground min-w-0">
                  <MapPin className="h-4 w-4 shrink-0 mt-0.5 opacity-70" />
                  <span className="min-w-0 break-words leading-snug">{r.address}</span>
                </p>
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4 shrink-0 opacity-70" />
                  <span className="tabular-nums">{formatDateTime(r.scheduledTime)}</span>
                </p>
                {r.driverName && (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4 shrink-0 opacity-70" />
                    <span>{r.driverName}</span>
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-muted/40 px-3 py-2.5 border border-border/50">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground shrink-0">
                    Driver
                  </span>
                  <PickupDriverSelect
                    branchId={r.branchId}
                    value={r.driverId ?? "unassigned"}
                    onValueChange={(id, name) => onAssignDriver(r.id, id, name)}
                    size="compact"
                    branchScoped={branchScoped}
                  />
                </div>
                <div className="flex items-center gap-2 sm:ml-auto">
                  <Button
                    type="button"
                    variant={nextStatus ? "default" : "secondary"}
                    size="sm"
                    className="h-8 text-xs"
                    disabled={!nextStatus}
                    title={
                      nextStatus
                        ? pickupAdvanceActionLabel(nextStatus)
                        : PICKUP_DROP_STATUS_LABEL[r.status]
                    }
                    onClick={() => onAdvance(r)}
                  >
                    {nextStatus ? pickupAdvanceActionLabel(nextStatus) : "Complete"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0 bg-background"
                    disabled={!hasPhone}
                    title={hasPhone ? "WhatsApp customer" : "No phone on file"}
                    onClick={() => onWhatsApp(r)}
                  >
                    <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
