"use client";

import { Suspense, useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { InvoiceStatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { createOrGetInvoiceForJob } from "@/lib/invoice-from-job-card";
import { useInvoiceStore } from "@/store/invoice-store";
import { useDashboardFilterStore, DASHBOARD_FILTER } from "@/store/dashboard-filter-store";
import { isPendingPaymentInvoice } from "@/lib/dashboard-filters";
import { FilterBanner } from "@/components/shared/filter-banner";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Invoice, InvoiceStatus } from "@/types";
import { IndianRupee, TrendingUp, FileText, Receipt } from "lucide-react";

const STATUS_TABS: { value: "all" | InvoiceStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "ISSUED", label: "Issued" },
  { value: "PARTIALLY_PAID", label: "Partially Paid" },
  { value: "PAID", label: "Paid" },
];

function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    CASH: "Cash",
    UPI: "UPI",
    CARD: "Card",
  };
  return labels[method] ?? method;
}

/** Handles /billing?jobCardId=… from job card “Generate Invoice” (requires useSearchParams + Suspense). */
function BillingFromJobCardEffect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobCardId = searchParams.get("jobCardId");

  useEffect(() => {
    if (!jobCardId) return;

    const result = createOrGetInvoiceForJob(jobCardId);
    if (!result.ok) {
      if (result.code === "NOT_FOUND") {
        toast.error("Job card not found");
        router.replace("/billing");
      } else if (result.code === "NOT_DELIVERED") {
        toast.error("Deliver the job before generating an invoice");
        router.replace(`/job-cards/${jobCardId}`);
      } else {
        toast.error("Add services on the job card before invoicing");
        router.replace(`/job-cards/${jobCardId}`);
      }
      return;
    }

    if (result.created) {
      toast.success("Invoice created", { description: result.invoiceNumber });
    }
    router.replace(`/billing/${result.invoiceId}`);
  }, [jobCardId, router]);

  return null;
}

