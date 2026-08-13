"use client";

import { Fragment } from "react";
import Link from "next/link";
import { ArrowLeft, Check, FileText, User } from "lucide-react";
import { JobCardStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { JobCardStatus } from "@/types";

export const JOB_CARD_STATUS_LABELS: Record<JobCardStatus, string> = {
  RECEIVED: "Received",
  INSPECTION: "Inspection",
  AWAITING_SERVICE: "Awaiting / In Service",
  QUALITY_CHECK: "Quality Check",
  READY: "Ready",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

const VISUAL_STEPS = [
  { id: "RECEIVED", label: "Received", statusIndex: 0 },
  { id: "INSPECTION", label: "Inspection", statusIndex: 1 },
  { id: "AWAITING_SERVICE", label: "Service", statusIndex: 2 },
  { id: "QUALITY_CHECK", label: "QC", statusIndex: 3 },
  { id: "READY", label: "Ready", statusIndex: 4 },
  { id: "INVOICE", label: "Invoice", statusIndex: -1 },
  { id: "DELIVERED", label: "Delivered", statusIndex: 5 },
] as const;

export interface JobCardWorkflowChromeProps {
  jobNumber: string;
  currentStatus: JobCardStatus;
  currentStatusIndex: number;
  invoiceForJob: { id: string } | null | undefined;
  advanceBlockedByMechanic: boolean;
  hasMechanicAssigned: boolean;
  updateStatusDisabled: boolean;
  updateStatusDisabledTitle?: string;
  onGenerateInvoice: () => void;
  onUpdateStatus: () => void;
  onCancel: () => void;
  onAssignMechanic: () => void;
}

export function JobCardWorkflowChrome({
  jobNumber,
  currentStatus,
  currentStatusIndex,
  invoiceForJob,
  advanceBlockedByMechanic,
  hasMechanicAssigned,
  updateStatusDisabled,
  updateStatusDisabledTitle,
  onGenerateInvoice,
  onUpdateStatus,
  onCancel,
  onAssignMechanic,
}: JobCardWorkflowChromeProps) {
  return (
    <div className="min-w-0 max-w-full overflow-x-hidden space-y-3 sm:space-y-4">
      <div className="sticky top-0 z-30 -mt-4 border-b border-border/80 bg-background/98 py-2.5 backdrop-blur-sm sm:mt-0">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 md:hidden" asChild>
            <Link href="/job-cards" aria-label="Back to job cards">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-sm font-bold leading-tight">{jobNumber}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              Current status: {JOB_CARD_STATUS_LABELS[currentStatus]}
            </p>
          </div>
          <JobCardStatusBadge status={currentStatus} className="shrink-0 text-[10px]" />
        </div>
      </div>

      {currentStatus !== "CANCELLED" && (
        <Card className="min-w-0 overflow-hidden border-border/80 shadow-sm">
          <CardContent className="!px-3 !py-3 sm:!px-4 sm:!py-4">
            <div
              className="w-full max-w-full overflow-hidden pt-1"
              role="navigation"
              aria-label="Job workflow progress"
            >
              <div className="flex w-full min-w-0 items-start overflow-hidden">
                {VISUAL_STEPS.map((step, index) => {
                  const isLast = index === VISUAL_STEPS.length - 1;
                  let isCompleted = false;
                  let isCurrent = false;

                  if (step.id === "INVOICE") {
                    isCompleted = invoiceForJob != null || currentStatus === "DELIVERED";
                    isCurrent = currentStatus === "READY" && !invoiceForJob;
                  } else if (step.id === "DELIVERED") {
                    isCompleted = currentStatus === "DELIVERED";
                    isCurrent = currentStatus === "DELIVERED";
                  } else {
                    const idx = step.statusIndex;
                    isCompleted =
                      idx < currentStatusIndex ||
                      (currentStatus === "READY" && idx === 4) ||
                      currentStatus === "DELIVERED";
                    isCurrent = idx === currentStatusIndex && !(currentStatus === "READY" && idx === 4);
                  }

                  const stepNumber = step.id === "DELIVERED" ? 6 : index + 1;
                  const showFileIcon = step.id === "INVOICE";
                  const isClickable = step.id === "INVOICE" && isCurrent;

                  return (
                    <Fragment key={step.id}>
                      <div
                        className={cn(
                          "flex min-w-0 flex-1 flex-col items-center px-0.5 select-none",
                          isClickable && "group/step cursor-pointer"
                        )}
                        onClick={isClickable ? onGenerateInvoice : undefined}
                        title={isClickable ? "Click to Generate Invoice" : undefined}
                      >
                        <div
                          className={cn(
                            "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all sm:h-8 sm:w-8",
                            isCompleted
                              ? "border-primary bg-primary text-primary-foreground"
                              : isCurrent
                                ? isClickable
                                  ? "border-primary bg-primary/10 text-primary animate-pulse shadow-md shadow-primary/20 hover:bg-primary/20 scale-105"
                                  : "border-primary bg-primary/10 text-primary"
                                : "border-muted-foreground/30 bg-muted/50 text-muted-foreground"
                          )}
                        >
                          {isCompleted ? (
                            <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          ) : showFileIcon ? (
                            <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          ) : (
                            <span className="text-[10px] font-medium sm:text-xs">{stepNumber}</span>
                          )}
                        </div>
                        <span
                          className={cn(
                            "mt-1 w-full text-center text-[8px] leading-[1.2] line-clamp-2 sm:text-[10px] sm:leading-tight",
                            isCurrent || isCompleted
                              ? "font-semibold text-foreground"
                              : "text-muted-foreground",
                            isClickable && "group-hover/step:text-primary transition-colors"
                          )}
                        >
                          {step.label}
                        </span>
                      </div>
                      {!isLast && (
                        <div
                          className={cn(
                            "mt-3.5 h-0.5 min-w-[3px] max-w-4 flex-[0.35_0_6px] shrink-0 rounded-full sm:max-w-5",
                            isCompleted ? "bg-primary" : "bg-muted"
                          )}
                          aria-hidden
                        />
                      )}
                    </Fragment>
                  );
                })}
              </div>
            </div>
            <div className="mt-3 space-y-2 sm:mt-4">
              {currentStatus === "DELIVERED" || currentStatus === "READY" ? (
                <div className="hidden flex-col gap-3 sm:flex sm:flex-row sm:flex-wrap sm:items-center">
                  <p className="text-sm text-muted-foreground">
                    {currentStatus === "DELIVERED"
                      ? "This job is delivered — you can create the tax invoice or open it if it already exists."
                      : "This job is ready — generate the invoice to mark it as delivered."}
                  </p>
                  <Button
                    type="button"
                    className="w-full shrink-0 sm:w-auto"
                    onClick={onGenerateInvoice}
                    title="Creates the invoice if needed and opens billing to print or record payment."
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    {invoiceForJob ? "View invoice" : "Generate Invoice"}
                  </Button>
                </div>
              ) : (
                <>
                  {advanceBlockedByMechanic && (
                    <p className="text-sm text-amber-600 dark:text-amber-500">
                      Assign a mechanic before moving to In Service — use the button below or the summary header.
                    </p>
                  )}
                  <div className="hidden flex-col gap-2 sm:flex sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                    {!hasMechanicAssigned && (
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full sm:w-auto"
                        onClick={onAssignMechanic}
                      >
                        <User className="w-4 h-4 mr-2" />
                        Assign mechanic
                      </Button>
                    )}
                    <Button
                      type="button"
                      className="w-full sm:w-auto"
                      onClick={onUpdateStatus}
                      disabled={updateStatusDisabled}
                      title={updateStatusDisabledTitle}
                    >
                      Update Status
                    </Button>
                    <Button className="w-full sm:w-auto" variant="destructive" onClick={onCancel}>
                      Cancel
                    </Button>
                  </div>
                  <div className="md:hidden">
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-destructive"
                      onClick={onCancel}
                    >
                      Cancel job
                    </Button>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
