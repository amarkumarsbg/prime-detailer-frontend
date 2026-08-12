"use client";

import { Check } from "lucide-react";
import { PICKUP_DROP_STATUS_LABEL, pickupDropStatusRank } from "@/lib/pickup-drop-flow";
import { pickupAdvanceActionLabel } from "@/lib/pickup-drop-actions";
import type { PickupDropStatus } from "@/types";
import { cn } from "@/lib/utils";

/** Pickup leg stops at In service (no Delivered step for PICKUP type). */
const PICKUP_LEG_STEPS = [
  "PENDING",
  "DRIVER_ASSIGNED",
  "PICKED_UP",
  "IN_SERVICE",
] as const satisfies readonly PickupDropStatus[];

const STEP_SHORT: Record<(typeof PICKUP_LEG_STEPS)[number], string> = {
  PENDING: "Pending",
  DRIVER_ASSIGNED: "Driver",
  PICKED_UP: "Picked up",
  IN_SERVICE: "At workshop",
};

type PickupLegStepperProps = {
  status: PickupDropStatus;
  className?: string;
};

export function PickupLegStepper({ status, className }: PickupLegStepperProps) {
  const currentRank = pickupDropStatusRank(status);

  return (
    <div className={cn("w-full", className)}>
      <div className="hidden sm:flex items-center justify-between gap-1">
        {PICKUP_LEG_STEPS.map((step, index) => {
          const stepRank = pickupDropStatusRank(step);
          const isCompleted = currentRank > stepRank;
          const isCurrent = status === step;
          const isLast = index === PICKUP_LEG_STEPS.length - 1;

          return (
            <div key={step} className="flex flex-1 items-center min-w-0">
              <div className="flex flex-col items-center flex-1 min-w-0 px-0.5">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center border-2 shrink-0 transition-colors",
                    isCompleted
                      ? "bg-primary border-primary text-primary-foreground"
                      : isCurrent
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted-foreground/30 bg-muted/40 text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <span className="text-[11px] font-semibold">{index + 1}</span>
                  )}
                </div>
                <span
                  className={cn(
                    "mt-1.5 text-[11px] leading-tight text-center truncate w-full",
                    isCurrent ? "font-semibold text-foreground" : "text-muted-foreground"
                  )}
                  title={PICKUP_DROP_STATUS_LABEL[step]}
                >
                  {STEP_SHORT[step]}
                </span>
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "h-0.5 flex-1 min-w-[8px] max-w-[48px] mb-5 shrink",
                    isCompleted ? "bg-primary" : "bg-muted"
                  )}
                  aria-hidden
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="sm:hidden space-y-0">
        {PICKUP_LEG_STEPS.map((step, index) => {
          const stepRank = pickupDropStatusRank(step);
          const isCompleted = currentRank > stepRank;
          const isCurrent = status === step;
          const isLast = index === PICKUP_LEG_STEPS.length - 1;

          return (
            <div key={step} className="flex gap-3">
              <div className="flex flex-col items-center shrink-0">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center border-2",
                    isCompleted
                      ? "bg-primary border-primary text-primary-foreground"
                      : isCurrent
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted-foreground/30 bg-muted/40 text-muted-foreground"
                  )}
                >
                  {isCompleted ? <Check className="w-3.5 h-3.5" /> : <span className="text-xs">{index + 1}</span>}
                </div>
                {!isLast && (
                  <div className={cn("w-0.5 h-5 my-0.5", isCompleted ? "bg-primary" : "bg-muted")} aria-hidden />
                )}
              </div>
              <div className={cn("pt-1.5 min-w-0", isLast ? "pb-0" : "pb-2")}>
                <span
                  className={cn(
                    "text-sm",
                    isCurrent ? "font-semibold text-foreground" : "text-muted-foreground"
                  )}
                >
                  {PICKUP_DROP_STATUS_LABEL[step]}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { pickupAdvanceActionLabel };
