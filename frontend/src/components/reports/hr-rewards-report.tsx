"use client";

import { useMemo, useState } from "react";
import { ReportPageChrome } from "@/components/reports/report-page-chrome";
import { ReportTableEmpty } from "@/components/reports/report-table-empty";
import {
  HrMonthYearBranchFilters,
  csvEscape,
  downloadTextFile,
} from "@/components/reports/hr-report-filters";
import {
  applyBranchFilters,
  resolveBranchScopeLabel,
  useBranchScope,
} from "@/lib/branch-scope";
import { DEFAULT_REPORT_PERIOD } from "@/lib/reports/report-period-presets";
import { formatDate, formatInrFull } from "@/lib/utils";
import { useBranchStore } from "@/store/branch-store";
import { useStaffRewardStore } from "@/store/staff-reward-store";
import { toast } from "sonner";

const FAV_KEY = "prime-detailer-hr-rewards-favourite";

export function HrRewardsReport() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [pageBranchFilter, setPageBranchFilter] = useState("all");
  const [period] = useState(DEFAULT_REPORT_PERIOD);

  const branches = useBranchStore((s) => s.branches);
  const { selectedBranchId, showBranchPicker, viewingLabel } = useBranchScope();
  const ledger = useStaffRewardStore((s) => s.ledger);

  const scopeLabel = resolveBranchScopeLabel(
    showBranchPicker,
    viewingLabel,
    pageBranchFilter,
    branches
  );

  const rows = useMemo(() => {
    let list = applyBranchFilters(
      ledger,
      (e) => e.branchId,
      selectedBranchId,
      showBranchPicker,
      pageBranchFilter
    );
    list = list.filter((e) => e.periodMonth === month && e.periodYear === year);
    return [...list].sort(
      (a, b) =>
        a.staffName.localeCompare(b.staffName) ||
        b.createdAt.localeCompare(a.createdAt)
    );
  }, [ledger, selectedBranchId, showBranchPicker, pageBranchFilter, month, year]);

  const totalsByStaff = useMemo(() => {
    const map = new Map<
      string,
      { staffId: string; staffName: string; amount: number; count: number }
    >();
    for (const e of rows) {
      if (e.status === "CANCELLED") continue;
      const cur = map.get(e.staffId) ?? {
        staffId: e.staffId,
        staffName: e.staffName,
        amount: 0,
        count: 0,
      };
      cur.amount += e.amount;
      cur.count += 1;
      map.set(e.staffId, cur);
    }
    return [...map.values()].sort((a, b) => b.amount - a.amount);
  }, [rows]);

  const grandTotal = useMemo(
    () => totalsByStaff.reduce((s, r) => s + r.amount, 0),
    [totalsByStaff]
  );

  const downloadCsv = () => {
    if (rows.length === 0) {
      toast.message("No rows to export");
      return;
    }
    const header = [
      "Staff",
      "Reward Type",
      "Amount",
      "Status",
      "Job Number",
      "Reason",
      "Branch ID",
      "Created At",
    ].join(",");
    const lines = rows.map((e) =>
      [
        e.staffName,
        e.rewardType,
        e.amount,
        e.status,
        e.jobNumber ?? "",
        e.reason ?? "",
        e.branchId,
        e.createdAt,
      ]
        .map(csvEscape)
        .join(",")
    );
    const monthLabel = String(month).padStart(2, "0");
    downloadTextFile(
      [header, ...lines].join("\n"),
      `hr-rewards-${year}-${monthLabel}.csv`
    );
    toast.message("Download started");
  };

  return (
    <ReportPageChrome
      title="HR Rewards"
      favouriteStorageKey={FAV_KEY}
      emailReportName="HR Rewards"
      period={period}
      onPeriodChange={() => {}}
      showPeriod={false}
      onDownloadCsv={downloadCsv}
      filterSlot={
        <HrMonthYearBranchFilters
          month={month}
          year={year}
          onMonthChange={setMonth}
          onYearChange={setYear}
          showBranchPicker={showBranchPicker}
          pageBranchFilter={pageBranchFilter}
          onBranchFilterChange={setPageBranchFilter}
          branches={branches}
        />
      }
    >
      <p className="mb-3 text-sm text-muted-foreground">
        Reward ledger for {String(month).padStart(2, "0")}/{year} · {scopeLabel}
      </p>

      <div className="mb-4 rounded-lg border border-border bg-card p-3 sm:max-w-xs">
        <p className="text-xs text-muted-foreground">Total (excl. cancelled)</p>
        <p className="mt-1 text-lg font-semibold tabular-nums">
          {formatInrFull(grandTotal)}
        </p>
      </div>

      <div className="mb-6 overflow-x-auto rounded-lg border border-border bg-card">
        <h2 className="border-b border-border bg-muted/40 px-3 py-2 text-sm font-semibold">
          Totals by staff
        </h2>
        <table className="w-full min-w-[480px] border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-[10px] font-semibold uppercase text-muted-foreground sm:text-xs">
              <th className="px-2 py-2 text-left">Staff</th>
              <th className="px-2 py-2 text-right">Entries</th>
              <th className="px-2 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {totalsByStaff.length === 0 ? (
              <ReportTableEmpty colSpan={3} message="No staff totals for this month." />
            ) : (
              totalsByStaff.map((r) => (
                <tr key={r.staffId} className="border-b border-border/80 hover:bg-muted/20">
                  <td className="px-2 py-2 font-medium">{r.staffName}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.count}</td>
                  <td className="px-2 py-2 text-right font-medium tabular-nums">
                    {formatInrFull(r.amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <h2 className="border-b border-border bg-muted/40 px-3 py-2 text-sm font-semibold">
          Ledger entries
        </h2>
        <table className="w-full min-w-[960px] border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">
              <th className="px-2 py-2 text-left">Staff</th>
              <th className="px-2 py-2 text-left">Type</th>
              <th className="px-2 py-2 text-right">Amount</th>
              <th className="px-2 py-2 text-left">Status</th>
              <th className="px-2 py-2 text-left">Job</th>
              <th className="px-2 py-2 text-left">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <ReportTableEmpty
                colSpan={6}
                message="No reward ledger entries for this month and branch."
              />
            ) : (
              rows.map((e) => (
                <tr key={e.id} className="border-b border-border/80 hover:bg-muted/20">
                  <td className="px-2 py-2 font-medium">{e.staffName}</td>
                  <td className="px-2 py-2">{e.rewardType}</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatInrFull(e.amount)}
                  </td>
                  <td className="px-2 py-2">{e.status}</td>
                  <td className="px-2 py-2 font-mono text-xs">{e.jobNumber ?? "—"}</td>
                  <td className="whitespace-nowrap px-2 py-2">
                    {formatDate(e.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ReportPageChrome>
  );
}
