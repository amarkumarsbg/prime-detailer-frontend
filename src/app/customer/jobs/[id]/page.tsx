"use client";

import { useParams } from "next/navigation";
import { useCustomerDashboardStore } from "@/store/customer-dashboard-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Car, CalendarDays, Gauge, ClipboardList, CheckCircle2, Circle, Wrench } from "lucide-react";
import Link from "next/link";
import { cn, formatDate, formatCurrency } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  RECEIVED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  INSPECTION: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  AWAITING_SERVICE: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  QUALITY_CHECK: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  READY: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  INVOICED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  DELIVERED: "bg-slate-100 text-slate-800 dark:bg-slate-800/30 dark:text-slate-300",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const PROGRESS_STEPS = [
  { label: "Received", statuses: ["RECEIVED", "INSPECTION", "AWAITING_SERVICE", "QUALITY_CHECK", "READY", "INVOICED", "DELIVERED"] },
  { label: "Inspection", statuses: ["INSPECTION", "AWAITING_SERVICE", "QUALITY_CHECK", "READY", "INVOICED", "DELIVERED"] },
  { label: "Service", statuses: ["AWAITING_SERVICE", "QUALITY_CHECK", "READY", "INVOICED", "DELIVERED"] },
  { label: "Quality Check", statuses: ["QUALITY_CHECK", "READY", "INVOICED", "DELIVERED"] },
  { label: "Ready", statuses: ["READY", "INVOICED", "DELIVERED"] },
];

export default function JobDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { jobCards, invoices } = useCustomerDashboardStore();

  const job = jobCards.find((j) => j.id === id);

  if (!job) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl">
        <Link href="/customer/jobs">
          <Button variant="ghost" size="sm" className="mb-4 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Jobs
          </Button>
        </Link>
        <Card>
          <CardContent className="pt-12 text-center">
            <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">Job card not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const linkedInvoice = invoices.find((inv) => inv.jobCardId === job.id);
  const completedServices = (job.services || []).filter((s: any) => s.isCompleted).length;
  const totalServices = (job.services || []).length;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl">
      {/* Back + header */}
      <div>
        <Link href="/customer/jobs">
          <Button variant="ghost" size="sm" className="mb-3 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Jobs
          </Button>
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {job.jobNumber}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Created {formatDate(job.createdAt)}
            </p>
          </div>
          <Badge className={cn("shrink-0 mt-1", STATUS_COLORS[job.status] || "")}>
            {job.status.replace(/_/g, " ")}
          </Badge>
        </div>
      </div>

      {/* Progress bar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Service Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-0">
            {PROGRESS_STEPS.map((step, i) => {
              const done = step.statuses.includes(job.status);
              const isLast = i === PROGRESS_STEPS.length - 1;
              return (
                <div key={step.label} className="flex flex-1 flex-col items-center">
                  <div className="flex items-center w-full">
                    <div className={cn(
                      "h-2 flex-1",
                      i === 0 ? "invisible" : done ? "bg-primary" : "bg-muted"
                    )} />
                    <div className={cn(
                      "h-5 w-5 rounded-full border-2 shrink-0 flex items-center justify-center",
                      done
                        ? "bg-primary border-primary"
                        : "border-muted-foreground/30 bg-background"
                    )}>
                      {done && <div className="h-2 w-2 rounded-full bg-white" />}
                    </div>
                    <div className={cn(
                      "h-2 flex-1",
                      isLast ? "invisible" : done && PROGRESS_STEPS[i + 1]?.statuses.includes(job.status) ? "bg-primary" : "bg-muted"
                    )} />
                  </div>
                  <p className={cn(
                    "text-[10px] mt-1 text-center leading-tight",
                    done ? "text-primary font-medium" : "text-muted-foreground"
                  )}>
                    {step.label}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Vehicle info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Car className="h-4 w-4" /> Vehicle
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Make & Model</p>
              <p className="font-medium">{job.vehicleMakeModel || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Registration</p>
              <p className="font-medium">{job.vehicleRegNumber || "—"}</p>
            </div>
            {job.odometerReading && (
              <div>
                <p className="text-xs text-muted-foreground">Odometer</p>
                <p className="font-medium">{job.odometerReading.toLocaleString()} km</p>
              </div>
            )}
            {job.expectedDelivery && (
              <div>
                <p className="text-xs text-muted-foreground">Est. Delivery</p>
                <p className="font-medium">{formatDate(job.expectedDelivery)}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reported issues */}
      {job.reportedIssues && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Reported Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{job.reportedIssues}</p>
          </CardContent>
        </Card>
      )}

      {/* Services */}
      {(job.services || []).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Wrench className="h-4 w-4" /> Services
              </span>
              <span className="text-sm font-normal text-muted-foreground">
                {completedServices}/{totalServices} done
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(job.services as any[]).map((svc) => (
              <div key={svc.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  {svc.isCompleted
                    ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    : <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  }
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{svc.name}</p>
                    {svc.durationMinutes && (
                      <p className="text-xs text-muted-foreground">{svc.durationMinutes} min</p>
                    )}
                  </div>
                </div>
                <p className="text-sm font-semibold shrink-0">{formatCurrency(svc.price)}</p>
              </div>
            ))}
            <div className="flex justify-between pt-1 font-semibold">
              <span>Estimated Total</span>
              <span>{formatCurrency(job.estimatedAmount || 0)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Linked invoice */}
      {linkedInvoice && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Invoice</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href={`/customer/invoices/${linkedInvoice.id}`}>
              <div className="flex items-center justify-between p-3 rounded-lg border hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer">
                <div>
                  <p className="font-medium text-sm">{linkedInvoice.invoiceNumber}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Total {formatCurrency(linkedInvoice.grandTotal || 0)}
                  </p>
                </div>
                <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
              </div>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
