"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { JobCardStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useJobCardStore } from "@/store/job-card-store";
import { useInvoiceStore } from "@/store/invoice-store";
import { useAuthStore } from "@/store/auth-store";
import { useBranchStore } from "@/store/branch-store";
import { isAllBranchesScope } from "@/lib/all-branches";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { JobCard, JobCardStatus } from "@/types";
import {
  Plus,
  RefreshCw,
  ClipboardList,
  Eye,
  IndianRupee,
  Wallet,
  Clock,
  LayoutList,
  Search,
} from "lucide-react";

const STATUS_OPTIONS: { value: JobCardStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All Statuses" },
  { value: "RECEIVED", label: "Received" },
  { value: "INSPECTION", label: "Inspection" },
  { value: "AWAITING_SERVICE", label: "In service" },
  { value: "QUALITY_CHECK", label: "Quality check" },
  { value: "READY", label: "Ready" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
];

function startOfDayIso(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function endOfDayIso(d: Date): number {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.getTime();
}

export default function BookingsPage() {
  const router = useRouter();
  const { jobCards } = useJobCardStore();
  const invoices = useInvoiceStore((s) => s.invoices);
  const currentBranch = useAuthStore((s) => s.currentBranch);
  const branches = useBranchStore((s) => s.branches);
  const activeBranches = useMemo(() => branches.filter((b) => b.isActive), [branches]);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<JobCardStatus | "ALL">("ALL");
  const [branchFilterId, setBranchFilterId] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const headerScoped = useMemo(() => {
    if (!currentBranch || isAllBranchesScope(currentBranch)) return jobCards;
    return jobCards.filter((jc) => jc.branchId === currentBranch.id);
  }, [jobCards, currentBranch]);

  const showBranchPicker = !currentBranch || isAllBranchesScope(currentBranch);

  const filteredBookings = useMemo(() => {
    let list = headerScoped;
    if (showBranchPicker && branchFilterId !== "all") {
      list = list.filter((jc) => jc.branchId === branchFilterId);
    }
    if (statusFilter !== "ALL") {
      list = list.filter((jc) => jc.status === statusFilter);
    }
    if (dateFrom.trim()) {
      const t = startOfDayIso(new Date(dateFrom));
      if (!Number.isNaN(t)) list = list.filter((jc) => new Date(jc.createdAt).getTime() >= t);
    }
    if (dateTo.trim()) {
      const t = endOfDayIso(new Date(dateTo));
      if (!Number.isNaN(t)) list = list.filter((jc) => new Date(jc.createdAt).getTime() <= t);
    }
    return list;
  }, [headerScoped, showBranchPicker, branchFilterId, statusFilter, dateFrom, dateTo]);

  const searchFilteredBookings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return filteredBookings;
    return filteredBookings.filter(
      (jc) =>
        jc.jobNumber.toLowerCase().includes(q) ||
        jc.customerName.toLowerCase().includes(q) ||
        jc.customerPhone.replace(/\D/g, "").includes(q.replace(/\D/g, "")) ||
        jc.vehicleRegNumber.toLowerCase().includes(q) ||
        (jc.services ?? []).some((s) => s.name.toLowerCase().includes(q))
    );
  }, [filteredBookings, searchQuery]);

  const invoiceByJobId = useMemo(
    () => Object.fromEntries(invoices.map((inv) => [inv.jobCardId, inv])),
    [invoices]
  );

  const branchNameById = useMemo(
    () => Object.fromEntries(branches.map((b) => [b.id, b.name])),
          [branches]
  );

  const kpis = useMemo(() => {
    let totalRevenue = 0;
    let amountReceived = 0;
    let pendingAmount = 0;
    let invoiced = 0;
    let unbilled = 0;

    for (const jc of filteredBookings) {
      const inv = invoiceByJobId[jc.id];
      if (inv) {
        invoiced++;
        totalRevenue += inv.grandTotal;
        const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
        amountReceived += paid;
        pendingAmount += Math.max(0, inv.grandTotal - paid);
      } else {
        totalRevenue += jc.estimatedAmount;
        unbilled++;
      }
    }

    return {
      totalRevenue,
      amountReceived,
      pendingAmount,
      totalBookings: filteredBookings.length,
      invoiced,
      unbilled,
    };
  }, [filteredBookings, invoiceByJobId]);

  const columns = useMemo(
    () => [
      {
        key: "jobNumber",
        label: "ID",
        render: (jc: JobCard) => (
          <span className="font-mono text-xs font-semibold text-primary">{jc.jobNumber}</span>
        ),
      },
      {
        key: "customerName",
        label: "Customer",
        render: (jc: JobCard) => <span className="font-medium">{jc.customerName}</span>,
      },
      {
        key: "customerPhone",
        label: "Contact",
        render: (jc: JobCard) => (
          <span className="text-muted-foreground whitespace-nowrap">{jc.customerPhone}</span>
        ),
      },
      {
        key: "vehicleRegNumber",
        label: "Reg. number",
        render: (jc: JobCard) => (
          <span className="font-mono text-xs">{jc.vehicleRegNumber}</span>
        ),
      },
      {
        key: "service",
        label: "Service",
        render: (jc: JobCard) => (
          <span className="text-muted-foreground">{jc.services[0]?.name ?? "—"}</span>
        ),
      },
      {
        key: "branchId",
        label: "Branch",
        render: (jc: JobCard) => (
          <span className="text-muted-foreground truncate max-w-[10rem] block">
            {branchNameById[jc.branchId] ?? jc.branchId}
          </span>
        ),
      },
      {
        key: "createdAt",
        label: "Date",
        render: (jc: JobCard) => (
          <span className="text-muted-foreground whitespace-nowrap">{formatDate(jc.createdAt)}</span>
        ),
      },
      {
        key: "bookedOn",
        label: "Booked on",
        render: (jc: JobCard) => (
          <span className="text-muted-foreground whitespace-nowrap">{formatDate(jc.createdAt)}</span>
        ),
      },
      {
        key: "estimatedAmount",
        label: "Price",
        render: (jc: JobCard) => (
          <span className="tabular-nums font-medium">{formatCurrency(jc.estimatedAmount)}</span>
        ),
      },
      {
        key: "mechanicName",
        label: "Floor mgr",
        render: (jc: JobCard) => (
          <span className="text-muted-foreground">{jc.mechanicName ?? "—"}</span>
        ),
      },
      {
        key: "status",
        label: "Status",
        render: (jc: JobCard) => (
          <JobCardStatusBadge status={jc.status} className="whitespace-nowrap shrink-0" />
        ),
      },
      {
        key: "actions",
        label: "Actions",
        className: "text-center w-24",
        render: (jc: JobCard) => (
          <div className="inline-flex items-center justify-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link href={`/job-cards/${jc.id}`} aria-label="Open job">
                <ClipboardList className="w-4 h-4" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link href={`/job-cards/${jc.id}`} aria-label="View job">
                <Eye className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        ),
      },
    ],
    [branchNameById]
  );

  return (
    <div className="w-full min-w-0 space-y-4 sm:space-y-6">
      <PageHeader
        title="Bookings"
        description="Manage customer bookings — walk-ins become job cards. Filter, review totals, and open a job."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.refresh()}
              className="shrink-0"
            >
              <RefreshCw className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button size="sm" className="shrink-0" asChild>
              <Link href="/bookings/walk-in">
                <Plus className="w-4 h-4 mr-2" />
                Create booking
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-emerald-200/60 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/40 h-full">
          <CardContent className="p-4 sm:p-5 flex flex-col h-full min-h-[9rem]">
            <div className="flex items-center gap-3 min-h-8">
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100/90 text-emerald-700 shadow-sm ring-1 ring-emerald-200/50 dark:bg-emerald-900/40 dark:text-emerald-300 dark:ring-emerald-800/50"
                aria-hidden
              >
                <IndianRupee className="size-4" strokeWidth={2.25} />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 leading-none">
                Total revenue
              </span>
            </div>
            <p className="text-xl sm:text-2xl font-bold tabular-nums mt-4 text-emerald-800 dark:text-emerald-300">
              {formatCurrency(kpis.totalRevenue)}
            </p>
            <p className="text-xs text-muted-foreground mt-auto pt-2 leading-snug">
              {kpis.totalBookings} booking{kpis.totalBookings !== 1 ? "s" : ""} · {kpis.invoiced} invoiced
            </p>
          </CardContent>
        </Card>
        <Card className="border-sky-200/60 bg-sky-50/50 dark:bg-sky-950/20 dark:border-sky-900/40 h-full">
          <CardContent className="p-4 sm:p-5 flex flex-col h-full min-h-[9rem]">
            <div className="flex items-center gap-3 min-h-8">
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-100/90 text-sky-700 shadow-sm ring-1 ring-sky-200/50 dark:bg-sky-900/40 dark:text-sky-300 dark:ring-sky-800/50"
                aria-hidden
              >
                <Wallet className="size-4" strokeWidth={2.25} />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-400 leading-none">
                Amount received
              </span>
            </div>
            <p className="text-xl sm:text-2xl font-bold tabular-nums mt-4 text-sky-800 dark:text-sky-300">
              {formatCurrency(kpis.amountReceived)}
            </p>
            <p className="text-xs text-muted-foreground mt-auto pt-2 leading-snug">
              Payments collected on invoices
            </p>
          </CardContent>
        </Card>
        <Card className="border-amber-200/60 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/40 h-full">
          <CardContent className="p-4 sm:p-5 flex flex-col h-full min-h-[9rem]">
            <div className="flex items-center gap-3 min-h-8">
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100/90 text-amber-700 shadow-sm ring-1 ring-amber-200/50 dark:bg-amber-900/40 dark:text-amber-300 dark:ring-amber-800/50"
                aria-hidden
              >
                <Clock className="size-4" strokeWidth={2.25} />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 leading-none">
                Pending amount
              </span>
            </div>
            <p className="text-xl sm:text-2xl font-bold tabular-nums mt-4 text-amber-800 dark:text-amber-300">
              {formatCurrency(kpis.pendingAmount)}
            </p>
            <p className="text-xs text-muted-foreground mt-auto pt-2 leading-snug">
              Unpaid on invoices · {kpis.unbilled} without invoice
            </p>
          </CardContent>
        </Card>
        <Card className="border-cyan-200/60 bg-cyan-50/50 dark:bg-cyan-950/20 dark:border-cyan-900/40 h-full">
          <CardContent className="p-4 sm:p-5 flex flex-col h-full min-h-[9rem]">
            <div className="flex items-center gap-3 min-h-8">
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-cyan-100/90 text-cyan-700 shadow-sm ring-1 ring-cyan-200/50 dark:bg-cyan-900/40 dark:text-cyan-300 dark:ring-cyan-800/50"
                aria-hidden
              >
                <LayoutList className="size-4" strokeWidth={2.25} />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-cyan-700 dark:text-cyan-400 leading-none">
                Bookings
              </span>
            </div>
            <p className="text-xl sm:text-2xl font-bold tabular-nums mt-4 text-cyan-800 dark:text-cyan-300">
              {kpis.totalBookings}
            </p>
            <p className="text-xs text-muted-foreground mt-auto pt-2 leading-snug">Matching current filters</p>
          </CardContent>
        </Card>
      </div>

      <Card className="min-w-0 border-border/80 shadow-sm">
        <CardContent className="min-w-0 pt-6 space-y-4">
          <div className="w-full min-w-0 max-w-full overflow-x-clip rounded-xl border border-border bg-background p-3 shadow-sm sm:p-4">
            <div className="flex w-full min-w-0 max-w-full flex-col gap-3 xl:flex-nowrap xl:flex-row xl:items-center">
              <div className="relative w-full min-w-0 max-w-full xl:min-w-[220px] xl:flex-[1.25]">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, phone or reg. no"
                  className="h-10 min-w-0 max-w-full bg-background pl-9"
                  aria-label="Search bookings"
                />
              </div>
              <div className="w-full min-w-0 max-w-full xl:w-[168px] xl:shrink-0">
                <Select
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as JobCardStatus | "ALL")}
                >
                  <SelectTrigger className="h-10 w-full min-w-0 bg-background xl:w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {showBranchPicker && (
                <div className="w-full min-w-0 max-w-full xl:w-[168px] xl:shrink-0">
                  <Select value={branchFilterId} onValueChange={setBranchFilterId}>
                    <SelectTrigger className="h-10 w-full min-w-0 bg-background xl:w-full">
                      <SelectValue placeholder="All Branches" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Branches</SelectItem>
                      {activeBranches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex w-full min-w-0 max-w-full flex-col gap-2 md:flex-row md:items-stretch md:gap-2 xl:flex-[1.1] xl:justify-end xl:gap-2">
                <div className="w-full min-w-0 md:min-w-0 md:flex-1 md:max-w-[11rem] xl:max-w-[11rem]">
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="date-input-icon-end h-10 min-w-0 w-full max-w-full bg-background pr-9 [color-scheme:light] dark:[color-scheme:dark]"
                  />
                </div>
                <span className="shrink-0 self-center px-0.5 text-center text-sm text-muted-foreground md:self-center">
                  to
                </span>
                <div className="w-full min-w-0 md:min-w-0 md:flex-1 md:max-w-[11rem] xl:max-w-[11rem]">
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="date-input-icon-end h-10 min-w-0 w-full max-w-full bg-background pr-9 [color-scheme:light] dark:[color-scheme:dark]"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <DataTable<JobCard>
              data={searchFilteredBookings}
              columns={columns}
              hideSearch
              searchPlaceholder="Search by name, phone, registration, or job ID…"
              searchMatch={(jc, q) =>
                jc.jobNumber.toLowerCase().includes(q) ||
                jc.customerName.toLowerCase().includes(q) ||
                jc.customerPhone.replace(/\D/g, "").includes(q.replace(/\D/g, "")) ||
                jc.vehicleRegNumber.toLowerCase().includes(q) ||
                (jc.services ?? []).some((s) => s.name.toLowerCase().includes(q))
              }
              pageSize={10}
              onRowClick={(jc) => router.push(`/job-cards/${jc.id}`)}
              renderMobileCard={(jc) => (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-primary">{jc.jobNumber}</span>
                    <JobCardStatusBadge
                      status={jc.status}
                      className="shrink-0 whitespace-nowrap text-[10px]"
                    />
                  </div>
                  <p className="font-medium mt-1.5 leading-tight">{jc.customerName}</p>
                  <p className="text-xs text-muted-foreground">{jc.customerPhone}</p>
                  <p className="text-xs font-mono mt-1">{jc.vehicleRegNumber}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{jc.services[0]?.name ?? "—"}</p>
                  <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                    <dt className="text-muted-foreground">Branch</dt>
                    <dd className="text-foreground truncate">{branchNameById[jc.branchId] ?? jc.branchId}</dd>
                    <dt className="text-muted-foreground">Booked</dt>
                    <dd className="text-foreground">{formatDate(jc.createdAt)}</dd>
                    <dt className="text-muted-foreground">Price</dt>
                    <dd className="text-foreground tabular-nums font-medium">
                      {formatCurrency(jc.estimatedAmount)}
                    </dd>
                    <dt className="text-muted-foreground">Floor mgr</dt>
                    <dd className="text-foreground truncate">{jc.mechanicName ?? "—"}</dd>
                  </dl>
                  <div className="flex items-center justify-end gap-1 mt-3 pt-2 border-t border-border/80">
                    <Button variant="outline" size="sm" className="h-8" asChild>
                      <Link href={`/job-cards/${jc.id}`}>
                        <ClipboardList className="w-3.5 h-3.5 mr-1.5" />
                        Open
                      </Link>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
                      <Link href={`/job-cards/${jc.id}`} aria-label="View booking">
                        <Eye className="w-4 h-4" />
                      </Link>
                    </Button>
                  </div>
                </>
              )}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
