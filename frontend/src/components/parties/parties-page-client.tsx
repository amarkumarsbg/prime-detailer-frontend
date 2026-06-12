"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { MobileFilterSheet, MobileFilterTrigger } from "@/components/shared/mobile-filter-sheet";
import { KPICard } from "@/components/shared/kpi-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogMobileSheetContentClasses,
  dialogMobileSheetHeaderClasses,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useParties } from "@/hooks/use-parties";
import { useScopedExpenses, useScopedInvoices } from "@/hooks/use-scoped-data";
import { partyDisplayBalance, balanceFlow } from "@/lib/party/ledger-math";
import { PartiesListLoading } from "@/components/parties/party-loading-states";
import { formatInrFull, formatInrTable } from "@/lib/utils";
import { useBranchScope } from "@/lib/branch-scope";
import { toast } from "sonner";
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowUpDown,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import type { PartyKind } from "@/types/party";

type SearchCategory =
  | "all"
  | "name"
  | "mobile"
  | "category"
  | "customer"
  | "supplier";

type SortKey = "name" | "balance" | "createdAt";
type SortDir = "asc" | "desc";

function matchesSearch(
  p: { name: string; mobile?: string; category?: string; kind: PartyKind },
  q: string,
  category: SearchCategory
): boolean {
  const lower = q.trim().toLowerCase();
  if (!lower) return true;
  switch (category) {
    case "name":
      return p.name.toLowerCase().includes(lower);
    case "mobile":
      return (p.mobile ?? "").toLowerCase().includes(lower);
    case "category":
      return (p.category ?? "").toLowerCase().includes(lower);
    case "customer":
      return p.kind === "customer" && p.name.toLowerCase().includes(lower);
    case "supplier":
      return p.kind === "supplier" && p.name.toLowerCase().includes(lower);
    default:
      return (
        p.name.toLowerCase().includes(lower) ||
        (p.mobile ?? "").toLowerCase().includes(lower) ||
        (p.category ?? "").toLowerCase().includes(lower)
      );
  }
}

