"use client";

import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { KPICard } from "@/components/shared/kpi-card";
import { VendorFormDialog } from "@/components/expenses/vendor-form-dialog";
import { VendorStatementDialog } from "@/components/vendors/vendor-statement-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate, formatDateTime, cn } from "@/lib/utils";
import { buildVendorSummaries, type VendorSummary } from "@/lib/vendors/vendor-metrics";
import { backfillPurchaseExpenses } from "@/lib/inventory/sync-purchase-expense";
import { totalReceivables } from "@/lib/accounting/dashboard-metrics";
import { useAuthStore } from "@/store/auth-store";
import { useExpenseStore, type AddVendorDirectoryInput } from "@/store/expense-store";
import { useInventoryStore } from "@/store/inventory-store";
import { useBranchStore } from "@/store/branch-store";
import { useInvoiceStore } from "@/store/invoice-store";
import { useCashBankStore, totalCashBankBalance } from "@/store/cash-bank-store";
import { resourcesForPath } from "@/lib/domain-data-map";
import { ensureDomainResources, invalidateDomainResources } from "@/lib/domain-data-loader";
import type { ExpenseVendorProfile } from "@/types";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Clock,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

type StatusFilter = "active" | "inactive" | "all";

export default function VendorsPage() {
  const purchases = useInventoryStore((s) => s.productPurchases);
  const renamePurchaseVendor = useInventoryStore((s) => s.renamePurchaseVendor);
  const vendorDirectory = useExpenseStore((s) => s.vendorDirectory);
  const expenses = useExpenseStore((s) => s.expenses);
  const addVendorDirectoryEntry = useExpenseStore((s) => s.addVendorDirectoryEntry);
  const updateVendorDirectoryEntry = useExpenseStore((s) => s.updateVendorDirectoryEntry);
  const branches = useBranchStore((s) => s.branches);
  const invoices = useInvoiceStore((s) => s.invoices);
  const cashAccounts = useCashBankStore((s) => s.accounts);
  const cashTransactions = useCashBankStore((s) => s.transactions);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (purchases.length === 0) return;
    void backfillPurchaseExpenses(purchases, {
      createdBy: user?.id ?? "unknown",
      createdByName: user?.name ?? user?.email ?? "staff",
    });
  }, [purchases, user?.id, user?.name, user?.email]);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<ExpenseVendorProfile | null>(null);
  const [createNameHint, setCreateNameHint] = useState("");
  const [statementKey, setStatementKey] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState(() => new Date().toISOString());

  const summaries = useMemo(
    () => buildVendorSummaries(vendorDirectory, purchases, expenses),
    [vendorDirectory, purchases, expenses]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return summaries
      .filter((r) => {
        if (statusFilter === "active" && !r.isActive) return false;
        if (statusFilter === "inactive" && r.isActive) return false;
        if (!q) return true;
        const hay = [
          r.vendorName,
          r.profile?.contactPerson,
          r.profile?.email,
          r.profile?.phone,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => b.outstanding - a.outstanding || b.volume - a.volume);
  }, [summaries, query, statusFilter]);

  const statementVendor = summaries.find((s) => s.key === statementKey) ?? null;

  const kpis = useMemo(() => {
    const activeCount = summaries.filter((s) => s.isActive).length;
    return {
      total: summaries.length,
      activeCount,
      volume: summaries.reduce((s, r) => s + r.volume, 0),
      outstanding: summaries.reduce((s, r) => s + r.outstanding, 0),
      overdue: summaries.filter((s) => s.overdue).length,
      toPay: summaries.reduce((s, r) => s + r.outstanding, 0),
      toCollect: totalReceivables(invoices),
      cashBank: totalCashBankBalance(cashAccounts),
    };
  }, [summaries, invoices, cashAccounts]);

  const lastUpdatedAt = useMemo(() => {
    let max = new Date(refreshedAt).getTime();
    const consider = (iso?: string | null) => {
      if (!iso) return;
      const t = new Date(iso).getTime();
      if (Number.isFinite(t) && t > max) max = t;
    };
    for (const p of purchases) consider(p.purchasedAt);
    for (const e of expenses) {
      consider(e.createdAt);
      consider(e.date);
    }
    for (const inv of invoices) {
      consider(inv.createdAt);
      for (const pay of inv.payments) consider(pay.paidAt);
    }
    for (const txn of cashTransactions) consider(txn.date);
    return new Date(max);
  }, [purchases, expenses, invoices, cashTransactions, refreshedAt]);

  const branchLabel = (id?: string) =>
    id ? branches.find((b) => b.id === id)?.name ?? id : null;

  const openAdd = () => {
    setEditingVendor(null);
    setCreateNameHint("");
    setDialogOpen(true);
  };

  const openEdit = (row: VendorSummary) => {
    if (row.profile) {
      setEditingVendor(row.profile);
      setCreateNameHint("");
    } else {
      setEditingVendor(null);
      setCreateNameHint(row.vendorName);
    }
    setDialogOpen(true);
  };

  const handleSave = async (input: AddVendorDirectoryInput): Promise<boolean> => {
    if (editingVendor) {
      const prevName = editingVendor.name;
      const updated = await updateVendorDirectoryEntry(editingVendor.id, input);
      if (!updated) {
        toast.error("Could not update vendor.");
        return false;
      }
      if (prevName.trim() !== updated.name.trim()) {
        renamePurchaseVendor(prevName, updated.name);
      }
      toast.success("Vendor updated.");
      return true;
    }
    const created = await addVendorDirectoryEntry(input);
    if (!created) {
      toast.error("Enter a vendor name.");
      return false;
    }
    if (createNameHint && createNameHint.trim() !== created.name.trim()) {
      renamePurchaseVendor(createNameHint, created.name);
    }
    toast.success("Vendor created.");
    return true;
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      const resources = resourcesForPath("/vendors");
      invalidateDomainResources(resources);
      await ensureDomainResources(resources);
      setRefreshedAt(new Date().toISOString());
      toast.success("Vendors refreshed.");
    } catch {
      toast.error("Could not refresh vendors.");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Vendor Management"
        description="Manage supplier relationships and outstanding payables"
        hideDescriptionOnMobile
        inlineActionsOnMobile
        actions={
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void refresh()} disabled={refreshing}>
              <RefreshCw className={cn("mr-1.5 h-4 w-4", refreshing && "animate-spin")} />
              Refresh
            </Button>
            <Button size="sm" className="shrink-0 whitespace-nowrap" onClick={openAdd}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add Vendor
            </Button>
          </div>
        }
      />

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Business overview
          </p>
          <p className="inline-flex items-center gap-1.5 text-[11px] tabular-nums text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Last update: {formatDateTime(lastUpdatedAt)}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KPICard
            title="To Pay"
            value={formatCurrency(kpis.toPay)}
            subtitle="Vendor & expense dues"
            icon={ArrowUpRight}
            tone="orange"
            size="compact"
          />
          <KPICard
            title="To Collect"
            value={formatCurrency(kpis.toCollect)}
            subtitle="Unpaid invoices"
            icon={ArrowDownRight}
            tone="blue"
            size="compact"
          />
          <KPICard
            title="Cash + Bank"
            value={formatCurrency(kpis.cashBank)}
            subtitle="All accounts"
            icon={Wallet}
            tone="emerald"
            size="compact"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard
          title="Total vendors"
          value={kpis.total}
          subtitle={`${kpis.activeCount} active`}
          icon={Building2}
          tone="blue"
          size="compact"
        />
        <KPICard
          title="Business volume"
          value={formatCurrency(kpis.volume)}
          subtitle="Purchases + expenses"
          icon={TrendingUp}
          tone="blue"
          size="compact"
        />
        <KPICard
          title="Total outstanding"
          value={formatCurrency(kpis.outstanding)}
          subtitle="Purchases + expense dues"
          icon={TrendingDown}
          tone="orange"
          size="compact"
        />
        <KPICard
          title="Overdue vendors"
          value={kpis.overdue}
          subtitle="Past due date"
          icon={AlertTriangle}
          tone="slate"
          size="compact"
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search vendors by name, phone, or email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active vendors</SelectItem>
            <SelectItem value="inactive">Inactive vendors</SelectItem>
            <SelectItem value="all">All vendors</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            {summaries.length === 0
              ? "No vendors yet. Add a vendor or record a stock purchase."
              : "No vendors match your filters."}
          </p>
          <Button size="sm" className="mt-3" onClick={openAdd}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Vendor
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => {
            const paidPct = r.volume > 0 ? Math.min(100, (r.paid / r.volume) * 100) : 0;
            const branch = branchLabel(r.profile?.branchId);
            return (
              <Card key={r.key} className="overflow-hidden">
                <CardContent className="flex h-full flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold leading-tight">{r.vendorName}</p>
                      {r.profile?.contactPerson ? (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {r.profile.contactPerson}
                        </p>
                      ) : !r.profile ? (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">From purchases / expenses</p>
                      ) : null}
                    </div>
                    <Badge variant={r.isActive ? "success" : "secondary"} className="shrink-0">
                      {r.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  {branch ? (
                    <Badge variant="info" className="w-fit font-normal">
                      {branch}
                    </Badge>
                  ) : null}

                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Business volume</dt>
                      <dd className="tabular-nums font-medium">{formatCurrency(r.volume)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Total paid</dt>
                      <dd className="tabular-nums font-medium text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(r.paid)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Outstanding</dt>
                      <dd className="tabular-nums font-medium text-orange-600 dark:text-orange-400">
                        {formatCurrency(r.outstanding)}
                      </dd>
                    </div>
                  </dl>

                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${paidPct}%` }}
                    />
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {r.orderCount} {r.orderCount === 1 ? "order" : "orders"}
                    {r.lastAt ? ` · ${formatDate(r.lastAt)}` : ""}
                  </p>

                  <div className="mt-auto flex gap-2 pt-1">
                    <Button
                      type="button"
                      className="flex-1"
                      variant={r.outstanding > 0.01 ? "default" : "outline"}
                      onClick={() => setStatementKey(r.key)}
                    >
                      {r.outstanding > 0.01 ? "View & Pay" : "View Statement"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`Edit ${r.vendorName}`}
                      onClick={() => openEdit(r)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <VendorFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingVendor(null);
            setCreateNameHint("");
          }
        }}
        vendor={editingVendor}
        initialName={createNameHint}
        onSave={handleSave}
      />

      <VendorStatementDialog
        vendor={statementVendor}
        onClose={() => setStatementKey(null)}
        onEdit={() => {
          if (!statementVendor) return;
          setStatementKey(null);
          openEdit(statementVendor);
        }}
      />
    </div>
  );
}
