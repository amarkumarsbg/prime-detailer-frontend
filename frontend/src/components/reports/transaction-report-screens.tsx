"use client";

import { useState } from "react";
import { ReportPageChrome } from "@/components/reports/report-page-chrome";
import { ReportTableEmpty } from "@/components/reports/report-table-empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { reportSelectItemClass } from "@/lib/reports/report-period-presets";
import { formatInrFull } from "@/lib/utils";
import { HelpCircle } from "lucide-react";
import { toast } from "sonner";

const TXN_TYPES = ["All Transactions", "Receipt", "Payment", "Contra", "Journal"] as const;
const BANKS = ["All bank accounts", "HDFC Current ****4821", "ICICI OD ****0092", "Cash in hand"] as const;
const EXPENSE_CATS = [
  "All Expense Categories",
  "Rent",
  "Utilities",
  "Consumables",
  "Staff welfare",
] as const;

function noopCsv() {
  toast.message("No rows to export");
}

export function BillWiseProfitReport() {
  const [period, setPeriod] = useState("week");
  const [party, setParty] = useState("all");

  return (
    <TooltipProvider>
      <ReportPageChrome
        title="Bill Wise Profit"
        favouriteStorageKey="prime-detailer-bill-wise-profit-fav"
        emailReportName="Bill Wise Profit"
        period={period}
        onPeriodChange={setPeriod}
        onDownloadCsv={noopCsv}
        titleAccessory={
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="How profit is calculated"
              >
                <HelpCircle className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-sm" side="bottom">
              Bill wise Profit report has been updated; profit is calculated using your costing rules in Settings.
            </TooltipContent>
          </Tooltip>
        }
        filterSlot={
          <Select value={party} onValueChange={setParty}>
            <SelectTrigger className="h-9 w-[200px] border-border">
              <SelectValue placeholder="Party" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className={reportSelectItemClass}>
                All Parties
              </SelectItem>
            </SelectContent>
          </Select>
        }
      >
        <div className="mb-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Net Profit: </span>
          <span className="font-semibold text-emerald-600 tabular-nums">{formatInrFull(0)}</span>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[800px] border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-[10px] font-semibold uppercase text-muted-foreground sm:text-xs">
                <th className="px-2 py-2 text-left">Date</th>
                <th className="px-2 py-2 text-left">Invoice No.</th>
                <th className="px-2 py-2 text-left">Party Name</th>
                <th className="px-2 py-2 text-right">Invoice Amount</th>
                <th className="px-2 py-2 text-right">Sales Amount</th>
                <th className="px-2 py-2 text-right">Purchase Amount</th>
                <th className="px-2 py-2 text-right">Profit</th>
              </tr>
            </thead>
            <tbody>
              <ReportTableEmpty colSpan={7} />
            </tbody>
          </table>
        </div>
      </ReportPageChrome>
    </TooltipProvider>
  );
}

