"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ArrowLeftRight,
  Building2,
  CirclePlus,
  Download,
  Landmark,
  Minus,
  Pencil,
  Plus,
  Share2,
  Shield,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import {
  DesktopTableWrap,
  MobileCardList,
  MobileRowCard,
} from "@/components/shared/mobile-table-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { downloadCashBankStatementPdf } from "@/lib/cash-bank-statement-pdf";
import { cn, formatCurrency, formatInrFull } from "@/lib/utils";
import { useSettingsStore } from "@/store/settings-store";
import {
  totalCashBankBalance,
  useCashBankStore,
  type CashBankAccount,
  type CashBankTransaction,
} from "@/store/cash-bank-store";

/** Alias kept for call-site readability; canonical formatter is formatInrFull. */
const formatInrDetailed = formatInrFull;

function rowTypeLabel(t: CashBankTransaction["rowType"]): string {
  switch (t) {
    case "OPENING":
      return "Opening Balance";
    case "ADJUST_ADD":
      return "Adjustment (+)";
    case "ADJUST_REDUCE":
      return "Adjustment (−)";
    case "TRANSFER_OUT":
      return "Transfer out";
    case "TRANSFER_IN":
      return "Transfer in";
    default:
      return "—";
  }
}

type DatePreset =
  | "last30"
  | "last7"
  | "today"
  | "yesterday"
  | "thisWeek"
  | "lastWeek"
  | "thisMonth"
  | "prevMonth"
  | "thisQuarter"
  | "prevQuarter"
  | "fyCurrent"
  | "fyPrev"
  | "last365"
  | "custom";

function startEndForPreset(
  preset: DatePreset,
  customStart?: string,
  customEnd?: string
): { start: Date; end: Date } | null {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (preset === "custom" && customStart && customEnd) {
    const a = startOfDay(new Date(customStart));
    const b = new Date(customEnd);
    b.setHours(23, 59, 59, 999);
    if (a > b) return null;
    return { start: a, end: b };
  }

  switch (preset) {
    case "today":
      return { start: startOfDay(now), end };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return {
        start: startOfDay(y),
        end: new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999),
      };
    }
    case "last7": {
      const s = new Date(now);
      s.setDate(s.getDate() - 6);
      return { start: startOfDay(s), end };
    }
    case "last30": {
      const s = new Date(now);
      s.setDate(s.getDate() - 29);
      return { start: startOfDay(s), end };
    }
    case "last365": {
      const s = new Date(now);
      s.setDate(s.getDate() - 364);
      return { start: startOfDay(s), end };
    }
    case "thisWeek": {
      const s = new Date(now);
      const day = s.getDay();
      s.setDate(s.getDate() - day);
      return { start: startOfDay(s), end };
    }
    case "lastWeek": {
      const e = new Date(now);
      const day = e.getDay();
      e.setDate(e.getDate() - day - 1);
      const s = new Date(e);
      s.setDate(s.getDate() - 6);
      return { start: startOfDay(s), end: new Date(e.setHours(23, 59, 59, 999)) };
    }
    case "thisMonth":
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end };
    case "prevMonth": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { start: s, end: e };
    }
    case "thisQuarter": {
      const q = Math.floor(now.getMonth() / 3);
      const sm = q * 3;
      return { start: new Date(now.getFullYear(), sm, 1), end };
    }
    case "prevQuarter": {
      const q = Math.floor(now.getMonth() / 3) - 1;
      const y = q < 0 ? now.getFullYear() - 1 : now.getFullYear();
      const mq = ((q + 4) % 4) * 3;
      const s = new Date(y, mq, 1);
      const e = new Date(y, mq + 3, 0, 23, 59, 59, 999);
      return { start: s, end: e };
    }
    case "fyCurrent": {
      const m = now.getMonth();
      const fy0 = m >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      return {
        start: new Date(fy0, 3, 1),
        end,
      };
    }
    case "fyPrev": {
      const m = now.getMonth();
      const fy0 = m >= 3 ? now.getFullYear() - 1 : now.getFullYear() - 2;
      return {
        start: new Date(fy0, 3, 1),
        end: new Date(fy0 + 1, 2, 31, 23, 59, 59, 999),
      };
    }
    default:
      return { start: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)), end };
  }
}

