"use client";

import { useCustomerAuthStore } from "@/store/customer-auth-store";
import { useCustomerDashboardStore } from "@/store/customer-dashboard-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardList, AlertCircle, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  "RECEIVED": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  "INSPECTION": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  "IN_PROGRESS": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  "QC": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  "READY": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  "INVOICED": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  "DELIVERED": "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300",
  "CANCELLED": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

export default function CustomerJobsPage() {
  const { jobCards, invoices, isLoading, error } = useCustomerDashboardStore();

  if (isLoading) {
    return (
      <div className="p-4 space-y-3 max-w-4xl mx-auto">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 bg-muted/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 max-w-4xl mx-auto">
        <Card className="border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl">
      <p className="text-sm text-muted-foreground">
        {jobCards.length} job{jobCards.length !== 1 ? "s" : ""} total
      </p>

      <div>
        {jobCards.length === 0 ? (
          <Card>
            <CardContent className="pt-12 text-center">
              <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="font-medium">No service jobs yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your completed or ongoing services will appear here
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {[...jobCards]
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((job) => (
                (() => {
                  const hasInvoice = invoices.some((inv) => inv.jobCardId === job.id);
                  const displayStatus =
                    job.status === "DELIVERED" || job.status === "CANCELLED"
                      ? job.status
                      : hasInvoice
                        ? "INVOICED"
                        : job.status;
                  return (
                <Link key={job.id} href={`/customer/jobs/${job.id}`}>
                  <Card className="cursor-pointer hover:border-primary/50 transition-colors group">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <p className="font-semibold truncate">
                              Job Card {job.jobNumber}
                            </p>
                            <Badge className={cn(STATUS_COLORS[displayStatus] || "")}>
                              {displayStatus}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground">Vehicle</p>
                              <p className="font-medium text-sm">
                                {job.vehicleMakeModel || "Unknown"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {job.vehicleRegNumber}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-muted-foreground">Date</p>
                              <p className="font-medium text-sm">
                                {formatDate(job.createdAt)}
                              </p>
                            </div>
                          </div>

                          {job.services && job.services.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs text-muted-foreground">Services</p>
                              <p className="text-sm font-medium line-clamp-1">
                                {job.services
                                  .map((item: any) => item.name)
                                  .join(", ")}
                              </p>
                            </div>
                          )}
                        </div>

                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary shrink-0 mt-1" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
                  );
                })()
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
