"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Check,
  CheckCircle2,
  Clock,
  Truck,
  UserCheck,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PickupDriverSelect } from "@/components/pickup-drop/pickup-driver-select";
import { usePickupDropStore } from "@/store/pickup-drop-store";
import { useBranchStore } from "@/store/branch-store";
import { useSettingsStore } from "@/store/settings-store";
import { notifyPickupDropWhatsApp } from "@/lib/whatsapp-automation-triggers";
import {
  getLinkedPickupRequest,
  nextPickupDropStatus,
  PICKUP_DROP_STATUS_LABEL,
  pickupDropStatusRank,
  validatePickupDropAdvance,
} from "@/lib/pickup-drop-flow";
import { cn } from "@/lib/utils";
import type { PickupDropStatus } from "@/types";

const PICKUP_STEPS = [
  "PENDING",
  "DRIVER_ASSIGNED",
  "PICKED_UP",
  "IN_SERVICE",
] as const satisfies readonly PickupDropStatus[];

const STEP_SHORT: Record<(typeof PICKUP_STEPS)[number], string> = {
  PENDING: "Pending",
  DRIVER_ASSIGNED: "Driver",
  PICKED_UP: "Picked up",
  IN_SERVICE: "At workshop",
};

const STATUS_ICON: Record<
  PickupDropStatus,
  { icon: LucideIcon; className: string }
> = {
  PENDING: { icon: Clock, className: "text-amber-600 dark:text-amber-400" },
  DRIVER_ASSIGNED: { icon: UserCheck, className: "text-blue-600 dark:text-blue-400" },
  PICKED_UP: { icon: Truck, className: "text-sky-600 dark:text-sky-400" },
  IN_SERVICE: { icon: Wrench, className: "text-violet-600 dark:text-violet-400" },
  DELIVERED: { icon: CheckCircle2, className: "text-emerald-600 dark:text-emerald-400" },
};

function PickupProgressPills({ status }: { status: PickupDropStatus }) {
  const currentRank = pickupDropStatusRank(status);

  return (
    <div className="flex flex-wrap gap-1.5" role="list" aria-label="Pickup progress">
      {PICKUP_STEPS.map((step) => {
        const stepRank = pickupDropStatusRank(step);
        const isCompleted = currentRank > stepRank;
        const isCurrent = status === step;

        return (
          <span
            key={step}
            role="listitem"
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors",
              isCompleted && "bg-primary/12 text-primary",
              isCurrent && "bg-primary text-primary-foreground shadow-sm",
              !isCompleted && !isCurrent && "bg-muted/80 text-muted-foreground"
            )}
          >
            {isCompleted ? <Check className="h-3 w-3 shrink-0" aria-hidden /> : null}
            {STEP_SHORT[step]}
          </span>
        );
      })}
    </div>
  );
}

type JobCardPickupPanelProps = {
  jobCardId: string;
  branchId: string;
  className?: string;
};

export function JobCardPickupPanel({ jobCardId, branchId, className }: JobCardPickupPanelProps) {
  const requests = usePickupDropStore((s) => s.requests);
  const assignDriver = usePickupDropStore((s) => s.assignDriver);
  const advanceStatus = usePickupDropStore((s) => s.advanceStatus);

  const pickup = getLinkedPickupRequest(jobCardId, requests);
  if (!pickup) return null;
  if (pickup.status === "IN_SERVICE" || pickup.status === "DELIVERED") return null;

  const nextStatus = nextPickupDropStatus(pickup.type, pickup.status);
  const { icon: StatusIcon, className: iconClass } = STATUS_ICON[pickup.status];

  const handleAssignDriver = (value: string, driverName?: string) => {
    if (value === "unassigned") {
      assignDriver(pickup.id, undefined, undefined);
      return;
    }
    assignDriver(pickup.id, value, driverName);
    if (driverName) toast.success(`Pickup driver: ${driverName}`);
    const updated = usePickupDropStore.getState().requests.find((row) => row.id === pickup.id);
    if (updated) {
      const branchName = useBranchStore.getState().branches.find((b) => b.id === updated.branchId)?.name;
      notifyPickupDropWhatsApp(updated, {
        branchName,
        businessName: useSettingsStore.getState().businessName,
      });
    }
  };

  const handleAdvance = () => {
    const block = validatePickupDropAdvance(pickup);
    if (block) {
      toast.error(block);
      return;
    }
    const next = advanceStatus(pickup.id);
    if (!next) {
      toast.message("Pickup leg complete");
      return;
    }
    toast.success(PICKUP_DROP_STATUS_LABEL[next]);
    const updated = usePickupDropStore.getState().requests.find((row) => row.id === pickup.id);
    if (updated) {
      const branchName = useBranchStore.getState().branches.find((b) => b.id === updated.branchId)?.name;
      notifyPickupDropWhatsApp(updated, {
        branchName,
        businessName: useSettingsStore.getState().businessName,
      });
    }
  };

  const advanceLabel =
    nextStatus === "DRIVER_ASSIGNED"
      ? "Confirm driver"
      : nextStatus === "PICKED_UP"
        ? "Mark picked up"
        : nextStatus === "IN_SERVICE"
          ? "At workshop"
          : nextStatus
            ? PICKUP_DROP_STATUS_LABEL[nextStatus]
            : null;

  return (
    <div
      className={cn(
        "mb-5 rounded-lg border border-border/70 bg-muted/25 px-3 py-3 sm:px-4 sm:py-3.5",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <StatusIcon className={cn("h-4 w-4 shrink-0", iconClass)} aria-hidden />
          <span className="text-sm font-medium">Customer pickup</span>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            — finish before Inspection
          </span>
        </div>
        <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs shrink-0" asChild>
          <Link href="/pickup-drop">All requests</Link>
        </Button>
      </div>

      <PickupProgressPills status={pickup.status} />

      <div className="mt-3 flex flex-wrap items-center gap-2 pt-3 border-t border-border/50">
        <PickupDriverSelect
          branchId={branchId}
          value={pickup.driverId ?? "unassigned"}
          onValueChange={handleAssignDriver}
          size="compact"
        />
        {advanceLabel ? (
          <Button type="button" size="sm" className="h-8 text-xs shrink-0" onClick={handleAdvance}>
            {advanceLabel}
          </Button>
        ) : null}
        {pickup.address && (
          <p className="w-full sm:w-auto sm:ml-auto text-[11px] text-muted-foreground truncate max-w-full sm:max-w-[240px]">
            {pickup.address}
          </p>
        )}
      </div>
    </div>
  );
}
