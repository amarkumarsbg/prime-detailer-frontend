"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { PartyListPanel } from "@/components/parties/party-list-panel";
import { PartySummaryCards } from "@/components/parties/party-summary-cards";
import { PartyTransactionsTab } from "@/components/parties/party-transactions-tab";
import { PartyProfileTab } from "@/components/parties/party-profile-tab";
import { PartyLedgerTab } from "@/components/parties/party-ledger-tab";
import { PartyItemWiseTab } from "@/components/parties/party-item-wise-tab";
import {
  PartyPeriodSelect,
  partyFilterTriggerClass,
} from "@/components/parties/party-period-select";
import { useParties, getPartyById } from "@/hooks/use-parties";
import { useScopedExpenses, useScopedInvoices } from "@/hooks/use-scoped-data";
import {
  buildPartyItemWise,
  buildPartyStatement,
  buildPartySummary,
  buildPartyTransactions,
  partyCurrentBalance,
  partyDisplayBalance,
} from "@/lib/party/ledger-math";
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  Download,
  Package,
  Pencil,
  Printer,
  Share2,
  Trash2,
  UserCircle,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import type { Party, PartyTransactionRow } from "@/types/party";
import { appendReturnTo, partyDetailReturnPath } from "@/lib/navigation/return-to";
import { cn } from "@/lib/utils";

const tabTriggerClass =
  "rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 pb-3 pt-2 text-sm font-medium text-muted-foreground shadow-none data-[state=active]:border-violet-600 data-[state=active]:bg-transparent data-[state=active]:text-violet-700 data-[state=active]:shadow-none dark:data-[state=active]:border-violet-500 dark:data-[state=active]:text-violet-400";

type PartyDetailClientProps = {
  partyId: string;
};

function filterTransactions(
  rows: PartyTransactionRow[],
  typeFilter: string,
  statusFilter: string
): PartyTransactionRow[] {
  return rows.filter((r) => {
    if (typeFilter !== "all") {
      const key = typeFilter.toLowerCase();
      if (key === "sales" && !r.typeLabel.toLowerCase().includes("sales")) return false;
      if (key === "purchase" && !r.typeLabel.toLowerCase().includes("purchase")) return false;
    }
    if (statusFilter !== "all") {
      const want = statusFilter.toLowerCase();
      if (want === "paid" && r.status !== "Paid") return false;
      if (want === "partial" && r.status !== "Partially paid") return false;
      if (want === "outstanding" && r.status !== "Outstanding") return false;
    }
    return true;
  });
}

