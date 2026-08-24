"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import {
  DesktopTableWrap,
  MobileCardList,
  MobileRowCard,
} from "@/components/shared/mobile-table-layout";
import { KPICard } from "@/components/shared/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAttendanceStore } from "@/store/attendance-store";
import { useStaffStore } from "@/store/staff-store";
import { useAuthStore } from "@/store/auth-store";
import { useBranchStore } from "@/store/branch-store";
import { useLeaveStore } from "@/store/leave-store";
import { AttendanceQrPanel } from "@/components/attendance/attendance-qr-panel";
import { format } from "date-fns";
import { roleDisplayLabel } from "@/lib/rbac";
import {
  Clock,
  UserCheck,
  UserX,
  AlertTriangle,
  Calendar,
  Download,
} from "lucide-react";
import { getShiftStatusDisplay } from "@/lib/attendance-display";
import { canViewStaffAttendanceDashboard } from "@/lib/attendance-access";
import { useBranchScope } from "@/lib/branch-scope";
import {
  attendanceSummaryToCsv,
  buildStaffAttendanceSummary,
  monthDateRange,
  type AttendanceSummaryStaff,
} from "@/lib/attendance-reports";
import { toast } from "sonner";
import { useDashboardStoresReady } from "@/hooks/use-dashboard-stores-ready";
import { PageSkeleton, RefreshingBar } from "@/components/shared/skeleton-loader";

const MONTH_OPTIONS = [
  { v: 1, label: "January" },
  { v: 2, label: "February" },
  { v: 3, label: "March" },
  { v: 4, label: "April" },
  { v: 5, label: "May" },
  { v: 6, label: "June" },
  { v: 7, label: "July" },
  { v: 8, label: "August" },
  { v: 9, label: "September" },
  { v: 10, label: "October" },
  { v: 11, label: "November" },
  { v: 12, label: "December" },
];

