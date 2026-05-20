"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookMarked,
  Download,
  Search,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  MoreHorizontal,
  FileText,
  ClipboardList,
  Banknote,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCustomerStore } from "@/store/customer-store";
import { useInvoiceStore } from "@/store/invoice-store";
import { useExpenseStore } from "@/store/expense-store";
import { useAuthStore } from "@/store/auth-store";
import { useBranchScope } from "@/lib/branch-scope";
import { useScopedExpenses, useScopedInvoices } from "@/hooks/use-scoped-data";
import { useSettingsStore } from "@/store/settings-store";
import { notifyCustomerPaymentRecordedWhatsApp } from "@/lib/payment-received-whatsapp";
import { pushActivityLog } from "@/lib/activity-log-helper";
import { formatCurrency, cn, formatDate } from "@/lib/utils";
import type { Expense, ExpensePaymentMethod, Invoice, PaymentMethod } from "@/types";

type PartyKind = "customer" | "supplier";

type LedgerParty = {
  id: string;
  kind: PartyKind;
  name: string;
  subtitle: string;
  balance: number;
  /** Positive = we are owed (customer) or we owe (supplier) for display arrow */
  flow: "in" | "out" | "zero";
};

type LedgerTx = {
  id: string;
  at: string;
  typeLabel: string;
  reference: string;
  amount: number;
  status: string;
  statusTone: "success" | "warning" | "muted";
};

function invoicePaidTotal(inv: Invoice): number {
  return inv.payments.reduce((s, p) => s + p.amount, 0);
}

function invoiceOutstanding(inv: Invoice): number {
  return Math.max(0, Math.round((inv.grandTotal - invoicePaidTotal(inv)) * 100) / 100);
}

function expenseOutstanding(e: Expense): number {
  if (e.paymentStatus === "PAID") return 0;
  const paid = e.amountPaid ?? 0;
  return Math.max(0, Math.round((e.amount - paid) * 100) / 100);
}

function expensePaidSoFar(e: Expense): number {
  if (e.paymentStatus === "PAID") return e.amount;
  if (e.paymentStatus === "PARTIAL") return e.amountPaid ?? 0;
  return 0;
}

const INV_PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
];

const EXP_PAYMENT_METHODS: { value: ExpensePaymentMethod; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "OTHER", label: "Other" },
];

const RANGE_DAYS: Record<string, number | null> = {
  "30": 30,
  "90": 90,
  "365": 365,
  all: null,
};

function inRange(isoDate: string, days: number | null): boolean {
  if (days == null) return true;
  const t = new Date(isoDate).getTime();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return t >= cutoff;
}