export function DaybookReport() {
  const [period, setPeriod] = useState("week");
  const [txnType, setTxnType] = useState<string>(TXN_TYPES[0]);

  return (
    <ReportPageChrome
      title="Daybook"
      favouriteStorageKey="prime-detailer-daybook-fav"
      emailReportName="Daybook"
      period={period}
      onPeriodChange={setPeriod}
      onDownloadCsv={noopCsv}
      filterSlot={
        <Select value={txnType} onValueChange={setTxnType}>
          <SelectTrigger className="h-9 w-[200px] border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TXN_TYPES.map((t) => (
              <SelectItem key={t} value={t} className={reportSelectItemClass}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <div className="mb-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
        <span className="text-muted-foreground">Net Amount: </span>
        <span className="font-semibold text-emerald-600 tabular-nums">{formatInrFull(0)}</span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[960px] border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-[10px] font-semibold uppercase text-muted-foreground sm:text-xs">
              <th className="px-2 py-2 text-left">Date</th>
              <th className="px-2 py-2 text-left">Party Name</th>
              <th className="px-2 py-2 text-left">Transaction Type</th>
              <th className="px-2 py-2 text-left">Transaction No.</th>
              <th className="px-2 py-2 text-right">Total Amount</th>
              <th className="px-2 py-2 text-right">Money In</th>
              <th className="px-2 py-2 text-right">Money Out</th>
              <th className="px-2 py-2 text-right">Balance Amount</th>
            </tr>
          </thead>
          <tbody>
            <ReportTableEmpty colSpan={8} />
          </tbody>
        </table>
      </div>
    </ReportPageChrome>
  );
}

export function PurchaseSummaryReport() {
  const [period, setPeriod] = useState("week");

  return (
    <ReportPageChrome
      title="Purchase Summary"
      favouriteStorageKey="prime-detailer-purchase-summary-fav"
      emailReportName="Purchase Summary"
      period={period}
      onPeriodChange={setPeriod}
      onDownloadCsv={noopCsv}
    >
      <div className="mb-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
        <span className="text-muted-foreground">Total Purchases: </span>
        <span className="font-semibold text-emerald-600 tabular-nums">{formatInrFull(0)}</span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[800px] border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-[10px] font-semibold uppercase text-muted-foreground sm:text-xs">
              <th className="px-2 py-2 text-left">Purchase No</th>
              <th className="px-2 py-2 text-left">Original Invoice No</th>
              <th className="px-2 py-2 text-left">Purchase Date</th>
              <th className="px-2 py-2 text-left">Party Name</th>
              <th className="px-2 py-2 text-right">Purchase Amount</th>
              <th className="px-2 py-2 text-left">Notes</th>
            </tr>
          </thead>
          <tbody>
            <ReportTableEmpty colSpan={6} />
          </tbody>
        </table>
      </div>
    </ReportPageChrome>
  );
}

export function CashBankPaymentsReport() {
  const [period, setPeriod] = useState("week");
  const [bank, setBank] = useState<string>(BANKS[0]);
  const [txnType, setTxnType] = useState<string>(TXN_TYPES[0]);

  return (
    <ReportPageChrome
      title="Cash and Bank Report (All Payments)"
      favouriteStorageKey="prime-detailer-cash-bank-fav"
      emailReportName="Cash and Bank Report (All Payments)"
      period={period}
      onPeriodChange={setPeriod}
      onDownloadCsv={noopCsv}
      filterSlot={
        <>
          <Select value={bank} onValueChange={setBank}>
            <SelectTrigger className="h-9 min-w-[220px] border-border">
              <SelectValue placeholder="Select Bank Account" />
            </SelectTrigger>
            <SelectContent>
              {BANKS.map((b) => (
                <SelectItem key={b} value={b} className={reportSelectItemClass}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={txnType} onValueChange={setTxnType}>
            <SelectTrigger className="h-9 w-[200px] border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TXN_TYPES.map((t) => (
                <SelectItem key={t} value={t} className={reportSelectItemClass}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      }
    >
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[900px] border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-[10px] font-semibold uppercase text-muted-foreground sm:text-xs">
              <th className="px-2 py-2 text-left">Date</th>
              <th className="px-2 py-2 text-left">Voucher Type</th>
              <th className="px-2 py-2 text-left">Txn No</th>
              <th className="px-2 py-2 text-left">Party</th>
              <th className="px-2 py-2 text-right">Paid</th>
              <th className="px-2 py-2 text-right">Received</th>
              <th className="px-2 py-2 text-right">Balance</th>
              <th className="px-2 py-2 text-left">Notes</th>
            </tr>
          </thead>
          <tbody>
            <ReportTableEmpty colSpan={8} />
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-muted/30 text-xs font-medium">
              <td className="px-2 py-2" colSpan={4}>
                Total:
              </td>
              <td className="px-2 py-2 text-right tabular-nums">{formatInrFull(0)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatInrFull(0)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatInrFull(0)}</td>
              <td className="px-2 py-2" />
            </tr>
          </tfoot>
        </table>
      </div>
    </ReportPageChrome>
  );
}

export function ExpenseCategoryReport() {
  const [period, setPeriod] = useState("week");

  return (
    <ReportPageChrome
      title="Expense Category Report"
      favouriteStorageKey="prime-detailer-expense-cat-fav"
      emailReportName="Expense Category Report"
      period={period}
      onPeriodChange={setPeriod}
      onDownloadCsv={noopCsv}
    >
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[480px] border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-[10px] font-semibold uppercase text-muted-foreground sm:text-xs">
              <th className="px-2 py-2 text-left">Category</th>
              <th className="px-2 py-2 text-right">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            <ReportTableEmpty colSpan={2} />
          </tbody>
        </table>
      </div>
    </ReportPageChrome>
  );
}

export function ExpenseTransactionReport() {
  const [period, setPeriod] = useState("week");
  const [category, setCategory] = useState<string>(EXPENSE_CATS[0]);

  return (
    <ReportPageChrome
      title="Expense Transaction Report"
      favouriteStorageKey="prime-detailer-expense-txn-fav"
      emailReportName="Expense Transaction Report"
      period={period}
      onPeriodChange={setPeriod}
      onDownloadCsv={noopCsv}
      filterSlot={
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-9 min-w-[220px] border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EXPENSE_CATS.map((c) => (
              <SelectItem key={c} value={c} className={reportSelectItemClass}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[720px] border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-[10px] font-semibold uppercase text-muted-foreground sm:text-xs">
              <th className="px-2 py-2 text-left">Date</th>
              <th className="px-2 py-2 text-left">Expense Number</th>
              <th className="px-2 py-2 text-left">Category</th>
              <th className="px-2 py-2 text-left">Payment Mode</th>
              <th className="px-2 py-2 text-right">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            <ReportTableEmpty colSpan={5} />
          </tbody>
        </table>
      </div>
    </ReportPageChrome>
  );
}
