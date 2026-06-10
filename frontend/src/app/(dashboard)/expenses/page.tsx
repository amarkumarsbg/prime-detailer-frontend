"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
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
import { useExpenseStore } from "@/store/expense-store";
import { useBranchStore } from "@/store/branch-store";
import {
  applyBranchFilters,
  resolveBranchScopeLabel,
  useBranchScope,
} from "@/lib/branch-scope";
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

function paidAmount(e: Expense): number {
  if (e.paymentStatus === "PAID") return e.amount;
  if (e.paymentStatus === "PARTIAL") return e.amountPaid ?? 0;
  return 0;
}

function payableAmount(e: Expense): number {
  if (e.paymentStatus === "PAID") return 0;
  if (e.paymentStatus === "PARTIAL") return Math.max(0, e.amount - (e.amountPaid ?? 0));
  return e.amount;
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
  const { selectedBranchId, showBranchPicker, viewingLabel } = useBranchScope();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<ExpenseDateFilter>({
    kind: "preset",
    preset: "this_month",
  });
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [compareOn, setCompareOn] = useState(false);
  const [fullViewOn, setFullViewOn] = useState(false);

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
    const total = scoped.reduce((s, e) => s + e.amount, 0);
    const totalPaid = scoped.reduce((s, e) => s + paidAmount(e), 0);
    const payables = scoped.reduce((s, e) => s + payableAmount(e), 0);
    const partialCount = scoped.filter((e) => e.paymentStatus === "PARTIAL").length;
    return {
      total,
      totalPaid,
      payables,
      partialCount,
      expenseCount: scoped.length,
    };
  }, [scoped]);

  const dateSummary = useMemo(
    () => formatExpenseDateFilterLabel(dateFilter),
    [dateFilter]
  );

  const branchSummary = useMemo(
    () => resolveBranchScopeLabel(showBranchPicker, viewingLabel, branchFilter, branches),
    [showBranchPicker, viewingLabel, branchFilter, branches]
  );

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
                className="text-destructive focus:text-destructive"
                onClick={() => {
                  removeExpense(item.id);
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
    <div className="space-y-6">
      <PageHeader
        title="Expense Management"
        description="Track and manage operational expenses."
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Expense
          </Button>
        }
      />

      <Card className="border-border/80 shadow-sm">
        <CardContent className="pt-6 space-y-4">
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
              ) : (
                <div className="flex h-10 items-center gap-2 rounded-md border border-border bg-muted/40 px-3 text-sm">
                  <Building2 className="w-4 h-4 shrink-0 text-muted-foreground" />
                  <span className="font-medium">{viewingLabel}</span>
                </div>
              )}

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
              className="text-muted-foreground self-start lg:self-auto"
              onClick={resetFilters}
            >
              <X className="w-4 h-4 mr-1" />
              Reset
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Showing: {dateSummary} • {branchSummary}
            {compareOn ? " • Compare on" : ""}
            {fullViewOn ? " • Full layout" : ""}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border/80 shadow-sm overflow-hidden">
          <CardContent className="!flex !flex-row !items-center !justify-between gap-4 !py-5">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Total Expenses</p>
              <p className="text-2xl font-bold tabular-nums">{formatCurrency(kpis.total)}</p>
              <p className="text-xs text-muted-foreground">
                {kpis.expenseCount} expense(s)
                {compareOn ? " · vs prior: —" : ""}
              </p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
              <IndianRupee className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm overflow-hidden">
          <CardContent className="!flex !flex-row !items-center !justify-between gap-4 !py-5">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Total Paid</p>
              <p className="text-2xl font-bold tabular-nums">{formatCurrency(kpis.totalPaid)}</p>
              <p className="text-xs text-muted-foreground">Including partial payments</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <FileCheck className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm overflow-hidden">
          <CardContent className="!flex !flex-row !items-center !justify-between gap-4 !py-5">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Total Payables</p>
              <p className="text-2xl font-bold tabular-nums">{formatCurrency(kpis.payables)}</p>
              <p className="text-xs text-muted-foreground">Pending + due amounts</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-600 dark:text-orange-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm overflow-hidden">
          <CardContent className="!flex !flex-row !items-center !justify-between gap-4 !py-5">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Partial Payments</p>
              <p className="text-2xl font-bold tabular-nums">{kpis.partialCount}</p>
              <p className="text-xs text-muted-foreground">In progress</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Tag className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">
          Expenses ({scoped.length})
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
          actions={
            <div className="flex flex-wrap items-center gap-2 justify-end">
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
          }
        />
      </div>

      <AddExpenseDialog open={dialogOpen} onOpenChange={setDialogOpen} />
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