export function SharedLedgerClient() {
  const router = useRouter();
  const customers = useCustomerStore((s) => s.customers);
  const invoices = useScopedInvoices();
  const recordInvoicePayment = useInvoiceStore((s) => s.recordPayment);
  const expenses = useScopedExpenses();
  const { viewingLabel } = useBranchScope();
  const updateExpense = useExpenseStore((s) => s.updateExpense);
  const vendorDirectory = useExpenseStore((s) => s.vendorDirectory);
  const vendorSuggestions = useExpenseStore((s) => s.vendorSuggestions);
  const user = useAuthStore((s) => s.user);
  const businessName = useSettingsStore((s) => s.businessName);

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<string>("365");

  const [invoicePayOpen, setInvoicePayOpen] = useState(false);
  const [invoicePayTarget, setInvoicePayTarget] = useState<Invoice | null>(null);
  const [invPayAmount, setInvPayAmount] = useState("");
  const [invPayMethod, setInvPayMethod] = useState<PaymentMethod>("CASH");
  const [invPayRef, setInvPayRef] = useState("");

  const [expensePayOpen, setExpensePayOpen] = useState(false);
  const [expensePayTarget, setExpensePayTarget] = useState<Expense | null>(null);
  const [expPayAmount, setExpPayAmount] = useState("");
  const [expPayMethod, setExpPayMethod] = useState<ExpensePaymentMethod>("CASH");

  const openInvoicePay = (inv: Invoice) => {
    const out = invoiceOutstanding(inv);
    setInvoicePayTarget(inv);
    setInvPayAmount(out > 0 ? String(out) : "");
    setInvPayMethod("CASH");
    setInvPayRef("");
    setInvoicePayOpen(true);
  };

  const submitInvoicePay = async () => {
    const inv = invoicePayTarget;
    if (!inv) return;
    const amount = Number(invPayAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const performedBy = user?.id?.toLowerCase() ?? "usr-001";
    const paidAt = new Date().toISOString();
    const remainingAfter = Math.max(0, inv.grandTotal - invoicePaidTotal(inv) - amount);

    const result = await recordInvoicePayment(
      inv.id,
      {
        invoiceId: inv.id,
        amount,
        method: invPayMethod,
        referenceNumber: invPayRef.trim() || undefined,
        paidAt,
      },
      { performedBy }
    );
    if (!result.ok) {
      toast.error("Could not record payment", {
        description: result.inventoryError ?? "Unknown error",
      });
      return;
    }
    toast.success("Payment recorded");
    pushActivityLog({
      action: "PAYMENT_RECEIVED",
      entityType: "INVOICE",
      entityId: inv.id,
      entityLabel: inv.invoiceNumber,
      details: `${formatCurrency(amount)} received on ${inv.invoiceNumber}`,
    });
    void notifyCustomerPaymentRecordedWhatsApp({
      invoice: inv,
      amount,
      method: invPayMethod,
      referenceNumber: invPayRef.trim() || undefined,
      paidAt,
      remainingBalanceAfter: remainingAfter,
      businessName,
    });
    setInvoicePayOpen(false);
    setInvoicePayTarget(null);
  };

  const openExpensePay = (e: Expense) => {
    const out = expenseOutstanding(e);
    setExpensePayTarget(e);
    setExpPayAmount(out > 0 ? String(out) : "");
    setExpPayMethod(e.paymentMethod ?? "CASH");
    setExpensePayOpen(true);
  };

  const submitExpensePay = () => {
    const e = expensePayTarget;
    if (!e) return;
    const pay = Number(expPayAmount);
    if (!Number.isFinite(pay) || pay <= 0) return;
    const prev = expensePaidSoFar(e);
    const total = Math.round((prev + pay) * 100) / 100;
    if (total >= e.amount - 0.01) {
      updateExpense(e.id, {
        paymentStatus: "PAID",
        amountPaid: undefined,
        paymentMethod: expPayMethod,
      });
    } else {
      updateExpense(e.id, {
        paymentStatus: "PARTIAL",
        amountPaid: total,
        paymentMethod: expPayMethod,
      });
    }
    toast.success("Vendor payment recorded");
    pushActivityLog({
      action: "STATUS_CHANGED",
      entityType: "EXPENSE",
      entityId: e.id,
      entityLabel: e.title,
      details: `${formatCurrency(pay)} paid toward ${e.vendorName ?? "vendor"} · ${e.title}`,
    });
    setExpensePayOpen(false);
    setExpensePayTarget(null);
  };

  const parties = useMemo((): LedgerParty[] => {
    const customerParties: LedgerParty[] = customers.map((c) => {
      const custInv = invoices.filter((i) => i.customerId === c.id);
      const bal = custInv.reduce((s, i) => s + invoiceOutstanding(i), 0);
      return {
        id: `c:${c.id}`,
        kind: "customer",
        name: c.name,
        subtitle: `Customer · ${custInv.length} invoice(s)`,
        balance: bal,
        flow: bal > 0.01 ? "in" : bal < -0.01 ? "out" : "zero",
      };
    });

    const vendorNames = new Set<string>();
    for (const e of expenses) {
      const v = e.vendorName?.trim();
      if (v) vendorNames.add(v);
    }
    for (const v of vendorDirectory) {
      if (v.name?.trim()) vendorNames.add(v.name.trim());
    }
    for (const v of vendorSuggestions) {
      if (v?.trim()) vendorNames.add(v.trim());
    }

    const supplierParties: LedgerParty[] = Array.from(vendorNames)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => {
        const venExp = expenses.filter((e) => e.vendorName?.trim() === name);
        const bal = venExp.reduce((s, e) => s + expenseOutstanding(e), 0);
        return {
          id: `v:${name}`,
          kind: "supplier",
          name,
          subtitle: `Supplier · ${venExp.length} bill(s)`,
          balance: bal,
          flow: bal > 0.01 ? "out" : "zero",
        };
      });

    return [...customerParties, ...supplierParties].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [customers, invoices, expenses, vendorDirectory, vendorSuggestions]);

  const filteredParties = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return parties;
    return parties.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.subtitle.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
    );
  }, [parties, query]);

  const selected = parties.find((p) => p.id === selectedId) ?? filteredParties[0] ?? null;

  const days = RANGE_DAYS[dateRange] ?? null;

  const transactions = useMemo((): LedgerTx[] => {
    if (!selected) return [];
    if (selected.kind === "customer") {
      const cid = selected.id.slice(2);
      return invoices
        .filter((i) => i.customerId === cid && inRange(i.createdAt, days))
        .map((i) => {
          const out = invoiceOutstanding(i);
          const paid = invoicePaidTotal(i);
          const status =
            i.status === "PAID" || out < 0.01
              ? "Completed"
              : paid > 0
                ? "Partially paid"
                : "Outstanding";
          const tone: LedgerTx["statusTone"] =
            status === "Completed" ? "success" : paid > 0 ? "warning" : "muted";
          return {
            id: i.id,
            at: i.createdAt,
            typeLabel: "Sales invoice",
            reference: i.invoiceNumber,
            amount: i.grandTotal,
            status,
            statusTone: tone,
          };
        })
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    }
    const vname = selected.id.slice(2);
    return expenses
      .filter((e) => e.vendorName?.trim() === vname && inRange(e.date, days))
      .map((e) => {
        const out = expenseOutstanding(e);
        const status =
          e.paymentStatus === "PAID" || out < 0.01 ? "Completed" : e.paymentStatus.replace(/_/g, " ");
        const tone: LedgerTx["statusTone"] =
          status === "Completed" ? "success" : "warning";
        return {
          id: e.id,
          at: e.date,
          typeLabel: "Purchase / expense",
          reference: e.title,
          amount: e.amount,
          status,
          statusTone: tone,
        };
      })
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [selected, invoices, expenses, days]);

  useEffect(() => {
    if (selectedId != null && filteredParties.some((p) => p.id === selectedId)) return;
    const first = filteredParties[0];
    queueMicrotask(() => {
      if (first) setSelectedId(first.id);
      else setSelectedId(null);
    });
  }, [filteredParties, selectedId]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <div className="flex flex-col gap-4 border-b border-border/80 pb-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
            <BookMarked className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Shared Ledger</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Receivables and payables for {viewingLabel} — wired to branch-scoped invoices and
              expenses.
            </p>
          </div>
        </div>
      </div>

      <div className="flex min-h-[min(70vh,720px)] flex-col gap-4 lg:flex-row lg:gap-0 lg:rounded-xl lg:border lg:border-border/80 lg:bg-card lg:shadow-sm lg:overflow-hidden">
        {/* Party list */}
        <aside className="flex w-full flex-col border-b border-border/80 bg-muted/20 lg:w-[min(100%,380px)] lg:shrink-0 lg:border-b-0 lg:border-r">
          <div className="border-b border-border/60 bg-background/80 p-3 backdrop-blur-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-10 border-border bg-background pl-9"
                placeholder="Search by party name or number…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {filteredParties.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-muted-foreground">No parties match.</p>
            ) : (
              <ul className="space-y-2">
                {filteredParties.map((p) => {
                  const on = selected?.id === p.id;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(p.id)}
                        className={cn(
                          "w-full rounded-xl border px-3 py-3 text-left transition-all",
                          on
                            ? "border-violet-400 bg-violet-50 shadow-sm ring-2 ring-violet-500/25 dark:border-violet-700 dark:bg-violet-950/40"
                            : "border-border/80 bg-card hover:border-violet-200/80 hover:bg-muted/40 dark:hover:border-violet-900/50"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 font-semibold leading-snug text-foreground">
                              {p.kind === "supplier" ? (
                                <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                              ) : (
                                <Building2 className="h-3.5 w-3.5 shrink-0 text-sky-600" />
                              )}
                              <span className="truncate">{p.name}</span>
                            </p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">{p.subtitle}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold tabular-nums text-foreground">
                              {formatCurrency(p.balance)}
                            </p>
                            <p className="flex items-center justify-end gap-0.5 text-[10px] text-muted-foreground">
                              {p.flow === "in" ? (
                                <>
                                  <ArrowUpRight className="h-3 w-3 text-emerald-600" />
                                  receivable
                                </>
                              ) : p.flow === "out" ? (
                                <>
                                  <ArrowDownRight className="h-3 w-3 text-amber-600" />
                                  payable
                                </>
                              ) : (
                                "settled"
                              )}
                            </p>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Detail */}
        <section className="min-w-0 flex-1 bg-background">
          {!selected ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              Add customers, invoices, or expenses to see ledger parties.
            </div>
          ) : (
            <div className="flex flex-col">
              <div className="border-b border-border/60 bg-muted/30 px-4 py-2.5 text-center text-xs text-muted-foreground sm:text-left">
                Shared ledger snapshot ·{" "}
                <span className="font-medium text-foreground">{selected.name}</span>
              </div>

              <div className="space-y-4 p-4 sm:p-6">
                <Card className="border-border/80 shadow-sm">
                  <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2 pt-4 sm:pt-5">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Party name
                      </p>
                      <p className="text-lg font-semibold">{selected.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Balance
                      </p>
                      <p className="flex items-center justify-end gap-1 text-lg font-bold tabular-nums">
                        {selected.flow === "in" ? (
                          <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                        ) : selected.flow === "out" ? (
                          <ArrowDownRight className="h-4 w-4 text-amber-600" />
                        ) : null}
                        {formatCurrency(selected.balance)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Party type
                      </p>
                      <Badge variant="secondary" className="mt-1 capitalize">
                        {selected.kind === "customer" ? "Customer" : "Supplier"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">Period</span>
                        <Select value={dateRange} onValueChange={setDateRange}>
                          <SelectTrigger className="h-9 w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="30">Last 30 days</SelectItem>
                            <SelectItem value="90">Last 90 days</SelectItem>
                            <SelectItem value="365">Last 365 days</SelectItem>
                            <SelectItem value="all">All time</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() =>
                          toast.success("Download", { description: "Demo — export not wired yet." })
                        }
                      >
                        <Download className="h-4 w-4" />
                        Download ledger
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Transaction type</th>
                          <th className="px-4 py-3">Reference</th>
                          <th className="px-4 py-3 text-right">Amount</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                              No transactions in this period.
                            </td>
                          </tr>
                        ) : (
                          transactions.map((row) => {
                            const inv =
                              selected.kind === "customer"
                                ? invoices.find((i) => i.id === row.id)
                                : null;
                            const exp =
                              selected.kind === "supplier"
                                ? expenses.find((e) => e.id === row.id)
                                : null;
                            const invOut = inv ? invoiceOutstanding(inv) : 0;
                            const expOut = exp ? expenseOutstanding(exp) : 0;
                            const canInvPay = Boolean(inv && invOut >= 0.01);
                            const canExpPay = Boolean(exp && expOut >= 0.01);

                            return (
                              <tr
                                key={row.id}
                                className="border-b border-border/60 transition-colors hover:bg-muted/30"
                              >
                                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">
                                  {formatDate(row.at)}
                                </td>
                                <td className="px-4 py-3 font-medium">{row.typeLabel}</td>
                                <td className="px-4 py-3 font-mono text-xs">{row.reference}</td>
                                <td className="px-4 py-3 text-right font-medium tabular-nums">
                                  {formatCurrency(row.amount)}
                                </td>
                                <td className="px-4 py-3">
                                  <Badge
                                    variant={row.statusTone === "success" ? "default" : "secondary"}
                                    className={cn(
                                      row.statusTone === "success" &&
                                        "bg-emerald-600 hover:bg-emerald-600 text-white"
                                    )}
                                  >
                                    {row.status}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        aria-label="Row actions"
                                        disabled={!inv && !exp}
                                      >
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-52">
                                      {inv && (
                                        <>
                                          <DropdownMenuItem
                                            onClick={() => router.push(`/billing/${inv.id}`)}
                                          >
                                            <FileText className="mr-2 h-4 w-4" />
                                            Open invoice
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() =>
                                              router.push(`/job-cards/${inv.jobCardId}`)
                                            }
                                          >
                                            <ClipboardList className="mr-2 h-4 w-4" />
                                            View job card
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            disabled={!canInvPay}
                                            onClick={() => openInvoicePay(inv)}
                                          >
                                            <Banknote className="mr-2 h-4 w-4" />
                                            Record payment
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                      {exp && (
                                        <>
                                          <DropdownMenuItem
                                            onClick={() =>
                                              router.push(`/expenses?highlight=${encodeURIComponent(exp.id)}`)
                                            }
                                          >
                                            <FileText className="mr-2 h-4 w-4" />
                                            Open in expenses
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            disabled={!canExpPay}
                                            onClick={() => openExpensePay(exp)}
                                          >
                                            <Banknote className="mr-2 h-4 w-4" />
                                            Record vendor payment
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <p className="text-center text-xs text-muted-foreground">
                  Open a{" "}
                  <Link href="/customers" className="font-medium text-primary underline underline-offset-2">
                    customer
                  </Link>{" "}
                  or{" "}
                  <Link href="/expenses" className="font-medium text-primary underline underline-offset-2">
                    expense
                  </Link>{" "}
                  to change underlying data.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>

      <Dialog open={invoicePayOpen} onOpenChange={setInvoicePayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
          </DialogHeader>
          {invoicePayTarget && (
            <p className="text-sm text-muted-foreground">
              {invoicePayTarget.invoiceNumber} · Balance{" "}
              <span className="font-medium text-foreground">
                {formatCurrency(invoiceOutstanding(invoicePayTarget))}
              </span>
            </p>
          )}
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="sl-inv-amount">Amount (INR)</Label>
              <Input
                id="sl-inv-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={invPayAmount}
                onChange={(e) => setInvPayAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment method</Label>
              <Select
                value={invPayMethod}
                onValueChange={(v) => setInvPayMethod(v as PaymentMethod)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INV_PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sl-inv-ref">Reference (optional)</Label>
              <Input
                id="sl-inv-ref"
                placeholder="UPI ref, TXN ID…"
                value={invPayRef}
                onChange={(e) => setInvPayRef(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvoicePayOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void submitInvoicePay()}
              disabled={
                !invPayAmount ||
                Number.isNaN(Number(invPayAmount)) ||
                Number(invPayAmount) <= 0
              }
            >
              Record payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={expensePayOpen} onOpenChange={setExpensePayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record vendor payment</DialogTitle>
          </DialogHeader>
          {expensePayTarget && (
            <p className="text-sm text-muted-foreground">
              {expensePayTarget.title} · Payable{" "}
              <span className="font-medium text-foreground">
                {formatCurrency(expenseOutstanding(expensePayTarget))}
              </span>
            </p>
          )}
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="sl-exp-amount">Amount (INR)</Label>
              <Input
                id="sl-exp-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={expPayAmount}
                onChange={(e) => setExpPayAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment method</Label>
              <Select
                value={expPayMethod}
                onValueChange={(v) => setExpPayMethod(v as ExpensePaymentMethod)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXP_PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpensePayOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitExpensePay}
              disabled={
                !expPayAmount ||
                Number.isNaN(Number(expPayAmount)) ||
                Number(expPayAmount) <= 0
              }
            >
              Record payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