function formatDuration(minutes?: number): string {
  if (minutes == null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

/** Local calendar day from yyyy-MM-dd (avoids UTC shift from `new Date(iso)`). */
function formatDateOptionLabel(isoDate: string): string {
  const [yy, mm, dd] = isoDate.split("-").map(Number);
  return format(new Date(yy, mm - 1, dd), "EEE, MMM d, yyyy");
}

export default function AttendancePage() {
  const storesReady = useDashboardStoresReady();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const branches = useBranchStore((s) => s.branches);
  const { selectedBranchId, viewingLabel } = useBranchScope();
  const attendanceRecords = useAttendanceStore((s) => s.records);
  const staff = useStaffStore((s) => s.staff);
  const leaveRequests = useLeaveStore((s) => s.requests);

  const qrDefaultBranchId = useMemo(() => {
    if (selectedBranchId) return selectedBranchId;
    return (
      user?.branchId ??
      branches.find((b) => b.isActive)?.id ??
      branches[0]?.id ??
      "br-main"
    );
  }, [selectedBranchId, user?.branchId, branches]);

  useEffect(() => {
    if (user && !canViewStaffAttendanceDashboard(user.role)) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  const today = format(new Date(), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(today);
  const [activeTab, setActiveTab] = useState("overview");
  const now = new Date();
  const [monthlyMonth, setMonthlyMonth] = useState(now.getMonth() + 1);
  const [monthlyYear, setMonthlyYear] = useState(now.getFullYear());

  const dateOptions = useMemo(() => {
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(format(d, "yyyy-MM-dd"));
    }
    return dates;
  }, []);

  const staffForBranch = useMemo(() => {
    if (!selectedBranchId) return staff;
    return staff.filter((s) => s.branchId === selectedBranchId);
  }, [staff, selectedBranchId]);

  const recordsForDate = useMemo(() => {
    if (activeTab !== "records") return [];
    const list = attendanceRecords.filter((r) => {
      if (r.date !== selectedDate) return false;
      if (!selectedBranchId) return true;
      return r.branchId === selectedBranchId;
    });
    return [...list].sort((a, b) => a.staffName.localeCompare(b.staffName));
  }, [attendanceRecords, selectedDate, selectedBranchId, activeTab]);

  const todayRecords = useMemo(() => {
    if (activeTab !== "overview") return [];
    return attendanceRecords.filter((r) => {
      if (r.date !== today) return false;
      if (!selectedBranchId) return true;
      return r.branchId === selectedBranchId;
    });
  }, [attendanceRecords, today, selectedBranchId, activeTab]);

  const kpis = useMemo(() => {
    /** Headcount: one row per staff. Short shifts are HALF_DAY, not PRESENT — still “showed up”. */
    const presentStaff = new Set(
      todayRecords
        .filter(
          (r) =>
            r.checkIn &&
            (r.status === "PRESENT" ||
              r.status === "LATE" ||
              r.status === "HALF_DAY")
        )
        .map((r) => r.staffId)
    );
    const present = presentStaff.size;
    const late = new Set(
      todayRecords.filter((r) => r.status === "LATE").map((r) => r.staffId)
    ).size;
    /** Active branch roster who have not checked in today (complements Present; includes explicit ABSENT + no row). */
    const roster = staffForBranch.filter((s) => s.isActive);
    const absent = roster.filter((s) => !presentStaff.has(s.id)).length;
    const withDuration = todayRecords.filter(
      (r) => r.durationMinutes != null && r.durationMinutes > 0
    );
    const avgHours =
      withDuration.length > 0
        ? (
            withDuration.reduce((s, r) => s + (r.durationMinutes ?? 0), 0) /
            withDuration.length /
            60
          ).toFixed(1)
        : "0";

    return { present, late, absent, avgHours };
  }, [todayRecords, staffForBranch, activeTab]);

  const absenceAlerts = useMemo(() => {
    const cutoff = "09:30";
    return staffForBranch.filter((s) => {
      const record = todayRecords.find((r) => r.staffId === s.id);
      if (!record) return true;
      if (record.status === "ABSENT") return true;
      if (!record.checkIn) return true;
      if (record.checkIn > cutoff) return true;
      return false;
    });
  }, [todayRecords, staffForBranch, activeTab]);

  const summaryPeriodLabel = useMemo(() => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const end = new Date(y, m - 1, d);
    const start = new Date(y, m - 1, d);
    start.setDate(start.getDate() - 6);
    return `${format(start, "EEE, MMM d")} – ${format(end, "EEE, MMM d, yyyy")}`;
  }, [selectedDate]);

  const staffSummary = useMemo(() => {
    if (activeTab !== "summary") return [];
    const [y, m, d] = selectedDate.split("-").map(Number);
    const end = new Date(y, m - 1, d);
    const start = new Date(y, m - 1, d);
    start.setDate(start.getDate() - 6);
    const startStr = format(start, "yyyy-MM-dd");
    const endStr = format(end, "yyyy-MM-dd");
    const periodRecords = attendanceRecords.filter((r) => {
      if (r.date > endStr || r.date < startStr) return false;
      if (!selectedBranchId) return true;
      return r.branchId === selectedBranchId;
    });
    return staffForBranch.map((s) => {
      const staffRecords = periodRecords.filter((r) => r.staffId === s.id);
      const present = staffRecords.filter((r) => r.status === "PRESENT").length;
      const absent = staffRecords.filter((r) => r.status === "ABSENT").length;
      const late = staffRecords.filter((r) => r.status === "LATE").length;
      const halfDay = staffRecords.filter((r) => r.status === "HALF_DAY").length;
      const withDuration = staffRecords.filter(
        (r) => r.durationMinutes != null && r.durationMinutes > 0
      );
      const avgHours =
        withDuration.length > 0
          ? (
              withDuration.reduce((sum, r) => sum + (r.durationMinutes ?? 0), 0) /
              withDuration.length /
              60
            ).toFixed(1)
          : "0";
      return {
        id: s.id,
        name: s.name,
        role: s.role,
        present,
        absent,
        late,
        halfDay,
        avgHours,
      };
    });
  }, [selectedDate, attendanceRecords, selectedBranchId, staffForBranch, activeTab]);

  const approvedLeave = useMemo(
    () => leaveRequests.filter((r) => r.status === "APPROVED"),
    [leaveRequests]
  );

  const summaryStaff = useMemo((): AttendanceSummaryStaff[] => {
    return staff.map((s) => ({
      id: s.id,
      name: s.name,
      branchId: s.branchId,
      isActive: s.isActive,
    }));
  }, [staff]);

  const monthlySummary = useMemo(() => {
    if (activeTab !== "monthly") return [];
    const { fromDate, toDate } = monthDateRange(monthlyYear, monthlyMonth);
    return buildStaffAttendanceSummary({
      attendance: attendanceRecords,
      staff: summaryStaff,
      approvedLeave,
      fromDate,
      toDate,
      branchId: selectedBranchId,
    });
  }, [
    attendanceRecords,
    summaryStaff,
    approvedLeave,
    monthlyYear,
    monthlyMonth,
    selectedBranchId,
    activeTab,
  ]);

  const downloadMonthlyCsv = () => {
    const csv = attendanceSummaryToCsv(monthlySummary);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const monthLabel = String(monthlyMonth).padStart(2, "0");
    a.download = `attendance-summary-${monthlyYear}-${monthLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export started.");
  };

  if (!user) {
    return null;
  }

  if (!canViewStaffAttendanceDashboard(user.role)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Redirecting…
      </div>
    );
  }

  if (!storesReady && staff.length === 0 && attendanceRecords.length === 0) return <PageSkeleton />;

  return (
    <div className="space-y-4 sm:space-y-6">
      <RefreshingBar show={!storesReady} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          title="Staff Attendance"
          description={`Managers and admins only — QR + PIN punch, check-in/out, and hours. Viewing: ${viewingLabel}.`}
        />
        <Badge variant="success" className="w-fit shrink-0">
          Live
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
        <TabsList className="bg-muted/50 p-1 flex-wrap h-auto sm:h-9 w-max">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="records">Records</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Present Today"
              value={kpis.present}
              subtitle="checked in"
              icon={UserCheck}
            />
            <KPICard
              title="Late Today"
              value={kpis.late}
              subtitle="staff"
              icon={Clock}
            />
            <KPICard
              title="Absent Today"
              value={kpis.absent}
              subtitle="no check-in"
              icon={UserX}
            />
            <KPICard
              title="Average Hours"
              value={`${kpis.avgHours}h`}
              subtitle="today"
              icon={Clock}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <AttendanceQrPanel defaultBranchId={qrDefaultBranchId} />

            <Card className="lg:col-span-2">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Absence Alerts
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  Not checked in by 9:30 AM today
                </span>
              </CardHeader>
              <CardContent>
                {absenceAlerts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    All staff have checked in on time
                  </p>
                ) : (
                  <div className="space-y-2">
                    {absenceAlerts.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border bg-amber-50/50 dark:bg-amber-950/20"
                      >
                        <div>
                          <p className="font-medium text-sm">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{s.role}</p>
                        </div>
                        <Badge variant="warning">Not checked in</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="records" className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Attendance Records
              </CardTitle>
              <Select value={selectedDate} onValueChange={setSelectedDate}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select date" />
                </SelectTrigger>
                <SelectContent>
                  {dateOptions.map((d) => (
                    <SelectItem key={d} value={d}>
                      {formatDateOptionLabel(d)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <MobileCardList>
                {recordsForDate.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No attendance records for this date
                  </p>
                ) : (
                  recordsForDate.map((r) => {
                    const shift = getShiftStatusDisplay(r);
                    return (
                      <MobileRowCard key={r.id}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium leading-snug">{r.staffName}</p>
                          <Badge variant={shift.variant}>{shift.label}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{r.staffRole}</p>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Check-in</span>
                            <p className="font-medium">{r.checkIn ?? "—"}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Check-out</span>
                            <p className="font-medium">{r.checkOut ?? "—"}</p>
                          </div>
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Duration</span>
                            <p className="font-medium">{formatDuration(r.durationMinutes)}</p>
                          </div>
                        </div>
                      </MobileRowCard>
                    );
                  })
                )}
              </MobileCardList>
              <DesktopTableWrap>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2 font-semibold">Staff Name</th>
                      <th className="text-left py-3 px-2 font-semibold">Role</th>
                      <th className="text-left py-3 px-2 font-semibold">Date</th>
                      <th className="text-left py-3 px-2 font-semibold">Check-In</th>
                      <th className="text-left py-3 px-2 font-semibold">Check-Out</th>
                      <th className="text-left py-3 px-2 font-semibold">Duration</th>
                      <th className="text-left py-3 px-2 font-semibold">Shift</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recordsForDate.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-8 text-center text-muted-foreground"
                        >
                          No attendance records for this date
                        </td>
                      </tr>
                    ) : (
                      recordsForDate.map((r) => {
                        const shift = getShiftStatusDisplay(r);
                        return (
                          <tr
                            key={r.id}
                            className="border-b border-border hover:bg-muted/50 transition-colors"
                          >
                            <td className="py-3 px-2 font-medium">{r.staffName}</td>
                            <td className="py-3 px-2 text-muted-foreground">
                              {r.staffRole}
                            </td>
                            <td className="py-3 px-2">
                              {format(new Date(r.date), "MMM d, yyyy")}
                            </td>
                            <td className="py-3 px-2">{r.checkIn ?? "—"}</td>
                            <td className="py-3 px-2">{r.checkOut ?? "—"}</td>
                            <td className="py-3 px-2">
                              {formatDuration(r.durationMinutes)}
                            </td>
                            <td className="py-3 px-2">
                              <Badge variant={shift.variant}>{shift.label}</Badge>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </DesktopTableWrap>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="space-y-4 sm:space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-border/80 bg-muted/20">
              <div className="space-y-1 min-w-0">
                <CardTitle className="text-base font-semibold">
                  Staff-wise Attendance Summary
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Rolling 7 days ending on the selected date
                </p>
                <p className="text-xs font-medium text-foreground/90 tabular-nums">
                  {summaryPeriodLabel}
                </p>
              </div>
              <div className="flex flex-col gap-1.5 sm:items-end shrink-0">
                <span className="text-xs text-muted-foreground">End date</span>
                <Select value={selectedDate} onValueChange={setSelectedDate}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select date" />
                  </SelectTrigger>
                  <SelectContent>
                    {dateOptions.map((d) => (
                      <SelectItem key={d} value={d}>
                        {formatDateOptionLabel(d)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <MobileCardList className="p-3">
                {staffSummary.map((s) => (
                  <MobileRowCard key={s.id}>
                    <p className="font-medium leading-snug">{s.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{roleDisplayLabel(s.role)}</p>
                    <div className="mt-3 grid grid-cols-5 gap-1 text-center text-xs">
                      <div>
                        <span className="text-muted-foreground">P</span>
                        <p className="font-semibold tabular-nums">{s.present}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">A</span>
                        <p className="font-semibold tabular-nums">{s.absent}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">L</span>
                        <p className="font-semibold tabular-nums">{s.late}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">H</span>
                        <p className="font-semibold tabular-nums">{s.halfDay}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Avg</span>
                        <p className="font-semibold tabular-nums">
                          {s.avgHours === "0" ? "—" : `${s.avgHours}h`}
                        </p>
                      </div>
                    </div>
                  </MobileRowCard>
                ))}
              </MobileCardList>
              <DesktopTableWrap>
                <table className="w-full caption-bottom border-collapse text-sm tabular-nums">
                  <caption className="sr-only">
                    Staff attendance counts for the rolling seven-day period ending on the selected date
                  </caption>
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th
                        scope="col"
                        className="text-left py-3 px-4 font-semibold text-foreground min-w-[140px]"
                      >
                        Staff
                      </th>
                      <th
                        scope="col"
                        className="text-left py-3 px-3 font-semibold text-foreground hidden sm:table-cell w-[120px]"
                      >
                        Role
                      </th>
                      <th scope="col" className="text-right py-3 px-3 font-semibold w-16">
                        P
                      </th>
                      <th scope="col" className="text-right py-3 px-3 font-semibold w-16">
                        A
                      </th>
                      <th scope="col" className="text-right py-3 px-3 font-semibold w-16">
                        L
                      </th>
                      <th scope="col" className="text-right py-3 px-3 font-semibold w-16">
                        H
                      </th>
                      <th scope="col" className="text-right py-3 pr-4 pl-3 font-semibold w-[5.5rem]">
                        Avg
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffSummary.map((s) => (
                      <tr
                        key={s.id}
                        className="border-b border-border/70 odd:bg-muted/15 hover:bg-muted/35 transition-colors"
                      >
                        <td className="py-3 px-4 align-middle font-medium text-foreground">
                          {s.name}
                          <span className="sm:hidden block text-xs font-normal text-muted-foreground mt-0.5">
                            {roleDisplayLabel(s.role)}
                          </span>
                        </td>
                        <td className="py-3 px-3 align-middle text-muted-foreground hidden sm:table-cell">
                          {roleDisplayLabel(s.role)}
                        </td>
                        <td className="py-3 px-3 text-right align-middle">{s.present}</td>
                        <td className="py-3 px-3 text-right align-middle">{s.absent}</td>
                        <td className="py-3 px-3 text-right align-middle">{s.late}</td>
                        <td className="py-3 px-3 text-right align-middle">{s.halfDay}</td>
                        <td className="py-3 pr-4 pl-3 text-right align-middle font-medium">
                          {s.avgHours === "0" ? "—" : `${s.avgHours}h`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DesktopTableWrap>
              <p className="text-xs text-muted-foreground px-4 py-3 border-t border-border bg-muted/20">
                P = Present · A = Absent · L = Late · H = Half day · Avg = mean hours when checked in (7-day window)
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly" className="space-y-4 sm:space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-border/80 bg-muted/20">
              <div className="space-y-1 min-w-0">
                <CardTitle className="text-base font-semibold">
                  Monthly Staff Attendance
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Full-month rollup with approved leave and branch scope
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-2 shrink-0">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-muted-foreground">Month</span>
                  <Select
                    value={String(monthlyMonth)}
                    onValueChange={(v) => setMonthlyMonth(Number(v))}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTH_OPTIONS.map((m) => (
                        <SelectItem key={m.v} value={String(m.v)}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-muted-foreground">Year</span>
                  <Select
                    value={String(monthlyYear)}
                    onValueChange={(v) => setMonthlyYear(Number(v))}
                  >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2024, 2025, 2026, 2027].map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={downloadMonthlyCsv}
                  disabled={monthlySummary.length === 0}
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <MobileCardList className="p-3">
                {monthlySummary.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No active staff for this period
                  </p>
                ) : (
                  monthlySummary.map((row) => (
                    <MobileRowCard key={row.staffId}>
                      <p className="font-medium leading-snug">{row.staffName}</p>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs sm:grid-cols-6">
                        <div>
                          <span className="text-muted-foreground">Present</span>
                          <p className="font-semibold tabular-nums">{row.presentDays}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Late</span>
                          <p className="font-semibold tabular-nums">{row.lateDays}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Half</span>
                          <p className="font-semibold tabular-nums">{row.halfDays}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Leave</span>
                          <p className="font-semibold tabular-nums">{row.leaveDays}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Absent</span>
                          <p className="font-semibold tabular-nums">{row.absentDays}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Avg hrs</span>
                          <p className="font-semibold tabular-nums">
                            {row.avgHours === 0 ? "—" : `${row.avgHours}h`}
                          </p>
                        </div>
                      </div>
                    </MobileRowCard>
                  ))
                )}
              </MobileCardList>
              <DesktopTableWrap>
                <table className="w-full caption-bottom border-collapse text-sm tabular-nums">
                  <caption className="sr-only">
                    Monthly staff attendance summary including leave and average hours
                  </caption>
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th
                        scope="col"
                        className="text-left py-3 px-4 font-semibold text-foreground min-w-[140px]"
                      >
                        Staff
                      </th>
                      <th scope="col" className="text-right py-3 px-3 font-semibold">
                        Present
                      </th>
                      <th scope="col" className="text-right py-3 px-3 font-semibold">
                        Late
                      </th>
                      <th scope="col" className="text-right py-3 px-3 font-semibold">
                        Half
                      </th>
                      <th scope="col" className="text-right py-3 px-3 font-semibold">
                        Leave
                      </th>
                      <th scope="col" className="text-right py-3 px-3 font-semibold">
                        Absent
                      </th>
                      <th scope="col" className="text-right py-3 pr-4 pl-3 font-semibold">
                        Avg hrs
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlySummary.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-8 text-center text-muted-foreground"
                        >
                          No active staff for this period
                        </td>
                      </tr>
                    ) : (
                      monthlySummary.map((row) => (
                        <tr
                          key={row.staffId}
                          className="border-b border-border/70 odd:bg-muted/15 hover:bg-muted/35 transition-colors"
                        >
                          <td className="py-3 px-4 align-middle font-medium text-foreground">
                            {row.staffName}
                          </td>
                          <td className="py-3 px-3 text-right align-middle">
                            {row.presentDays}
                          </td>
                          <td className="py-3 px-3 text-right align-middle">{row.lateDays}</td>
                          <td className="py-3 px-3 text-right align-middle">{row.halfDays}</td>
                          <td className="py-3 px-3 text-right align-middle">{row.leaveDays}</td>
                          <td className="py-3 px-3 text-right align-middle">
                            {row.absentDays}
                          </td>
                          <td className="py-3 pr-4 pl-3 text-right align-middle font-medium">
                            {row.avgHours === 0 ? "—" : `${row.avgHours}h`}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </DesktopTableWrap>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