export function PartiesPageClient() {
  const router = useRouter();
  const { parties, partiesLoading, removeParty } = useParties();
  const invoices = useScopedInvoices();
  const expenses = useScopedExpenses();
  const { viewingLabel } = useBranchScope();

  const [query, setQuery] = useState("");
  const [searchCategory, setSearchCategory] = useState<SearchCategory>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | PartyKind>("all");
  const [balanceFilter, setBalanceFilter] = useState<"all" | "collect" | "pay">("all");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const activeFilterCount = searchCategory !== "all" ? 1 : 0;

  const partiesWithBalance = useMemo(
    () =>
      parties.map((p) => ({
        ...p,
        balance: partyDisplayBalance(p, invoices, expenses),
      })),
    [parties, invoices, expenses]
  );

  const filtered = useMemo(() => {
    let list = partiesWithBalance.filter((p) => {
      if (typeFilter !== "all" && p.kind !== typeFilter) return false;
      const flow = balanceFlow(p.kind, p.balance);
      if (balanceFilter === "collect" && flow !== "in") return false;
      if (balanceFilter === "pay" && flow !== "out") return false;
      return matchesSearch(p, query, searchCategory);
    });

    list = [...list].sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      if (sortKey === "name") {
        return mul * a.name.localeCompare(b.name);
      }
      if (sortKey === "createdAt") {
        return mul * (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
      return mul * (a.balance - b.balance);
    });

    return list;
  }, [partiesWithBalance, query, searchCategory, typeFilter, balanceFilter, sortKey, sortDir]);

  const totals = useMemo(() => {
    let toCollect = 0;
    let toPay = 0;
    let collectCount = 0;
    let payCount = 0;
    for (const p of partiesWithBalance) {
      const flow = balanceFlow(p.kind, p.balance);
      if (flow === "in") {
        toCollect += p.balance;
        collectCount += 1;
      }
      if (flow === "out") {
        toPay += p.balance;
        payCount += 1;
      }
    }
    return { toCollect, toPay, collectCount, payCount };
  }, [partiesWithBalance]);

  const setBalanceFilterToggle = (next: "all" | "collect" | "pay") => {
    setBalanceFilter((prev) => (prev === next ? "all" : next));
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "balance" || key === "createdAt" ? "desc" : "asc");
    }
  };

  const exportFilteredCsv = () => {
    const rows = filtered.length ? filtered : partiesWithBalance;
    const header = "Party Name,Category,Mobile,Party Type,Balance\n";
    const body = rows
      .map(
        (p) =>
          `"${p.name.replace(/"/g, '""')}",${p.category ?? ""},${p.mobile ?? ""},${p.kind},${p.balance}`
      )
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `parties-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported CSV");
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await removeParty(deleteTarget.id);
      toast.success("Party removed from list");
      setDeleteTarget(null);
    } catch {
      toast.error("Could not remove party. Is the API running?");
    } finally {
      setDeleting(false);
    }
  };

  if (partiesLoading) {
    return <PartiesListLoading />;
  }

  const actionTh =
    "sticky top-0 z-10 w-[32px] min-w-[32px] max-w-[32px] border border-border bg-muted p-0 align-middle";
  const actionTd =
    "w-[32px] min-w-[32px] max-w-[32px] border border-border p-0 align-middle bg-background text-center";

  const thCell =
    "sticky top-0 z-10 border border-border bg-muted text-left font-semibold text-foreground px-4 py-3 whitespace-nowrap align-middle";
  const tdCell = "border border-border px-4 py-3.5 text-foreground align-middle bg-background";
  const tdMuted = `${tdCell} text-muted-foreground`;

  const tableHeaderRow = (
    <tr>
      <th className={`${thCell} w-[50%] sm:w-[30%]`}>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 font-semibold hover:text-foreground transition-colors"
          onClick={() => toggleSort("name")}
        >
          Party Name
          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
        </button>
      </th>
      <th className={`${thCell} hidden md:table-cell md:w-[14%]`}>Category</th>
      <th className={`${thCell} hidden sm:table-cell sm:w-[18%]`}>Mobile Number</th>
      <th className={`${thCell} hidden sm:table-cell sm:w-[14%]`}>Party type</th>
      <th className={`${thCell} w-[38%] sm:w-[14%] text-right tabular-nums whitespace-nowrap`}>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 font-semibold hover:text-foreground transition-colors"
          onClick={() => toggleSort("balance")}
        >
          Balance
          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
        </button>
      </th>
      <th className={actionTh} aria-label="Actions" />
    </tr>
  );

  return (
    <div className="flex h-[calc(100dvh-7.25rem)] max-h-[calc(100dvh-7.25rem)] flex-col gap-4 overflow-hidden md:h-[calc(100dvh-8rem)] md:max-h-[calc(100dvh-8rem)]">
      <div className="shrink-0">
        <PageHeader
          title="Parties"
          description={`Customers & suppliers ledger. Viewing: ${viewingLabel}.`}
        />
      </div>

      <div className="grid shrink-0 grid-cols-1 items-stretch sm:grid-cols-3 gap-3">
        <KPICard
          size="compact"
          title="All Parties"
          value={parties.length}
          icon={Users}
          tone="violet"
          active={balanceFilter === "all"}
          onClick={() => setBalanceFilter("all")}
        />
        <KPICard
          size="compact"
          title="To Collect"
          value={formatInrFull(totals.toCollect)}
          icon={ArrowDownRight}
          tone="emerald"
          active={balanceFilter === "collect"}
          onClick={() => setBalanceFilterToggle("collect")}
        />
        <KPICard
          size="compact"
          title="To Pay"
          value={formatInrFull(totals.toPay)}
          icon={ArrowUpRight}
          tone="rose"
          active={balanceFilter === "pay"}
          onClick={() => setBalanceFilterToggle("pay")}
        />
      </div>

      <div className="flex shrink-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex w-full min-w-0 flex-col gap-2 md:flex-1 md:flex-row md:items-center">
          <Input
            placeholder="Search parties"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full md:max-w-xs"
          />
          <Select
            value={searchCategory}
            onValueChange={(v) => setSearchCategory(v as SearchCategory)}
          >
            <SelectTrigger className="hidden w-[180px] shrink-0 md:flex">
              <SelectValue placeholder="Search Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All fields</SelectItem>
              <SelectItem value="name">Party name</SelectItem>
              <SelectItem value="mobile">Mobile number</SelectItem>
              <SelectItem value="category">Category</SelectItem>
              <SelectItem value="customer">Customers only</SelectItem>
              <SelectItem value="supplier">Suppliers only</SelectItem>
            </SelectContent>
          </Select>
          <MobileFilterTrigger
            onClick={() => setFilterSheetOpen(true)}
            activeCount={activeFilterCount}
          />
        </div>
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center md:shrink-0">
          <Button variant="outline" className="w-full md:w-auto" onClick={exportFilteredCsv}>
            Export CSV
          </Button>
          <Button className="w-full md:w-auto" onClick={() => router.push("/parties/new")}>
            <Plus className="h-4 w-4 mr-2" />
            Create Party
          </Button>
        </div>
      </div>

      <div className="flex shrink-0 gap-2 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch] md:hidden">
        {(
          [
            { value: "all" as const, label: "All types" },
            { value: "customer" as const, label: "Customers" },
            { value: "supplier" as const, label: "Suppliers" },
          ] as const
        ).map((opt) => (
          <Button
            key={opt.value}
            type="button"
            size="sm"
            variant={typeFilter === opt.value ? "default" : "outline"}
            className="shrink-0"
            onClick={() => setTypeFilter(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        {filtered.length === 0 ? (
          <EmptyState
            type="parties-filter"
            actionLabel={parties.length === 0 ? "Create Party" : undefined}
            onAction={parties.length === 0 ? () => router.push("/parties/new") : undefined}
          />
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-3 space-y-3 md:hidden">
              {filtered.map((p) => {
                const flow = balanceFlow(p.kind, p.balance);
                const goToParty = () => router.push(`/parties/${encodeURIComponent(p.id)}`);
                return (
                  <div
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    onClick={goToParty}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        goToParty();
                      }
                    }}
                    className="rounded-lg border border-border bg-card p-4 text-sm shadow-sm cursor-pointer transition-colors hover:bg-muted/40 hover:border-primary/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold leading-snug">{p.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {p.kind === "customer" ? "Customer" : "Supplier"}
                          {p.category ? ` · ${p.category}` : ""}
                        </p>
                        {p.mobile ? (
                          <a
                            href={`tel:${p.mobile.replace(/\s/g, "")}`}
                            className="mt-0.5 block text-xs text-primary"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {p.mobile}
                          </a>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-right">
                        <p
                          className={`text-base font-bold tabular-nums ${
                            flow === "in"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : flow === "out"
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-foreground"
                          }`}
                        >
                          {formatInrTable(p.balance)}
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {flow === "in" ? "To collect" : flow === "out" ? "To pay" : "Settled"}
                        </p>
                      </div>
                    </div>
                    <div
                      className="mt-3 flex gap-2 border-t border-border/80 pt-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button variant="outline" size="sm" className="flex-1" asChild>
                        <Link href={`/parties/${encodeURIComponent(p.id)}/edit`}>
                          <Pencil className="h-3.5 w-3.5 mr-1.5" />
                          Edit
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={() => setDeleteTarget({ id: p.id, name: p.name })}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="hidden md:block min-h-0 flex-1 overflow-y-auto overflow-x-auto overscroll-y-contain">
              <table className="w-full table-fixed border-collapse border border-border text-sm min-w-[280px]">
                <thead>{tableHeaderRow}</thead>
                <tbody>
                  {filtered.map((p) => {
                    const goToParty = () =>
                      router.push(`/parties/${encodeURIComponent(p.id)}`);
                    return (
                      <tr
                        key={p.id}
                        className="cursor-pointer transition-colors duration-200 hover:[&>td]:bg-muted"
                        onClick={goToParty}
                      >
                        <td className={`${tdCell} font-medium min-w-0`}>
                          <div className="truncate">{p.name}</div>
                          <div className="text-xs font-normal text-muted-foreground sm:hidden">
                            {p.kind === "customer" ? "Customer" : "Supplier"}
                          </div>
                        </td>
                        <td className={`${tdMuted} hidden md:table-cell`}>
                          {p.category ?? "—"}
                        </td>
                        <td className={`${tdMuted} hidden sm:table-cell whitespace-nowrap`}>
                          {p.mobile ?? "—"}
                        </td>
                        <td className={`${tdCell} hidden sm:table-cell whitespace-nowrap`}>
                          {p.kind === "customer" ? "Customer" : "Supplier"}
                        </td>
                        <td className={`${tdCell} text-right tabular-nums whitespace-nowrap`}>
                          {formatInrTable(p.balance)}
                        </td>
                        <td
                          className={actionTd}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                              >
                                <MoreVertical className="h-4 w-4 shrink-0" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/parties/${encodeURIComponent(p.id)}/edit`}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteTarget({ id: p.id, name: p.name })}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="shrink-0 text-xs text-muted-foreground px-4 py-2 border-t border-border bg-muted/30">
              {balanceFilter === "collect"
                ? `Showing ${filtered.length} parties with amount to collect`
                : balanceFilter === "pay"
                  ? `Showing ${filtered.length} parties with amount to pay`
                  : `Showing ${filtered.length} of ${parties.length} parties`}
            </p>
          </>
        )}
      </div>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}
      >
        <DialogContent className={cn(dialogMobileSheetContentClasses, "max-w-md")}>
          <DialogHeader className={cn(dialogMobileSheetHeaderClasses, "space-y-0")}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              <div className="min-w-0 space-y-1">
                <DialogTitle>Remove party?</DialogTitle>
                <DialogDescription>
                  This hides the party from your list. Ledger history is kept in the database.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {deleteTarget ? (
            <div className="space-y-3 px-6 py-4">
              <div className="rounded-lg border border-border/60 bg-muted/40 px-4 py-3">
                <p className="font-medium leading-snug">{deleteTarget.name}</p>
              </div>
              <p className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                You can create the party again later if needed.
              </p>
            </div>
          ) : null}
          <DialogFooter className="shrink-0 gap-2 border-t border-border/60 px-6 py-4 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting ? "Removing…" : "Remove party"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MobileFilterSheet
        open={filterSheetOpen}
        onOpenChange={setFilterSheetOpen}
        title="Party filters"
        activeCount={activeFilterCount}
        onReset={() => setSearchCategory("all")}
      >
        <div className="space-y-2">
          <p className="text-sm font-medium">Search in</p>
          <Select
            value={searchCategory}
            onValueChange={(v) => setSearchCategory(v as SearchCategory)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Search in" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All fields</SelectItem>
              <SelectItem value="name">Party name</SelectItem>
              <SelectItem value="mobile">Mobile number</SelectItem>
              <SelectItem value="category">Category</SelectItem>
              <SelectItem value="customer">Customers only</SelectItem>
              <SelectItem value="supplier">Suppliers only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </MobileFilterSheet>
    </div>
  );
}
