"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { KPICard } from "@/components/shared/kpi-card";
import {
  DesktopTableWrap,
  MobileCardList,
  MobileRowCard,
} from "@/components/shared/mobile-table-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  applyBranchFilters,
  resolveBranchScopeLabel,
  useBranchScope,
} from "@/lib/branch-scope";
import { pushActivityLog } from "@/lib/activity-log-helper";
import { canManageStaffUsers, userHasPermission } from "@/lib/rbac";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { useBranchStore } from "@/store/branch-store";
import { useStaffRewardStore } from "@/store/staff-reward-store";
import { useStaffStore } from "@/store/staff-store";
import type {
  StaffRewardLedgerStatus,
  StaffRewardMode,
  StaffTarget,
  StaffTargetMetric,
} from "@/types";
import {
  Ban,
  Check,
  Gift,
  Plus,
  Settings2,
  Target,
  Trash2,
  Wallet,
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

const STATUS_CLASS: Record<StaffRewardLedgerStatus, string> = {
  PENDING:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  APPROVED:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  PAID_IN_PAYROLL:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  CANCELLED: "bg-muted text-muted-foreground",
};

const METRIC_OPTIONS: { value: StaffTargetMetric; label: string }[] = [
  { value: "JOBS_COMPLETED", label: "Jobs completed" },
  { value: "REVENUE", label: "Revenue" },
  { value: "INCENTIVE", label: "Incentive / rewards" },
];

export default function RewardsPage() {
  const authUser = useAuthStore((s) => s.user);
  const branches = useBranchStore((s) => s.branches);
  const staff = useStaffStore((s) => s.staff);
  const settings = useStaffRewardStore((s) => s.settings);
  const ledger = useStaffRewardStore((s) => s.ledger);
  const targets = useStaffRewardStore((s) => s.targets);
  const updateSettings = useStaffRewardStore((s) => s.updateSettings);
  const addManualEntry = useStaffRewardStore((s) => s.addManualEntry);
  const approveEntry = useStaffRewardStore((s) => s.approveEntry);
  const cancelEntry = useStaffRewardStore((s) => s.cancelEntry);
  const upsertTarget = useStaffRewardStore((s) => s.upsertTarget);
  const removeTarget = useStaffRewardStore((s) => s.removeTarget);

  const { selectedBranchId, showBranchPicker, viewingLabel } = useBranchScope();
  const canManage = canManageStaffUsers(authUser?.role);
  const canAccess =
    canManage || userHasPermission(authUser, "STAFF_REWARDS");

  const today = new Date();
  const [pageBranchFilter, setPageBranchFilter] = useState("all");
  const [filterMonth, setFilterMonth] = useState(today.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(today.getFullYear());
  const [staffFilter, setStaffFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StaffRewardLedgerStatus | "ALL">(
    "ALL"
  );

  const [manualOpen, setManualOpen] = useState(false);
  const [manualStaffId, setManualStaffId] = useState("");
  const [manualKind, setManualKind] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [manualAmount, setManualAmount] = useState("");
  const [manualReason, setManualReason] = useState("");

  const emptyTiers = () => [
    { targetAmount: 0, rewardPercent: 0 },
    { targetAmount: 0, rewardPercent: 0 },
    { targetAmount: 0, rewardPercent: 0 },
    { targetAmount: 0, rewardPercent: 0 },
  ];

  const getMigratedSettings = (rawSettings: typeof settings) => {
    const currentPeriod = rawSettings.companyTargetPeriod || "MONTHLY";
    const loadedFreqTiers = rawSettings.companyTargetFrequencyTiers || {} as any;
    const legacyTiers = rawSettings.companyTargetTiers || [];

    const migratedFrequencyTiers = {
      MONTHLY: loadedFreqTiers.MONTHLY || (currentPeriod === "MONTHLY" && legacyTiers.length > 0 ? legacyTiers : null) || emptyTiers(),
      QUARTERLY: loadedFreqTiers.QUARTERLY || (currentPeriod === "QUARTERLY" && legacyTiers.length > 0 ? legacyTiers : null) || emptyTiers(),
      HALF_YEARLY: loadedFreqTiers.HALF_YEARLY || (currentPeriod === "HALF_YEARLY" && legacyTiers.length > 0 ? legacyTiers : null) || emptyTiers(),
      YEARLY: loadedFreqTiers.YEARLY || (currentPeriod === "YEARLY" && legacyTiers.length > 0 ? legacyTiers : null) || emptyTiers(),
    };

    return {
      ...rawSettings,
      companyTargetFrequencyTiers: migratedFrequencyTiers,
    };
  };

  const [settingsDraft, setSettingsDraft] = useState(() => getMigratedSettings(settings));
  const [settingsDirty, setSettingsDirty] = useState(false);

  useEffect(() => {
    if (!settingsDirty) {
      setSettingsDraft(getMigratedSettings(settings));
    }
  }, [settings, settingsDirty]);

  const [targetOpen, setTargetOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<StaffTarget | null>(null);
  const [targetStaffId, setTargetStaffId] = useState("");
  const [targetMonth, setTargetMonth] = useState(today.getMonth() + 1);
  const [targetYear, setTargetYear] = useState(today.getFullYear());
  const [targetMetric, setTargetMetric] =
    useState<StaffTargetMetric>("JOBS_COMPLETED");
  const [targetValue, setTargetValue] = useState("");
  const [targetNotes, setTargetNotes] = useState("");

  const branchScopeLabel = useMemo(
    () =>
      resolveBranchScopeLabel(
        showBranchPicker,
        viewingLabel,
        pageBranchFilter,
        branches
      ),
    [showBranchPicker, viewingLabel, pageBranchFilter, branches]
  );

  const scopedStaff = useMemo(
    () =>
      applyBranchFilters(
        staff,
        (u) => u.branchId,
        selectedBranchId,
        showBranchPicker,
        pageBranchFilter
      ).filter((s) => s.isActive),
    [staff, selectedBranchId, showBranchPicker, pageBranchFilter]
  );

  const scopedLedger = useMemo(() => {
    let list = applyBranchFilters(
      ledger,
      (e) => e.branchId,
      selectedBranchId,
      showBranchPicker,
      pageBranchFilter
    );
    list = list.filter(
      (e) => e.periodMonth === filterMonth && e.periodYear === filterYear
    );
    if (staffFilter !== "all") {
      list = list.filter((e) => e.staffId === staffFilter);
    }
    if (statusFilter !== "ALL") {
      list = list.filter((e) => e.status === statusFilter);
    }
    return list;
  }, [
    ledger,
    selectedBranchId,
    showBranchPicker,
    pageBranchFilter,
    filterMonth,
    filterYear,
    staffFilter,
    statusFilter,
  ]);

  const scopedTargets = useMemo(() => {
    let list = applyBranchFilters(
      targets,
      (t) => t.branchId,
      selectedBranchId,
      showBranchPicker,
      pageBranchFilter
    );
    return list.filter(
      (t) => t.periodMonth === filterMonth && t.periodYear === filterYear
    );
  }, [
    targets,
    selectedBranchId,
    showBranchPicker,
    pageBranchFilter,
    filterMonth,
    filterYear,
  ]);

  const kpis = useMemo(() => {
    const pending = scopedLedger.filter((e) => e.status === "PENDING").length;
    const approved = scopedLedger.filter((e) => e.status === "APPROVED").length;
    const total = scopedLedger
      .filter((e) => e.status !== "CANCELLED")
      .reduce((s, e) => s + e.amount, 0);
    return { pending, approved, total, count: scopedLedger.length };
  }, [scopedLedger]);

  if (!canAccess) {
    return (
      <div className="space-y-6">
        <PageHeader title="Staff Rewards" />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            You do not have permission to view staff rewards.
          </CardContent>
        </Card>
      </div>
    );
  }

  const openManual = () => {
    setManualStaffId(scopedStaff[0]?.id ?? "");
    setManualKind("CREDIT");
    setManualAmount("");
    setManualReason("");
    setManualOpen(true);
  };

  const handleManual = () => {
    const member = staff.find((s) => s.id === manualStaffId);
    if (!member) {
      toast.error("Select a staff member.");
      return;
    }
    const amount = Number(manualAmount);
    const result = addManualEntry({
      staffId: member.id,
      staffName: member.name,
      branchId: member.branchId,
      amount,
      kind: manualKind,
      reason: manualReason,
      periodMonth: filterMonth,
      periodYear: filterYear,
      createdById: authUser?.id,
      createdByName: authUser?.name,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    pushActivityLog({
      action: manualKind === "CREDIT" ? "WALLET_CREDITED" : "WALLET_DEBITED",
      entityType: "STAFF_REWARD",
      entityId: result.entry?.id ?? member.id,
      entityLabel: `${member.name} reward`,
      details: `Manual ${manualKind.toLowerCase()} ${formatCurrency(Math.abs(amount))}: ${manualReason.trim()}`,
    });
    toast.success("Ledger entry added.");
    setManualOpen(false);
  };

  const handleApprove = (entryId: string) => {
    const result = approveEntry(entryId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    pushActivityLog({
      action: "UPDATED",
      entityType: "STAFF_REWARD",
      entityId: entryId,
      entityLabel: result.entry?.staffName ?? "Reward",
      details: `Approved ${formatCurrency(result.entry?.amount ?? 0)} (${result.entry?.rewardType})`,
    });
    toast.success("Reward approved.");
  };

  const handleCancel = (entryId: string) => {
    const result = cancelEntry(entryId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    pushActivityLog({
      action: "CANCELLED",
      entityType: "STAFF_REWARD",
      entityId: entryId,
      entityLabel: result.entry?.staffName ?? "Reward",
      details: `Cancelled reward entry ${formatCurrency(result.entry?.amount ?? 0)}`,
    });
    toast.success("Entry cancelled.");
  };



  const syncSettingsDraft = () => {
    setSettingsDraft(getMigratedSettings(settings));
    setSettingsDirty(false);
  };

  const patchSettingsDraft = <K extends keyof typeof settings>(
    key: K,
    value: (typeof settings)[K]
  ) => {
    setSettingsDraft((prev) => ({ ...prev, [key]: value }));
    setSettingsDirty(true);
  };

  const patchCompanyTargetTier = (
    index: number,
    field: "targetAmount" | "rewardPercent",
    value: number
  ) => {
    const currentPeriod = settingsDraft.companyTargetPeriod || "MONTHLY";
    const copyAll = { ...(settingsDraft.companyTargetFrequencyTiers || {}) as any };
    const copyTiers = [...(copyAll[currentPeriod] || emptyTiers())];
    if (!copyTiers[index]) {
      copyTiers[index] = { targetAmount: 0, rewardPercent: 0 };
    }
    copyTiers[index] = {
      ...copyTiers[index],
      [field]: value,
    };
    copyAll[currentPeriod] = copyTiers;
    patchSettingsDraft("companyTargetFrequencyTiers", copyAll);
  };

  const handleSaveSettings = () => {
    const currentPeriod = settingsDraft.companyTargetPeriod || "MONTHLY";
    const currentTiers = (settingsDraft.companyTargetFrequencyTiers || {} as any)[currentPeriod] || [];
    updateSettings({
      rewardMode: settingsDraft.rewardMode,
      defaultPercent: settingsDraft.defaultPercent,
      defaultFixedAmount: settingsDraft.defaultFixedAmount,
      tiersEnabled: settingsDraft.tiersEnabled,
      timeBonusEnabled: settingsDraft.timeBonusEnabled,
      timeBonusMinutesThreshold: settingsDraft.timeBonusMinutesThreshold,
      timeBonusPercent: settingsDraft.timeBonusPercent,
      lateDeductionEnabled: settingsDraft.lateDeductionEnabled,
      lateDeductionPercent: settingsDraft.lateDeductionPercent,
      supervisorSharePercent: settingsDraft.supervisorSharePercent,
      applicatorSharePercent: settingsDraft.applicatorSharePercent,
      companyTargetEnabled: settingsDraft.companyTargetEnabled,
      companyTargetRevenueType: settingsDraft.companyTargetRevenueType,
      companyTargetPeriod: settingsDraft.companyTargetPeriod,
      companyTargetTiers: currentTiers,
      companyTargetFrequencyTiers: settingsDraft.companyTargetFrequencyTiers,
    });
    setSettingsDirty(false);
    toast.success("Reward settings saved.");
  };

  const openTarget = (existing?: StaffTarget) => {
    if (existing) {
      setEditingTarget(existing);
      setTargetStaffId(existing.staffId);
      setTargetMonth(existing.periodMonth);
      setTargetYear(existing.periodYear);
      setTargetMetric(existing.metric);
      setTargetValue(String(existing.targetValue));
      setTargetNotes(existing.notes ?? "");
    } else {
      setEditingTarget(null);
      setTargetStaffId(scopedStaff[0]?.id ?? "");
      setTargetMonth(filterMonth);
      setTargetYear(filterYear);
      setTargetMetric("JOBS_COMPLETED");
      setTargetValue("");
      setTargetNotes("");
    }
    setTargetOpen(true);
  };

  const handleSaveTarget = () => {
    const member = staff.find((s) => s.id === targetStaffId);
    if (!member) {
      toast.error("Select a staff member.");
      return;
    }
    const result = upsertTarget({
      id: editingTarget?.id,
      staffId: member.id,
      staffName: member.name,
      branchId: member.branchId,
      periodMonth: targetMonth,
      periodYear: targetYear,
      metric: targetMetric,
      targetValue: Number(targetValue),
      notes: targetNotes,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    pushActivityLog({
      action: editingTarget ? "UPDATED" : "CREATED",
      entityType: "STAFF_REWARD",
      entityId: result.target?.id ?? member.id,
      entityLabel: `${member.name} target`,
      details: `${targetMetric} target ${targetValue} for ${targetMonth}/${targetYear}`,
    });
    toast.success(editingTarget ? "Target updated." : "Target created.");
    setTargetOpen(false);
  };

  const handleRemoveTarget = (id: string) => {
    const result = removeTarget(id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Target removed.");
  };

  const years = useMemo(() => {
    const y = today.getFullYear();
    return [y - 1, y, y + 1];
  }, [today]);

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Staff Rewards"
        description={`${branchScopeLabel} · incentives, ledger, and targets`}
        actions={
          canManage ? (
            <Button type="button" onClick={openManual}>
              <Plus className="size-4 mr-2" />
              Manual entry
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard title="Entries" value={kpis.count} icon={Wallet} tone="slate" />
        <KPICard title="Pending" value={kpis.pending} icon={Gift} tone="orange" />
        <KPICard title="Approved" value={kpis.approved} icon={Check} tone="emerald" />
        <KPICard
          title="Net rewards"
          value={formatCurrency(kpis.total)}
          icon={Target}
          tone="violet"
        />
      </div>

      <Tabs
        defaultValue="ledger"
        className="w-full"
        onValueChange={(v) => {
          if (v === "settings") syncSettingsDraft();
        }}
      >
        <TabsList className="h-auto w-full flex flex-wrap justify-start gap-1 rounded-xl bg-muted/70 p-1.5">
          <TabsTrigger value="ledger" className="gap-1.5">
            <Wallet className="size-3.5" />
            Ledger
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5">
            <Settings2 className="size-3.5" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="targets" className="gap-1.5">
            <Target className="size-3.5" />
            Targets
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ledger" className="mt-4 space-y-4">
          <Card>
            <CardContent className="pt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {showBranchPicker && (
                <div className="space-y-1.5">
                  <Label>Branch</Label>
                  <Select value={pageBranchFilter} onValueChange={setPageBranchFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Branch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All branches</SelectItem>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Month</Label>
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
                <Label>Year</Label>
                <Select
                  value={String(filterYear)}
                  onValueChange={(v) => setFilterYear(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Staff</Label>
                <Select value={staffFilter} onValueChange={setStaffFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Staff" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All staff</SelectItem>
                    {scopedStaff.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(v) =>
                    setStatusFilter(v as StaffRewardLedgerStatus | "ALL")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="PAID_IN_PAYROLL">Paid in payroll</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {scopedLedger.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No ledger entries for this period.
                </p>
              ) : (
                <>
                  <MobileCardList className="p-3">
                    {scopedLedger.map((entry) => (
                      <MobileRowCard key={entry.id}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium">{entry.staffName}</p>
                            <p className="text-xs text-muted-foreground">
                              {entry.rewardType.replace(/_/g, " ")}
                              {entry.jobNumber ? ` · ${entry.jobNumber}` : ""}
                            </p>
                          </div>
                          <Badge className={STATUS_CLASS[entry.status]}>
                            {entry.status}
                          </Badge>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-sm">
                          <span
                            className={
                              entry.amount >= 0
                                ? "font-semibold text-emerald-600"
                                : "font-semibold text-rose-600"
                            }
                          >
                            {formatCurrency(entry.amount)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(entry.createdAt)}
                          </span>
                        </div>
                        {canManage && entry.status === "PENDING" && (
                          <div className="mt-3 flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleApprove(entry.id)}
                            >
                              <Check className="size-3.5 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCancel(entry.id)}
                            >
                              <Ban className="size-3.5 mr-1" />
                              Cancel
                            </Button>
                          </div>
                        )}
                      </MobileRowCard>
                    ))}
                  </MobileCardList>
                  <DesktopTableWrap>
                    <table className="w-full text-sm min-w-[860px]">
                      <thead>
                        <tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                          <th className="py-3 px-4">Staff</th>
                          <th className="py-3 px-4">Type</th>
                          <th className="py-3 px-4">Job</th>
                          <th className="py-3 px-4 text-right">Amount</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">When</th>
                          {canManage && <th className="py-3 px-4 text-right">Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {scopedLedger.map((entry) => (
                          <tr key={entry.id} className="border-b border-border/70">
                            <td className="py-3 px-4 font-medium">{entry.staffName}</td>
                            <td className="py-3 px-4 text-muted-foreground">
                              {entry.rewardType.replace(/_/g, " ")}
                              {entry.reason ? (
                                <div className="text-xs mt-0.5">{entry.reason}</div>
                              ) : null}
                            </td>
                            <td className="py-3 px-4 font-mono text-xs">
                              {entry.jobNumber ?? "—"}
                            </td>
                            <td
                              className={`py-3 px-4 text-right tabular-nums font-medium ${
                                entry.amount >= 0
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-rose-600 dark:text-rose-400"
                              }`}
                            >
                              {formatCurrency(entry.amount)}
                            </td>
                            <td className="py-3 px-4">
                              <Badge className={STATUS_CLASS[entry.status]}>
                                {entry.status}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                              {formatDateTime(entry.createdAt)}
                            </td>
                            {canManage && (
                              <td className="py-3 px-4 text-right">
                                {entry.status === "PENDING" ? (
                                  <div className="inline-flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleApprove(entry.id)}
                                    >
                                      <Check className="size-3.5 mr-1" />
                                      Approve
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleCancel(entry.id)}
                                    >
                                      <Ban className="size-3.5 mr-1" />
                                      Cancel
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </td>
                            )}
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

        <TabsContent value="settings" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="text-base">Reward calculation</CardTitle>
              {canManage && (
                <Button
                  type="button"
                  disabled={!settingsDirty}
                  onClick={handleSaveSettings}
                >
                  Save settings
                </Button>
              )}
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Mode</Label>
                <Select
                  value={settingsDraft.rewardMode}
                  disabled={!canManage}
                  onValueChange={(v) =>
                    patchSettingsDraft("rewardMode", v as StaffRewardMode)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENT_OF_JOB">Percent of job</SelectItem>
                    <SelectItem value="FIXED_PER_JOB">Fixed per job</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Default percent</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.1"
                  disabled={!canManage}
                  value={settingsDraft.defaultPercent}
                  onChange={(e) =>
                    patchSettingsDraft("defaultPercent", Number(e.target.value) || 0)
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Default fixed amount (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  disabled={!canManage}
                  value={settingsDraft.defaultFixedAmount}
                  onChange={(e) =>
                    patchSettingsDraft(
                      "defaultFixedAmount",
                      Number(e.target.value) || 0
                    )
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Tier bonuses</p>
                  <p className="text-xs text-muted-foreground">
                    Enable monthly job-threshold tiers
                  </p>
                </div>
                <Switch
                  checked={settingsDraft.tiersEnabled}
                  disabled={!canManage}
                  onCheckedChange={(v) => patchSettingsDraft("tiersEnabled", v)}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Time bonus</p>
                  <p className="text-xs text-muted-foreground">
                    Bonus when delivered early
                  </p>
                </div>
                <Switch
                  checked={settingsDraft.timeBonusEnabled}
                  disabled={!canManage}
                  onCheckedChange={(v) => patchSettingsDraft("timeBonusEnabled", v)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Time bonus threshold (minutes early)</Label>
                <Input
                  type="number"
                  min={0}
                  disabled={!canManage || !settingsDraft.timeBonusEnabled}
                  value={settingsDraft.timeBonusMinutesThreshold}
                  onChange={(e) =>
                    patchSettingsDraft(
                      "timeBonusMinutesThreshold",
                      Number(e.target.value) || 0
                    )
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Time bonus percent</Label>
                <Input
                  type="number"
                  min={0}
                  disabled={!canManage || !settingsDraft.timeBonusEnabled}
                  value={settingsDraft.timeBonusPercent}
                  onChange={(e) =>
                    patchSettingsDraft(
                      "timeBonusPercent",
                      Number(e.target.value) || 0
                    )
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Late deduction</p>
                  <p className="text-xs text-muted-foreground">
                    Deduct when delivered after promise
                  </p>
                </div>
                <Switch
                  checked={settingsDraft.lateDeductionEnabled}
                  disabled={!canManage}
                  onCheckedChange={(v) =>
                    patchSettingsDraft("lateDeductionEnabled", v)
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Late deduction percent</Label>
                <Input
                  type="number"
                  min={0}
                  disabled={!canManage || !settingsDraft.lateDeductionEnabled}
                  value={settingsDraft.lateDeductionPercent}
                  onChange={(e) =>
                    patchSettingsDraft(
                      "lateDeductionPercent",
                      Number(e.target.value) || 0
                    )
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader className="flex flex-row items-center justify-between pb-3 gap-3">
              <div className="space-y-0.5">
                <CardTitle className="text-base">Company Target-Based Rewards</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Enable rewards based on company-wide target achievements
                </p>
              </div>
              <Switch
                checked={!!settingsDraft.companyTargetEnabled}
                disabled={!canManage}
                onCheckedChange={(v) => patchSettingsDraft("companyTargetEnabled", v)}
              />
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">

              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label>Target Type</Label>
                <Select
                  value={settingsDraft.companyTargetRevenueType || "SERVICES"}
                  disabled={!canManage || !settingsDraft.companyTargetEnabled}
                  onValueChange={(v) =>
                    patchSettingsDraft("companyTargetRevenueType", v as any)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SERVICES">Services</SelectItem>
                    <SelectItem value="COUNTER_SALE">Counter Sale (Parts)</SelectItem>
                    <SelectItem value="BOTH">Services + Counter Sale</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label>Period Frequency</Label>
                <Select
                  value={settingsDraft.companyTargetPeriod || "MONTHLY"}
                  disabled={!canManage || !settingsDraft.companyTargetEnabled}
                  onValueChange={(v) =>
                    patchSettingsDraft("companyTargetPeriod", v as any)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                    <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                    <SelectItem value="HALF_YEARLY">Half Yearly</SelectItem>
                    <SelectItem value="YEARLY">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 space-y-4">
                <hr className="border-t border-border" />
                <h4 className="text-sm font-semibold text-foreground">Target Tiers Configuration</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  {[0, 1, 2, 3].map((idx) => {
                    const currentFreq = settingsDraft.companyTargetPeriod || "MONTHLY";
                    const currentFreqTiers = (settingsDraft.companyTargetFrequencyTiers as any)?.[currentFreq] || [];
                    const tier = currentFreqTiers[idx] || { targetAmount: 0, rewardPercent: 0 };
                    return (
                      <div key={idx} className="space-y-2 rounded-lg border p-3 bg-muted/20">
                        <p className="text-xs font-semibold text-muted-foreground uppercase">
                          Tier {idx + 1}
                        </p>
                        <div className="space-y-2">
                          <div>
                            <Label className="text-xs">Target Amount (₹)</Label>
                            <Input
                              type="number"
                              min={0}
                              disabled={!canManage || !settingsDraft.companyTargetEnabled}
                              value={tier.targetAmount || ""}
                              placeholder="e.g. 500000"
                              onChange={(e) =>
                                patchCompanyTargetTier(idx, "targetAmount", Number(e.target.value) || 0)
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Reward %</Label>
                            <Input
                              type="number"
                              min={0}
                              step="0.1"
                              disabled={!canManage || !settingsDraft.companyTargetEnabled}
                              value={tier.rewardPercent || ""}
                              placeholder="e.g. 2.5"
                              onChange={(e) =>
                                patchCompanyTargetTier(idx, "rewardPercent", Number(e.target.value) || 0)
                              }
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="targets" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Targets for {MONTHS.find((m) => m.v === filterMonth)?.label}{" "}
              {filterYear}
            </p>
            {canManage && (
              <Button type="button" variant="outline" onClick={() => openTarget()}>
                <Plus className="size-4 mr-2" />
                Add target
              </Button>
            )}
          </div>
          <Card>
            <CardContent className="p-0">
              {scopedTargets.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No staff targets for this period.
                </p>
              ) : (
                <>
                  <MobileCardList className="p-3">
                    {scopedTargets.map((t) => (
                      <MobileRowCard key={t.id}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium">{t.staffName}</p>
                            <p className="text-xs text-muted-foreground">
                              {t.metric.replace(/_/g, " ")} · target {t.targetValue}
                            </p>
                          </div>
                          {canManage && (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openTarget(t)}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRemoveTarget(t.id)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </MobileRowCard>
                    ))}
                  </MobileCardList>
                  <DesktopTableWrap>
                    <table className="w-full text-sm min-w-[720px]">
                      <thead>
                        <tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                          <th className="py-3 px-4">Staff</th>
                          <th className="py-3 px-4">Metric</th>
                          <th className="py-3 px-4 text-right">Target</th>
                          <th className="py-3 px-4">Notes</th>
                          {canManage && (
                            <th className="py-3 px-4 text-right">Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {scopedTargets.map((t) => (
                          <tr key={t.id} className="border-b border-border/70">
                            <td className="py-3 px-4 font-medium">{t.staffName}</td>
                            <td className="py-3 px-4 text-muted-foreground">
                              {t.metric.replace(/_/g, " ")}
                            </td>
                            <td className="py-3 px-4 text-right tabular-nums">
                              {t.targetValue}
                            </td>
                            <td className="py-3 px-4 text-muted-foreground">
                              {t.notes ?? "—"}
                            </td>
                            {canManage && (
                              <td className="py-3 px-4 text-right">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openTarget(t)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRemoveTarget(t.id)}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </td>
                            )}
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

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual credit / debit</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Staff</Label>
              <Select value={manualStaffId} onValueChange={setManualStaffId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff" />
                </SelectTrigger>
                <SelectContent>
                  {scopedStaff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Kind</Label>
                <Select
                  value={manualKind}
                  onValueChange={(v) => setManualKind(v as "CREDIT" | "DEBIT")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CREDIT">Credit</SelectItem>
                    <SelectItem value="DEBIT">Debit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Amount</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Reason (required)</Label>
              <Textarea
                value={manualReason}
                onChange={(e) => setManualReason(e.target.value)}
                rows={3}
                placeholder="Why is this adjustment being made?"
              />
            </div>
            <Button type="button" className="w-full" onClick={handleManual}>
              Save entry
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={targetOpen} onOpenChange={setTargetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTarget ? "Edit target" : "Add staff target"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Staff</Label>
              <Select value={targetStaffId} onValueChange={setTargetStaffId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff" />
                </SelectTrigger>
                <SelectContent>
                  {scopedStaff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Month</Label>
                <Select
                  value={String(targetMonth)}
                  onValueChange={(v) => setTargetMonth(Number(v))}
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
                <Label>Year</Label>
                <Select
                  value={String(targetYear)}
                  onValueChange={(v) => setTargetYear(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Metric</Label>
              <Select
                value={targetMetric}
                onValueChange={(v) => setTargetMetric(v as StaffTargetMetric)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METRIC_OPTIONS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Target value</Label>
              <Input
                type="number"
                min={0}
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={targetNotes}
                onChange={(e) => setTargetNotes(e.target.value)}
                rows={2}
              />
            </div>
            <Button type="button" className="w-full" onClick={handleSaveTarget}>
              Save target
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
