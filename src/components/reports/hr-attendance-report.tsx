"use client";

import { useMemo, useState } from "react";
import { ReportPageChrome } from "@/components/reports/report-page-chrome";
import { ReportTableEmpty } from "@/components/reports/report-table-empty";
import {
  HrMonthYearBranchFilters,
  downloadTextFile,
} from "@/components/reports/hr-report-filters";
import {
  attendanceSummaryToCsv,
  buildStaffAttendanceSummary,
  monthDateRange,
  type AttendanceSummaryStaff,
} from "@/lib/attendance-reports";
import {
  resolveBranchScopeLabel,
  resolveEffectiveBranchId,
  useBranchScope,
} from "@/lib/branch-scope";
import { DEFAULT_REPORT_PERIOD } from "@/lib/reports/report-period-presets";
import { useAttendanceStore } from "@/store/attendance-store";
import { useBranchStore } from "@/store/branch-store";
import { useLeaveStore } from "@/store/leave-store";
import { useStaffStore } from "@/store/staff-store";
import { toast } from "sonner";

const FAV_KEY = "prime-detailer-hr-attendance-favourite";

export function HrAttendanceReport() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [pageBranchFilter, setPageBranchFilter] = useState("all");
  const [period] = useState(DEFAULT_REPORT_PERIOD);

  const branches = useBranchStore((s) => s.branches);
  const { selectedBranchId, showBranchPicker, viewingLabel } = useBranchScope();
  const attendance = useAttendanceStore((s) => s.records);
  const staff = useStaffStore((s) => s.staff);
  const leaveRequests = useLeaveStore((s) => s.requests);

  const branchId = resolveEffectiveBranchId(
    selectedBranchId,
    showBranchPicker,
    pageBranchFilter
  );

  const scopeLabel = resolveBranchScopeLabel(
    showBranchPicker,
    viewingLabel,
    pageBranchFilter,
    branches
  );

  const summaryStaff = useMemo((): AttendanceSummaryStaff[] => {
    return staff.map((s) => ({
      id: s.id,
      name: s.name,
      branchId: s.branchId,
      isActive: s.isActive,
    }));
  }, [staff]);

  const approvedLeave = useMemo(
    () => leaveRequests.filter((r) => r.status === "APPROVED"),
    [leaveRequests]
  );

  const rows = useMemo(() => {
    const { fromDate, toDate } = monthDateRange(year, month);
    return buildStaffAttendanceSummary({
      attendance,
      staff: summaryStaff,
      approvedLeave,
      fromDate,
      toDate,
      branchId,
    });
  }, [attendance, summaryStaff, approvedLeave, year, month, branchId]);

  const downloadCsv = () => {
    if (rows.length === 0) {
      toast.message("No rows to export");
      return;
    }
    const csv = attendanceSummaryToCsv(rows);
    const monthLabel = String(month).padStart(2, "0");
    downloadTextFile(csv, `hr-attendance-${year}-${monthLabel}.csv`);
    toast.message("Download started");
  };

  return (
    <ReportPageChrome
      title="HR Attendance"
      favouriteStorageKey={FAV_KEY}
      emailReportName="HR Attendance"
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
        Monthly staff attendance with approved leave · {scopeLabel}
      </p>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[900px] border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">
              <th className="px-2 py-2 text-left">Staff</th>
              <th className="px-2 py-2 text-right">Present</th>
              <th className="px-2 py-2 text-right">Late</th>
              <th className="px-2 py-2 text-right">Half day</th>
              <th className="px-2 py-2 text-right">Leave</th>
              <th className="px-2 py-2 text-right">Absent</th>
              <th className="px-2 py-2 text-right">Total minutes</th>
              <th className="px-2 py-2 text-right">Avg hours</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <ReportTableEmpty
                colSpan={8}
                message="No attendance summary for this month and branch."
              />
            ) : (
              rows.map((r) => (
                <tr key={r.staffId} className="border-b border-border/80 hover:bg-muted/20">
                  <td className="px-2 py-2 font-medium">{r.staffName}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.presentDays}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.lateDays}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.halfDays}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.leaveDays}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.absentDays}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.totalMinutes}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.avgHours}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ReportPageChrome>
  );
}
