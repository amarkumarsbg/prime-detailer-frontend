"use client";

import { Suspense, useCallback, useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { InvoiceStatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { SharedLedgerClient } from "@/components/shared-ledger/shared-ledger-client";
import { createOrGetInvoiceForJob } from "@/lib/invoice-from-job-card";
import { notifyInvoiceCreatedWhatsApp } from "@/lib/whatsapp-automation-triggers";
import { useInvoiceStore } from "@/store/invoice-store";
import { useJobCardStore } from "@/store/job-card-store";
import { useSettingsStore } from "@/store/settings-store";
import {
  applyInvoiceBranchFilters,
  useBranchScope,
} from "@/lib/branch-scope";
import { useDashboardFilterStore, DASHBOARD_FILTER } from "@/store/dashboard-filter-store";
import { isPendingPaymentInvoice, groupPendingPaymentCustomers } from "@/lib/dashboard-filters";
import { FilterBanner } from "@/components/shared/filter-banner";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { Invoice, InvoiceStatus } from "@/types";
import { BookMarked, Eye, IndianRupee, Pencil, Trash2, TrendingUp, FileText, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { invoiceOutstanding } from "@/lib/party/ledger-math";
import { invoiceSourceColumnLabel } from "@/lib/invoice-source";
import { shareCustomerLedgerWhatsApp } from "@/lib/share-customer-ledger";
import { useDashboardStoresReady } from "@/hooks/use-dashboard-stores-ready";
import { PageSkeleton, RefreshingBar } from "@/components/shared/skeleton-loader";

const STATUS_TABS: { value: "all" | InvoiceStatus; label: string; shortLabel?: string }[] = [
  { value: "all", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "ISSUED", label: "Issued" },
  { value: "PARTIALLY_PAID", label: "Partially Paid", shortLabel: "Partial" },
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
        toast.error("Mark the job ready before generating an invoice");
        router.replace(`/job-cards/${jobCardId}`);
      } else {
        toast.error("Add services on the job card before invoicing");
        router.replace(`/job-cards/${jobCardId}`);
      }
      return;
    }

    if (result.created) {
      toast.success("Invoice created", { description: result.invoiceNumber });
      const inv = useInvoiceStore.getState().invoices.find((i) => i.id === result.invoiceId);
      const businessName = useSettingsStore.getState().businessName;
      if (inv) notifyInvoiceCreatedWhatsApp(inv, businessName);
    }
    router.replace(`/billing/invoices/${encodeURIComponent(result.invoiceId)}`);
  }, [jobCardId, router]);

  return null;
}

function BillingLedgerQueryEffect({
  onOpenLedger,
}: {
  onOpenLedger: (customerId: string) => void;
}) {
  const searchParams = useSearchParams();
  const view = searchParams.get("view");
  const customerId = searchParams.get("customerId");

  useEffect(() => {
    if (view === "ledger" && customerId) {
      onOpenLedger(customerId);
    }
  }, [view, customerId, onOpenLedger]);

  return null;
}

type BillingView = "invoices" | "ledger";

function invoiceRowIsMutable(item: Record<string, unknown>): boolean {
  const status = item.status as InvoiceStatus;
  const paymentCount = Number(item.paymentCount ?? 0);
  const wallet = Number(item.walletAmountUsed ?? 0);
  return paymentCount === 0 && wallet <= 0 && status !== "PAID" && status !== "PARTIALLY_PAID";
}

