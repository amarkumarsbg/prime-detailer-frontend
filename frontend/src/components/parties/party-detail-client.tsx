"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import { useParties } from "@/hooks/use-parties";
import { useParty } from "@/hooks/use-party";
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
import {
  PartyDetailLoadingShell,
  PartyEmptyState,
} from "@/components/parties/party-loading-states";
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
  const { party, partyLoading, partyError, partyNotFound, refreshParty } = useParty(partyId);
  const invoices = useScopedInvoices();
  const expenses = useScopedExpenses();
  const [sidebarQuery, setSidebarQuery] = useState("");
  const [period, setPeriod] = useState("last365");
  const [txnTypeFilter, setTxnTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tab, setTab] = useState("transactions");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const confirmDelete = async () => {
    if (!party) return;
    setDeleting(true);
    try {
      await removeParty(party.id);
      toast.success("Party removed");
      setDeleteOpen(false);
      router.push("/parties");
    } catch {
      toast.error("Could not remove party");
    } finally {
      setDeleting(false);
    }
  };

  if (partyLoading) {
    return <PartyDetailLoadingShell />;
  }

  if (partyError) {
    return (
      <PartyEmptyState
        title="Could not load party"
        description={partyError}
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={() => void refreshParty()}>Try again</Button>
            <Button variant="outline" onClick={() => router.push("/parties")}>
              Back to parties
            </Button>
          </div>
        }
      />
    );
  }

  if (partyNotFound || !party) {
    return (
      <PartyEmptyState
        title="Party not found"
        description="This party may have been removed or the link is incorrect."
        action={
          <Button variant="outline" onClick={() => router.push("/parties")}>
            Back to parties
          </Button>
        }
      />
    );
  }

  const handleUpdateParty = async (patch: Partial<Party>) => {
    await upsertParty(party.id, {
      ...party,
      ...patch,
      name: party.name,
      kind: party.kind,
    });
    void refreshParty();
  };

  const handleTabChange = (value: string) => {
    setTab(value);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", value);
    router.replace(url.pathname + url.search, { scroll: false });
  };

  return (
    <div className="flex flex-col rounded-lg border border-border bg-background md:h-[calc(100dvh-8rem)] md:max-h-[calc(100dvh-8rem)] md:overflow-hidden">
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
        className="flex min-w-0 flex-1 flex-col md:overflow-hidden"
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
            <div className="flex md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="h-8 gap-1">
                    Actions
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {party.kind === "customer" ? (
                    <DropdownMenuItem asChild>
                      <Link href="/billing">Create sales invoice</Link>
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem asChild>
                    <Link href={`/parties/${encodeURIComponent(party.id)}/edit`}>Edit party</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteOpen(true)}
                  >
                    Remove party
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="hidden flex-wrap items-center gap-2 md:flex">
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
                className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <TabsList className="mt-3 h-auto w-full justify-start gap-2 overflow-x-auto rounded-none border-0 border-b-0 bg-transparent p-0 [-webkit-overflow-scrolling:touch] sm:gap-6">
            <TabsTrigger value="transactions" className={cn(tabTriggerClass, "shrink-0 gap-1.5")}>
              <Wallet className="h-4 w-4 shrink-0 opacity-70" />
              Transactions
            </TabsTrigger>
            <TabsTrigger value="profile" className={cn(tabTriggerClass, "shrink-0 gap-1.5")}>
              <UserCircle className="h-4 w-4 shrink-0 opacity-70" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="ledger" className={cn(tabTriggerClass, "shrink-0 gap-1.5")}>
              <BookOpen className="h-4 w-4 shrink-0 opacity-70" />
              <span className="sm:hidden">Ledger</span>
              <span className="hidden sm:inline">Ledger (Statement)</span>
            </TabsTrigger>
            <TabsTrigger value="items" className={cn(tabTriggerClass, "shrink-0 gap-1.5")}>
              <Package className="h-4 w-4 shrink-0 opacity-70" />
              <span className="sm:hidden">Items</span>
              <span className="hidden sm:inline">Item Wise Report</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="space-y-4 px-4 py-4 sm:px-5 md:min-h-0 md:flex-1 md:overflow-y-auto">
          {tab === "transactions" && (
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <PartyPeriodSelect value={period} onChange={setPeriod} className="w-full sm:w-auto" />
              <Select value={txnTypeFilter} onValueChange={setTxnTypeFilter}>
                <SelectTrigger className={cn(partyFilterTriggerClass, "w-full sm:w-[200px]")}>
                  <SelectValue placeholder="Select Transaction Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All transaction types</SelectItem>
                  <SelectItem value="sales">Sales invoice</SelectItem>
                  <SelectItem value="purchase">Purchase / expense</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className={cn(partyFilterTriggerClass, "w-full sm:w-[160px]")}>
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
          <TabsContent value="ledger" className="mt-0 space-y-3 focus-visible:outline-none sm:space-y-4">
            {summary && <PartySummaryCards kind={party.kind} summary={summary} />}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <PartyPeriodSelect value={period} onChange={setPeriod} className="w-full sm:w-auto" />
              <div className="flex sm:ml-auto sm:shrink-0 sm:items-center sm:gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 w-full gap-1 sm:w-auto">
                      <Download className="h-4 w-4" />
                      <span className="md:hidden">Export</span>
                      <span className="hidden md:inline">Download Excel</span>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={downloadCsv}>Download CSV</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-full sm:w-auto"
                  onClick={() => window.print()}
                >
                  <Printer className="mr-1 h-4 w-4" />
                  Print
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="hidden h-9 shrink-0 md:inline-flex">
                      <Share2 className="mr-1 h-4 w-4" />
                      Share
                      <ChevronDown className="ml-1 h-3 w-3" />
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
          <TabsContent value="items" className="mt-0 space-y-3 focus-visible:outline-none sm:space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <PartyPeriodSelect value={period} onChange={setPeriod} className="w-full sm:w-auto" />
              <div className="flex gap-2 sm:ml-auto sm:shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 flex-1 gap-1 sm:flex-none">
                      <Download className="h-4 w-4" />
                      Export
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={downloadItemWiseCsv}>Download CSV</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 flex-1 sm:flex-none"
                  onClick={() => window.print()}
                >
                  <Printer className="mr-1 h-4 w-4" />
                  Print
                </Button>
              </div>
            </div>
            <PartyItemWiseTab rows={itemWise} />
          </TabsContent>
        </div>
      </Tabs>

      <Dialog open={deleteOpen} onOpenChange={(open) => !open && !deleting && setDeleteOpen(false)}>
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
          {party ? (
            <div className="space-y-3 px-6 py-4">
              <div className="rounded-lg border border-border/60 bg-muted/40 px-4 py-3">
                <p className="font-medium leading-snug">{party.name}</p>
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
              onClick={() => setDeleteOpen(false)}
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
    </div>
  );
}