const PRESET_LABEL: Record<DatePreset, string> = {
  last30: "Last 30 Days",
  last7: "Last 7 days",
  today: "Today",
  yesterday: "Yesterday",
  thisWeek: "This Week",
  lastWeek: "Last Week",
  thisMonth: "This Month",
  prevMonth: "Previous Month",
  thisQuarter: "This Quarter",
  prevQuarter: "Previous Quarter",
  fyCurrent: "Current Fiscal Year",
  fyPrev: "Previous Fiscal Year",
  last365: "Last 365 Days",
  custom: "Custom Date Range",
};

export function CashBankClient() {
  const accounts = useCashBankStore((s) => s.accounts);
  const transactions = useCashBankStore((s) => s.transactions);
  const addBankAccount = useCashBankStore((s) => s.addBankAccount);
  const updateBankAccount = useCashBankStore((s) => s.updateBankAccount);
  const removeBankAccount = useCashBankStore((s) => s.removeBankAccount);
  const adjustBalance = useCashBankStore((s) => s.adjustBalance);
  const transfer = useCashBankStore((s) => s.transfer);
  const businessName = useSettingsStore((s) => s.businessName);
  const businessPhone = useSettingsStore((s) => s.businessPhone);

  const [selectedId, setSelectedId] = useState("acc-unlinked");
  const [datePreset, setDatePreset] = useState<DatePreset>("last30");

  useEffect(() => {
    if (accounts.length > 0 && !accounts.some((a) => a.id === selectedId)) {
      queueMicrotask(() => setSelectedId(accounts[0].id));
    }
  }, [accounts, selectedId]);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);

  const selected = useMemo(
    () => accounts.find((a) => a.id === selectedId) ?? null,
    [accounts, selectedId]
  );

  const total = useMemo(() => totalCashBankBalance(accounts), [accounts]);

  const cashAccount = useMemo(() => accounts.find((a) => a.type === "cash"), [accounts]);
  const bankOnly = useMemo(() => accounts.filter((a) => a.type === "bank"), [accounts]);
  const specialRows = useMemo(
    () => accounts.filter((a) => a.type === "cash" || a.type === "unlinked"),
    [accounts]
  );

  const range = useMemo(() => {
    if (datePreset === "custom") {
      return startEndForPreset("custom", customStart, customEnd);
    }
    return startEndForPreset(datePreset);
  }, [datePreset, customStart, customEnd]);

  const filteredTx = useMemo(() => {
    if (!selected || !range) return [];
    return transactions
      .filter((t) => {
        if (t.accountId !== selected.id) return false;
        const d = new Date(t.date).getTime();
        return d >= range.start.getTime() && d <= range.end.getTime();
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, selected, range]);

  const downloadStatementPdf = useCallback(() => {
    if (!selected || !range) return;
    downloadCashBankStatementPdf({
      businessName,
      businessPhone,
      accountDisplayName: selected.displayName,
      rangeStart: range.start,
      rangeEnd: range.end,
      transactions: filteredTx,
      fallbackBalance: selected.balance,
    });
    toast.success("PDF statement downloaded");
  }, [filteredTx, selected, range, businessName, businessPhone]);

  return (
    <div className="space-y-6">
      <PageHeader
        className="border-b border-border pb-5"
        title="Cash and Bank"
        description="Manage cash on hand, bank accounts, and account transactions."
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-border bg-background shadow-sm hover:bg-muted/60"
              onClick={() => setAdjustOpen(true)}
            >
              <CirclePlus className="size-4" aria-hidden />
              Add/Reduce Money
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-border bg-background shadow-sm hover:bg-muted/60"
              onClick={() => setTransferOpen(true)}
            >
              <ArrowLeftRight className="size-4" aria-hidden />
              Transfer Money
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="size-4" aria-hidden />
              Add New Account
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
        <Card className="lg:col-span-4 border-border shadow-sm">
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-semibold text-foreground">Total Balance</span>
              <span className="text-base font-bold tabular-nums text-foreground">{formatInrDetailed(total)}</span>
            </div>
            <ScrollArea className="max-h-[min(70vh,640px)]">
              <div className="px-2 py-2">
                <p className="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Cash</p>
                {cashAccount && (
                  <button
                    type="button"
                    onClick={() => setSelectedId(cashAccount.id)}
                    className={cn(
                      "mb-1 flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors",
                      selectedId === cashAccount.id
                        ? "border-indigo-200 bg-indigo-50/90 dark:border-indigo-900 dark:bg-indigo-950/40"
                        : "hover:bg-muted/60"
                    )}
                  >
                    <div className="flex size-9 items-center justify-center rounded-md bg-muted">
                      <Wallet className="size-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{cashAccount.displayName}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatInrDetailed(cashAccount.balance)}
                    </span>
                  </button>
                )}

                <p className="mt-3 px-2 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Bank Accounts
                </p>
                <div className="mb-2 flex items-center justify-between px-2">
                  <span />
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() => setAddOpen(true)}
                  >
                    + Add New Bank
                  </button>
                </div>

                {specialRows
                  .filter((a) => a.type === "unlinked")
                  .map((acc) => (
                    <AccountRow
                      key={acc.id}
                      acc={acc}
                      selected={selectedId === acc.id}
                      onSelect={() => setSelectedId(acc.id)}
                    />
                  ))}

                {bankOnly.map((acc) => (
                  <AccountRow key={acc.id} acc={acc} selected={selectedId === acc.id} onSelect={() => setSelectedId(acc.id)} />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="lg:col-span-8 border-border shadow-sm min-h-[420px]">
          <CardContent className="p-0">
            <Tabs defaultValue="transactions" className="w-full">
              <div className="flex flex-col gap-3 border-b border-border px-4 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <TabsList className="h-9 bg-transparent p-0">
                  <TabsTrigger
                    value="transactions"
                    className="rounded-none border-b-2 border-transparent px-3 pb-2 pt-1 text-sm data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent data-[state=active]:text-indigo-600 data-[state=active]:shadow-none"
                  >
                    Transactions
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="transactions" className="mt-0 space-y-0 p-0">
                {selected?.type === "bank" && selected.bankMeta && (
                  <div className="border-b border-border bg-muted/20 px-4 py-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
                      <div className="grid flex-1 gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs text-sky-800/80 dark:text-sky-200/80">Account Holder&apos;s Name</p>
                          <p className="font-semibold text-foreground">{selected.bankMeta.holderName}</p>
                        </div>
                        <div>
                          <p className="text-xs text-sky-800/80 dark:text-sky-200/80">Account Name</p>
                          <p className="font-semibold text-foreground">{selected.displayName}</p>
                        </div>
                        <div>
                          <p className="text-xs text-sky-800/80 dark:text-sky-200/80">Account Number</p>
                          <p className="font-mono text-sm font-medium">{selected.bankMeta.accountNumber}</p>
                        </div>
                        <div>
                          <p className="text-xs text-sky-800/80 dark:text-sky-200/80">IFSC Code</p>
                          <p className="font-mono text-sm font-medium">{selected.bankMeta.ifsc}</p>
                        </div>
                        <div className="sm:col-span-2">
                          <p className="text-xs text-sky-800/80 dark:text-sky-200/80">Bank &amp; Branch</p>
                          <p className="text-sm font-medium">
                            {selected.bankMeta.bankName}, {selected.bankMeta.branchName}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col gap-2">
                        <Button type="button" variant="outline" size="sm" className="justify-start" onClick={() => setUpdateOpen(true)}>
                          <Pencil className="size-4 mr-2" />
                          Update Bank Details
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="justify-start" onClick={() => setShareOpen(true)}>
                          <Share2 className="size-4 mr-2" />
                          Share Bank Details
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="justify-start" onClick={downloadStatementPdf}>
                          <Download className="size-4 mr-2" />
                          Download Statement
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={datePreset}
                      onValueChange={(v) => setDatePreset(v as DatePreset)}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(PRESET_LABEL) as DatePreset[]).map((k) => (
                          <SelectItem key={k} value={k}>
                            {PRESET_LABEL[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {datePreset === "custom" && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          type="date"
                          className="w-[150px] date-input-icon-end pr-9"
                          value={customStart}
                          onChange={(e) => setCustomStart(e.target.value)}
                        />
                        <span className="text-muted-foreground">to</span>
                        <Input
                          type="date"
                          className="w-[150px] date-input-icon-end pr-9"
                          value={customEnd}
                          onChange={(e) => setCustomEnd(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={downloadStatementPdf} title="Download PDF statement">
                    <Download className="size-4" />
                  </Button>
                </div>

                <div className="p-4">
                  {!range ? (
                    <p className="text-sm text-muted-foreground">Select a valid custom date range.</p>
                  ) : filteredTx.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="mb-4 rounded-full border-2 border-dashed border-muted-foreground/25 p-6">
                        <Shield className="size-14 text-muted-foreground/40" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground">No Transactions</h3>
                      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                        You don&apos;t have any transaction in the selected period.
                      </p>
                    </div>
                  ) : (
                    <>
                    <MobileCardList>
                      {filteredTx.map((t) => (
                        <MobileRowCard key={t.id}>
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(t.date), "dd/MM/yyyy")}
                            </span>
                            <span className="text-xs font-medium">{rowTypeLabel(t.rowType)}</span>
                          </div>
                          <p className="mt-2 font-medium">{t.party ?? "—"}</p>
                          <p className="mt-1 font-mono text-xs text-muted-foreground">{t.txnNo ?? "—"}</p>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            {t.paid != null && (
                              <div>
                                <span className="text-muted-foreground">Paid</span>
                                <p className="font-semibold tabular-nums text-red-600">{formatCurrency(t.paid)}</p>
                              </div>
                            )}
                            {t.received != null && (
                              <div>
                                <span className="text-muted-foreground">Received</span>
                                <p className="font-semibold tabular-nums text-emerald-600">{formatCurrency(t.received)}</p>
                              </div>
                            )}
                            <div className="col-span-2">
                              <span className="text-muted-foreground">Balance</span>
                              <p className="font-bold tabular-nums">{formatInrDetailed(t.balanceAfter)}</p>
                            </div>
                          </div>
                          {t.notes && (
                            <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{t.notes}</p>
                          )}
                        </MobileRowCard>
                      ))}
                    </MobileCardList>
                    <DesktopTableWrap className="rounded-lg border border-border">
                      <table className="w-full min-w-[720px] text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            <th className="px-3 py-2">Date</th>
                            <th className="px-3 py-2">Type</th>
                            <th className="px-3 py-2">Txn No</th>
                            <th className="px-3 py-2">Party</th>
                            <th className="px-3 py-2">Mode</th>
                            <th className="px-3 py-2 text-right">Paid</th>
                            <th className="px-3 py-2 text-right">Received</th>
                            <th className="px-3 py-2 text-right">Balance</th>
                            <th className="px-3 py-2">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredTx.map((t) => (
                            <tr key={t.id} className="border-b border-border/80 hover:bg-muted/30">
                              <td className="px-3 py-2 whitespace-nowrap">{format(new Date(t.date), "dd/MM/yyyy")}</td>
                              <td className="px-3 py-2">{rowTypeLabel(t.rowType)}</td>
                              <td className="px-3 py-2 font-mono text-xs">{t.txnNo ?? "—"}</td>
                              <td className="px-3 py-2">{t.party ?? "—"}</td>
                              <td className="px-3 py-2">{t.mode ?? "—"}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{t.paid != null ? formatCurrency(t.paid) : "—"}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{t.received != null ? formatCurrency(t.received) : "—"}</td>
                              <td className="px-3 py-2 text-right font-medium tabular-nums">{formatInrDetailed(t.balanceAfter)}</td>
                              <td className="px-3 py-2 max-w-[140px] truncate text-muted-foreground">{t.notes ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </DesktopTableWrap>
                    </>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <AddBankAccountDialog open={addOpen} onOpenChange={setAddOpen} onSave={addBankAccount} />
      <AdjustBalanceDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        accounts={accounts}
        defaultAccountId={selectedId}
        adjustBalance={adjustBalance}
      />
      <TransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        accounts={accounts}
        transfer={transfer}
      />
      {selected?.type === "bank" && selected.bankMeta && (
        <>
          <ShareAccountDialog open={shareOpen} onOpenChange={setShareOpen} meta={selected.bankMeta} />
          <UpdateBankDialog
            open={updateOpen}
            onOpenChange={setUpdateOpen}
            account={selected}
            onUpdate={updateBankAccount}
            onDelete={removeBankAccount}
          />
        </>
      )}
    </div>
  );
}

function AccountRow({
  acc,
  selected,
  onSelect,
}: {
  acc: CashBankAccount;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "mb-1 flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors",
        selected
          ? "border-indigo-200 bg-indigo-50/90 dark:border-indigo-900 dark:bg-indigo-950/40"
          : "hover:bg-muted/60"
      )}
    >
      <div className="flex size-9 items-center justify-center rounded-md bg-muted">
        {acc.type === "unlinked" ? (
          <Landmark className="size-4 text-muted-foreground" />
        ) : (
          <Building2 className="size-4 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{acc.displayName}</p>
        {acc.accountNumberDisplay && (
          <p className="truncate text-xs text-muted-foreground">{acc.accountNumberDisplay}</p>
        )}
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums">{formatInrDetailed(acc.balance)}</span>
    </button>
  );
}

function AddBankAccountDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSave: (account: Omit<CashBankAccount, "id">) => void;
}) {
  const [name, setName] = useState("");
  const [opening, setOpening] = useState("");
  const [asOf, setAsOf] = useState(format(new Date(), "yyyy-MM-dd"));
  const [bankDetails, setBankDetails] = useState(false);
  const [accNum, setAccNum] = useState("");
  const [accNum2, setAccNum2] = useState("");
  const [holder, setHolder] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [bankName, setBankName] = useState("");
  const [branch, setBranch] = useState("");
  const [upi, setUpi] = useState("");

  const reset = () => {
    setName("");
    setOpening("");
    setAsOf(format(new Date(), "yyyy-MM-dd"));
    setBankDetails(false);
    setAccNum("");
    setAccNum2("");
    setHolder("");
    setIfsc("");
    setBankName("");
    setBranch("");
    setUpi("");
  };

  const submit = () => {
    const n = name.trim();
    if (!n) {
      toast.error("Account name is required");
      return;
    }
    const ob = Number.parseFloat(opening.replace(/,/g, "") || "0");
    if (Number.isNaN(ob)) {
      toast.error("Invalid opening balance");
      return;
    }
    let meta: CashBankAccount["bankMeta"] | undefined;
    if (bankDetails) {
      if (!accNum.trim() || accNum.trim() !== accNum2.trim()) {
        toast.error("Bank account numbers must match");
        return;
      }
      if (!holder.trim() || !ifsc.trim() || !bankName.trim() || !branch.trim()) {
        toast.error("Fill all required bank fields");
        return;
      }
      meta = {
        accountNumber: accNum.trim(),
        holderName: holder.trim(),
        ifsc: ifsc.trim().toUpperCase(),
        bankName: bankName.trim(),
        branchName: branch.trim(),
        upiId: upi.trim() || undefined,
      };
    }
    onSave({
      type: "bank",
      displayName: n,
      balance: Math.round(ob * 100) / 100,
      openingBalanceDate: new Date(asOf).toISOString(),
      accountNumberDisplay: meta?.accountNumber ?? "—",
      bankMeta: meta,
    });
    toast.success("Bank account added");
    onOpenChange(false);
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Bank Account</DialogTitle>
          <DialogDescription>Create a bank account and optional extended bank details.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>
              Account Name <span className="text-destructive">*</span>
            </Label>
            <Input placeholder="e.g. Personal Account" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Opening Balance</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                <Input className="pl-8" placeholder="e.g. 10000" value={opening} onChange={(e) => setOpening(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>As of Date</Label>
              <Input type="date" className="date-input-icon-end pr-9" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-3 py-1">
            <span className="text-sm font-medium">Add Bank Details</span>
            <Switch checked={bankDetails} onCheckedChange={setBankDetails} />
          </div>
          {bankDetails && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>
                  Bank Account Number <span className="text-destructive">*</span>
                </Label>
                <Input className="font-mono" value={accNum} onChange={(e) => setAccNum(e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>
                  Re-Enter Bank Account Number <span className="text-destructive">*</span>
                </Label>
                <Input className="font-mono" value={accNum2} onChange={(e) => setAccNum2(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>
                  Account Holders Name <span className="text-destructive">*</span>
                </Label>
                <Input value={holder} onChange={(e) => setHolder(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>
                  IFSC Code <span className="text-destructive">*</span>
                </Label>
                <Input className="font-mono uppercase" value={ifsc} onChange={(e) => setIfsc(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>
                  Bank Name <span className="text-destructive">*</span>
                </Label>
                <Input value={bankName} onChange={(e) => setBankName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>
                  Branch Name <span className="text-destructive">*</span>
                </Label>
                <Input value={branch} onChange={(e) => setBranch(e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>UPI ID</Label>
                <Input placeholder="e.g. name@okhdfc" value={upi} onChange={(e) => setUpi(e.target.value)} />
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" className="bg-indigo-600 hover:bg-indigo-700" onClick={submit}>
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdjustBalanceDialog({
  open,
  onOpenChange,
  accounts,
  defaultAccountId,
  adjustBalance,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  accounts: CashBankAccount[];
  defaultAccountId: string;
  adjustBalance: (i: {
    accountId: string;
    amount: number;
    add: boolean;
    dateIso: string;
    remarks?: string;
  }) => void;
}) {
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [add, setAdd] = useState(true);

  useEffect(() => {
    if (open) queueMicrotask(() => setAccountId(defaultAccountId));
  }, [open, defaultAccountId]);
  const [amount, setAmount] = useState("");
  const [dateStr, setDateStr] = useState(format(new Date(), "yyyy-MM-dd"));
  const [remarks, setRemarks] = useState("");
  const [showRemarks, setShowRemarks] = useState(false);

  const acc = accounts.find((a) => a.id === accountId);
  const amt = Number.parseFloat(amount.replace(/,/g, "") || "0");
  const newBal =
    acc && !Number.isNaN(amt) ? Math.round((acc.balance + (add ? amt : -amt)) * 100) / 100 : null;

  const submit = () => {
    if (!acc || amt <= 0 || Number.isNaN(amt)) {
      toast.error("Enter a valid amount");
      return;
    }
    if (newBal != null && newBal < 0) {
      toast.error("Balance cannot be negative");
      return;
    }
    adjustBalance({
      accountId,
      amount: amt,
      add,
      dateIso: new Date(dateStr).toISOString(),
      remarks: remarks.trim() || undefined,
    });
    toast.success("Balance updated");
    onOpenChange(false);
    setAmount("");
    setRemarks("");
    setShowRemarks(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Balance</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Adjust money in</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={add ? "default" : "outline"}
              className={cn("flex-1", add && "bg-indigo-600 hover:bg-indigo-700")}
              onClick={() => setAdd(true)}
            >
              + Add Money
            </Button>
            <Button type="button" variant={!add ? "default" : "outline"} className={cn("flex-1", !add && "bg-indigo-600 hover:bg-indigo-700")} onClick={() => setAdd(false)}>
              − Reduce Money
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-muted-foreground">Current Balance</Label>
              <p className="text-lg font-semibold tabular-nums">{acc ? formatInrDetailed(acc.balance) : "—"}</p>
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" className="date-input-icon-end pr-9" value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-primary">Enter Amount</Label>
            <div className="relative">
              <span
                className={cn(
                  "absolute left-3 top-1/2 -translate-y-1/2 select-none font-semibold tabular-nums",
                  add ? "text-emerald-600" : "text-red-600"
                )}
                aria-hidden
              >
                {add ? "+" : "−"}
              </span>
              <span className="absolute left-8 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
              <Input className="pl-14 border-0 border-b rounded-none" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            </div>
          </div>
          <div>
            <Label className="text-muted-foreground">New balance</Label>
            <p className="text-lg font-semibold tabular-nums">{newBal != null && !Number.isNaN(newBal) ? formatInrDetailed(newBal) : "—"}</p>
          </div>
          {!showRemarks ? (
            <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => setShowRemarks(true)}>
              + Add Remarks
            </button>
          ) : (
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" className="bg-indigo-600 hover:bg-indigo-700" onClick={submit}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TransferDialog({
  open,
  onOpenChange,
  accounts,
  transfer,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  accounts: CashBankAccount[];
  transfer: (input: {
    fromId: string;
    toId: string;
    amount: number;
    dateIso: string;
    remarks?: string;
  }) => boolean;
}) {
  const [fromId, setFromId] = useState("acc-cash");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [dateStr, setDateStr] = useState(format(new Date(), "yyyy-MM-dd"));
  const [remarks, setRemarks] = useState("");
  const [showRemarks, setShowRemarks] = useState(false);

  const from = accounts.find((a) => a.id === fromId);
  const amt = Number.parseFloat(amount.replace(/,/g, "") || "0");

  const submit = () => {
    if (!toId) {
      toast.error("Select destination account");
      return;
    }
    if (amt <= 0 || Number.isNaN(amt)) {
      toast.error("Enter a valid amount");
      return;
    }
    const ok = transfer({
      fromId,
      toId,
      amount: amt,
      dateIso: new Date(dateStr).toISOString(),
      remarks: remarks.trim() || undefined,
    });
    if (!ok) {
      toast.error("Transfer failed", { description: "Check balance and accounts." });
      return;
    }
    toast.success("Transfer completed");
    onOpenChange(false);
    setAmount("");
    setRemarks("");
    setShowRemarks(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer Balance</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sky-800/90 dark:text-sky-200/90">Transfer money from</Label>
            <Select value={fromId} onValueChange={setFromId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sky-800/90 dark:text-sky-200/90">Transfer money to</Label>
            <Select value={toId || undefined} onValueChange={setToId}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts
                  .filter((a) => a.id !== fromId)
                  .map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.displayName}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-sky-800/90 dark:text-sky-200/90">Current Balance</Label>
              <p className="font-semibold tabular-nums">{from ? formatInrDetailed(from.balance) : "—"}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-sky-800/90 dark:text-sky-200/90">Date</Label>
              <Input type="date" className="date-input-icon-end pr-9" value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-primary">Enter Amount</Label>
            <div className="relative border-b">
              <span className="absolute left-0 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">₹</span>
              <Input className="border-0 pl-8 text-lg shadow-none focus-visible:ring-0" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          </div>
          {!showRemarks ? (
            <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => setShowRemarks(true)}>
              + Add Remarks
            </button>
          ) : (
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" className="bg-indigo-600 hover:bg-indigo-700" onClick={submit}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShareAccountDialog({
  open,
  onOpenChange,
  meta,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  meta: NonNullable<CashBankAccount["bankMeta"]>;
}) {
  const copy = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share Account Details</DialogTitle>
        </DialogHeader>
        <div className="divide-y divide-border">
          <div className="py-3">
            <p className="text-xs text-sky-800/80 dark:text-sky-200/80">Account Holder Name</p>
            <p className="font-semibold">{meta.holderName}</p>
          </div>
          <div className="flex items-start justify-between gap-2 py-3">
            <div>
              <p className="text-xs text-sky-800/80 dark:text-sky-200/80">Account Number</p>
              <p className="font-mono text-sm font-medium">{meta.accountNumber}</p>
            </div>
            <Button type="button" variant="outline" size="sm" className="text-indigo-600" onClick={() => copy(meta.accountNumber, "Account number")}>
              COPY
            </Button>
          </div>
          <div className="flex items-start justify-between gap-2 py-3">
            <div>
              <p className="text-xs text-sky-800/80 dark:text-sky-200/80">IFSC Code</p>
              <p className="font-mono text-sm font-medium">{meta.ifsc}</p>
            </div>
            <Button type="button" variant="outline" size="sm" className="text-indigo-600" onClick={() => copy(meta.ifsc, "IFSC")}>
              COPY
            </Button>
          </div>
          <div className="flex items-start justify-between gap-2 py-3">
            <div>
              <p className="text-xs text-sky-800/80 dark:text-sky-200/80">Bank &amp; Branch</p>
              <p className="text-sm font-medium">
                {meta.bankName}, {meta.branchName}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-indigo-600 shrink-0"
              onClick={() => copy(`${meta.bankName}, ${meta.branchName}`, "Bank & branch")}
            >
              COPY
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => onOpenChange(false)}>
            Share Details
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UpdateBankDialog({
  open,
  onOpenChange,
  account,
  onUpdate,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  account: CashBankAccount;
  onUpdate: (id: string, patch: Partial<CashBankAccount>) => void;
  onDelete: (id: string) => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const meta = account.bankMeta;

  if (!meta) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setEditMode(false);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editMode ? "Edit Bank Account" : "Update Bank Account"}</DialogTitle>
        </DialogHeader>
        {!editMode ? (
          <>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-sky-800/80 dark:text-sky-200/80">Account Name</p>
                <p className="text-lg font-semibold">{account.displayName}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-sky-800/80 dark:text-sky-200/80">Bank Account Number</p>
                  <p className="font-mono font-medium">{meta.accountNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-sky-800/80 dark:text-sky-200/80">Account Holders Name</p>
                  <p className="font-semibold">{meta.holderName}</p>
                </div>
                <div>
                  <p className="text-xs text-sky-800/80 dark:text-sky-200/80">IFSC Code</p>
                  <p className="font-mono font-medium">{meta.ifsc}</p>
                </div>
                <div>
                  <p className="text-xs text-sky-800/80 dark:text-sky-200/80">Bank Name</p>
                  <p className="font-medium">{meta.bankName}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-sky-800/80 dark:text-sky-200/80">Branch Name</p>
                  <p className="font-medium">{meta.branchName}</p>
                </div>
              </div>
            </div>
            <DialogFooter className="flex-col gap-3 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => {
                  onDelete(account.id);
                  toast.success("Account removed");
                  onOpenChange(false);
                }}
              >
                <Minus className="size-4 mr-1" />
                Delete Account
              </Button>
              <Button type="button" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => setEditMode(true)}>
                Edit Bank Details
              </Button>
            </DialogFooter>
          </>
        ) : (
          <EditBankForm
            account={account}
            onCancel={() => setEditMode(false)}
            onSave={(patch) => {
              onUpdate(account.id, patch);
              toast.success("Bank details saved");
              setEditMode(false);
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditBankForm({
  account,
  onCancel,
  onSave,
}: {
  account: CashBankAccount;
  onCancel: () => void;
  onSave: (patch: Partial<CashBankAccount>) => void;
}) {
  const m = account.bankMeta!;
  const [displayName, setDisplayName] = useState(account.displayName);
  const [opening, setOpening] = useState(String(account.balance));
  const [asOf, setAsOf] = useState(
    account.openingBalanceDate ? format(new Date(account.openingBalanceDate), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")
  );
  const [bankDetails, setBankDetails] = useState(true);
  const [accNum, setAccNum] = useState(m.accountNumber);
  const [accNum2, setAccNum2] = useState(m.accountNumber);
  const [holder, setHolder] = useState(m.holderName);
  const [ifsc, setIfsc] = useState(m.ifsc);
  const [bankName, setBankName] = useState(m.bankName);
  const [branch, setBranch] = useState(m.branchName);
  const [upi, setUpi] = useState(m.upiId ?? "");

  const save = () => {
    if (accNum.trim() !== accNum2.trim()) {
      toast.error("Account numbers must match");
      return;
    }
    const ob = Number.parseFloat(opening.replace(/,/g, "") || "0");
    onSave({
      displayName: displayName.trim(),
      balance: Math.round(ob * 100) / 100,
      openingBalanceDate: new Date(asOf).toISOString(),
      accountNumberDisplay: accNum.trim(),
      bankMeta: {
        accountNumber: accNum.trim(),
        holderName: holder.trim(),
        ifsc: ifsc.trim().toUpperCase(),
        bankName: bankName.trim(),
        branchName: branch.trim(),
        upiId: upi.trim() || undefined,
      },
    });
  };

  return (
    <>
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        <div className="space-y-2">
          <Label>
            Account Name <span className="text-destructive">*</span>
          </Label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Opening Balance</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
              <Input className="pl-8" value={opening} onChange={(e) => setOpening(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>As of Date</Label>
            <Input type="date" className="date-input-icon-end pr-9" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
          </div>
        </div>
        <Separator />
        <div className="flex items-center justify-between gap-3 py-1">
          <span className="text-sm font-medium">Add Bank Details</span>
          <Switch checked={bankDetails} onCheckedChange={setBankDetails} />
        </div>
        {bankDetails && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Bank Account Number *</Label>
              <Input className="font-mono" value={accNum} onChange={(e) => setAccNum(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Re-Enter Bank Account Number *</Label>
              <Input className="font-mono" value={accNum2} onChange={(e) => setAccNum2(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Account Holders Name *</Label>
              <Input value={holder} onChange={(e) => setHolder(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>IFSC Code *</Label>
              <Input className="font-mono uppercase" value={ifsc} onChange={(e) => setIfsc(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Bank Name *</Label>
              <Input value={bankName} onChange={(e) => setBankName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Branch Name *</Label>
              <Input value={branch} onChange={(e) => setBranch(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>UPI ID</Label>
              <Input value={upi} onChange={(e) => setUpi(e.target.value)} />
            </div>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" className="bg-indigo-600 hover:bg-indigo-700" onClick={save}>
          Submit
        </Button>
      </DialogFooter>
    </>
  );
}
