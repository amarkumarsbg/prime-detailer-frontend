"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  applyBranchFilters,
  resolveBranchScopeLabel,
  useBranchScope,
} from "@/lib/branch-scope";
import { roleDisplayLabel } from "@/lib/rbac";
import type { ExperienceBand, PayrollRecordStatus, SalaryStructure, UserRole } from "@/types";
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
} from "lucide-react";
import { toast } from "sonner";

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
  };
  return <Badge className={map[status]}>{status}</Badge>;
}

export default function PayrollPage() {
  const branches = useBranchStore((s) => s.branches);
  const { selectedBranchId, showBranchPicker, viewingLabel } = useBranchScope();
  const staff = useStaffStore((s) => s.staff);
  const salaryStructures = usePayrollStore((s) => s.salaryStructures);
  const payrollRecords = usePayrollStore((s) => s.payrollRecords);
  const generatePayroll = usePayrollStore((s) => s.generatePayroll);
  const recalculateAll = usePayrollStore((s) => s.recalculateAll);
  const setRecordStatus = usePayrollStore((s) => s.setRecordStatus);
  const upsertSalaryStructure = usePayrollStore((s) => s.upsertSalaryStructure);
  const removeSalaryStructure = usePayrollStore((s) => s.removeSalaryStructure);

  const today = new Date();
  const [viewDate, setViewDate] = useState(() => today.toISOString().slice(0, 10));
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState(today.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(today.getFullYear());
  const [statusFilter, setStatusFilter] = useState<PayrollRecordStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);

  const [structDialogOpen, setStructDialogOpen] = useState(false);
  const [editStructure, setEditStructure] = useState<SalaryStructure | null>(null);
  const [formRole, setFormRole] = useState<UserRole>("MECHANIC");
  const [formBand, setFormBand] = useState<ExperienceBand>("MID");
  const [formLabel, setFormLabel] = useState("");
  const [formBase, setFormBase] = useState("");
  const [formBonus, setFormBonus] = useState("");
  const [formAbsence, setFormAbsence] = useState("");

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
    return branchScopedRecords.filter((r) => {
      if (r.periodMonth !== filterMonth || r.periodYear !== filterYear) return false;
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (search.trim() && !r.employeeName.toLowerCase().includes(search.toLowerCase()))
        return false;
      return true;
    });
  }, [branchScopedRecords, filterMonth, filterYear, statusFilter, search]);

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

  const handleGenerate = () => {
    const n = generatePayroll({
      year: filterYear,
      month: filterMonth,
      staff,
      branchId: branchFilterId,
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Salary & Payroll"
        description="Manage staff salaries, bonuses, and disbursements. Configure pay rules by role and experience band."
      />

      <Card>
        <CardContent className="p-4 flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
            <div className="space-y-1.5 min-w-[160px]">
              <Label className="text-xs text-muted-foreground">Date</Label>
              <Input
                type="date"
                value={viewDate}
                onChange={(e) => setViewDate(e.target.value)}
                className="w-full"
              />
            </div>
            {showBranchPicker ? (
              <div className="space-y-1.5 min-w-[180px]">
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
            ) : (
              <div className="space-y-1.5 min-w-[180px]">
                <Label className="text-xs text-muted-foreground">Branch</Label>
                <p className="text-sm font-medium h-10 flex items-center">{viewingLabel}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" disabled>
                Compare
              </Button>
              <Button type="button" variant="secondary" size="sm" disabled>
                Full
              </Button>
            </div>
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
          <p className="text-xs text-muted-foreground">
            Showing: {viewLabel} &middot;{" "}
            {branchFilter === "all"
              ? "All branches"
              : branches.find((b) => b.id === branchFilter)?.name ?? branchFilter}
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="records" className="space-y-4">
        <TabsList>
          <TabsTrigger value="records">Payroll Records</TabsTrigger>
          <TabsTrigger value="structures">Salary Structures</TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-5 flex flex-col justify-center min-h-[120px]">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Gross earnings
                </p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-2xl font-bold tabular-nums">{formatCurrency(kpis.gross)}</p>
                  <TrendingUp className="w-8 h-8 text-emerald-500 opacity-90" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 flex flex-col justify-center min-h-[120px]">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Total deductions
                </p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-2xl font-bold tabular-nums">
                    {formatCurrency(kpis.deductions)}
                  </p>
                  <TrendingDown className="w-8 h-8 text-red-500 opacity-90" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 flex flex-col justify-center min-h-[120px]">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Net payout
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Total salary after additions and deductions
                </p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-2xl font-bold tabular-nums">{formatCurrency(kpis.net)}</p>
                  <Wallet className="w-8 h-8 text-blue-500 opacity-90" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 flex flex-col justify-center min-h-[120px]">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Disbursements
                </p>
                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Paid</span>
                    <span className="font-semibold tabular-nums">{formatCurrency(kpis.paid)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Pending</span>
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(kpis.pending)}
                    </span>
                  </div>
                </div>
                <CreditCard className="w-8 h-8 text-amber-500 opacity-90 mt-2 self-end" />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4 flex flex-col gap-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:flex-wrap">
                <div className="flex-1 min-w-[200px] space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Search records</Label>
                  <Input
                    placeholder="Search records…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
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
                <div className="flex flex-wrap gap-2 justify-end xl:ml-auto">
                  <Button type="button" variant="outline" onClick={() => recalculateAll()}>
                    <RotateCw className="w-4 h-4 mr-2" />
                    Recalculate All
                  </Button>
                  <Button type="button" onClick={handleGenerate}>
                    <Plus className="w-4 h-4 mr-2" />
                    Generate Payroll
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="px-4 py-3 border-b">
                <h2 className="text-sm font-semibold">
                  Payroll Records ({filteredRecords.length})
                </h2>
              </div>
              <div className="overflow-x-auto">
                {filteredRecords.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-16 px-4">
                    No payroll records found. Click &quot;Generate Payroll&quot; to create rows
                    from active staff and salary structures for the selected month.
                  </p>
                ) : (
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
                          <td className="px-3 py-3 align-middle text-right font-semibold tabular-nums">
                            {formatCurrency(r.netSalary)}
                          </td>
                          <td className="px-3 py-3 align-middle">{statusBadge(r.status)}</td>
                          <td className="px-3 py-3 align-middle text-right">
                            {r.status === "PENDING" && (
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
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
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
            <CardContent className="p-0 overflow-x-auto">
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
