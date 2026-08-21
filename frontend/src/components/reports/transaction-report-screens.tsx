"use client";

import { useMemo, useState } from "react";
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
import { useScopedExpenses, useScopedInvoices } from "@/hooks/use-scoped-data";
import { DEFAULT_REPORT_PERIOD, reportSelectItemClass } from "@/lib/reports/report-period-presets";
import {
  accountFilterOptions,
  buildBillWiseProfitRows,
  buildCashBankReportRows,
  buildDaybookRows,
  buildExpenseCategoryRows,
  buildExpenseTransactionRows,
  buildPurchaseSummaryRows,
  expenseCategoryFilterOptions,
  uniqueInvoiceCustomers,
} from "@/lib/reports/transaction-report-data";
import { useCashBankStore } from "@/store/cash-bank-store";
import { useInventoryStore } from "@/store/inventory-store";
import { formatDate, formatInrFull } from "@/lib/utils";
import { HelpCircle } from "lucide-react";
import { toast } from "sonner";

const TXN_TYPES = ["All Transactions", "Receipt", "Payment", "Contra", "Journal"] as const;

function noopCsv() {
  toast.message("No rows to export");
}

export function BillWiseProfitReport() {
  const invoices = useScopedInvoices();
  const [period, setPeriod] = useState<string>(DEFAULT_REPORT_PERIOD);
  const [party, setParty] = useState("all");

  const partyOptions = useMemo(() => uniqueInvoiceCustomers(invoices), [invoices]);
  const rows = useMemo(
    () => buildBillWiseProfitRows(invoices, period, party),
    [invoices, period, party]
  );
  const netProfit = useMemo(
    () => Math.round(rows.reduce((s, r) => s + r.profit, 0) * 100) / 100,
    [rows]
  );

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
              Profit = taxable sales (subtotal) minus parts line totals on each invoice.
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
              {partyOptions.map((c) => (
                <SelectItem key={c.id} value={c.id} className={reportSelectItemClass}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      >
        <div className="mb-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Net Profit: </span>
          <span className="font-semibold text-emerald-600 tabular-nums">{formatInrFull(netProfit)}</span>
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
              {rows.length === 0 ? (
                <ReportTableEmpty colSpan={7} />
              ) : (
                rows.map((r) => (
                  <tr key={r.invoiceNumber} className="border-b border-border/80 hover:bg-muted/10">
                    <td className="px-2 py-2 whitespace-nowrap">{formatDate(r.date)}</td>
                    <td className="px-2 py-2 font-mono text-xs">{r.invoiceNumber}</td>
                    <td className="px-2 py-2">{r.partyName}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatInrFull(r.invoiceAmount)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatInrFull(r.salesAmount)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatInrFull(r.purchaseAmount)}</td>
                    <td className="px-2 py-2 text-right font-medium tabular-nums text-emerald-700">
                      {formatInrFull(r.profit)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ReportPageChrome>
    </TooltipProvider>
  );
}

export function DaybookReport() {
  const invoices = useScopedInvoices();
  const expenses = useScopedExpenses();
  const cashTxns = useCashBankStore((s) => s.transactions);
  const [period, setPeriod] = useState<string>(DEFAULT_REPORT_PERIOD);
  const [txnType, setTxnType] = useState<string>(TXN_TYPES[0]);

  const { rows, netAmount } = useMemo(
    () => buildDaybookRows(invoices, expenses, cashTxns, period, txnType),
    [invoices, expenses, cashTxns, period, txnType]
  );

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
        <span className="font-semibold text-emerald-600 tabular-nums">{formatInrFull(netAmount)}</span>
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
            {rows.length === 0 ? (
              <ReportTableEmpty colSpan={8} />
            ) : (
              rows.map((r, i) => (
                <tr key={`${r.txnNo}-${i}`} className="border-b border-border/80 hover:bg-muted/10">
                  <td className="px-2 py-2 whitespace-nowrap">{formatDate(r.date)}</td>
                  <td className="px-2 py-2">{r.partyName}</td>
                  <td className="px-2 py-2">{r.txnType}</td>
                  <td className="px-2 py-2 font-mono text-xs">{r.txnNo}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatInrFull(r.totalAmount)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-emerald-700">
                    {r.moneyIn > 0 ? formatInrFull(r.moneyIn) : "—"}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-red-600">
                    {r.moneyOut > 0 ? formatInrFull(r.moneyOut) : "—"}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatInrFull(r.balanceAmount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ReportPageChrome>
  );
}

export function PurchaseSummaryReport() {
  const purchases = useInventoryStore((s) => s.productPurchases);
  const parts = useInventoryStore((s) => s.parts);
  const [period, setPeriod] = useState<string>(DEFAULT_REPORT_PERIOD);

  const rows = useMemo(
    () => buildPurchaseSummaryRows(purchases, parts, period),
    [purchases, parts, period]
  );
  const total = useMemo(
    () => Math.round(rows.reduce((s, r) => s + r.purchaseAmount, 0) * 100) / 100,
    [rows]
  );

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
        <span className="font-semibold text-emerald-600 tabular-nums">{formatInrFull(total)}</span>
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
            {rows.length === 0 ? (
              <ReportTableEmpty colSpan={6} />
            ) : (
              rows.map((r) => (
                <tr key={r.purchaseNo} className="border-b border-border/80 hover:bg-muted/10">
                  <td className="px-2 py-2 font-mono text-xs">{r.purchaseNo}</td>
                  <td className="px-2 py-2">{r.originalInvoiceNo}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{formatDate(r.purchaseDate)}</td>
                  <td className="px-2 py-2">{r.partyName}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatInrFull(r.purchaseAmount)}</td>
                  <td className="px-2 py-2 text-muted-foreground">{r.notes}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ReportPageChrome>
  );
}

export function CashBankPaymentsReport() {
  const accounts = useCashBankStore((s) => s.accounts);
  const transactions = useCashBankStore((s) => s.transactions);
  const [period, setPeriod] = useState<string>(DEFAULT_REPORT_PERIOD);
  const [bank, setBank] = useState("all");
  const [txnType, setTxnType] = useState<string>(TXN_TYPES[0]);

  const bankOptions = useMemo(() => accountFilterOptions(accounts), [accounts]);
  const { rows, totalPaid, totalReceived, closingBalance } = useMemo(
    () => buildCashBankReportRows(accounts, transactions, period, bank, txnType),
    [accounts, transactions, period, bank, txnType]
  );

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
              {bankOptions.map((b) => (
                <SelectItem key={b.value} value={b.value} className={reportSelectItemClass}>
                  {b.label}
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
            {rows.length === 0 ? (
              <ReportTableEmpty colSpan={8} />
            ) : (
              rows.map((r, i) => (
                <tr key={`${r.txnNo}-${i}`} className="border-b border-border/80 hover:bg-muted/10">
                  <td className="px-2 py-2 whitespace-nowrap">{formatDate(r.date)}</td>
                  <td className="px-2 py-2">{r.voucherType}</td>
                  <td className="px-2 py-2 font-mono text-xs">{r.txnNo}</td>
                  <td className="px-2 py-2">{r.party}</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {r.paid > 0 ? formatInrFull(r.paid) : "—"}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-emerald-700">
                    {r.received > 0 ? formatInrFull(r.received) : "—"}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatInrFull(r.balance)}</td>
                  <td className="px-2 py-2 text-muted-foreground">{r.notes || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-muted/30 text-xs font-medium">
              <td className="px-2 py-2" colSpan={4}>
                Total:
              </td>
              <td className="px-2 py-2 text-right tabular-nums">{formatInrFull(totalPaid)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatInrFull(totalReceived)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatInrFull(closingBalance)}</td>
              <td className="px-2 py-2" />
            </tr>
          </tfoot>
        </table>
      </div>
    </ReportPageChrome>
  );
}

export function ExpenseCategoryReport() {
  const expenses = useScopedExpenses();
  const [period, setPeriod] = useState<string>(DEFAULT_REPORT_PERIOD);

  const rows = useMemo(() => buildExpenseCategoryRows(expenses, period), [expenses, period]);

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
              <th className="px-2 py-2 text-right">Cash Paid</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <ReportTableEmpty colSpan={2} />
            ) : (
              <>
                {rows.map((r) => (
                  <tr key={r.category} className="border-b border-border/80 hover:bg-muted/10">
                    <td className="px-2 py-2 font-medium">{r.category}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatInrFull(r.totalAmount)}</td>
                  </tr>
                ))}
                <tr className="border-t border-border bg-muted/30 font-semibold">
                  <td className="px-2 py-2">Total</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatInrFull(
                      Math.round(rows.reduce((s, r) => s + r.totalAmount, 0) * 100) / 100
                    )}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </ReportPageChrome>
  );
}

export function ExpenseTransactionReport() {
  const expenses = useScopedExpenses();
  const purchases = useInventoryStore((s) => s.productPurchases);
  const [period, setPeriod] = useState<string>(DEFAULT_REPORT_PERIOD);
  const [category, setCategory] = useState("All Expense Categories");

  const categoryOptions = useMemo(() => expenseCategoryFilterOptions(expenses), [expenses]);
  const rows = useMemo(
    () => buildExpenseTransactionRows(expenses, period, category, purchases),
    [expenses, period, category, purchases]
  );
  const totalCashPaid = useMemo(
    () => Math.round(rows.reduce((s, r) => s + r.totalAmount, 0) * 100) / 100,
    [rows]
  );

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
            {categoryOptions.map((c) => (
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
              <th className="px-2 py-2 text-right">Cash Paid</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <ReportTableEmpty colSpan={5} />
            ) : (
              <>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/80 hover:bg-muted/10">
                    <td className="px-2 py-2 whitespace-nowrap">{formatDate(r.date)}</td>
                    <td className="px-2 py-2 font-mono text-xs">{r.expenseNumber}</td>
                    <td className="px-2 py-2">{r.category}</td>
                    <td className="px-2 py-2">{r.paymentMode}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatInrFull(r.totalAmount)}</td>
                  </tr>
                ))}
                <tr className="border-t border-border bg-muted/30 font-semibold">
                  <td className="px-2 py-2" colSpan={4}>
                    Total (cash paid)
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatInrFull(totalCashPaid)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </ReportPageChrome>
  );
}
