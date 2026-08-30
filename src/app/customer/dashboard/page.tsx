"use client";

import { useEffect } from "react";
import { useCustomerAuthStore } from "@/store/customer-auth-store";
import { useCustomerDashboardStore } from "@/store/customer-dashboard-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ClipboardList,
  FileText,
  Car,
  Gift,
  Wallet,
  Trophy,
  Users,
  Ticket,
  ChevronRight,
  AlertCircle,
  MoreHorizontal,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/utils";

function getTotalPaid(invoice: any): number {
  return (invoice.payments || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
}

export default function CustomerDashboardPage() {
  const { user } = useCustomerAuthStore();
  const {
    customer,
    isLoading,
    error,
    getCurrentJobCard,
    getRecentInvoice,
    getTotalOutstanding,
    getPrimaryVehicle,
    getActiveMemberships,
  } = useCustomerDashboardStore();

  const currentJob = getCurrentJobCard();
  const recentInvoice = getRecentInvoice();
  const totalOutstanding = getTotalOutstanding();
  const primaryVehicle = getPrimaryVehicle();
  const activeMemberships = getActiveMemberships();

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 max-w-4xl mx-auto">
        {/* Loading skeleton */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-32 bg-muted/50 rounded-lg animate-pulse" />
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
              <div>
                <p className="font-medium text-red-900 dark:text-red-200">Failed to load data</p>
                <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl">
      <div className="space-y-4">
        {/* Current Vehicle & Job */}
        {primaryVehicle && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Car className="h-5 w-5" />
                Current Vehicle
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-sm font-medium">
                  {primaryVehicle.make} {primaryVehicle.model}
                </p>
                <p className="text-xs text-muted-foreground">
                  {primaryVehicle.registrationNumber}
                </p>
              </div>
              {currentJob && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Current Service
                  </p>
                  <Link
                    href={`/customer/jobs/${currentJob.id}`}
                    className="block group"
                  >
                    <div className="flex items-start justify-between gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm group-hover:text-primary">
                          Job Card {currentJob.jobNumber}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Status: <span className="font-medium">{currentJob.status}</span>
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 mt-0.5" />
                    </div>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Job Progress (if current job exists) */}
        {currentJob && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Service Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <div className="flex-1">
                    <div className="grid grid-cols-5 gap-1">
                      {[
                        { label: "Received", completed: true },
                        { label: "Inspection", completed: ["INSPECTION", "IN_PROGRESS", "QC", "READY", "INVOICED", "DELIVERED"].includes(currentJob.status) },
                        { label: "Service", completed: ["IN_PROGRESS", "QC", "READY", "INVOICED", "DELIVERED"].includes(currentJob.status) },
                        { label: "QC", completed: ["QC", "READY", "INVOICED", "DELIVERED"].includes(currentJob.status) },
                        { label: "Ready", completed: ["READY", "INVOICED", "DELIVERED"].includes(currentJob.status) },
                      ].map((step, i) => (
                        <div
                          key={i}
                          className={cn(
                            "p-2 rounded text-center text-xs font-medium transition-colors",
                            step.completed
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {step.label}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Invoice */}
        {recentInvoice && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Recent Invoice
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Link
                href={`/customer/invoices/${recentInvoice.id}`}
                className="block group"
              >
                <div className="flex items-start justify-between gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors -mx-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm group-hover:text-primary">
                      Invoice {recentInvoice.invoiceNumber}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(recentInvoice.createdAt)}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 mt-0.5" />
                </div>
              </Link>

              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Total</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(recentInvoice.grandTotal || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Paid</p>
                  <p className="text-lg font-semibold text-green-600">
                    {formatCurrency(getTotalPaid(recentInvoice))}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Due</p>
                  <p className={cn(
                    "text-lg font-semibold",
                    (recentInvoice.grandTotal || 0) - getTotalPaid(recentInvoice) > 0
                      ? "text-red-600"
                      : "text-green-600"
                  )}>
                    {formatCurrency(
                      Math.max(0, (recentInvoice.grandTotal || 0) - getTotalPaid(recentInvoice))
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {/* Rewards */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-2xl font-bold">{customer?.rewardPoints || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Reward Points</p>
                </div>
                <Trophy className="h-5 w-5 text-amber-500" />
              </div>
            </CardContent>
          </Card>

          {/* Wallet */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-2xl font-bold">
                    {formatCurrency(customer?.walletBalance || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Wallet</p>
                </div>
                <Wallet className="h-5 w-5 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          {/* Total Due */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className={cn(
                    "text-2xl font-bold",
                    totalOutstanding > 0 ? "text-red-600" : "text-green-600"
                  )}>
                    {formatCurrency(totalOutstanding)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Outstanding</p>
                </div>
                <FileText className="h-5 w-5 text-red-500" />
              </div>
            </CardContent>
          </Card>

          {/* Memberships */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-2xl font-bold">{activeMemberships.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">Active Plans</p>
                </div>
                <Gift className="h-5 w-5 text-pink-500" />
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
