"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { PageHeader } from "@/components/shared/page-header";
import { MobileFilterSheet } from "@/components/shared/mobile-filter-sheet";
import { DataTable } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { AddExpenseDialog } from "@/components/expenses/add-expense-dialog";
import {
  ExpenseDateRangePicker,
  formatExpenseDateFilterLabel,
  matchesExpenseDate,
  type ExpenseDateFilter,
} from "@/components/expenses/expense-date-range-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency, formatDate } from "@/lib/utils";
import { recognizedExpenseAmount } from "@/lib/accounting/dashboard-metrics";
import { expensePaidAmount, expenseOutstanding } from "@/lib/party/ledger-math";
import { useExpenseStore } from "@/store/expense-store";
import { useBranchStore } from "@/store/branch-store";
import { applyBranchFilters, useBranchScope } from "@/lib/branch-scope";
import type { Expense, ExpensePaymentStatus } from "@/types";
import {
  Plus,
  Building2,
  BarChart2,
  LayoutGrid,
  X,
  IndianRupee,
  FileCheck,
  AlertTriangle,
  Tag,
  Download,
  MoreHorizontal,
  Pencil,
  Receipt,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

function categoryLabel(c: string): string {
  if (/^[A-Z_]+$/.test(c)) {
    return c.charAt(0) + c.slice(1).toLowerCase().replace(/_/g, " ");
  }
  return c;
}

function paymentMethodShort(m: string): string {
  if (m === "BANK_TRANSFER") return "Bank";
  return m.charAt(0) + m.slice(1).toLowerCase();
}

function statusBadgeVariant(
  s: ExpensePaymentStatus
): "success" | "warning" | "destructive" | "secondary" | "outline" | "info" {
  switch (s) {
    case "PAID":
      return "success";
    case "PENDING":
      return "warning";
    case "PARTIAL":
      return "info";
    case "OVERDUE":
      return "destructive";
    default:
      return "secondary";
  }
}

function exportCsv(rows: Expense[]) {
  const headers = [
    "Date",
    "Title",
    "Category",
    "Vendor",
    "Amount",
    "Payment status",
    "Payment method",
  ];
  const lines = rows.map((e) =>
    [
      e.date,
      `"${e.title.replace(/"/g, '""')}"`,
      e.category,
      e.vendorName ? `"${e.vendorName.replace(/"/g, '""')}"` : "",
      String(e.amount),
      e.paymentStatus,
      e.paymentMethod,
    ].join(",")
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `expenses-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("Export started.");
}

function ExpensesPageContent() {
  const searchParams = useSearchParams();
  const highlight = searchParams.get("highlight")?.trim() ?? "";

  const expenses = useExpenseStore((s) => s.expenses);
  const customCategories = useExpenseStore((s) => s.customCategories);
  const removeExpense = useExpenseStore((s) => s.removeExpense);
  const branches = useBranchStore((s) => s.branches);
  const { selectedBranchId, showBranchPicker } = useBranchScope();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [dateFilter, setDateFilter] = useState<ExpenseDateFilter>({
    kind: "preset",
    preset: "this_month",
  });
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [compareOn, setCompareOn] = useState(false);
  const [fullViewOn, setFullViewOn] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const activeFilterCount =
    (categoryFilter !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (showBranchPicker && branchFilter !== "all" ? 1 : 0) +
    (compareOn ? 1 : 0) +
    (fullViewOn ? 1 : 0);

  useEffect(() => {
    if (!highlight) return;
    queueMicrotask(() => {
      setDateFilter({ kind: "preset", preset: "all" });
      setBranchFilter("all");
      setCategoryFilter("all");
      setStatusFilter("all");
    });
  }, [highlight]);

  useEffect(() => {
    if (!showBranchPicker) {
      queueMicrotask(() => setBranchFilter("all"));
    }
  }, [showBranchPicker, selectedBranchId]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of expenses) set.add(e.category);
    for (const c of customCategories) set.add(c);
    return [...set].sort();
  }, [expenses, customCategories]);

  const branchScopedExpenses = useMemo(
    () =>
      applyBranchFilters(
        expenses,
        (e) => e.branchId,
        selectedBranchId,
        showBranchPicker,
        branchFilter
      ),
    [expenses, selectedBranchId, showBranchPicker, branchFilter]
  );

  const scoped = useMemo(() => {
    return branchScopedExpenses.filter((e) => {
      if (!matchesExpenseDate(e.date, dateFilter)) return false;
      if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
      if (statusFilter !== "all" && e.paymentStatus !== statusFilter) return false;
      return true;
    });
  }, [branchScopedExpenses, dateFilter, categoryFilter, statusFilter]);

  const kpis = useMemo(() => {
    /** Cash paid — same basis as Accounting → Total Expenses. */
    const total = scoped.reduce((s, e) => s + expensePaidAmount(e), 0);
    const payables = scoped.reduce((s, e) => s + expenseOutstanding(e), 0);
    const billed = scoped.reduce((s, e) => s + recognizedExpenseAmount(e), 0);
    const partialCount = scoped.filter((e) => e.paymentStatus === "PARTIAL").length;
    return {
      total,
      billed,
      payables,
      partialCount,
      expenseCount: scoped.length,
    };
  }, [scoped]);

  const dateSummary = useMemo(
    () => formatExpenseDateFilterLabel(dateFilter),
    [dateFilter]
  );

  const mobileActiveFilterLabels = useMemo(() => {
    const labels: string[] = [];
    if (categoryFilter !== "all") labels.push(categoryLabel(categoryFilter));
    if (statusFilter !== "all") labels.push(statusFilter);
    if (showBranchPicker && branchFilter !== "all") {
      const b = branches.find((br) => br.id === branchFilter);
      labels.push(b?.name ?? "Branch");
    }
    if (compareOn) labels.push("Compare");
    if (fullViewOn) labels.push("Full");
    return labels;
  }, [
    categoryFilter,
    statusFilter,
    showBranchPicker,
    branchFilter,
    branches,
    compareOn,
    fullViewOn,
  ]);

  const resetFilters = () => {
    setDateFilter({ kind: "preset", preset: "this_month" });
    setBranchFilter("all");
    setCategoryFilter("all");
    setStatusFilter("all");
    setCompareOn(false);
    setFullViewOn(false);
  };

  const columns = useMemo(
    () => [
      {
        key: "date",
        label: "DATE",
        sortable: true,
        render: (item: Expense) => (
          <span className="text-muted-foreground whitespace-nowrap">
            {formatDate(item.date)}
          </span>
        ),
      },
      {
        key: "title",
        label: "TITLE",
        sortable: true,
        render: (item: Expense) => (
          <span className="font-medium line-clamp-2">{item.title}</span>
        ),
      },
      {
        key: "category",
        label: "CATEGORY",
        sortable: true,
        render: (item: Expense) => (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted">
            {categoryLabel(item.category)}
          </span>
        ),
      },
      {
        key: "vendorName",
        label: "VENDOR",
        sortable: true,
        render: (item: Expense) => (
          <span className="text-muted-foreground line-clamp-1">
            {item.vendorName ?? "—"}
          </span>
        ),
      },
      {
        key: "amount",
        label: "AMOUNT",
        sortable: true,
        render: (item: Expense) => (
          <span className="font-semibold tabular-nums">{formatCurrency(item.amount)}</span>
        ),
      },
      {
        key: "paymentMethod",
        label: "PAYMENT",
        sortable: true,
        render: (item: Expense) => (
          <span className="text-sm">{paymentMethodShort(item.paymentMethod)}</span>
        ),
      },
      {
        key: "paymentStatus",
        label: "STATUS",
        sortable: true,
        render: (item: Expense) => (
          <Badge variant={statusBadgeVariant(item.paymentStatus)}>
            {item.paymentStatus}
          </Badge>
        ),
      },
      {
        key: "actions",
        label: "ACTIONS",
        className: "w-[72px]",
        render: (item: Expense) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setEditingExpense(item);
                  setDialogOpen(true);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => {
                  void removeExpense(item.id);
                  toast.success("Expense removed.");
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [removeExpense]
  );

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Expense Management"
        description="Track and manage operational expenses."
        hideDescriptionOnMobile
        inlineActionsOnMobile
        actions={
          <Button
            size="sm"
            className="shrink-0 whitespace-nowrap"
            onClick={() => {
              setEditingExpense(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Expense
          </Button>
        }
      />

      <Card className="border-border/80 shadow-sm lg:hidden">
        <CardContent className="space-y-2 p-3">
          <ExpenseDateRangePicker value={dateFilter} onChange={setDateFilter} />
          <p className="text-[11px] leading-tight text-muted-foreground">
            {dateSummary}
            {mobileActiveFilterLabels.length > 0
              ? ` · ${mobileActiveFilterLabels.join(" · ")}`
              : ""}
          </p>
        </CardContent>
      </Card>

      <Card className="hidden border-border/80 shadow-sm lg:block">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <ExpenseDateRangePicker value={dateFilter} onChange={setDateFilter} />

              {showBranchPicker ? (
                <Select value={branchFilter} onValueChange={setBranchFilter}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <Building2 className="w-4 h-4 mr-2 shrink-0 text-muted-foreground" />
                    <SelectValue placeholder="Branch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant={compareOn ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setCompareOn((v) => !v)}
                >
                  <BarChart2 className="w-4 h-4" />
                  Compare
                </Button>
                <Button
                  type="button"
                  variant={fullViewOn ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setFullViewOn((v) => !v)}
                >
                  <LayoutGrid className="w-4 h-4" />
                  Full
                </Button>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start text-muted-foreground lg:self-auto"
              onClick={resetFilters}
            >
              <X className="w-4 h-4 mr-1" />
              Reset
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Showing: {dateSummary}
            {showBranchPicker && branchFilter !== "all"
              ? ` • ${branches.find((b) => b.id === branchFilter)?.name ?? "Branch"}`
              : ""}
            {compareOn ? " • Compare on" : ""}
            {fullViewOn ? " • Full layout" : ""}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-2 md:gap-3 xl:grid-cols-4">
        <KPICard
          size="compact"
          title="Total Expenses"
          value={formatCurrency(kpis.total)}
          subtitle="Cash paid in period"
          icon={IndianRupee}
          tone="blue"
          titleClassName="text-[11px] leading-tight sm:text-xs"
          valueClassName="text-sm leading-tight tabular-nums sm:text-lg md:text-xl"
        />
        <KPICard
          size="compact"
          title="Total Billed"
          value={formatCurrency(kpis.billed)}
          subtitle={`${kpis.expenseCount} expense(s)`}
          icon={FileCheck}
          tone="emerald"
          titleClassName="text-[11px] leading-tight sm:text-xs"
          valueClassName="text-sm leading-tight tabular-nums sm:text-lg md:text-xl"
        />
        <KPICard
          size="compact"
          title="Total Payables"
          value={formatCurrency(kpis.payables)}
          subtitle="Pending + due"
          icon={AlertTriangle}
          tone="orange"
          titleClassName="text-[11px] leading-tight sm:text-xs"
          valueClassName="text-sm leading-tight tabular-nums sm:text-lg md:text-xl"
        />
        <KPICard
          size="compact"
          title="Partial Payments"
          value={kpis.partialCount}
          subtitle="In progress"
          icon={Tag}
          tone="amber"
          titleClassName="text-[11px] leading-tight sm:text-xs"
          valueClassName="text-lg sm:text-xl"
        />
      </div>

      <div className="space-y-2 md:space-y-3">
        <h2 className="text-sm font-semibold tracking-tight md:text-base">
          Expenses <span className="text-muted-foreground">({scoped.length})</span>
        </h2>
        <DataTable
          data={scoped}
          columns={columns}
          defaultSortKey="date"
          defaultSortDir="desc"
          focusItemId={highlight || undefined}
          getRowDomId={(item) => `expense-row-${(item as Expense).id}`}
          searchPlaceholder="Search expenses..."
          searchKeys={["title", "category", "vendorName"]}
          searchMatch={(item, q) => {
            const e = item as Expense;
            const hay = [
              e.title,
              e.category,
              e.vendorName,
              e.description,
              e.paymentStatus,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();
            return hay.includes(q);
          }}
          hideSearch={false}
          renderMobileCard={(item) => {
            const e = item as Expense;
            return (
              <>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{formatDate(e.date)}</span>
                  <Badge variant={statusBadgeVariant(e.paymentStatus)}>{e.paymentStatus}</Badge>
                </div>
                <p className="mt-2 font-medium leading-snug">{e.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {categoryLabel(e.category)}
                  {e.vendorName ? ` · ${e.vendorName}` : ""}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-base font-bold tabular-nums">{formatCurrency(e.amount)}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 shrink-0"
                    onClick={() => {
                      setEditingExpense(e);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                </div>
              </>
            );
          }}
          emptyContent={
            <div className="flex flex-col items-center px-4 py-8 text-center">
              <Receipt className="mb-2 h-7 w-7 text-muted-foreground/50" />
              <p className="text-sm font-medium">No expenses found</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Adjust filters or add a new expense.
              </p>
              <Button
                size="sm"
                className="mt-3"
                onClick={() => {
                  setEditingExpense(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Add Expense
              </Button>
            </div>
          }
          actions={
            <>
              <div className="flex flex-wrap items-center gap-1.5 md:hidden">
                <Button
                  type="button"
                  variant={activeFilterCount > 0 ? "default" : "outline"}
                  size="sm"
                  className="h-7 gap-1 rounded-full px-2.5 text-xs"
                  onClick={() => setFilterSheetOpen(true)}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
                  Filters
                  {activeFilterCount > 0 ? (
                    <span className="rounded-full bg-primary-foreground/20 px-1.5 text-[10px] font-semibold leading-none">
                      {activeFilterCount}
                    </span>
                  ) : null}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 rounded-full px-2.5 text-xs"
                  onClick={() => exportCsv(scoped)}
                >
                  <Download className="h-3.5 w-3.5 shrink-0" />
                  Export
                </Button>
              </div>
              <div className="hidden flex-wrap items-center gap-2 md:flex">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[160px] sm:w-[180px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categoryOptions.map((c) => (
                      <SelectItem key={c} value={c}>
                        {categoryLabel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px] sm:w-[160px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="PAID">Paid</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="PARTIAL">Partial</SelectItem>
                    <SelectItem value="OVERDUE">Overdue</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="sm" onClick={() => exportCsv(scoped)}>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </>
          }
        />
      </div>

      <MobileFilterSheet
        open={filterSheetOpen}
        onOpenChange={setFilterSheetOpen}
        title="Expense filters"
        activeCount={activeFilterCount}
        onReset={() => {
          setCategoryFilter("all");
          setStatusFilter("all");
          if (showBranchPicker) setBranchFilter("all");
          setCompareOn(false);
          setFullViewOn(false);
        }}
      >
        {showBranchPicker ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Branch</p>
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="h-10 w-full bg-background">
                <SelectValue placeholder="Branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="space-y-2">
          <p className="text-sm font-medium">Category</p>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-10 w-full bg-background">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categoryOptions.map((c) => (
                <SelectItem key={c} value={c}>
                  {categoryLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Payment status</p>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-10 w-full bg-background">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="PARTIAL">Partial</SelectItem>
              <SelectItem value="OVERDUE">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">View options</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={compareOn ? "default" : "outline"}
              size="sm"
              className="h-9 gap-1.5"
              onClick={() => setCompareOn((v) => !v)}
            >
              <BarChart2 className="h-4 w-4" />
              Compare
            </Button>
            <Button
              type="button"
              variant={fullViewOn ? "default" : "outline"}
              size="sm"
              className="h-9 gap-1.5"
              onClick={() => setFullViewOn((v) => !v)}
            >
              <LayoutGrid className="h-4 w-4" />
              Full
            </Button>
          </div>
        </div>
      </MobileFilterSheet>

      <AddExpenseDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingExpense(null);
        }}
        expense={editingExpense}
      />
    </div>
  );
}

export default function ExpensesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-muted-foreground">Loading expenses…</div>
      }
    >
      <ExpensesPageContent />
    </Suspense>
  );
}
