"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { MobileFilterSheet } from "@/components/shared/mobile-filter-sheet";
import { KPICard } from "@/components/shared/kpi-card";
import {
  DesktopTableWrap,
  MobileCardList,
  MobileRowCard,
} from "@/components/shared/mobile-table-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useStaffStore } from "@/store/staff-store";
import { usePayrollStore } from "@/store/payroll-store";
import { useBranchStore } from "@/store/branch-store";
import { useAttendanceStore } from "@/store/attendance-store";
import { useLeaveStore } from "@/store/leave-store";
import { useStaffRewardStore } from "@/store/staff-reward-store";
import {
  applyBranchFilters,
  resolveBranchScopeLabel,
  useBranchScope,
} from "@/lib/branch-scope";
import { roleDisplayLabel } from "@/lib/rbac";
import type {
  ExperienceBand,
  PayrollRecord,
  PayrollRecordStatus,
  SalaryAdvance,
  SalaryStructure,
  UserRole,
} from "@/types";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  RotateCw,
  Plus,
  X,
  Pencil,
  Trash2,
  SlidersHorizontal,
  Search,
  Ban,
  CheckCircle2,
  ChevronDown,
  Check,
  Printer,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { useDashboardStoresReady } from "@/hooks/use-dashboard-stores-ready";
import { PageSkeleton, RefreshingBar } from "@/components/shared/skeleton-loader";

const MONTHS = [
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

const STATUS_OPTIONS: (PayrollRecordStatus | "ALL")[] = [
  "ALL",
  "PENDING",
  "PROCESSING",
  "PAID",
  "CANCELLED",
];

const ROLE_OPTIONS: UserRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "BRANCH_MANAGER",
  "MANAGER",
  "SUPERVISOR",
  "RECEPTIONIST",
  "MECHANIC",
];
const BAND_OPTIONS: ExperienceBand[] = ["ENTRY", "MID", "SENIOR", "LEAD"];

function statusBadge(status: PayrollRecordStatus) {
  const map: Record<PayrollRecordStatus, string> = {
    PENDING: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
    PROCESSING: "bg-blue-500/15 text-blue-800 dark:text-blue-300",
    PAID: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
    CANCELLED: "bg-rose-500/15 text-rose-800 dark:text-rose-300",
  };
  return <Badge className={map[status]}>{status}</Badge>;
}