export default function BillingPage() {
  const router = useRouter();
  const activeFilter = useDashboardFilterStore((s) => s.activeFilter);
  const setActiveFilter = useDashboardFilterStore((s) => s.setActiveFilter);
  const [activeTab, setActiveTab] = useState<string>("all");
  const invoices = useInvoiceStore((s) => s.invoices);

  const invoicesForView = useMemo(() => {
    if (activeFilter !== DASHBOARD_FILTER.PENDING_PAYMENT) return invoices;
    return invoices.filter(isPendingPaymentInvoice);
  }, [invoices, activeFilter]);

  const tabCounts = useMemo(() => {
    const c: Record<string, number> = { all: invoicesForView.length };
    invoicesForView.forEach((inv) => {
      c[inv.status] = (c[inv.status] ?? 0) + 1;
    });
    return c;
  }, [invoicesForView]);

  const toTableRows = (list: Invoice[]) =>
    list.map((inv) => {
      const serviceLines = inv.lineItems
        .filter((l) => l.type === "SERVICE")
        .map((l) => l.description);
      const servicesSummary =
        serviceLines.length === 0
          ? inv.lineItems
              .slice(0, 2)
              .map((l) => l.description)
              .join(", ") || "—"
          : serviceLines.slice(0, 2).join(", ") + (serviceLines.length > 2 ? "…" : "");
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        jobNumber: inv.jobNumber,
        customerName: inv.customerName,
        vehicleRegNumber: inv.vehicleRegNumber,
        servicesSummary,
        grandTotal: inv.grandTotal,
        status: inv.status,
        paymentMethod: inv.payments[0]?.method ?? null,
        walletAmountUsed: inv.walletAmountUsed,
        createdAt: inv.createdAt,
      };
    }) as Record<string, unknown>[];

  const allTableData = useMemo(() => toTableRows(invoicesForView), [invoicesForView]);

  const kpis = useMemo(() => {
    const paidInvoices = invoices.filter((i) => i.status === "PAID");
    const totalRevenue = paidInvoices.reduce((sum, i) => sum + i.grandTotal, 0);
    const outstanding = invoices
      .filter((i) => i.status === "ISSUED" || i.status === "PARTIALLY_PAID")
      .reduce((sum, i) => {
        const paid = i.payments.reduce((p, pay) => p + pay.amount, 0);
        return sum + (i.grandTotal - paid);
      }, 0);
    const now = new Date();
    const thisMonth = invoices.filter((inv) => {
      const d = new Date(inv.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const avgValue =
      paidInvoices.length > 0 ? totalRevenue / paidInvoices.length : 0;

    return {
      totalRevenue,
      outstanding,
      thisMonth,
      avgValue,
    };
  }, [invoices]);

  const columns = [
    {
      key: "invoiceNumber",
      label: "Invoice Number",
      render: (item: Record<string, unknown>) => (
        <span className="font-mono font-bold">{item.invoiceNumber as string}</span>
      ),
      sortable: true,
    },
    {
      key: "customerName",
      label: "Customer Name",
      render: (item: Record<string, unknown>) => (
        <span className="font-medium">{item.customerName as string}</span>
      ),
      sortable: true,
    },
    {
      key: "vehicleRegNumber",
      label: "Vehicle",
      render: (item: Record<string, unknown>) => (
        <span className="text-muted-foreground">{item.vehicleRegNumber as string}</span>
      ),
      sortable: true,
    },
    {
      key: "jobNumber",
      label: "Job #",
      render: (item: Record<string, unknown>) => (
        <span className="font-mono text-sm text-muted-foreground">{item.jobNumber as string}</span>
      ),
      sortable: true,
    },
    {
      key: "servicesSummary",
      label: "Services / items",
      render: (item: Record<string, unknown>) => (
        <span className="text-muted-foreground line-clamp-2 max-w-[220px] text-sm">
          {item.servicesSummary as string}
        </span>
      ),
    },
    {
      key: "grandTotal",
      label: "Amount",
      render: (item: Record<string, unknown>) => (
        <div className="space-y-0.5">
          <span className="font-bold">{formatCurrency(item.grandTotal as number)}</span>
          {(item.walletAmountUsed as number) > 0 && (
            <p className="text-xs text-muted-foreground">
              Wallet: {formatCurrency(item.walletAmountUsed as number)}
            </p>
          )}
        </div>
      ),
      sortable: true,
    },
    {
      key: "status",
      label: "Status",
      render: (item: Record<string, unknown>) => (
        <InvoiceStatusBadge status={item.status as InvoiceStatus} />
      ),
    },
    {
      key: "paymentMethod",
      label: "Payment Method",
      render: (item: Record<string, unknown>) => {
        const method = item.paymentMethod as string | null;
        return method ? (
          <Badge variant="outline">{getPaymentMethodLabel(method)}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      key: "createdAt",
      label: "Date",
      render: (item: Record<string, unknown>) => (
        <span className="text-muted-foreground">
          {formatDate(item.createdAt as string)}
        </span>
      ),
      sortable: true,
    },
  ];

  const handleRowClick = (item: Record<string, unknown>) => {
    router.push(`/billing/${item.id}`);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <Suspense fallback={null}>
        <BillingFromJobCardEffect />
      </Suspense>
      <PageHeader
        title="Billing & Invoices"
        description="View and manage invoices, payments, and billing history"
      />

      {activeFilter === DASHBOARD_FILTER.PENDING_PAYMENT && (
        <FilterBanner
          message="⚠ Showing pending payments — awaiting collection"
          onDismiss={() => setActiveFilter(null)}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Revenue"
          value={formatCurrency(kpis.totalRevenue)}
          icon={IndianRupee}
          tone="emerald"
        />
        <KPICard
          title="Outstanding"
          value={formatCurrency(kpis.outstanding)}
          icon={TrendingUp}
          tone="rose"
        />
        <KPICard
          title="Invoices This Month"
          value={kpis.thisMonth}
          icon={FileText}
          tone="blue"
        />
        <KPICard
          title="Average Invoice Value"
          value={formatCurrency(kpis.avgValue)}
          icon={Receipt}
          tone="violet"
        />
      </div>

      <Card className="border-border/80 shadow-sm overflow-hidden">
        <CardHeader className="space-y-1 border-b border-border/80 bg-muted/20 pb-4">
          <CardTitle className="text-base font-semibold">Invoices</CardTitle>
          <p className="text-sm text-muted-foreground">
            Open an invoice to record payments, print, or share via WhatsApp.
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex-wrap h-auto gap-1 w-full justify-start bg-muted/50 p-1">
              {STATUS_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="data-[state=active]:shadow-sm">
                  {tab.label}{" "}
                  <span className="text-muted-foreground font-normal">
                    ({tabCounts[tab.value] ?? 0})
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
            {STATUS_TABS.map((tab) => (
              <TabsContent key={tab.value} value={tab.value} className="mt-6 focus-visible:outline-none">
                <DataTable
                  data={
                    tab.value === "all"
                      ? allTableData
                      : toTableRows(invoicesForView.filter((inv) => inv.status === tab.value))
                  }
                  columns={columns}
                  searchPlaceholder="Search by invoice number, customer, or vehicle..."
                  searchKeys={[
                    "invoiceNumber",
                    "customerName",
                    "vehicleRegNumber",
                    "jobNumber",
                    "servicesSummary",
                  ]}
                  pageSize={10}
                  onRowClick={handleRowClick}
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
