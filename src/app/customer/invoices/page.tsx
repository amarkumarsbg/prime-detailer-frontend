"use client";

import { useCustomerDashboardStore } from "@/store/customer-dashboard-store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, FileText, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/utils";

const INVOICE_STATUS_COLORS: Record<string, string> = {
  "DRAFT": "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300",
  "ISSUED": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  "PARTIALLY_PAID": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  "PAID": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  "OVERDUE": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  "CANCELLED": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

function getTotalPaid(invoice: any): number {
  return (invoice.payments || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
}

export default function CustomerInvoicesPage() {
  const { invoices, isLoading, error } = useCustomerDashboardStore();

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

  const totalBilled = invoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + getTotalPaid(inv), 0);
  const totalDue = totalBilled - totalPaid;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl">
      <p className="text-sm text-muted-foreground">
        {invoices.length} invoice{invoices.length !== 1 ? "s" : ""} total
      </p>

      <div className="space-y-4">
        {/* Billing Summary */}
        {invoices.length > 0 && (
          <div className="grid grid-cols-1 min-[520px]:grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs font-medium text-muted-foreground">Total Billed</p>
                <p className="text-lg min-[520px]:text-xl font-bold mt-1 leading-tight tabular-nums wrap-break-word">
                  {formatCurrency(totalBilled)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <p className="text-xs font-medium text-muted-foreground">Paid</p>
                <p className="text-lg min-[520px]:text-xl font-bold mt-1 leading-tight tabular-nums wrap-break-word text-green-600">
                  {formatCurrency(totalPaid)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <p className="text-xs font-medium text-muted-foreground">Due</p>
                <p className={cn(
                  "text-lg min-[520px]:text-xl font-bold mt-1 leading-tight tabular-nums wrap-break-word",
                  totalDue > 0 ? "text-red-600" : "text-green-600"
                )}>
                  {formatCurrency(totalDue)}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Invoices List */}
        {invoices.length === 0 ? (
          <Card>
            <CardContent className="pt-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="font-medium">No invoices yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your invoices will appear here once a service is completed
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {[...invoices]
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((invoice) => {
                const outstanding = (invoice.grandTotal || 0) - getTotalPaid(invoice);
                const status = 
                  getTotalPaid(invoice) === 0
                    ? "ISSUED"
                    : outstanding > 0.01
                    ? "PARTIALLY_PAID"
                    : "PAID";

                return (
                  <Link key={invoice.id} href={`/customer/invoices/${invoice.id}`}>
                    <Card className="cursor-pointer hover:border-primary/50 transition-colors group">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <p className="font-semibold truncate">
                                Invoice {invoice.invoiceNumber}
                              </p>
                              <Badge className={cn(INVOICE_STATUS_COLORS[status] || "")}>
                                {status}
                              </Badge>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                              <div>
                                <p className="text-xs text-muted-foreground">Vehicle</p>
                                <p className="font-medium text-sm">
                                  {invoice.vehicleMakeModel?.trim() && invoice.vehicleRegNumber?.trim() 
                                    ? `${invoice.vehicleMakeModel.trim()} (${invoice.vehicleRegNumber.trim()})`
                                    : invoice.vehicleMakeModel?.trim() || invoice.vehicleRegNumber?.trim() || "—"}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Date</p>
                                <p className="font-medium text-sm">
                                  {formatDate(invoice.createdAt)}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 pt-2 border-t text-xs">
                              <div>
                                <p className="text-muted-foreground">Total</p>
                                <p className="font-semibold text-sm">
                                  {formatCurrency(invoice.grandTotal || 0)}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Paid</p>
                                <p className="font-semibold text-sm text-green-600">
                                  {formatCurrency(getTotalPaid(invoice))}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Due</p>
                                <p className={cn(
                                  "font-semibold text-sm",
                                  outstanding > 0 ? "text-red-600" : "text-green-600"
                                )}>
                                  {formatCurrency(outstanding)}
                                </p>
                              </div>
                            </div>
                          </div>

                          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary shrink-0 mt-1" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
