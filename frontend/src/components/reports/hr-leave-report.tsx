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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { monthDateRange } from "@/lib/attendance-reports";
import {
  applyBranchFilters,
  resolveBranchScopeLabel,
  useBranchScope,
} from "@/lib/branch-scope";
import { rangesOverlap } from "@/lib/leave/calculations";
import {
  DEFAULT_REPORT_PERIOD,
  reportSelectItemClass,
} from "@/lib/reports/report-period-presets";
import { formatDate } from "@/lib/utils";
import { useBranchStore } from "@/store/branch-store";
import { useLeaveStore } from "@/store/leave-store";
import type { LeaveRequestStatus } from "@/types";
import { toast } from "sonner";

const FAV_KEY = "prime-detailer-hr-leave-favourite";

const STATUS_OPTIONS: (LeaveRequestStatus | "ALL")[] = [
  "ALL",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
];

export function HrLeaveReport() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [pageBranchFilter, setPageBranchFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<LeaveRequestStatus | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState("all");
  const [period] = useState(DEFAULT_REPORT_PERIOD);

  const branches = useBranchStore((s) => s.branches);
  const { selectedBranchId, showBranchPicker, viewingLabel } = useBranchScope();
  const requests = useLeaveStore((s) => s.requests);
  const leaveTypes = useLeaveStore((s) => s.leaveTypes);

  const scopeLabel = resolveBranchScopeLabel(
    showBranchPicker,
    viewingLabel,
    pageBranchFilter,
    branches
  );

  const { fromDate, toDate } = useMemo(
    () => monthDateRange(year, month),
    [year, month]
  );

  const rows = useMemo(() => {
    let list = applyBranchFilters(
      requests,
      (r) => r.branchId,
      selectedBranchId,
      showBranchPicker,
      pageBranchFilter
    );
    list = list.filter((r) => rangesOverlap(fromDate, toDate, r.fromDate, r.toDate));
    if (statusFilter !== "ALL") {
      list = list.filter((r) => r.status === statusFilter);
    }
    if (typeFilter !== "all") {
      list = list.filter((r) => r.leaveTypeId === typeFilter);
    }
    return [...list].sort((a, b) => b.fromDate.localeCompare(a.fromDate));
  }, [
    requests,
    selectedBranchId,
    showBranchPicker,
    pageBranchFilter,
    fromDate,
    toDate,
    statusFilter,
    typeFilter,
  ]);

  const downloadCsv = () => {
    if (rows.length === 0) {
      toast.message("No rows to export");
      return;
    }
    const header = [
      "Staff",
      "Leave Type",
      "Status",
      "From",
      "To",
      "Days",
      "Reason",
      "Branch ID",
      "Applied At",
    ].join(",");
    const lines = rows.map((r) =>
      [
        r.staffName,
        r.leaveTypeName,
        r.status,
        r.fromDate,
        r.toDate,
        r.days,
        r.reason,
        r.branchId,
        r.appliedAt,
      ]
        .map(csvEscape)
        .join(",")
    );
    const monthLabel = String(month).padStart(2, "0");
    downloadTextFile(
      [header, ...lines].join("\n"),
      `hr-leave-${year}-${monthLabel}.csv`
    );
    toast.message("Download started");
  };

  return (
    <ReportPageChrome
      title="HR Leave"
      favouriteStorageKey={FAV_KEY}
      emailReportName="HR Leave"
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
          extra={
            <>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as LeaveRequestStatus | "ALL")}
              >
                <SelectTrigger className="h-9 w-[140px] border-border" aria-label="Status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s} className={reportSelectItemClass}>
                      {s === "ALL" ? "All statuses" : s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 w-[160px] border-border" aria-label="Leave type">
                  <SelectValue placeholder="Leave type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className={reportSelectItemClass}>
                    All types
                  </SelectItem>
                  {leaveTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id} className={reportSelectItemClass}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          }
        />
      }
    >
      <p className="mb-3 text-sm text-muted-foreground">
        Leave requests overlapping {fromDate} – {toDate} · {scopeLabel}
      </p>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[960px] border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">
              <th className="px-2 py-2 text-left">Staff</th>
              <th className="px-2 py-2 text-left">Type</th>
              <th className="px-2 py-2 text-left">Status</th>
              <th className="px-2 py-2 text-left">From</th>
              <th className="px-2 py-2 text-left">To</th>
              <th className="px-2 py-2 text-right">Days</th>
              <th className="px-2 py-2 text-left">Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <ReportTableEmpty
                colSpan={7}
                message="No leave requests for this period and filters."
              />
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-border/80 hover:bg-muted/20">
                  <td className="px-2 py-2 font-medium">{r.staffName}</td>
                  <td className="px-2 py-2">{r.leaveTypeName}</td>
                  <td className="px-2 py-2">{r.status}</td>
                  <td className="whitespace-nowrap px-2 py-2">{formatDate(r.fromDate)}</td>
                  <td className="whitespace-nowrap px-2 py-2">{formatDate(r.toDate)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.days}</td>
                  <td className="max-w-[240px] truncate px-2 py-2 text-muted-foreground">
                    {r.reason || "—"}
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