function InvoiceRowActions({
  item,
  onView,
  onEdit,
  onDelete,
}: {
  item: Record<string, unknown>;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const mutable = invoiceRowIsMutable(item);
  const lockedHint = "Recorded payments lock this invoice from edit or delete";
  return (
    <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="View invoice" onClick={onView}>
        <Eye className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        aria-label="Edit invoice"
        disabled={!mutable}
        title={mutable ? "Edit invoice" : lockedHint}
        onClick={onEdit}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive hover:text-destructive"
        aria-label="Delete invoice"
        disabled={!mutable}
        title={mutable ? "Delete invoice" : lockedHint}
        onClick={onDelete}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function BillingPage() {
  const storesReady = useDashboardStoresReady();
  const router = useRouter();
  const activeFilter = useDashboardFilterStore((s) => s.activeFilter);
  const setActiveFilter = useDashboardFilterStore((s) => s.setActiveFilter);
  const [billingView, setBillingView] = useState<BillingView>("invoices");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [ledgerFocusCustomerId, setLedgerFocusCustomerId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    invoiceNumber: string;
    customerName: string;
  } | null>(null);
  const [deletingInvoice, setDeletingInvoice] = useState(false);
  const invoices = useInvoiceStore((s) => s.invoices);
  const total = useInvoiceStore((s) => s.total);
  const totalPages = useInvoiceStore((s) => s.totalPages);
  const currentPage = useInvoiceStore((s) => s.page);
  const isLoading = useInvoiceStore((s) => s.invoicesLoading);
  const isInitialLoaded = useInvoiceStore((s) => s.isInitialLoaded);
  const fetchPaginatedInvoices = useInvoiceStore((s) => s.fetchPaginatedInvoices);
  const deleteInvoice = useInvoiceStore((s) => s.deleteInvoice);
  const jobCards = useJobCardStore((s) => s.jobCards);
  const businessName = useSettingsStore((s) => s.businessName);
  const { selectedBranchId, showBranchPicker, viewingLabel } = useBranchScope();

  const branchScopedInvoices = useMemo(
    () =>
      applyInvoiceBranchFilters(
        invoices,
        jobCards,
        selectedBranchId,
        showBranchPicker,
        "all"
      ),
    [invoices, jobCards, selectedBranchId, showBranchPicker]
  );

  const invoicesForView = useMemo(() => {
    if (activeFilter !== DASHBOARD_FILTER.PENDING_PAYMENT) return branchScopedInvoices;
    return branchScopedInvoices.filter(isPendingPaymentInvoice);
  }, [branchScopedInvoices, activeFilter]);

  const [searchQuery, setSearchQuery] = useState("");
  const isFirstMount = useRef(true);

  useEffect(() => {
    const filters: Record<string, unknown> = {};
    if (selectedBranchId) filters.branchId = selectedBranchId;
    if (activeTab !== "all") filters.status = activeTab;
    if (activeFilter) filters.dashboardFilter = activeFilter;

    const isDefaultFilters = !selectedBranchId && activeTab === "all" && !activeFilter;

    if (isFirstMount.current && isInitialLoaded && !searchQuery && isDefaultFilters) {
      isFirstMount.current = false;
      return;
    }
    isFirstMount.current = false;

    fetchPaginatedInvoices({ page: 1, pageSize: 50, search: searchQuery, filters });
  }, [searchQuery, activeTab, activeFilter, selectedBranchId, fetchPaginatedInvoices, isInitialLoaded]);

  const handlePageChange = (newPage: number) => {
    const filters: Record<string, unknown> = {};
    if (selectedBranchId) filters.branchId = selectedBranchId;
    if (activeTab !== "all") filters.status = activeTab;
    if (activeFilter) filters.dashboardFilter = activeFilter;

    fetchPaginatedInvoices({ page: newPage, pageSize: 50, search: searchQuery, filters });
  };

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
        source: inv.source ?? "",
        customerId: inv.customerId,
        customerName: inv.customerName,
        customerPhone: inv.customerPhone,
        vehicleRegNumber: inv.vehicleRegNumber,
        servicesSummary,
        grandTotal: inv.grandTotal,
        outstanding: invoiceOutstanding(inv),
        status: inv.status,
        paymentMethod: inv.payments[0]?.method ?? null,
        paymentCount: inv.payments.length,
        walletAmountUsed: inv.walletAmountUsed,
        createdAt: inv.createdAt,
      };
    }) as Record<string, unknown>[];

  const allTableData = useMemo(() => toTableRows(invoicesForView), [invoicesForView]);
  const pendingCustomers = useMemo(
    () => groupPendingPaymentCustomers(invoicesForView),
    [invoicesForView]
  );
  const pendingCustomerRows = useMemo(
    () => pendingCustomers as unknown as Record<string, unknown>[],
    [pendingCustomers]
  );
  const showingPendingCustomers = activeFilter === DASHBOARD_FILTER.PENDING_PAYMENT;

  const openCustomerLedger = useCallback((customerId: string) => {
    setLedgerFocusCustomerId(customerId);
    setBillingView("ledger");
  }, []);

  const sharePendingCustomerLedger = (customerId: string, phoneHint?: string) => {
    const row = pendingCustomers.find((c) => c.customerId === customerId);
    void shareCustomerLedgerWhatsApp({
      customer: {
        id: customerId,
        name: row?.customerName ?? "Customer",
        phone: phoneHint || row?.customerPhone,
      },
      invoices,
      businessName,
    });
  };

  const kpis = useMemo(() => {
    const paidInvoices = branchScopedInvoices.filter((i) => i.status === "PAID");
    const totalRevenue = paidInvoices.reduce((sum, i) => sum + i.grandTotal, 0);
    const outstanding = branchScopedInvoices
      .filter((i) => i.status === "ISSUED" || i.status === "PARTIALLY_PAID")
      .reduce((sum, i) => {
        const paid = i.payments.reduce((p, pay) => p + pay.amount, 0) + (i.walletAmountUsed || 0);
        return sum + (i.grandTotal - paid);
      }, 0);
    const now = new Date();
    const thisMonth = branchScopedInvoices.filter((inv) => {
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
  }, [branchScopedInvoices]);

  const columns = [
    {
      key: "createdAt",
      label: "Date",
      sortable: true,
      render: (item: Record<string, unknown>) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {formatDate(item.createdAt as string)}
        </span>
      ),
    },
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
        <span className="font-mono text-sm text-muted-foreground">
          {invoiceSourceColumnLabel(item as Pick<Invoice, "source" | "jobNumber">)}
        </span>
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
      key: "actions",
      label: "Actions",
      className: "text-right w-[120px]",
      render: (item: Record<string, unknown>) => {
        const invoiceId = String(item.id ?? "");
        return (
          <InvoiceRowActions
            item={item}
            onView={() => router.push(`/billing/invoices/${encodeURIComponent(invoiceId)}`)}
            onEdit={() =>
              router.push(`/billing/invoices/${encodeURIComponent(invoiceId)}?edit=1`)
            }
            onDelete={() =>
              setDeleteTarget({
                id: invoiceId,
                invoiceNumber: String(item.invoiceNumber ?? ""),
                customerName: String(item.customerName ?? ""),
              })
            }
          />
        );
      },
    },
  ];

  const pendingCustomerColumns = [
    {
      key: "customerName",
      label: "Customer",
      sortable: true,
      render: (item: Record<string, unknown>) => (
        <span className="font-medium">{String(item.customerName ?? "")}</span>
      ),
    },
    {
      key: "customerPhone",
      label: "Phone",
      sortable: true,
      render: (item: Record<string, unknown>) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {String(item.customerPhone ?? "—")}
        </span>
      ),
    },
    {
      key: "invoiceCount",
      label: "Open invoices",
      sortable: true,
      render: (item: Record<string, unknown>) => (
        <span className="tabular-nums">{Number(item.invoiceCount ?? 0)}</span>
      ),
    },
    {
      key: "outstanding",
      label: "Outstanding",
      sortable: true,
      render: (item: Record<string, unknown>) => (
        <span className="font-semibold tabular-nums">
          {formatCurrency(Number(item.outstanding ?? 0))}
        </span>
      ),
    },
    {
      key: "ledger",
      label: "Ledger",
      render: (item: Record<string, unknown>) => {
        const customerId = String(item.customerId ?? "");
        const phone = String(item.customerPhone ?? "").trim();
        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 px-2.5"
              onClick={() => {
                if (customerId) openCustomerLedger(customerId);
              }}
            >
              <Eye className="h-3.5 w-3.5 shrink-0" />
              Ledger
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 px-2.5 text-[#128C7E] hover:bg-[#25D366]/10 hover:text-[#075E54]"
              disabled={!phone}
              title={phone ? "Share ledger via WhatsApp" : "No phone on file"}
              onClick={() => {
                if (customerId) sharePendingCustomerLedger(customerId, phone);
              }}
            >
              <WhatsAppIcon className="h-3.5 w-3.5" />
              Share Ledger
            </Button>
          </div>
        );
      },
    },
  ];

  const handleRowClick = (item: Record<string, unknown>) => {
    router.push(`/billing/invoices/${encodeURIComponent(String(item.id ?? ""))}`);
  };

  const confirmDeleteInvoice = async () => {
    if (!deleteTarget) return;
    setDeletingInvoice(true);
    try {
      await deleteInvoice(deleteTarget.id);
      toast.success("Invoice deleted", { description: deleteTarget.invoiceNumber });
      setDeleteTarget(null);
    } catch {
      toast.error("Could not delete invoice");
    } finally {
      setDeletingInvoice(false);
    }
  };

  if (!storesReady && !isInitialLoaded && invoicesForView.length === 0) return <PageSkeleton />;

  return (
    <div className="space-y-4 sm:space-y-6">
      <RefreshingBar show={!storesReady} />
      <Suspense fallback={null}>
        <BillingFromJobCardEffect />
        <BillingLedgerQueryEffect onOpenLedger={openCustomerLedger} />
      </Suspense>
      <PageHeader
        title="Billing & Invoices"
        description={
          billingView === "ledger"
            ? `Customer ledger for ${viewingLabel} — balances from invoices.`
            : `View and manage invoices for ${viewingLabel}.`
        }
        hideDescriptionOnMobile
      />

      <Tabs
        value={billingView}
        onValueChange={(v) => setBillingView(v as BillingView)}
        className="space-y-4 sm:space-y-6"
      >
        <TabsList className="h-auto w-full justify-start gap-0 rounded-none border-b border-border bg-transparent p-0">
          {(
            [
              ["invoices", "Invoices", FileText],
              ["ledger", "Ledger", BookMarked],
            ] as const
          ).map(([value, label, Icon]) => (
            <TabsTrigger
              key={value}
              value={value}
              className={cn(
                "rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium shadow-none gap-1.5",
                "data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground",
                "data-[state=active]:shadow-none"
              )}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-70" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="invoices" className="mt-0 space-y-4 sm:space-y-6 focus-visible:outline-none">
          {activeFilter === DASHBOARD_FILTER.PENDING_PAYMENT && (
            <FilterBanner
              message="⚠ Showing pending payments — awaiting collection"
              onDismiss={() => setActiveFilter(null)}
            />
          )}

          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <KPICard
              size="compact"
              title="Total Revenue"
              value={formatCurrency(kpis.totalRevenue)}
              icon={IndianRupee}
              tone="emerald"
              titleClassName="text-[11px] leading-tight sm:text-xs"
              valueClassName="text-lg sm:text-xl tabular-nums"
            />
            <KPICard
              size="compact"
              title="Outstanding"
              value={formatCurrency(kpis.outstanding)}
              icon={TrendingUp}
              tone="rose"
              titleClassName="text-[11px] leading-tight sm:text-xs"
              valueClassName="text-lg sm:text-xl tabular-nums"
            />
            <KPICard
              size="compact"
              title="Invoices This Month"
              value={kpis.thisMonth}
              icon={FileText}
              tone="blue"
              titleClassName="text-[11px] leading-tight sm:text-xs"
              valueClassName="text-lg sm:text-xl tabular-nums"
            />
            <KPICard
              size="compact"
              title="Avg Invoice"
              value={formatCurrency(kpis.avgValue)}
              icon={Receipt}
              tone="violet"
              titleClassName="text-[11px] leading-tight sm:text-xs"
              valueClassName="text-lg sm:text-xl tabular-nums"
            />
          </div>

          <Card className="border-border/80 shadow-sm overflow-hidden">
            <CardHeader className="space-y-0.5 border-b border-border/80 bg-muted/20 px-4 pb-3 pt-4 sm:px-6 sm:pb-4">
              <CardTitle className="text-base font-semibold">
                {showingPendingCustomers ? "Pending payment customers" : "Invoices"}
              </CardTitle>
              <p className="hidden text-sm text-muted-foreground md:block">
                {showingPendingCustomers
                  ? "Only customers with a balance due. Open the ledger to view or share the statement."
                  : "Open an invoice to record payments, print, or share via WhatsApp."}
              </p>
            </CardHeader>
            <CardContent className="px-3 pt-4 sm:px-6 sm:pt-6">
              {showingPendingCustomers ? (
                <DataTable
                  data={pendingCustomerRows}
                  columns={pendingCustomerColumns}
                  defaultSortKey="outstanding"
                  defaultSortDir="desc"
                  searchPlaceholder="Search customer or phone…"
                  searchKeys={["customerName", "customerPhone"]}
                  pageSize={10}
                  renderMobileCard={(item) => {
                    const customerId = String(item.customerId ?? "");
                    const phone = String(item.customerPhone ?? "").trim();
                    return (
                      <>
                        <p className="truncate text-sm font-medium leading-tight">
                          {String(item.customerName)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {phone || "No phone"} · {Number(item.invoiceCount ?? 0)} open invoice
                          {Number(item.invoiceCount ?? 0) === 1 ? "" : "s"}
                        </p>
                        <p className="mt-1.5 text-base font-bold tabular-nums leading-none">
                          {formatCurrency(Number(item.outstanding ?? 0))}
                        </p>
                        <div
                          className="mt-2 flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 flex-1 gap-1 px-2 text-[11px]"
                            onClick={() => {
                              if (customerId) openCustomerLedger(customerId);
                            }}
                          >
                            <Eye className="h-3 w-3" />
                            Ledger
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 flex-1 gap-1 px-2 text-[11px] text-[#128C7E]"
                            disabled={!phone}
                            onClick={() => {
                              if (customerId) sharePendingCustomerLedger(customerId, phone);
                            }}
                          >
                            <WhatsAppIcon className="h-3 w-3" />
                            Share Ledger
                          </Button>
                        </div>
                      </>
                    );
                  }}
                />
              ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
                  <TabsList className="inline-flex h-auto w-max min-w-full flex-nowrap justify-start gap-1 bg-muted/50 p-1 sm:w-full sm:flex-wrap">
                    {STATUS_TABS.map((tab) => (
                      <TabsTrigger
                        key={tab.value}
                        value={tab.value}
                        className="h-8 shrink-0 px-2.5 text-xs data-[state=active]:shadow-sm sm:h-9 sm:px-3 sm:text-sm"
                      >
                        <span className="sm:hidden">{tab.shortLabel ?? tab.label}</span>
                        <span className="hidden sm:inline">{tab.label}</span>{" "}
                        <span className="font-normal text-muted-foreground tabular-nums">
                          ({tabCounts[tab.value] ?? 0})
                        </span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
                {STATUS_TABS.map((tab) => (
                  <TabsContent
                    key={tab.value}
                    value={tab.value}
                    className="mt-4 focus-visible:outline-none sm:mt-6"
                  >
                    <DataTable
                      data={
                        tab.value === "all"
                          ? allTableData
                          : toTableRows(invoicesForView.filter((inv) => inv.status === tab.value))
                      }
                      columns={columns}
                      defaultSortKey="createdAt"
                      defaultSortDir="desc"
                      searchPlaceholder="Search invoice, customer, vehicle…"
                      searchKeys={[
                        "invoiceNumber",
                        "customerName",
                        "vehicleRegNumber",
                        "jobNumber",
                        "servicesSummary",
                      ]}
                      serverPagination={{
                        page: currentPage,
                        pageSize: 50,
                        total,
                        totalPages,
                        onPageChange: handlePageChange,
                        isLoading,
                      }}
                      onSearchChange={setSearchQuery}
                      onRowClick={handleRowClick}
                      renderMobileCard={(item) => {
                        const paymentLabel = item.paymentMethod
                          ? getPaymentMethodLabel(String(item.paymentMethod))
                          : null;
                        const invoiceId = String(item.id ?? "");
                        return (
                          <>
                            <div className="flex items-start justify-between gap-2">
                              <span className="shrink-0 text-[10px] text-muted-foreground">
                                {formatDate(String(item.createdAt))}
                              </span>
                              <InvoiceStatusBadge
                                status={item.status as InvoiceStatus}
                                className="h-5 shrink-0 px-1.5 text-[10px]"
                              />
                            </div>
                            <span className="mt-1 block truncate font-mono text-xs font-bold text-primary">
                              {String(item.invoiceNumber)}
                            </span>
                            <p className="mt-1 truncate text-sm font-medium leading-tight">
                              {String(item.customerName)}
                            </p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              <span className="font-mono">{String(item.vehicleRegNumber)}</span>
                              <span aria-hidden> · </span>
                              <span className="font-mono">
                                {invoiceSourceColumnLabel(item as Pick<Invoice, "source" | "jobNumber">)}
                              </span>
                            </p>
                            <div className="mt-1.5 flex items-baseline justify-between gap-2">
                              <p className="text-base font-bold tabular-nums leading-none">
                                {formatCurrency(item.grandTotal as number)}
                              </p>
                            </div>
                            <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">
                              {String(item.servicesSummary)}
                              {paymentLabel ? ` · ${paymentLabel}` : ""}
                            </p>
                            <div className="mt-1 flex justify-end">
                              <InvoiceRowActions
                                item={item}
                                onView={() =>
                                  router.push(`/billing/invoices/${encodeURIComponent(invoiceId)}`)
                                }
                                onEdit={() =>
                                  router.push(
                                    `/billing/invoices/${encodeURIComponent(invoiceId)}?edit=1`
                                  )
                                }
                                onDelete={() =>
                                  setDeleteTarget({
                                    id: invoiceId,
                                    invoiceNumber: String(item.invoiceNumber ?? ""),
                                    customerName: String(item.customerName ?? ""),
                                  })
                                }
                              />
                            </div>
                          </>
                        );
                      }}
                    />
                  </TabsContent>
                ))}
              </Tabs>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ledger" className="mt-0 focus-visible:outline-none">
          <SharedLedgerClient
            embedded
            partyKinds="customer"
            focusPartyId={ledgerFocusCustomerId}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && !deletingInvoice && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete invoice?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `${deleteTarget.invoiceNumber} for ${deleteTarget.customerName} will be permanently removed.`
                : "This invoice will be permanently removed."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={deletingInvoice}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deletingInvoice}
              onClick={() => void confirmDeleteInvoice()}
            >
              {deletingInvoice ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