export function PartyDetailClient({ partyId }: PartyDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { parties, removeParty, upsertParty } = useParties();
  const invoices = useScopedInvoices();
  const expenses = useScopedExpenses();
  const [sidebarQuery, setSidebarQuery] = useState("");
  const [period, setPeriod] = useState("last365");
  const [txnTypeFilter, setTxnTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tab, setTab] = useState("transactions");

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "profile" || t === "ledger" || t === "items" || t === "transactions") {
      setTab(t);
    }
  }, [searchParams]);

  const partiesWithBalance = useMemo(
    () =>
      parties.map((p) => ({
        ...p,
        balance: partyDisplayBalance(p, invoices, expenses),
      })),
    [parties, invoices, expenses]
  );

  const party = getPartyById(parties, partyId);

  const summary = useMemo(
    () => (party ? buildPartySummary(party, invoices, expenses, period) : null),
    [party, invoices, expenses, period]
  );

  const transactions = useMemo(
    () => (party ? buildPartyTransactions(party, invoices, expenses, period) : []),
    [party, invoices, expenses, period]
  );

  const partyReturnPath = useMemo(
    () => (party ? partyDetailReturnPath(party.id, tab) : ""),
    [party, tab]
  );

  const filteredTransactions = useMemo(() => {
    const filtered = filterTransactions(transactions, txnTypeFilter, statusFilter);
    if (!partyReturnPath) return filtered;
    return filtered.map((r) =>
      r.href ? { ...r, href: appendReturnTo(r.href, partyReturnPath) } : r
    );
  }, [transactions, txnTypeFilter, statusFilter, partyReturnPath]);

  const statement = useMemo(
    () => (party ? buildPartyStatement(party, invoices, expenses, period) : []),
    [party, invoices, expenses, period]
  );

  const itemWise = useMemo(
    () => (party ? buildPartyItemWise(party, invoices, expenses, period) : []),
    [party, invoices, expenses, period]
  );

  const downloadCsv = () => {
    if (!party || !statement.length) {
      toast.error("Nothing to export");
      return;
    }
    const header = "Date,Voucher,Sr No,Payment Mode,Credit,Debit,Balance\n";
    const rows = statement
      .map(
        (r) =>
          `${r.date},${r.voucher},${r.serialNo},${r.paymentMode},${r.credit ?? ""},${r.debit ?? ""},${r.balance}`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `party-ledger-${party.name.replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded CSV");
  };

  const downloadItemWiseCsv = () => {
    if (!party || itemWise.length === 0) {
      toast.error("Nothing to export");
      return;
    }
    const header =
      "Item Name,Item Code,Sales Quantity,Sales Amount,Purchase Quantity,Purchase Amount\n";
    const rows = itemWise
      .map(
        (r) =>
          `${r.itemName},${r.itemCode},${r.salesQuantity},${r.salesAmount},${r.purchaseQuantity},${r.purchaseAmount}`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `party-item-wise-${party.name.replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded CSV");
  };

  const handleDelete = async () => {
    if (!party) return;
    if (!confirm(`Hide "${party.name}" from the parties list?`)) return;
    await removeParty(party.id);
    toast.success("Party removed");
    router.push("/parties");
  };

  if (!party) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <p className="text-muted-foreground">Party not found</p>
        <Button variant="outline" onClick={() => router.push("/parties")}>
          Back to parties
        </Button>
      </div>
    );
  }

  const handleUpdateParty = async (patch: Partial<Party>) => {
    await upsertParty(party.id, {
      ...party,
      ...patch,
      name: party.name,
      kind: party.kind,
    });
  };

  const handleTabChange = (value: string) => {
    setTab(value);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", value);
    router.replace(url.pathname + url.search, { scroll: false });
  };

  return (
    <div className="flex h-[calc(100dvh-7.25rem)] max-h-[calc(100dvh-7.25rem)] overflow-hidden rounded-lg border border-border bg-background md:h-[calc(100dvh-8rem)] md:max-h-[calc(100dvh-8rem)]">
      <PartyListPanel
        className="w-full max-w-[300px] shrink-0 hidden lg:flex"
        parties={partiesWithBalance}
        query={sidebarQuery}
        onQueryChange={setSidebarQuery}
        selectedId={partyId}
        onSelect={(id) => router.push(`/parties/${encodeURIComponent(id)}`)}
      />

      <Tabs
        value={tab}
        onValueChange={handleTabChange}
        className="flex min-w-0 flex-1 flex-col overflow-hidden"
      >
        <div className="shrink-0 border-b border-border bg-background px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" asChild>
                <Link href="/parties">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <h1 className="text-lg font-bold truncate sm:text-xl">{party.name}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {party.kind === "customer" && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1">
                      Create Sales Invoice
                      <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href="/billing">New invoice</Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Button size="sm" variant="outline" asChild>
                <Link href={`/parties/${encodeURIComponent(party.id)}/edit`}>
                  <Pencil className="h-4 w-4 mr-1.5" />
                  Edit
                </Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <TabsList className="mt-3 h-auto w-full justify-start gap-4 sm:gap-6 rounded-none bg-transparent p-0 border-0 border-b-0">
            <TabsTrigger value="transactions" className={cn(tabTriggerClass, "gap-1.5")}>
              <Wallet className="h-4 w-4 shrink-0 opacity-70" />
              Transactions
            </TabsTrigger>
            <TabsTrigger value="profile" className={cn(tabTriggerClass, "gap-1.5")}>
              <UserCircle className="h-4 w-4 shrink-0 opacity-70" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="ledger" className={cn(tabTriggerClass, "gap-1.5")}>
              <BookOpen className="h-4 w-4 shrink-0 opacity-70" />
              Ledger (Statement)
            </TabsTrigger>
            <TabsTrigger value="items" className={cn(tabTriggerClass, "gap-1.5")}>
              <Package className="h-4 w-4 shrink-0 opacity-70" />
              Item Wise Report
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4 sm:px-5 space-y-4">
          {tab === "transactions" && (
            <div className="flex flex-nowrap items-center gap-3 overflow-x-auto pb-0.5">
              <PartyPeriodSelect value={period} onChange={setPeriod} />
              <Select value={txnTypeFilter} onValueChange={setTxnTypeFilter}>
                <SelectTrigger className={cn(partyFilterTriggerClass, "w-[200px]")}>
                  <SelectValue placeholder="Select Transaction Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All transaction types</SelectItem>
                  <SelectItem value="sales">Sales invoice</SelectItem>
                  <SelectItem value="purchase">Purchase / expense</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className={cn(partyFilterTriggerClass, "w-[160px]")}>
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="partial">Partially paid</SelectItem>
                  <SelectItem value="outstanding">Outstanding</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <TabsContent value="transactions" className="mt-0 focus-visible:outline-none">
            <PartyTransactionsTab rows={filteredTransactions} />
          </TabsContent>
          <TabsContent value="profile" className="mt-0 focus-visible:outline-none">
            <PartyProfileTab party={party} onUpdateParty={handleUpdateParty} />
          </TabsContent>
          <TabsContent value="ledger" className="mt-0 space-y-4 focus-visible:outline-none">
            {summary && <PartySummaryCards kind={party.kind} summary={summary} />}
            <div className="flex flex-nowrap items-center gap-3 overflow-x-auto pb-0.5">
              <PartyPeriodSelect value={period} onChange={setPeriod} />
              <div className="ml-auto flex shrink-0 flex-nowrap items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 shrink-0">
                      <Download className="h-4 w-4 mr-1" />
                      Download Excel
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={downloadCsv}>Download CSV</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0"
                  onClick={() => window.print()}
                >
                  <Printer className="h-4 w-4 mr-1" />
                  Print PDF
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 shrink-0">
                      <Share2 className="h-4 w-4 mr-1" />
                      Share
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() =>
                        toast.message("Share", {
                          description: "Party portal link — coming with backend.",
                        })
                      }
                    >
                      Copy link
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <PartyLedgerTab lines={statement} returnTo={partyReturnPath} />
          </TabsContent>
          <TabsContent value="items" className="mt-0 space-y-4 focus-visible:outline-none">
            <div className="flex flex-nowrap items-center gap-3 overflow-x-auto pb-0.5">
              <PartyPeriodSelect value={period} onChange={setPeriod} />
              <div className="ml-auto flex shrink-0 flex-nowrap items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 shrink-0">
                      <Download className="h-4 w-4 mr-1" />
                      Download
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={downloadItemWiseCsv}>Download CSV</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0"
                  onClick={() => window.print()}
                >
                  <Printer className="h-4 w-4 mr-1" />
                  Print
                </Button>
              </div>
            </div>
            <PartyItemWiseTab rows={itemWise} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
