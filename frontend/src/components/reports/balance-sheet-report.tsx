"use client";

/**
 * Balance sheet layout inspired by common accounting UIs.
 * Intentionally no "Watch how to use" / tutorial / help video control.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCashBankStore } from "@/store/cash-bank-store";
import {
  BALANCE_SHEET_CATEGORY_LABEL,
  type BalanceSheetLedgerEntry,
  type BalanceSheetManualCategory,
  useBalanceSheetLedgerStore,
} from "@/store/balance-sheet-ledger-store";
import { useExpenseStore } from "@/store/expense-store";
import { useInvoiceStore } from "@/store/invoice-store";
import type { Invoice } from "@/types";
import { formatDateTime, formatInrFull } from "@/lib/utils";
import { ArrowLeft, FileSpreadsheet, Info, Mail, Star } from "lucide-react";
import { toast } from "sonner";

const CURRENT_LIABILITY_CATEGORIES: BalanceSheetManualCategory[] = [
  "gstPayable",
  "igstPayable",
  "cgstPayable",
  "sgstPayable",
  "tcsPayableLiab",
  "tdsPayableLiab",
  "accountPayable",
];

const CURRENT_ASSET_MANUAL_CATEGORIES: BalanceSheetManualCategory[] = [
  "taxReceivable",
  "tcsReceivable",
  "tdsReceivable",
  "inventory",
];

type BalanceSheetModalMode =
  | "capital"
  | "currentLiability"
  | "loans"
  | "currentAssets"
  | "fixedAssets"
  | "investments"
  | "loansAdvance";

function sumOutstanding(invoices: Invoice[]) {
  let s = 0;
  for (const inv of invoices) {
    const paid = (inv.payments ?? []).reduce((p, x) => p + x.amount, 0);
    s += Math.max(0, (inv.grandTotal ?? 0) - paid);
  }
  return Math.round(s * 100) / 100;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-muted/50 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </div>
  );
}

/** Line with optional detail rows — no “Add” (matches reference: add only on section blocks). */
function AmountRow({
  label,
  amount,
  infoTitle,
  boldLabel,
  entries,
}: {
  label: string;
  amount: number;
  infoTitle?: string;
  boldLabel?: boolean;
  entries?: BalanceSheetLedgerEntry[];
}) {
  return (
    <div className="border-b border-border/80">
      <div className="flex items-start justify-between gap-3 px-3 py-2.5">
        <div className="min-w-0 flex items-start gap-1.5">
          <span
            className={boldLabel ? "font-semibold text-foreground" : "text-sm text-foreground"}
          >
            {label}
          </span>
          {infoTitle && (
            <button
              type="button"
              className="mt-0.5 inline-flex text-muted-foreground hover:text-foreground"
              title={infoTitle}
              aria-label={`About ${label}`}
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <span className="shrink-0 tabular-nums text-sm font-medium text-foreground">
          {formatInrFull(amount)}
        </span>
      </div>
      {entries && entries.length > 0 && (
        <ul className="space-y-0.5 px-3 pb-2 pl-6 text-xs text-muted-foreground">
          {entries.map((e) => (
            <li key={e.id} className="flex justify-between gap-2">
              <span className="truncate">{e.ledgerName}</span>
              <span className="shrink-0 tabular-nums">{formatInrFull(e.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SectionAddLink({ onClick }: { onClick: () => void }) {
  return (
    <div className="border-b border-border/80 px-3 py-2">
      <button
        type="button"
        onClick={onClick}
        className="text-xs font-medium text-primary hover:underline"
      >
        + Add New Entry
      </button>
    </div>
  );
}

function SimpleLine({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/80 px-3 py-2 text-sm">
      <span className="text-foreground">{label}</span>
      <span className="tabular-nums text-foreground">{formatInrFull(amount)}</span>
    </div>
  );
}

export function BalanceSheetReport() {
  const invoices = useInvoiceStore((s) => s.invoices);
  const expenses = useExpenseStore((s) => s.expenses);
  const accounts = useCashBankStore((s) => s.accounts);

  const entries = useBalanceSheetLedgerStore((s) => s.entries);
  const favourite = useBalanceSheetLedgerStore((s) => s.favourite);
  const lastUpdatedAt = useBalanceSheetLedgerStore((s) => s.lastUpdatedAt);
  const setFavourite = useBalanceSheetLedgerStore((s) => s.setFavourite);
  const addEntry = useBalanceSheetLedgerStore((s) => s.addEntry);

  const [modalMode, setModalMode] = useState<BalanceSheetModalMode | null>(null);
  const [formPickCategory, setFormPickCategory] = useState<BalanceSheetManualCategory>("gstPayable");
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formName, setFormName] = useState("");
  const [formAmount, setFormAmount] = useState("");

  const revenue = useMemo(
    () => invoices.reduce((s, i) => s + (i.grandTotal ?? 0), 0),
    [invoices]
  );
  const expenseTotal = useMemo(
    () => expenses.reduce((s, e) => s + (e.amount ?? 0), 0),
    [expenses]
  );
  const netIncome = Math.round((revenue - expenseTotal) * 100) / 100;
  const accountsReceivable = useMemo(() => sumOutstanding(invoices), [invoices]);

  const cashInHand = useMemo(() => {
    return accounts
      .filter((a) => a.type === "cash")
      .reduce((s, a) => s + a.balance, 0);
  }, [accounts]);

  const cashInBank = useMemo(() => {
    return accounts
      .filter((a) => a.type === "bank")
      .reduce((s, a) => s + a.balance, 0);
  }, [accounts]);

  const byCategory = useMemo(() => {
    const m = new Map<BalanceSheetManualCategory, BalanceSheetLedgerEntry[]>();
    for (const e of entries) {
      const list = m.get(e.category) ?? [];
      list.push(e);
      m.set(e.category, list);
    }
    return m;
  }, [entries]);

  const sumCat = (c: BalanceSheetManualCategory) =>
    (byCategory.get(c) ?? []).reduce((s, e) => s + e.amount, 0);

  const totalLiabilities = useMemo(() => {
    const liabKeys: BalanceSheetManualCategory[] = [
      "capital",
      "gstPayable",
      "igstPayable",
      "cgstPayable",
      "sgstPayable",
      "tcsPayableLiab",
      "tdsPayableLiab",
      "accountPayable",
      "loansLiability",
    ];
    let manual = 0;
    for (const k of liabKeys) {
      manual += (byCategory.get(k) ?? []).reduce((s, e) => s + e.amount, 0);
    }
    return manual + netIncome;
  }, [entries, netIncome, byCategory]);

  const totalAssets = useMemo(() => {
    const assetKeys: BalanceSheetManualCategory[] = [
      "taxReceivable",
      "tcsReceivable",
      "tdsReceivable",
      "inventory",
      "fixedAssets",
      "investments",
      "loansAdvance",
    ];
    let manual = 0;
    for (const k of assetKeys) {
      manual += (byCategory.get(k) ?? []).reduce((s, e) => s + e.amount, 0);
    }
    return manual + cashInHand + cashInBank + accountsReceivable;
  }, [entries, cashInHand, cashInBank, accountsReceivable, byCategory]);

  const resetForm = () => {
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormName("");
    setFormAmount("");
  };

  const openModal = (mode: BalanceSheetModalMode) => {
    setModalMode(mode);
    if (mode === "currentLiability") {
      setFormPickCategory("gstPayable");
    } else if (mode === "currentAssets") {
      setFormPickCategory("taxReceivable");
    }
    resetForm();
  };

  const resolveSaveCategory = (): BalanceSheetManualCategory | null => {
    if (!modalMode) return null;
    if (modalMode === "currentLiability") return formPickCategory;
    if (modalMode === "currentAssets") return formPickCategory;
    const map: Record<Exclude<BalanceSheetModalMode, "currentLiability" | "currentAssets">, BalanceSheetManualCategory> = {
      capital: "capital",
      loans: "loansLiability",
      fixedAssets: "fixedAssets",
      investments: "investments",
      loansAdvance: "loansAdvance",
    };
    return map[modalMode];
  };

  const saveEntry = () => {
    const category = resolveSaveCategory();
    if (!category) return;
    const n = parseFloat(formAmount.replace(/,/g, ""));
    if (Number.isNaN(n)) {
      toast.error("Enter a valid amount.");
      return;
    }
    addEntry({
      category,
      ledgerName: formName,
      amount: n,
      date: formDate,
    });
    toast.success("Entry saved.");
    setModalMode(null);
  };

  const modalTitle =
    modalMode == null
      ? ""
      : (() => {
          const labels: Record<BalanceSheetModalMode, string> = {
            capital: "Capital",
            currentLiability: "Current Liability",
            loans: "Loans",
            currentAssets: "Current Assets",
            fixedAssets: "Fixed Assets",
            investments: "Investments",
            loansAdvance: "Loans Advance",
          };
          return `Add New Entry for ${labels[modalMode]}`;
        })();

  const downloadCsv = () => {
    const lines = [
      ["Section", "Category", "Ledger", "Amount"].join(","),
      ...entries.map((e) =>
        [
          e.category.includes("Payable") || e.category === "capital" ? "Liabilities" : "Assets",
          BALANCE_SHEET_CATEGORY_LABEL[e.category],
          `"${(e.ledgerName || "").replace(/"/g, '""')}"`,
          String(e.amount),
        ].join(",")
      ),
      ["Computed", "Accounts Receivables", "", String(accountsReceivable)].join(","),
      ["Computed", "Cash In Hand", "", String(cashInHand)].join(","),
      ["Computed", "Cash In Bank", "", String(cashInBank)].join(","),
      ["Computed", "Net Income", "", String(netIncome)].join(","),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `balance-sheet-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.message("Download started", { description: "Open in Excel or Google Sheets." });
  };

  const emailExport = () => {
    downloadCsv();
    toast.message("Email Excel", {
      description: "Demo: connect your mail provider to attach this export automatically.",
    });
  };

  const updatedLabel = lastUpdatedAt
    ? formatDateTime(lastUpdatedAt)
    : formatDateTime(new Date().toISOString());

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" className="-ml-2" asChild>
            <Link href="/reports">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Balance Sheet (As of Today)
          </h1>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 border-amber-300/80 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
            onClick={() => setFavourite(!favourite)}
          >
            <Star
              className={`h-4 w-4 ${favourite ? "fill-amber-400 text-amber-500" : "text-muted-foreground"}`}
            />
            Favourite
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={emailExport}>
            <Mail className="h-4 w-4" />
            Email Excel
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-2 bg-violet-600 hover:bg-violet-700"
            onClick={downloadCsv}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel Download
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-amber-200/90 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-100">
        Balance sheet is updated once per day. Last updated at: {updatedLabel}
      </div>

      <div className="grid gap-0 overflow-hidden rounded-lg border border-border md:grid-cols-2">
        <div className="flex flex-col border-b border-border md:border-b-0 md:border-r">
          <SectionHeader>Liabilities</SectionHeader>
          <AmountRow
            label="Capital"
            amount={sumCat("capital")}
            infoTitle="Owner / partner capital and adjustments."
            boldLabel
            entries={byCategory.get("capital")}
          />
          <SectionAddLink onClick={() => openModal("capital")} />
          <div className="border-b border-border bg-muted/20 px-3 py-2">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              Current Liability
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                title="Short-term obligations including statutory taxes."
                aria-label="About current liability"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <AmountRow
            label={BALANCE_SHEET_CATEGORY_LABEL.gstPayable}
            amount={sumCat("gstPayable")}
            entries={byCategory.get("gstPayable")}
          />
          <AmountRow
            label={BALANCE_SHEET_CATEGORY_LABEL.igstPayable}
            amount={sumCat("igstPayable")}
            entries={byCategory.get("igstPayable")}
          />
          <AmountRow
            label={BALANCE_SHEET_CATEGORY_LABEL.cgstPayable}
            amount={sumCat("cgstPayable")}
            entries={byCategory.get("cgstPayable")}
          />
          <AmountRow
            label={BALANCE_SHEET_CATEGORY_LABEL.sgstPayable}
            amount={sumCat("sgstPayable")}
            entries={byCategory.get("sgstPayable")}
          />
          <AmountRow
            label={BALANCE_SHEET_CATEGORY_LABEL.tcsPayableLiab}
            amount={sumCat("tcsPayableLiab")}
            entries={byCategory.get("tcsPayableLiab")}
          />
          <AmountRow
            label={BALANCE_SHEET_CATEGORY_LABEL.tdsPayableLiab}
            amount={sumCat("tdsPayableLiab")}
            entries={byCategory.get("tdsPayableLiab")}
          />
          <SectionAddLink onClick={() => openModal("currentLiability")} />
          <AmountRow
            label="Account Payable"
            amount={sumCat("accountPayable")}
            entries={byCategory.get("accountPayable")}
          />
          <AmountRow
            label="Loans"
            amount={sumCat("loansLiability")}
            infoTitle="Long-term borrowings."
            boldLabel
            entries={byCategory.get("loansLiability")}
          />
          <SectionAddLink onClick={() => openModal("loans")} />
          <div className="border-b border-border">
            <div className="flex items-start justify-between gap-3 px-3 py-2.5">
              <div className="flex items-start gap-1.5">
                <span className="font-semibold text-foreground">Net Income</span>
                <button
                  type="button"
                  className="mt-0.5 text-muted-foreground hover:text-foreground"
                  title="Revenue minus expenses from invoices and expense entries."
                  aria-label="About net income"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </div>
              <span className="tabular-nums text-sm font-semibold text-foreground">
                {formatInrFull(netIncome)}
              </span>
            </div>
          </div>
          <div className="mt-auto flex items-center justify-between gap-3 bg-muted/30 px-3 py-3">
            <span className="font-bold text-foreground">Total Liabilities</span>
            <span className="font-bold tabular-nums text-foreground">
              {formatInrFull(totalLiabilities)}
            </span>
          </div>
        </div>

        <div className="flex flex-col">
          <SectionHeader>Assets</SectionHeader>
          <div className="border-b border-border bg-muted/20 px-3 py-2">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              Current Assets
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                title="Cash, receivables, inventory, and tax credits."
                aria-label="About current assets"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <AmountRow
            label={BALANCE_SHEET_CATEGORY_LABEL.taxReceivable}
            amount={sumCat("taxReceivable")}
            entries={byCategory.get("taxReceivable")}
          />
          <AmountRow
            label={BALANCE_SHEET_CATEGORY_LABEL.tcsReceivable}
            amount={sumCat("tcsReceivable")}
            entries={byCategory.get("tcsReceivable")}
          />
          <AmountRow
            label={BALANCE_SHEET_CATEGORY_LABEL.tdsReceivable}
            amount={sumCat("tdsReceivable")}
            entries={byCategory.get("tdsReceivable")}
          />
          <SectionAddLink onClick={() => openModal("currentAssets")} />
          <SimpleLine label="Cash In Hand" amount={cashInHand} />
          <SimpleLine label="Cash In Bank" amount={cashInBank} />
          <SimpleLine label="Accounts Receivables" amount={accountsReceivable} />
          <AmountRow
            label="Inventory In Hand"
            amount={sumCat("inventory")}
            entries={byCategory.get("inventory")}
          />
          <AmountRow
            label="Fixed Assets"
            amount={sumCat("fixedAssets")}
            infoTitle="Plant, machinery, vehicles at written-down value."
            boldLabel
            entries={byCategory.get("fixedAssets")}
          />
          <SectionAddLink onClick={() => openModal("fixedAssets")} />
          <AmountRow
            label="Investments"
            amount={sumCat("investments")}
            boldLabel
            entries={byCategory.get("investments")}
          />
          <SectionAddLink onClick={() => openModal("investments")} />
          <AmountRow
            label="Loans Advance"
            amount={sumCat("loansAdvance")}
            boldLabel
            entries={byCategory.get("loansAdvance")}
          />
          <SectionAddLink onClick={() => openModal("loansAdvance")} />
          <div className="mt-auto flex items-center justify-between gap-3 bg-muted/30 px-3 py-3">
            <span className="font-bold text-foreground">Total Assets</span>
            <span className="font-bold tabular-nums text-foreground">{formatInrFull(totalAssets)}</span>
          </div>
        </div>
      </div>

      <Dialog open={modalMode != null} onOpenChange={(o) => !o && setModalMode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{modalTitle}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label>Ledger Category</Label>
              {modalMode === "currentLiability" || modalMode === "currentAssets" ? (
                <Select
                  value={formPickCategory}
                  onValueChange={(v) => setFormPickCategory(v as BalanceSheetManualCategory)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {(modalMode === "currentLiability"
                      ? CURRENT_LIABILITY_CATEGORIES
                      : CURRENT_ASSET_MANUAL_CATEGORIES
                    ).map((c) => (
                      <SelectItem key={c} value={c}>
                        {BALANCE_SHEET_CATEGORY_LABEL[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                  {resolveSaveCategory()
                    ? BALANCE_SHEET_CATEGORY_LABEL[resolveSaveCategory()!]
                    : "—"}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bs-date">Date</Label>
              <Input
                id="bs-date"
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bs-name">Ledger Name</Label>
              <Input
                id="bs-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. HDFC GST"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bs-amt">Amount</Label>
              <Input
                id="bs-amt"
                inputMode="decimal"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setModalMode(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-violet-600 hover:bg-violet-700"
              onClick={saveEntry}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