export default function PayrollPage() {
  const storesReady = useDashboardStoresReady();
  const branches = useBranchStore((s) => s.branches);
  const { selectedBranchId, showBranchPicker, viewingLabel } = useBranchScope();
  const staff = useStaffStore((s) => s.staff);
  const attendanceRecords = useAttendanceStore((s) => s.records);
  const leaveRequests = useLeaveStore((s) => s.requests);
  const leaveTypes = useLeaveStore((s) => s.leaveTypes);
  const rewardLedger = useStaffRewardStore((s) => s.ledger);
  const salaryStructures = usePayrollStore((s) => s.salaryStructures);
  const payrollRecords = usePayrollStore((s) => s.payrollRecords);
  const salaryAdvances = usePayrollStore((s) => s.salaryAdvances);
  const generatePayroll = usePayrollStore((s) => s.generatePayroll);
  const recalculateAll = usePayrollStore((s) => s.recalculateAll);
  const setRecordStatus = usePayrollStore((s) => s.setRecordStatus);
  const addSalaryAdvance = usePayrollStore((s) => s.addSalaryAdvance);
  const cancelSalaryAdvance = usePayrollStore((s) => s.cancelSalaryAdvance);
  const closeSalaryAdvance = usePayrollStore((s) => s.closeSalaryAdvance);
  const deleteSalaryAdvance = usePayrollStore((s) => s.deleteSalaryAdvance);
  const upsertSalaryStructure = usePayrollStore((s) => s.upsertSalaryStructure);
  const removeSalaryStructure = usePayrollStore((s) => s.removeSalaryStructure);

  const today = new Date();
  const todayLocal = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [viewDate, setViewDate] = useState(() => todayLocal);
  const [activeTab, setActiveTab] = useState("records");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState(today.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(today.getFullYear());
  const [statusFilter, setStatusFilter] = useState<PayrollRecordStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [payslipRecord, setPayslipRecord] = useState<PayrollRecord | null>(null);

  const [structDialogOpen, setStructDialogOpen] = useState(false);
  const [editStructure, setEditStructure] = useState<SalaryStructure | null>(null);
  const [formRole, setFormRole] = useState<UserRole>("MECHANIC");
  const [formBand, setFormBand] = useState<ExperienceBand>("MID");
  const [formLabel, setFormLabel] = useState("");
  const [formBase, setFormBase] = useState("");
  const [formBonus, setFormBonus] = useState("");
  const [formAbsence, setFormAbsence] = useState("");
  const [recordsFilterOpen, setRecordsFilterOpen] = useState(false);
  const [advanceDialogOpen, setAdvanceDialogOpen] = useState(false);
  const [advanceEmployeeId, setAdvanceEmployeeId] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceMonthlyCap, setAdvanceMonthlyCap] = useState("");
  const [advanceDate, setAdvanceDate] = useState(() => today.toISOString().slice(0, 10));
  const [advanceNotes, setAdvanceNotes] = useState("");
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const todayMonth = today.getMonth() + 1;
  const todayYear = today.getFullYear();
  const recordsFilterCount = useMemo(() => {
    let n = 0;
    if (showBranchPicker && branchFilter !== "all") n += 1;
    if (filterMonth !== todayMonth) n += 1;
    if (filterYear !== todayYear) n += 1;
    if (statusFilter !== "ALL") n += 1;
    if (pageSize !== 10) n += 1;
    return n;
  }, [
    showBranchPicker,
    branchFilter,
    filterMonth,
    filterYear,
    statusFilter,
    pageSize,
    todayMonth,
    todayYear,
  ]);

  useEffect(() => {
    if (!showBranchPicker) {
      queueMicrotask(() => setBranchFilter("all"));
    }
  }, [showBranchPicker, selectedBranchId]);

  const branchScopedRecords = useMemo(
    () =>
      applyBranchFilters(
        payrollRecords,
        (r) => r.branchId,
        selectedBranchId,
        showBranchPicker,
        branchFilter
      ),
    [payrollRecords, selectedBranchId, showBranchPicker, branchFilter]
  );

  const branchScopeLabel = useMemo(
    () => resolveBranchScopeLabel(showBranchPicker, viewingLabel, branchFilter, branches),
    [showBranchPicker, viewingLabel, branchFilter, branches]
  );

  const branchFilterId =
    selectedBranchId ?? (branchFilter === "all" ? null : branchFilter);

  const filteredRecords = useMemo(() => {
    if (activeTab !== "records") return [];
    return branchScopedRecords.filter((r) => {
      if (r.periodMonth !== filterMonth || r.periodYear !== filterYear) return false;
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (search.trim() && !r.employeeName.toLowerCase().includes(search.toLowerCase()))
        return false;
      return true;
    });
  }, [branchScopedRecords, filterMonth, filterYear, statusFilter, search, activeTab]);

  const kpis = useMemo(() => {
    const gross = filteredRecords.reduce((s, r) => s + r.grossEarnings, 0);
    const deductions = filteredRecords.reduce((s, r) => s + r.totalDeductions, 0);
    const net = filteredRecords.reduce((s, r) => s + r.netSalary, 0);
    const paid = filteredRecords.filter((r) => r.status === "PAID").reduce((s, r) => s + r.netSalary, 0);
    const pending = filteredRecords
      .filter((r) => r.status !== "PAID")
      .reduce((s, r) => s + r.netSalary, 0);
    return { gross, deductions, net, paid, pending };
  }, [filteredRecords]);

  const pagedRecords = useMemo(
    () => filteredRecords.slice(0, pageSize),
    [filteredRecords, pageSize]
  );

  const resetFilters = () => {
    const n = new Date();
    setViewDate(n.toISOString().slice(0, 10));
    setBranchFilter("all");
    setFilterMonth(n.getMonth() + 1);
    setFilterYear(n.getFullYear());
    setStatusFilter("ALL");
    setSearch("");
    setPageSize(10);
  };

  const openNewStructure = () => {
    setEditStructure(null);
    setFormRole("MECHANIC");
    setFormBand("MID");
    setFormLabel("");
    setFormBase("");
    setFormBonus("");
    setFormAbsence("");
    setStructDialogOpen(true);
  };

  const openEditStructure = (s: SalaryStructure) => {
    setEditStructure(s);
    setFormRole(s.role);
    setFormBand(s.experienceBand);
    setFormLabel(s.label);
    setFormBase(String(s.baseSalary));
    setFormBonus(String(s.attendanceBonusPerDay));
    setFormAbsence(String(s.absenceDeductionPerDay));
    setStructDialogOpen(true);
  };

  const saveStructure = (e: React.FormEvent) => {
    e.preventDefault();
    const base = Number(formBase);
    const bonus = Number(formBonus);
    const abs = Number(formAbsence);
    if (!formLabel.trim() || [base, bonus, abs].some((n) => Number.isNaN(n) || n < 0)) {
      toast.error("Fill in label and valid non-negative numbers.");
      return;
    }
    const id = editStructure?.id ?? `ss-${Date.now()}`;
    upsertSalaryStructure({
      id,
      role: formRole,
      experienceBand: formBand,
      label: formLabel.trim(),
      baseSalary: base,
      attendanceBonusPerDay: bonus,
      absenceDeductionPerDay: abs,
    });
    toast.success(editStructure ? "Salary structure updated." : "Salary structure added.");
    setStructDialogOpen(false);
  };

  const branchScopedStructures = useMemo(() => {
    if (activeTab !== "structures") return [];
    return applyBranchFilters(
      salaryStructures,
      (s) => s.branchId,
      selectedBranchId,
      showBranchPicker,
      branchFilter
    );
  }, [salaryStructures, selectedBranchId, showBranchPicker, branchFilter, activeTab]);

  const branchScopedAdvances = useMemo(() => {
    if (activeTab !== "advances") return [];
    return applyBranchFilters(
      salaryAdvances,
      (a) => a.branchId,
      selectedBranchId,
      showBranchPicker,
      branchFilter
    );
  }, [salaryAdvances, selectedBranchId, showBranchPicker, branchFilter, activeTab]);

  const eligibleAdvanceStaff = useMemo(() => {
    return staff
      .filter((s) => s.isActive)
      .filter((s) => !branchFilterId || s.branchId === branchFilterId);
  }, [staff, branchFilterId]);

  const filteredAdvanceStaff = useMemo(() => {
    if (activeTab !== "advances") return [];
    const query = employeeSearch.trim().toLowerCase();
    if (!query) return eligibleAdvanceStaff;
    const digits = query.replace(/\D/g, "");
    return eligibleAdvanceStaff.filter((s) => {
      const nameMatch = s.name.toLowerCase().includes(query);
      const roleMatch = s.role.toLowerCase().includes(query);
      const phoneMatch = digits ? s.phone.replace(/\D/g, "").includes(digits) : false;
      return nameMatch || roleMatch || phoneMatch;
    });
  }, [eligibleAdvanceStaff, employeeSearch, activeTab]);

  const selectedAdvanceEmployee = useMemo(() => {
    return eligibleAdvanceStaff.find((s) => s.id === advanceEmployeeId) ?? null;
  }, [eligibleAdvanceStaff, advanceEmployeeId]);

  const saveAdvance = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(advanceAmount);
    const monthly = advanceMonthlyCap.trim() ? Number(advanceMonthlyCap) : undefined;
    if (!advanceEmployeeId || !advanceDate || !Number.isFinite(amount) || amount <= 0) {
      toast.error("Select employee, date and valid amount.");
      return;
    }
    if (monthly != null && (!Number.isFinite(monthly) || monthly <= 0)) {
      toast.error("Monthly deduction must be a positive number.");
      return;
    }
    const emp = staff.find((s) => s.id === advanceEmployeeId);
    if (!emp) {
      toast.error("Employee not found.");
      return;
    }
    addSalaryAdvance({
      employeeId: emp.id,
      employeeName: emp.name,
      branchId: emp.branchId,
      advanceAmount: amount,
      advanceDate,
      monthlyDeductionAmount: monthly,
      notes: advanceNotes,
    });
    toast.success("Salary advance recorded.");
    setAdvanceDialogOpen(false);
    setAdvanceEmployeeId("");
    setAdvanceAmount("");
    setAdvanceMonthlyCap("");
    setAdvanceNotes("");
    setEmployeeSearch("");
    setEmployeePickerOpen(false);
  };

  const handleGenerate = () => {
    const n = generatePayroll({
      year: filterYear,
      month: filterMonth,
      staff,
      branchId: branchFilterId,
      attendanceRecords,
      leaveRequests,
      leaveTypes,
      rewardLedger,
    });
    if (n === 0) {
      toast.message("No new records", {
        description:
          "Everyone already has a payroll row for this period, or no staff / structures match.",
      });
    } else {
      toast.success(`Generated ${n} payroll record(s).`);
    }
  };

  const viewLabel = `Today (${formatDate(viewDate)})`;

  if (!storesReady && staff.length === 0) return <PageSkeleton />;

  return (
    <div className="space-y-4 md:space-y-6">
      <RefreshingBar show={!storesReady} />
      <PageHeader
        title="Salary & Payroll"
        description="Manage staff salaries, bonuses, and disbursements. Configure pay rules by role and experience band."
        hideDescriptionOnMobile
        inlineActionsOnMobile
        actions={
          <Button
            type="button"
            size="sm"
            className="shrink-0 whitespace-nowrap"
            onClick={handleGenerate}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Generate Payroll
          </Button>
        }
      />

      <div className="space-y-1 md:hidden">
        <Input
          type="date"
          value={viewDate}
          onChange={(e) => setViewDate(e.target.value)}
          className="h-9 date-input-icon-end pr-9"
        />
        <p className="text-[11px] leading-tight text-muted-foreground">{viewLabel}</p>
      </div>

      <Card className="hidden md:block">
        <CardContent className="flex flex-col gap-2 p-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-end">
            <div className="min-w-[160px] space-y-1.5">
              <Label className="text-xs text-muted-foreground">Date</Label>
              <Input
                type="date"
                value={viewDate}
                onChange={(e) => setViewDate(e.target.value)}
                className="w-full date-input-icon-end pr-9"
              />
            </div>
            {showBranchPicker ? (
              <div className="min-w-[180px] space-y-1.5">
                <Label className="text-xs text-muted-foreground">Branch</Label>
                <Select value={branchFilter} onValueChange={setBranchFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Branch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="lg:ml-auto"
              onClick={resetFilters}
            >
              <X className="w-4 h-4 mr-1" />
              Reset
            </Button>
          </div>
          {showBranchPicker ? (
            <p className="text-xs text-muted-foreground">
              Showing: {viewLabel} &middot; {branchScopeLabel}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Showing: {viewLabel}</p>
          )}
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50 p-1 flex-wrap h-auto sm:h-9">
          <TabsTrigger value="records">Payroll Records</TabsTrigger>
          <TabsTrigger value="structures">Salary Structures</TabsTrigger>
          <TabsTrigger value="advances">Salary Advances</TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="flex flex-col gap-3 md:gap-4">
          <div className="order-1 space-y-2 md:order-3">
            <div className="flex flex-col gap-2 md:hidden">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search records…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 pl-9"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  variant={recordsFilterCount > 0 ? "default" : "outline"}
                  size="sm"
                  className="h-7 gap-1 rounded-full px-2.5 text-xs"
                  onClick={() => setRecordsFilterOpen(true)}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
                  Filters
                  {recordsFilterCount > 0 ? (
                    <span className="rounded-full bg-primary-foreground/20 px-1.5 text-[10px] font-semibold leading-none">
                      {recordsFilterCount}
                    </span>
                  ) : null}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 rounded-full px-2.5 text-xs"
                  onClick={() => recalculateAll()}
                >
                  <RotateCw className="h-3.5 w-3.5 shrink-0" />
                  Recalculate
                </Button>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="border-b px-4 py-2.5 md:py-3">
                  <h2 className="text-sm font-semibold">
                    Payroll Records{" "}
                    <span className="text-muted-foreground">({filteredRecords.length})</span>
                  </h2>
                </div>
                <>
                  {filteredRecords.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No payroll records found. Tap &quot;Generate Payroll&quot; to create rows
                      for the selected month.
                    </p>
                  ) : (
                    <>
                      <MobileCardList className="space-y-2 p-3 pb-20">
                        {pagedRecords.map((r) => (
                          <MobileRowCard key={r.id} className="p-3 shadow-none">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold leading-tight text-foreground">
                                {r.employeeName}
                              </p>
                              {statusBadge(r.status)}
                            </div>
                            <p className="mt-1 text-base font-bold tabular-nums">
                              {formatCurrency(r.netSalary)}
                            </p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              Base {formatCurrency(r.baseSalary)} · Absence{" "}
                              <span className="text-red-600/90">
                                {formatCurrency(r.absenceDeduction)}
                              </span>
                              {r.advanceDeductionPlanned > 0 || r.advanceDeductionFinalized > 0 ? (
                                <>
                                  {" "}· Advance {formatCurrency(
                                    r.status === "PAID" ? r.advanceDeductionFinalized : r.advanceDeductionPlanned
                                  )}
                                </>
                              ) : null}
                            </p>
                            <div className="mt-1.5 flex items-center justify-between gap-2">
                              <span className="text-[10px] text-muted-foreground">
                                {MONTHS.find((m) => m.v === r.periodMonth)?.label.slice(0, 3)}{" "}
                                {r.periodYear} · {r.attendanceDays} days
                              </span>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 shrink-0 px-2.5 text-xs"
                                  onClick={() => setPayslipRecord(r)}
                                >
                                  <FileText className="mr-1 h-3.5 w-3.5" />
                                  Payslip
                                </Button>
                                {r.status === "PENDING" ? (
                                  <>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-7 shrink-0 px-2.5 text-xs"
                                      onClick={() => {
                                        setRecordStatus(r.id, "PAID");
                                        toast.success("Marked as paid.");
                                      }}
                                    >
                                      Mark paid
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 shrink-0 px-2.5 text-xs text-rose-600"
                                      onClick={() => {
                                        setRecordStatus(r.id, "CANCELLED");
                                        toast.success("Record cancelled.");
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                  </>
                                ) : null}
                              </div>
                            </div>
                          </MobileRowCard>
                        ))}
                      </MobileCardList>
                  <DesktopTableWrap>
                  <table className="w-full min-w-[1000px] text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left">
                        <th className="px-3 py-3 font-semibold whitespace-nowrap">Employee</th>
                        <th className="px-3 py-3 font-semibold whitespace-nowrap">Period</th>
                        <th className="px-3 py-3 font-semibold whitespace-nowrap text-right">
                          Attendance
                        </th>
                        <th className="px-3 py-3 font-semibold whitespace-nowrap text-right">
                          Presence pay
                        </th>
                        <th className="px-3 py-3 font-semibold whitespace-nowrap text-right">
                          Base salary
                        </th>
                        <th className="px-3 py-3 font-semibold whitespace-nowrap text-right">
                          Absence ded.
                        </th>
                        <th className="px-3 py-3 font-semibold whitespace-nowrap text-right">
                          Advance ded.
                        </th>
                        <th className="px-3 py-3 font-semibold whitespace-nowrap text-right">
                          Net salary
                        </th>
                        <th className="px-3 py-3 font-semibold whitespace-nowrap">Status</th>
                        <th className="px-3 py-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedRecords.map((r, i) => (
                        <tr
                          key={r.id}
                          className={i % 2 ? "bg-muted/15 border-b border-border/50" : "border-b border-border/50"}
                        >
                          <td className="px-3 py-3 align-middle font-medium">{r.employeeName}</td>
                          <td className="px-3 py-3 align-middle text-muted-foreground whitespace-nowrap">
                            {MONTHS.find((m) => m.v === r.periodMonth)?.label.slice(0, 3)}{" "}
                            {r.periodYear}
                          </td>
                          <td className="px-3 py-3 align-middle text-right tabular-nums">
                            {r.attendanceDays}
                          </td>
                          <td className="px-3 py-3 align-middle text-right tabular-nums">
                            {formatCurrency(r.presencePayment)}
                          </td>
                          <td className="px-3 py-3 align-middle text-right tabular-nums">
                            {formatCurrency(r.baseSalary)}
                          </td>
                          <td className="px-3 py-3 align-middle text-right tabular-nums text-red-600/90">
                            {formatCurrency(r.absenceDeduction)}
                          </td>
                          <td className="px-3 py-3 align-middle text-right tabular-nums text-rose-600/90">
                            {formatCurrency(
                              r.status === "PAID" ? r.advanceDeductionFinalized : r.advanceDeductionPlanned
                            )}
                          </td>
                          <td className="px-3 py-3 align-middle text-right font-semibold tabular-nums">
                            {formatCurrency(r.netSalary)}
                          </td>
                          <td className="px-3 py-3 align-middle">{statusBadge(r.status)}</td>
                          <td className="px-3 py-3 align-middle text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setPayslipRecord(r)}
                            >
                              Payslip
                            </Button>
                            {(r.status === "PENDING" || r.status === "PROCESSING") && (
                              <>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setRecordStatus(r.id, "PAID");
                                    toast.success("Marked as paid.");
                                  }}
                                >
                                  Mark paid
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-rose-600"
                                  onClick={() => {
                                    setRecordStatus(r.id, "CANCELLED");
                                    toast.success("Record cancelled.");
                                  }}
                                >
                                  Cancel
                                </Button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </DesktopTableWrap>
                  </>
                )}
              </>
            </CardContent>
          </Card>
          </div>

          <div className="order-2 grid grid-cols-2 gap-2 md:order-1 xl:grid-cols-4 md:gap-3">
            <KPICard
              size="compact"
              title="Gross earnings"
              value={formatCurrency(kpis.gross)}
              icon={TrendingUp}
              tone="emerald"
              titleClassName="text-[11px] leading-tight sm:text-xs"
              valueClassName="text-sm leading-tight tabular-nums sm:text-lg md:text-xl"
            />
            <KPICard
              size="compact"
              title="Total deductions"
              value={formatCurrency(kpis.deductions)}
              icon={TrendingDown}
              tone="rose"
              titleClassName="text-[11px] leading-tight sm:text-xs"
              valueClassName="text-sm leading-tight tabular-nums sm:text-lg md:text-xl"
            />
            <KPICard
              size="compact"
              title="Net payout"
              value={formatCurrency(kpis.net)}
              subtitle="After deductions"
              icon={Wallet}
              tone="blue"
              titleClassName="text-[11px] leading-tight sm:text-xs"
              valueClassName="text-sm leading-tight tabular-nums sm:text-lg md:text-xl"
            />
            <KPICard
              size="compact"
              title="Disbursements"
              value={formatCurrency(kpis.paid)}
              subtitle={`Pending ${formatCurrency(kpis.pending)}`}
              icon={CreditCard}
              tone="amber"
              titleClassName="text-[11px] leading-tight sm:text-xs"
              valueClassName="text-sm leading-tight tabular-nums sm:text-lg md:text-xl"
            />
          </div>

          <Card className="order-3 hidden md:order-2 md:block">
            <CardContent className="flex flex-col gap-3 p-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-end">
                <div className="min-w-[200px] flex-1 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Search records</Label>
                  <Input
                    placeholder="Search records…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Month</Label>
                    <Select
                      value={String(filterMonth)}
                      onValueChange={(v) => setFilterMonth(Number(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((m) => (
                          <SelectItem key={m.v} value={String(m.v)}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Year</Label>
                    <Select
                      value={String(filterYear)}
                      onValueChange={(v) => setFilterYear(Number(v))}
                    >
                      <SelectTrigger>
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
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Select
                      value={statusFilter}
                      onValueChange={(v) => setStatusFilter(v as PayrollRecordStatus | "ALL")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s === "ALL" ? "All status" : s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Show</Label>
                    <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[10, 25, 50].map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n} records
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2 xl:ml-auto">
                  <Button type="button" variant="outline" onClick={() => recalculateAll()}>
                    <RotateCw className="mr-2 h-4 w-4" />
                    Recalculate All
                  </Button>
                  <Button type="button" onClick={handleGenerate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Generate Payroll
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="structures" className="space-y-4">
          <div className="flex justify-end">
            <Button type="button" onClick={openNewStructure}>
              <Plus className="w-4 h-4 mr-2" />
              Add structure
            </Button>
          </div>
          <Dialog open={structDialogOpen} onOpenChange={setStructDialogOpen}>
            <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editStructure ? "Edit salary structure" : "New salary structure"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={saveStructure} className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Role</Label>
                      <Select value={formRole} onValueChange={(v) => setFormRole(v as UserRole)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((r) => (
                            <SelectItem key={r} value={r}>
                              {roleDisplayLabel(r)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Experience band</Label>
                      <Select
                        value={formBand}
                        onValueChange={(v) => setFormBand(v as ExperienceBand)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BAND_OPTIONS.map((b) => (
                            <SelectItem key={b} value={b}>
                              {b.charAt(0) + b.slice(1).toLowerCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Label</Label>
                    <Input
                      value={formLabel}
                      onChange={(e) => setFormLabel(e.target.value)}
                      placeholder="e.g. Mechanic · Senior"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label>Base salary (₹)</Label>
                      <Input
                        inputMode="numeric"
                        value={formBase}
                        onChange={(e) => setFormBase(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Bonus / day (₹)</Label>
                      <Input
                        inputMode="numeric"
                        value={formBonus}
                        onChange={(e) => setFormBonus(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Absence ded. / day (₹)</Label>
                      <Input
                        inputMode="numeric"
                        value={formAbsence}
                        onChange={(e) => setFormAbsence(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full">
                    Save structure
                  </Button>
                </form>
            </DialogContent>
          </Dialog>

          <Card>
            <CardContent className="p-0">
              <MobileCardList className="p-3">
                {salaryStructures.map((s) => (
                  <MobileRowCard key={s.id}>
                    <p className="font-medium leading-snug">{s.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {roleDisplayLabel(s.role)} · {s.experienceBand}
                    </p>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Base</span>
                        <p className="font-semibold tabular-nums">{formatCurrency(s.baseSalary)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Bonus/day</span>
                        <p className="font-semibold tabular-nums">{formatCurrency(s.attendanceBonusPerDay)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Absence/day</span>
                        <p className="font-semibold tabular-nums">{formatCurrency(s.absenceDeductionPerDay)}</p>
                      </div>
                    </div>
                  </MobileRowCard>
                ))}
              </MobileCardList>
              <DesktopTableWrap>
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="px-3 py-3 font-semibold">Label</th>
                    <th className="px-3 py-3 font-semibold">Role</th>
                    <th className="px-3 py-3 font-semibold">Band</th>
                    <th className="px-3 py-3 font-semibold text-right">Base</th>
                    <th className="px-3 py-3 font-semibold text-right">Bonus/day</th>
                    <th className="px-3 py-3 font-semibold text-right">Absence/day</th>
                    <th className="px-3 py-3 font-semibold text-right w-28">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {salaryStructures.map((s, i) => (
                    <tr
                      key={s.id}
                      className={
                        i % 2 ? "bg-muted/15 border-b border-border/50" : "border-b border-border/50"
                      }
                    >
                      <td className="px-3 py-3 align-middle font-medium">{s.label}</td>
                      <td className="px-3 py-3 align-middle">{roleDisplayLabel(s.role)}</td>
                      <td className="px-3 py-3 align-middle text-muted-foreground">{s.experienceBand}</td>
                      <td className="px-3 py-3 align-middle text-right tabular-nums">
                        {formatCurrency(s.baseSalary)}
                      </td>
                      <td className="px-3 py-3 align-middle text-right tabular-nums">
                        {formatCurrency(s.attendanceBonusPerDay)}
                      </td>
                      <td className="px-3 py-3 align-middle text-right tabular-nums">
                        {formatCurrency(s.absenceDeductionPerDay)}
                      </td>
                      <td className="px-3 py-3 align-middle text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditStructure(s)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => {
                            removeSalaryStructure(s.id);
                            toast.success("Structure removed.");
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </DesktopTableWrap>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advances" className="space-y-4">
          <div className="flex justify-end">
            <Button type="button" onClick={() => setAdvanceDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Record Advance
            </Button>
          </div>

          <Dialog open={advanceDialogOpen} onOpenChange={setAdvanceDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New salary advance</DialogTitle>
              </DialogHeader>
              <form onSubmit={saveAdvance} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label>Employee</Label>
                  <Popover open={employeePickerOpen} onOpenChange={setEmployeePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 w-full justify-between px-3 font-normal"
                      >
                        <span className="truncate text-left">
                          {selectedAdvanceEmployee
                            ? `${selectedAdvanceEmployee.name} (${selectedAdvanceEmployee.phone})`
                            : "Select employee"}
                        </span>
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <div className="flex items-center border-b border-border px-3">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <input
                          placeholder="Search by name, phone, or role..."
                          value={employeeSearch}
                          onChange={(e) => setEmployeeSearch(e.target.value)}
                          className="flex h-10 w-full rounded-md bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
                        />
                      </div>
                      <div className="max-h-64 overflow-y-auto p-1" onWheel={(e) => e.stopPropagation()}>
                        {filteredAdvanceStaff.length === 0 ? (
                          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                            No employee found.
                          </div>
                        ) : (
                          filteredAdvanceStaff.slice(0, 75).map((s) => {
                            const active = s.id === advanceEmployeeId;
                            return (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => {
                                  setAdvanceEmployeeId(s.id);
                                  setEmployeePickerOpen(false);
                                  setEmployeeSearch("");
                                }}
                                className={`flex w-full items-start gap-2 rounded-sm px-2.5 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground ${
                                  active ? "bg-accent text-accent-foreground" : ""
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="truncate font-medium">{s.name}</div>
                                  <div className="truncate text-xs text-muted-foreground">
                                    {s.phone} · {roleDisplayLabel(s.role)}
                                  </div>
                                </div>
                                {active ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : null}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Advance amount (Rs.)</Label>
                    <Input
                      inputMode="decimal"
                      value={advanceAmount}
                      onChange={(e) => setAdvanceAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Advance date</Label>
                    <Input
                      type="date"
                      value={advanceDate}
                      onChange={(e) => setAdvanceDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Monthly deduction cap (optional)</Label>
                  <Input
                    inputMode="decimal"
                    value={advanceMonthlyCap}
                    onChange={(e) => setAdvanceMonthlyCap(e.target.value)}
                    placeholder="Leave empty for full recovery"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Notes (optional)</Label>
                  <Input value={advanceNotes} onChange={(e) => setAdvanceNotes(e.target.value)} />
                </div>
                <Button type="submit" className="w-full">
                  Save advance
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Card>
            <CardContent className="p-0">
              {branchScopedAdvances.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No salary advances found.
                </p>
              ) : (
                <>
                  <MobileCardList className="p-3">
                    {branchScopedAdvances.map((a: SalaryAdvance) => (
                      <MobileRowCard key={a.id}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold leading-tight">{a.employeeName}</p>
                          <Badge
                            className={
                              a.status === "CLOSED"
                                ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                                : a.status === "CANCELLED"
                                  ? "bg-rose-500/15 text-rose-800 dark:text-rose-300"
                                  : "bg-blue-500/15 text-blue-800 dark:text-blue-300"
                            }
                          >
                            {a.status}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Advance {formatCurrency(a.advanceAmount)} · Recovered {formatCurrency(a.recoveredAmount)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Remaining {formatCurrency(a.remainingAmount)}
                          {a.monthlyDeductionAmount ? ` · Monthly cap ${formatCurrency(a.monthlyDeductionAmount)}` : ""}
                        </p>
                        <div className="mt-2 flex gap-2">
                          {a.status !== "CANCELLED" && a.status !== "CLOSED" ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => {
                                cancelSalaryAdvance(a.id, "Cancelled by admin");
                                toast.success("Advance cancelled.");
                              }}
                            >
                              <Ban className="w-3.5 h-3.5 mr-1" />
                              Cancel
                            </Button>
                          ) : null}
                          {a.status !== "CLOSED" && a.status !== "CANCELLED" ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => {
                                closeSalaryAdvance(a.id, "Closed by admin");
                                toast.success("Advance closed.");
                              }}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                              Close
                            </Button>
                          ) : null}
                          {a.recoveredAmount <= 0 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-destructive"
                              onClick={() => {
                                const ok = deleteSalaryAdvance(a.id);
                                if (!ok) {
                                  toast.error("Cannot delete recovered or linked advance.");
                                  return;
                                }
                                toast.success("Advance deleted.");
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1" />
                              Delete
                            </Button>
                          ) : null}
                        </div>
                      </MobileRowCard>
                    ))}
                  </MobileCardList>

                  <DesktopTableWrap>
                    <table className="w-full min-w-[980px] text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40 text-left">
                          <th className="px-3 py-3 font-semibold">Employee</th>
                          <th className="px-3 py-3 font-semibold whitespace-nowrap text-right">Advance</th>
                          <th className="px-3 py-3 font-semibold whitespace-nowrap text-right">Recovered</th>
                          <th className="px-3 py-3 font-semibold whitespace-nowrap text-right">Remaining</th>
                          <th className="px-3 py-3 font-semibold whitespace-nowrap text-right">Monthly cap</th>
                          <th className="px-3 py-3 font-semibold">Date</th>
                          <th className="px-3 py-3 font-semibold">Status</th>
                          <th className="px-3 py-3 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {branchScopedAdvances.map((a, i) => (
                          <tr
                            key={a.id}
                            className={
                              i % 2
                                ? "bg-muted/15 border-b border-border/50"
                                : "border-b border-border/50"
                            }
                          >
                            <td className="px-3 py-3 align-middle font-medium">{a.employeeName}</td>
                            <td className="px-3 py-3 align-middle text-right tabular-nums">
                              {formatCurrency(a.advanceAmount)}
                            </td>
                            <td className="px-3 py-3 align-middle text-right tabular-nums">
                              {formatCurrency(a.recoveredAmount)}
                            </td>
                            <td className="px-3 py-3 align-middle text-right tabular-nums">
                              {formatCurrency(a.remainingAmount)}
                            </td>
                            <td className="px-3 py-3 align-middle text-right tabular-nums">
                              {a.monthlyDeductionAmount
                                ? formatCurrency(a.monthlyDeductionAmount)
                                : "-"}
                            </td>
                            <td className="px-3 py-3 align-middle text-muted-foreground">
                              {formatDate(a.advanceDate)}
                            </td>
                            <td className="px-3 py-3 align-middle">
                              <Badge
                                className={
                                  a.status === "CLOSED"
                                    ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                                    : a.status === "CANCELLED"
                                      ? "bg-rose-500/15 text-rose-800 dark:text-rose-300"
                                      : "bg-blue-500/15 text-blue-800 dark:text-blue-300"
                                }
                              >
                                {a.status}
                              </Badge>
                            </td>
                            <td className="px-3 py-3 align-middle text-right">
                              {a.status !== "CANCELLED" && a.status !== "CLOSED" ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-rose-600"
                                  onClick={() => {
                                    cancelSalaryAdvance(a.id, "Cancelled by admin");
                                    toast.success("Advance cancelled.");
                                  }}
                                >
                                  Cancel
                                </Button>
                              ) : null}
                              {a.status !== "CLOSED" && a.status !== "CANCELLED" ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    closeSalaryAdvance(a.id, "Closed by admin");
                                    toast.success("Advance closed.");
                                  }}
                                >
                                  Close
                                </Button>
                              ) : null}
                              {a.recoveredAmount <= 0 ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive"
                                  onClick={() => {
                                    const ok = deleteSalaryAdvance(a.id);
                                    if (!ok) {
                                      toast.error("Cannot delete recovered or linked advance.");
                                      return;
                                    }
                                    toast.success("Advance deleted.");
                                  }}
                                >
                                  Delete
                                </Button>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </DesktopTableWrap>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <MobileFilterSheet
        open={recordsFilterOpen}
        onOpenChange={setRecordsFilterOpen}
        title="Payroll filters"
        activeCount={recordsFilterCount}
        onReset={() => {
          if (showBranchPicker) setBranchFilter("all");
          setFilterMonth(todayMonth);
          setFilterYear(todayYear);
          setStatusFilter("ALL");
          setPageSize(10);
        }}
      >
        {showBranchPicker ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Branch</p>
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="h-10 w-full bg-background">
                <SelectValue placeholder="Branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <p className="text-sm font-medium">Month</p>
            <Select value={String(filterMonth)} onValueChange={(v) => setFilterMonth(Number(v))}>
              <SelectTrigger className="h-10 w-full bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m.v} value={String(m.v)}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Year</p>
            <Select value={String(filterYear)} onValueChange={(v) => setFilterYear(Number(v))}>
              <SelectTrigger className="h-10 w-full bg-background">
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
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Status</p>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as PayrollRecordStatus | "ALL")}
          >
            <SelectTrigger className="h-10 w-full bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "ALL" ? "All status" : s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Page size</p>
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
            <SelectTrigger className="h-10 w-full bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 25, 50].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} records
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </MobileFilterSheet>

      <Dialog open={!!payslipRecord} onOpenChange={(open) => !open && setPayslipRecord(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader className="no-print">
            <DialogTitle>Payslip</DialogTitle>
          </DialogHeader>
          {payslipRecord ? (
            <div className="payslip-print space-y-3 text-sm">
              <div>
                <p className="text-lg font-semibold">{payslipRecord.employeeName}</p>
                <p className="text-muted-foreground">
                  {MONTHS.find((m) => m.v === payslipRecord.periodMonth)?.label}{" "}
                  {payslipRecord.periodYear}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                <dt className="text-muted-foreground">Attendance days</dt>
                <dd className="text-right tabular-nums font-medium">
                  {payslipRecord.attendanceDays}
                </dd>
                <dt className="text-muted-foreground">Paid leave</dt>
                <dd className="text-right tabular-nums">
                  {payslipRecord.paidLeaveDays ?? 0}
                </dd>
                <dt className="text-muted-foreground">Unpaid leave</dt>
                <dd className="text-right tabular-nums">
                  {payslipRecord.unpaidLeaveDays ?? 0}
                </dd>
                <dt className="text-muted-foreground">Base salary</dt>
                <dd className="text-right tabular-nums">
                  {formatCurrency(payslipRecord.baseSalary)}
                </dd>
                <dt className="text-muted-foreground">Presence pay</dt>
                <dd className="text-right tabular-nums">
                  {formatCurrency(payslipRecord.presencePayment)}
                </dd>
                <dt className="text-muted-foreground">Absence deduction</dt>
                <dd className="text-right tabular-nums text-red-600/90">
                  {formatCurrency(payslipRecord.absenceDeduction)}
                </dd>
                <dt className="text-muted-foreground">Rewards</dt>
                <dd className="text-right tabular-nums">
                  {formatCurrency(payslipRecord.rewardAmount ?? 0)}
                </dd>
                <dt className="text-muted-foreground">Advance deduction</dt>
                <dd className="text-right tabular-nums text-rose-600/90">
                  {formatCurrency(
                    payslipRecord.status === "PAID"
                      ? payslipRecord.advanceDeductionFinalized
                      : payslipRecord.advanceDeductionPlanned
                  )}
                </dd>
                <dt className="border-t pt-2 font-semibold">Net salary</dt>
                <dd className="border-t pt-2 text-right tabular-nums font-semibold">
                  {formatCurrency(payslipRecord.netSalary)}
                </dd>
              </dl>
              <div className="no-print flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setPayslipRecord(null)}>
                  Close
                </Button>
                <Button type="button" onClick={() => window.print()}>
                  <Printer className="mr-1.5 h-4 w-4" />
                  Print
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .payslip-print,
          .payslip-print * {
            visibility: visible !important;
          }
          .payslip-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 24px;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
