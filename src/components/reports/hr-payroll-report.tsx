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
import { formatInrFull } from "@/lib/utils";
import { useBranchStore } from "@/store/branch-store";
import { usePayrollStore } from "@/store/payroll-store";
import { toast } from "sonner";

const FAV_KEY = "prime-detailer-hr-payroll-favourite";

export function HrPayrollReport() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [pageBranchFilter, setPageBranchFilter] = useState("all");
  const [period] = useState(DEFAULT_REPORT_PERIOD);

  const branches = useBranchStore((s) => s.branches);
  const { selectedBranchId, showBranchPicker, viewingLabel } = useBranchScope();
  const payrollRecords = usePayrollStore((s) => s.payrollRecords);

  const scopeLabel = resolveBranchScopeLabel(
    showBranchPicker,
    viewingLabel,
    pageBranchFilter,
    branches
  );

  const rows = useMemo(() => {
    let list = applyBranchFilters(
      payrollRecords,
      (r) => r.branchId,
      selectedBranchId,
      showBranchPicker,
      pageBranchFilter
    );
    list = list.filter((r) => r.periodMonth === month && r.periodYear === year);
    return [...list].sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }, [
    payrollRecords,
    selectedBranchId,
    showBranchPicker,
    pageBranchFilter,
    month,
    year,
  ]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.net += r.netSalary;
        acc.rewards += r.rewardAmount ?? 0;
        acc.attendance += r.attendanceDays;
        return acc;
      },
      { net: 0, rewards: 0, attendance: 0 }
    );
  }, [rows]);

  const downloadCsv = () => {
    if (rows.length === 0) {
      toast.message("No rows to export");
      return;
    }
    const header = [
      "Employee",
      "Branch ID",
      "Attendance Days",
      "Paid Leave Days",
      "Unpaid Leave Days",
      "Reward Amount",
      "Net Salary",
      "Status",
    ].join(",");
    const lines = rows.map((r) =>
      [
        r.employeeName,
        r.branchId,
        r.attendanceDays,
        r.paidLeaveDays ?? 0,
        r.unpaidLeaveDays ?? 0,
        r.rewardAmount ?? 0,
        r.netSalary,
        r.status,
      ]
        .map(csvEscape)
        .join(",")
    );
    const monthLabel = String(month).padStart(2, "0");
    downloadTextFile(
      [header, ...lines].join("\n"),
      `hr-payroll-${year}-${monthLabel}.csv`
    );
    toast.message("Download started");
  };

  return (
    <ReportPageChrome
      title="HR Payroll"
      favouriteStorageKey={FAV_KEY}
      emailReportName="HR Payroll"
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
        Payroll records for {String(month).padStart(2, "0")}/{year} · {scopeLabel}
      </p>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Total net</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{formatInrFull(totals.net)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Rewards included</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {formatInrFull(totals.rewards)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Attendance days (sum)</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{totals.attendance}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[960px] border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">
              <th className="px-2 py-2 text-left">Employee</th>
              <th className="px-2 py-2 text-right">Attendance</th>
              <th className="px-2 py-2 text-right">Paid leave</th>
              <th className="px-2 py-2 text-right">Unpaid leave</th>
              <th className="px-2 py-2 text-right">Rewards</th>
              <th className="px-2 py-2 text-right">Net salary</th>
              <th className="px-2 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <ReportTableEmpty
                colSpan={7}
                message="No payroll records for this month and branch."
              />
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-border/80 hover:bg-muted/20">
                  <td className="px-2 py-2 font-medium">{r.employeeName}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.attendanceDays}</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {r.paidLeaveDays ?? 0}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {r.unpaidLeaveDays ?? 0}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatInrFull(r.rewardAmount ?? 0)}
                  </td>
                  <td className="px-2 py-2 text-right font-medium tabular-nums">
                    {formatInrFull(r.netSalary)}
                  </td>
                  <td className="px-2 py-2">{r.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ReportPageChrome>
  );
}
