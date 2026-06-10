"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
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

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hide "${name}" from the parties list?`)) return;
    await removeParty(id);
    toast.success("Party removed from list");
  };

  if (partiesLoading) {
    return <PartiesListLoading />;
  }

  const tableColGroup = (
    <colgroup>
      <col style={{ width: "30%" }} />
      <col style={{ width: "14%" }} />
      <col style={{ width: "18%" }} />
      <col style={{ width: "14%" }} />
      <col style={{ width: "14%" }} />
      <col style={{ width: 32 }} />
    </colgroup>
  );

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
      <th className={thCell}>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 font-semibold hover:text-foreground transition-colors"
          onClick={() => toggleSort("name")}
        >
          Party Name
          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
        </button>
      </th>
      <th className={`${thCell} hidden md:table-cell`}>Category</th>
      <th className={`${thCell} hidden sm:table-cell`}>Mobile Number</th>
      <th className={thCell}>Party type</th>
      <th className={`${thCell} tabular-nums`}>
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

      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 min-w-0 items-center gap-2">
          <Input
            placeholder="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-xs"
          />
          <Select
            value={searchCategory}
            onValueChange={(v) => setSearchCategory(v as SearchCategory)}
          >
            <SelectTrigger className="w-[180px] shrink-0">
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
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" onClick={exportFilteredCsv}>
            Export CSV
          </Button>
          <Button onClick={() => router.push("/parties/new")}>Create Party</Button>
        </div>
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
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-auto overscroll-y-contain">
              <table className="w-full table-fixed border-collapse border border-border text-sm">
                {tableColGroup}
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
                        <td className={`${tdCell} font-medium`}>{p.name}</td>
                        <td className={`${tdMuted} hidden md:table-cell`}>
                          {p.category ?? "—"}
                        </td>
                        <td className={`${tdMuted} hidden sm:table-cell`}>
                          {p.mobile ?? "—"}
                        </td>
                        <td className={tdCell}>
                          {p.kind === "customer" ? "Customer" : "Supplier"}
                        </td>
                        <td className={`${tdCell} tabular-nums`}>
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
                                onClick={() => handleDelete(p.id, p.name)}
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
    </div>
  );
}
