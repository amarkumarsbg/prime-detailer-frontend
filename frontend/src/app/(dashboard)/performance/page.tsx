"use client";

import { Fragment, useMemo, useState } from "react";
import { format } from "date-fns";
import { PageHeader } from "@/components/shared/page-header";
import { KPICard } from "@/components/shared/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, formatCurrency, getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useBranchStore } from "@/store/branch-store";
import { useAuthStore } from "@/store/auth-store";
import { useBranchScope } from "@/lib/branch-scope";
import { useScopedJobCards } from "@/hooks/use-scoped-data";
import {
  aggregateBranchPerformance,
  emptyBranchPerformanceMetrics,
  getPerformanceRange,
  performancePeriodLabel,
  type PerformancePeriod,
} from "@/lib/performance-branch-metrics";
import { getDemoBranchPerformance } from "@/lib/performance-demo-data";
import type { UserRole } from "@/types";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  Building2,
  Calculator,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  Gift,
  Hourglass,
  IndianRupee,
  Info,
  DollarSign,
  LineChart as LineChartIcon,
  Medal,
  Target,
  Trophy,
  Users,
  UserRound,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

const CHART_COLORS = [
  "#3b82f6",
  "#10b981",
  "#8b5cf6",
  "#f59e0b",
  "#ec4899",
  "#06b6d4",
  "#ef4444",
  "#84cc16",
];

const JOBS_COMPLETED_BAR = "#7dd3fc";

function performanceDashboardBadge(role: UserRole | undefined): string {
  if (!role) return "USER";
  if (role === "SUPER_ADMIN" || role === "ADMIN") return "COMPANY ADMIN";
  if (role === "BRANCH_MANAGER") return "BRANCH MANAGER";
  return role.replace(/_/g, " ");
}

const tabTriggerClass =
  "shrink-0 gap-1.5 rounded-lg px-3 py-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground";

type LeaderboardViewMode = "floor-managers" | "supervisor-teams";
type LeaderboardSortMetric = "paid" | "jobs" | "rewards" | "efficiency" | "onTime";

export default function PerformancePage() {
  const [period, setPeriod] = useState<PerformancePeriod>("this_month");
  const [leaderboardView, setLeaderboardView] =
    useState<LeaderboardViewMode>("floor-managers");
  const [leaderboardMetric, setLeaderboardMetric] =
    useState<LeaderboardSortMetric>("paid");
  const [expandedJobDetailId, setExpandedJobDetailId] = useState<string | null>(null);
  const scopedJobCards = useScopedJobCards();
  const branches = useBranchStore((s) => s.branches);
  const { selectedBranchId, viewingLabel } = useBranchScope();
  const user = useAuthStore((s) => s.user);

  const range = useMemo(() => getPerformanceRange(period), [period]);

  const { branchRows, usingDemo } = useMemo(() => {
    const live = aggregateBranchPerformance(
      scopedJobCards,
      branches,
      range.start,
      range.end
    );
    if (live.length > 0) {
      return { branchRows: live, usingDemo: false };
    }
    if (selectedBranchId) {
      const branchName =
        branches.find((b) => b.id === selectedBranchId)?.name ?? "Branch";
      return {
        branchRows: [emptyBranchPerformanceMetrics(selectedBranchId, branchName)],
        usingDemo: false,
      };
    }
    return {
      branchRows: getDemoBranchPerformance(branches, null),
      usingDemo: true,
    };
  }, [scopedJobCards, branches, range.start, range.end, selectedBranchId]);

  const hasScopedJobData = useMemo(
    () => branchRows.some((r) => r.jobCount > 0),
    [branchRows]
  );

  const jobsCompletedChartData = useMemo(
    () =>
      branchRows.map((r) => ({
        branch: r.chartLabel,
        fullName: r.branchName,
        jobsCompleted: r.deliveredCount,
      })),
    [branchRows]
  );

  const revenueChartData = useMemo(
    () =>
      branchRows.map((r) => ({
        branch: r.chartLabel,
        fullName: r.branchName,
        totalJobValue: r.totalJobValue,
      })),
    [branchRows]
  );

  const efficiencyChartData = useMemo(
    () =>
      branchRows.map((r) => ({
        branch: r.chartLabel,
        fullName: r.branchName,
        efficiency: r.efficiencyPct,
        onTime: r.onTimeRatePct,
      })),
    [branchRows]
  );

  const withRewardsPie = branchRows.filter((r) => r.totalRewards > 0);
  const rewardsPieData =
    withRewardsPie.length === 0
      ? branchRows.map((r) => ({
          name: r.chartLabel,
          fullName: r.branchName,
          value: r.totalRewards,
        }))
      : withRewardsPie.map((r) => ({
          name: r.chartLabel,
          fullName: r.branchName,
          value: r.totalRewards,
        }));

  const totalRewardsAll = useMemo(
    () => branchRows.reduce((s, r) => s + r.totalRewards, 0),
    [branchRows]
  );

  const totalJobValueAll = useMemo(
    () => branchRows.reduce((s, r) => s + r.totalJobValue, 0),
    [branchRows]
  );

  const totalCompletedJobs = useMemo(
    () => branchRows.reduce((s, r) => s + r.deliveredCount, 0),
    [branchRows]
  );

  const overviewStats = useMemo(() => {
    const n = branchRows.length || 1;
    const avgEff =
      Math.round(
        (branchRows.reduce((s, r) => s + r.efficiencyPct, 0) / n) * 10
      ) / 10;
    const avgOnTime =
      Math.round(
        (branchRows.reduce((s, r) => s + r.onTimeRatePct, 0) / n) * 10
      ) / 10;
    const paidGuess = Math.round(totalJobValueAll * 0.52);
    const avgReward =
      totalCompletedJobs > 0
        ? Math.round(totalRewardsAll / totalCompletedJobs)
        : 0;
    return { avgEff, avgOnTime, paidGuess, avgReward };
  }, [branchRows, totalJobValueAll, totalRewardsAll, totalCompletedJobs]);

  const highlights = useMemo(() => {
    if (!hasScopedJobData || branchRows.length === 0) return null;
    const topValue = branchRows.reduce((a, b) =>
      a.totalJobValue >= b.totalJobValue ? a : b
    );
    const topEff = branchRows.reduce((a, b) =>
      a.efficiencyPct >= b.efficiencyPct ? a : b
    );
    return { topValue, topEff, totalRewards: totalRewardsAll };
  }, [branchRows, totalRewardsAll, hasScopedJobData]);

  const rangeDescription = `${format(range.start, "d MMM yyyy")} – ${format(range.end, "d MMM yyyy")}`;
  const periodSubtitle =
    performancePeriodLabel(period) === "This month"
      ? "This monthly"
      : `${performancePeriodLabel(period).toLowerCase()}`;

  const scopeNote = selectedBranchId
    ? hasScopedJobData
      ? `Showing ${viewingLabel} only. Choose “All branches” in the header to compare.`
      : `No job activity for ${viewingLabel} in this period.`
    : null;

  const tooltipBase = {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: "0.5rem",
    color: "var(--popover-foreground)",
  } as const;

  const jobsMax = Math.max(
    1,
    ...jobsCompletedChartData.map((d) => d.jobsCompleted)
  );

  const handleRewardCalc = () => {
    toast.message("Reward calculator", {
      description: "Demo: connect payroll rules here when the backend is ready.",
    });
  };

  const branchTableRows = useMemo(
    () =>
      branchRows.map((r, i) => ({
        rank: i + 1,
        branch: r.branchName,
        jobs: r.deliveredCount,
        revenue: r.totalJobValue,
        eff: r.efficiencyPct,
        onTime: r.onTimeRatePct,
        rewards: r.totalRewards,
        teams: 1 + (i % 3),
      })),
    [branchRows]
  );

  const floorManagersDemo = useMemo(() => {
    if (selectedBranchId && !hasScopedJobData) return [];
    const b = branches;
    const n = (i: number) => b[i]?.name ?? `Branch ${i + 1}`;
    return [
      {
        name: `Floor Manager — ${n(0)}`,
        email: "floor.manager.1@demo.prime",
        branch: n(0),
        jobs: branchRows[0]?.deliveredCount ?? 0,
        revenue: branchRows[0]?.totalJobValue ?? 0,
        rewards: branchRows[0]?.totalRewards ?? 0,
        eff: branchRows[0]?.efficiencyPct ?? 0,
        teams: 2,
        onTime: branchRows[0]?.onTimeRatePct ?? 0,
      },
      ...(branchRows.length > 1
        ? [
            {
              name: `Floor Manager — ${n(1)}`,
              email: "floor.manager.2@demo.prime",
              branch: n(1),
              jobs: branchRows[1]?.deliveredCount ?? 0,
              revenue: branchRows[1]?.totalJobValue ?? 0,
              rewards: branchRows[1]?.totalRewards ?? 0,
              eff: branchRows[1]?.efficiencyPct ?? 0,
              teams: 1,
              onTime: branchRows[1]?.onTimeRatePct ?? 0,
            },
          ]
        : []),
    ];
  }, [branches, branchRows, selectedBranchId, hasScopedJobData]);

  const supervisorLeaderboardRows = useMemo(
    () =>
      branchRows.map((r, i) => ({
        key: `sup-${r.branchId}-${i}`,
        supervisor: `Supervisor ${i + 1} — ${r.branchName}`,
        floor: `Floor Manager — ${r.branchName}`,
        branch: r.branchName,
        jobs: r.deliveredCount,
        paid: Math.round(r.totalJobValue * 0.48),
        rewards: r.totalRewards,
        efficiency: r.efficiencyPct,
        onTime: r.onTimeRatePct,
      })),
    [branchRows]
  );

  const floorLeaderboardRows = useMemo(() => {
    return floorManagersDemo.map((fm, i) => {
      const totalRevenue =
        floorManagersDemo.length === 1
          ? 700
          : Math.max(700, Math.round(fm.revenue / 1000));
      const paidRevenue =
        floorManagersDemo.length === 1 && i === 0
          ? 0
          : Math.round(totalRevenue * 0.52);
      return {
        key: fm.email,
        name: fm.name,
        email: fm.email,
        branch: fm.branch,
        supervisorTeams: fm.teams,
        jobs: fm.jobs,
        paidRevenue,
        totalRevenue,
        rewards: i === 0 && floorManagersDemo.length === 1 ? 0 : fm.rewards,
        efficiency: floorManagersDemo.length === 1 ? 100 : fm.eff,
        onTime: floorManagersDemo.length === 1 ? 100 : fm.onTime,
        showUnpaidBadge: paidRevenue === 0 && fm.jobs > 0,
      };
    });
  }, [floorManagersDemo]);

  const sortedFloorLeaderboard = useMemo(() => {
    const next = [...floorLeaderboardRows];
    next.sort((a, b) => {
      switch (leaderboardMetric) {
        case "paid":
          return b.paidRevenue - a.paidRevenue;
        case "jobs":
          return b.jobs - a.jobs;
        case "rewards":
          return b.rewards - a.rewards;
        case "efficiency":
          return b.efficiency - a.efficiency;
        case "onTime":
          return b.onTime - a.onTime;
        default:
          return 0;
      }
    });
    return next;
  }, [floorLeaderboardRows, leaderboardMetric]);

  const sortedSupervisorLeaderboard = useMemo(() => {
    const next = [...supervisorLeaderboardRows];
    next.sort((a, b) => {
      switch (leaderboardMetric) {
        case "paid":
          return b.paid - a.paid;
        case "jobs":
          return b.jobs - a.jobs;
        case "rewards":
          return b.rewards - a.rewards;
        case "efficiency":
          return b.efficiency - a.efficiency;
        case "onTime":
          return b.onTime - a.onTime;
        default:
          return 0;
      }
    });
    return next;
  }, [supervisorLeaderboardRows, leaderboardMetric]);

  const leaderboardSortLabel: Record<LeaderboardSortMetric, string> = {
    paid: "Paid revenue",
    jobs: "Jobs",
    rewards: "Rewards",
    efficiency: "Efficiency",
    onTime: "On-time %",
  };

  const leaderboardPeriodWord =
    period === "this_month" ? "Monthly" : performancePeriodLabel(period);

  const metricChipClass = (active: boolean) =>
    cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer shrink-0",
      active
        ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-600"
        : "border-border bg-background text-muted-foreground hover:bg-muted/80"
    );

  const jobDetailDemo = useMemo(() => {
    if (selectedBranchId && !hasScopedJobData) return [];

    const scopedBranchName = selectedBranchId
      ? branches.find((b) => b.id === selectedBranchId)?.name
      : undefined;
    const b0 = scopedBranchName ?? branches[0]?.name ?? "Main branch";
    const b1 = branches.find((b) => b.name !== b0)?.name ?? b0;
    const rows = [
      {
        id: "#258",
        date: "03 Apr 2026, 06:34 am",
        branch: b0,
        supervisor: `Supervisor 1 ${b0}`,
        team: 0,
        timeSavedLabel: "+2h 0m",
        durationLine: "0m / 120m",
        amount: 3420,
        gst: 522,
        estimated: true,
        reward: 293,
        rewardPct: 1.0,
        status: "On time",
        expand: {
          floorManager: `Floor Manager ${b0}`,
          supervisor: `Supervisor 1 ${b0}`,
          serviceValue: 5680,
          gst: 522,
          totalCharged: 3420,
          rewardTotal: 293,
          baseReward: 34,
          basePct: 1.0,
          timeBonus: 162,
          timeBonusRules: [
            "Rule: 8 intervals of 15m at 0.5% each",
            "Basis: 120 min saved (120m allowed)",
          ],
          supervisorShareLabel: `Supervisor 1 ${b0} (100% share)`,
          supervisorShare: 293,
          applicatorPool: 0,
          applicatorMembers: 0,
          paymentNote:
            "The associated invoice has not been fully paid. Figures update automatically once payment is confirmed.",
          invoiceTotal: 3942,
          paidAmount: 0,
        },
      },
      {
        id: "#253",
        date: "02 Apr 2026, 04:27 pm",
        branch: b0,
        supervisor: `Supervisor 1 ${b0}`,
        team: 0,
        timeSavedLabel: "+40m",
        durationLine: "0m / 40m",
        amount: 700,
        gst: 107,
        estimated: false,
        reward: 0,
        rewardPct: 0,
        status: "On time",
        expand: {
          floorManager: `Floor Manager ${b0}`,
          supervisor: `Supervisor 1 ${b0}`,
          serviceValue: 920,
          gst: 107,
          totalCharged: 700,
          rewardTotal: 0,
          baseReward: 0,
          basePct: 0,
          timeBonus: 0,
          timeBonusRules: ["No time bonus on this job."],
          supervisorShareLabel: `Supervisor 1 ${b0}`,
          supervisorShare: 0,
          applicatorPool: 0,
          applicatorMembers: 0,
          paymentNote:
            "The associated invoice has not been fully paid. Figures update automatically once payment is confirmed.",
          invoiceTotal: 807,
          paidAmount: 0,
        },
      },
      {
        id: "#223",
        date: "01 Apr 2026, 11:15 am",
        branch: b1,
        supervisor: `Supervisor 1 ${b1}`,
        team: 1,
        timeSavedLabel: "+15m",
        durationLine: "45m / 60m",
        amount: 600,
        gst: 91,
        estimated: true,
        reward: 42,
        rewardPct: 0.65,
        status: "On time",
        expand: {
          floorManager: `Floor Manager ${b1}`,
          supervisor: `Supervisor 1 ${b1}`,
          serviceValue: 890,
          gst: 91,
          totalCharged: 600,
          rewardTotal: 42,
          baseReward: 28,
          basePct: 0.65,
          timeBonus: 14,
          timeBonusRules: ["Time bonus from early completion."],
          supervisorShareLabel: `Supervisor 1 ${b1} (80% share)`,
          supervisorShare: 34,
          applicatorPool: 8,
          applicatorMembers: 1,
          paymentNote: "Awaiting payment on invoice.",
          invoiceTotal: 691,
          paidAmount: 0,
        },
      },
      {
        id: "#222",
        date: "31 Mar 2026, 04:50 pm",
        branch: b1,
        supervisor: `Supervisor 1 ${b1}`,
        team: 2,
        timeSavedLabel: "On schedule",
        durationLine: "30m / 30m",
        amount: 5392,
        gst: 817,
        estimated: true,
        reward: 1363,
        rewardPct: 1.2,
        status: "On time",
        expand: {
          floorManager: `Floor Manager ${b1}`,
          supervisor: `Supervisor 1 ${b1}`,
          serviceValue: 7200,
          gst: 817,
          totalCharged: 5392,
          rewardTotal: 1363,
          baseReward: 340,
          basePct: 1.2,
          timeBonus: 1023,
          timeBonusRules: ["Standard tier reward.", "Volume bonus applied (demo)."],
          supervisorShareLabel: `Supervisor 1 ${b1} (100% share)`,
          supervisorShare: 1363,
          applicatorPool: 0,
          applicatorMembers: 0,
          paymentNote: "Invoice fully paid in demo.",
          invoiceTotal: 6209,
          paidAmount: 6209,
        },
      },
    ];
    if (scopedBranchName) {
      return rows.filter((j) => j.branch === scopedBranchName);
    }
    return rows;
  }, [branches, selectedBranchId, hasScopedJobData]);

  const jobDetailsSummary = useMemo(() => {
    const n = jobDetailDemo.length;
    const totalRevenue = jobDetailDemo.reduce((s, j) => s + j.amount + j.gst, 0);
    const totalRewards = jobDetailDemo.reduce((s, j) => s + j.reward, 0);
    const paidRevenue = jobDetailDemo.reduce((s, j) => s + j.expand.paidAmount, 0);
    const awaiting = Math.max(0, totalRevenue - paidRevenue);
    const paidJobCount = jobDetailDemo.filter((j) => j.expand.paidAmount >= j.expand.invoiceTotal).length;
    const paidPct = n > 0 ? Math.round((paidJobCount / n) * 100) : 0;
    const rewardProgress =
      totalRevenue > 0 ? Math.min(100, Math.round((totalRewards / totalRevenue) * 100)) : 0;
    return {
      n,
      totalRevenue,
      totalRewards,
      paidRevenue,
      awaiting,
      paidJobCount,
      paidPct,
      rewardProgress,
    };
  }, [jobDetailDemo]);

  return (
    <div className="space-y-6 pb-10">
      <PageHeader title="Performance" description="Manage your operations." />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between border-b border-border pb-6">
        <div className="min-w-0 space-y-1">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Performance Dashboard
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="success" className="font-semibold uppercase tracking-wide text-[10px]">
              {performanceDashboardBadge(user?.role)}
            </Badge>
            <span className="text-muted-foreground/80">•</span>
            <span>Performance &amp; Efficiency Metrics</span>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          {scopeNote && (
            <p className="text-xs text-muted-foreground sm:order-last sm:w-full lg:max-w-xs lg:text-right">
              {scopeNote}
            </p>
          )}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Calendar className="size-3" />
              Period
            </span>
            <Select
              value={period}
              onValueChange={(v) => setPeriod(v as PerformancePeriod)}
            >
              <SelectTrigger className="w-[168px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this_month">
                  {performancePeriodLabel("this_month")}
                </SelectItem>
                <SelectItem value="last_month">
                  {performancePeriodLabel("last_month")}
                </SelectItem>
                <SelectItem value="last_30d">
                  {performancePeriodLabel("last_30d")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="button" className="h-9" onClick={handleRewardCalc}>
            <Calculator className="size-4 mr-2" />
            Reward Calc
          </Button>
        </div>
      </div>

      {selectedBranchId && !hasScopedJobData && !usingDemo && (
        <div
          role="status"
          className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
        >
          No job cards for{" "}
          <span className="font-medium text-foreground">
            {viewingLabel !== "All branches" ? viewingLabel : "this branch"}
          </span>{" "}
          in {performancePeriodLabel(period).toLowerCase()} ({rangeDescription}). Metrics show zero
          until jobs are created for this site.
        </div>
      )}

      <Tabs defaultValue="analytics" className="w-full">
        <TabsList className="h-auto w-full flex flex-nowrap justify-start gap-1 overflow-x-auto rounded-xl bg-muted/70 p-1.5 scrollbar-none">
          <TabsTrigger value="overview" className={tabTriggerClass}>
            <BarChart3 className="size-3.5 sm:size-4 opacity-90" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="branches" className={tabTriggerClass}>
            <Building2 className="size-3.5 sm:size-4 opacity-90" />
            Branches
          </TabsTrigger>
          <TabsTrigger value="floor-managers" className={tabTriggerClass}>
            <UserRound className="size-3.5 sm:size-4 opacity-90" />
            Floor Managers
          </TabsTrigger>
          <TabsTrigger value="supervisors" className={tabTriggerClass}>
            <Users className="size-3.5 sm:size-4 opacity-90" />
            Supervisor Teams
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className={tabTriggerClass}>
            <Medal className="size-3.5 sm:size-4 opacity-90" />
            Leaderboard
          </TabsTrigger>
          <TabsTrigger value="job-details" className={tabTriggerClass}>
            <FileText className="size-3.5 sm:size-4 opacity-90" />
            Job Details
          </TabsTrigger>
          <TabsTrigger value="rewards" className={tabTriggerClass}>
            <Gift className="size-3.5 sm:size-4 opacity-90" />
            Rewards
          </TabsTrigger>
          <TabsTrigger value="analytics" className={tabTriggerClass}>
            <LineChartIcon className="size-3.5 sm:size-4 opacity-90" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div>
            <h3 className="text-base font-semibold">Performance Overview</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Analyzing data from {format(range.start, "d MMM")} to{" "}
              {format(range.end, "d MMM")}.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KPICard
              title="Total jobs completed"
              value={totalCompletedJobs}
              subtitle={`${periodSubtitle} · demo trend`}
              icon={CheckCircle2}
              tone="emerald"
            />
            <KPICard
              title="Paid revenue (est.)"
              value={formatCurrency(overviewStats.paidGuess)}
              subtitle="Confirmed · invoices paid"
              icon={IndianRupee}
              tone="emerald"
            />
            <KPICard
              title="Total rewards"
              value={formatCurrency(totalRewardsAll)}
              subtitle={`Earned ${periodSubtitle}`}
              icon={Trophy}
              tone="orange"
            />
            <KPICard
              title="Avg efficiency"
              value={`${overviewStats.avgEff.toFixed(1)}%`}
              subtitle="Team throughput"
              icon={Zap}
              tone="violet"
            />
            <KPICard
              title="On-time completion"
              value={`${overviewStats.avgOnTime.toFixed(1)}%`}
              subtitle="Delivered by promise"
              icon={CheckCircle2}
              tone="emerald"
            />
            <KPICard
              title="Time saved (demo)"
              value="39m"
              subtitle="Rolling monthly avg"
              icon={Clock}
              tone="blue"
            />
            <KPICard
              title="Avg reward / job"
              value={formatCurrency(overviewStats.avgReward)}
              subtitle="When completed jobs &gt; 0"
              icon={Gift}
              tone="orange"
            />
            <KPICard
              title="Total job value"
              value={formatCurrency(totalJobValueAll)}
              subtitle="Estimated on open + done"
              icon={BarChart3}
              tone="slate"
            />
          </div>
          {usingDemo && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Sample/KPI mix: job counts and branch charts use placeholder data until jobs fall in this
              period.
            </p>
          )}
        </TabsContent>

        <TabsContent value="branches" className="mt-4 space-y-4">
          <div>
            <h3 className="text-base font-semibold">Branch performance comparison</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Compare metrics across branches • {branchRows.length} branch
              {branchRows.length !== 1 ? "es" : ""}
            </p>
          </div>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-3 px-4 font-medium">Rank</th>
                    <th className="py-3 px-4 font-medium">Branch</th>
                    <th className="py-3 px-4 font-medium text-right">Jobs</th>
                    <th className="py-3 px-4 font-medium text-right">Revenue</th>
                    <th className="py-3 px-4 font-medium text-right">Efficiency</th>
                    <th className="py-3 px-4 font-medium text-right">On-time %</th>
                    <th className="py-3 px-4 font-medium text-right">Rewards</th>
                    <th className="py-3 px-4 font-medium text-right">Teams</th>
                  </tr>
                </thead>
                <tbody>
                  {branchTableRows.map((row) => (
                    <tr key={row.branch} className="border-b border-border/70">
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 font-medium">
                          {row.rank === 1 && <Medal className="size-4 text-amber-500" />}
                          #{row.rank}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium">{row.branch}</td>
                      <td className="py-3 px-4 text-right tabular-nums">{row.jobs}</td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        {formatCurrency(row.revenue)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Badge variant="success" className="font-normal">
                          {row.eff.toFixed(1)}%
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        {row.onTime.toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        {formatCurrency(row.rewards)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">{row.teams}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="floor-managers" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Floor manager rankings</CardTitle>
              <CardDescription>
                {floorManagersDemo.length} floor manager · {periodSubtitle}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {floorManagersDemo.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No floor manager activity for this branch in the selected period.
                </p>
              ) : (
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                    <th className="py-3 px-4">Rank</th>
                    <th className="py-3 px-4">Floor manager</th>
                    <th className="py-3 px-4">Branch</th>
                    <th className="py-3 px-4 text-right">Jobs</th>
                    <th className="py-3 px-4 text-right">Revenue (paid est.)</th>
                    <th className="py-3 px-4 text-right">Rewards</th>
                    <th className="py-3 px-4 text-right">Efficiency</th>
                    <th className="py-3 px-4 text-right">Teams</th>
                    <th className="py-3 px-4 text-right">On-time %</th>
                  </tr>
                </thead>
                <tbody>
                  {floorManagersDemo.map((fm, i) => (
                    <tr key={fm.email} className="border-b border-border/70">
                      <td className="py-3 px-4">
                        {i === 0 ? (
                          <Medal className="size-5 text-amber-500" />
                        ) : (
                          `#${i + 1}`
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium">{fm.name}</div>
                        <div className="text-xs text-muted-foreground">{fm.email}</div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{fm.branch}</td>
                      <td className="py-3 px-4 text-right tabular-nums">{fm.jobs}</td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        {formatCurrency(Math.round(fm.revenue * 0.5))}{" "}
                        <span className="text-xs text-muted-foreground">of {formatCurrency(fm.revenue)}</span>
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        {formatCurrency(fm.rewards)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Badge variant="success">{fm.eff.toFixed(1)}%</Badge>
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">{fm.teams}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="tabular-nums">{fm.onTime.toFixed(1)}%</div>
                        <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${Math.min(100, fm.onTime)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="supervisors" className="mt-4 space-y-4">
          {!hasScopedJobData && selectedBranchId ? (
            <p className="text-sm text-muted-foreground py-6 text-center rounded-lg border border-dashed">
              No supervisor team data for this branch in the selected period.
            </p>
          ) : (
          branchRows.slice(0, 2).map((r, i) => (
            <Card key={r.branchId}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <CardTitle className="text-base leading-snug">
                  Supervisor {i + 1} — {r.branchName}
                </CardTitle>
                <Badge variant="success">{r.efficiencyPct.toFixed(1)}% efficiency</Badge>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Jobs completed</p>
                  <p className="text-xl font-bold mt-1">{r.deliveredCount}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Paid revenue (est.)</p>
                  <p className="text-xl font-bold mt-1">
                    {formatCurrency(Math.round(r.totalJobValue * 0.45))}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Rewards earned</p>
                  <p className="text-xl font-bold mt-1 text-amber-600 dark:text-amber-400">
                    {formatCurrency(r.totalRewards)}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Time performance</p>
                  <p className="text-xl font-bold mt-1 text-emerald-600">+39m</p>
                </div>
              </CardContent>
            </Card>
          ))
          )}
          {branchRows.length === 0 && hasScopedJobData && (
            <p className="text-sm text-muted-foreground">No supervisor rows for this scope.</p>
          )}
        </TabsContent>

        <TabsContent value="leaderboard" className="mt-4 space-y-4">
          <Card className="overflow-hidden">
            <CardContent className="p-4 sm:p-5 space-y-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-orange-500 shadow-sm">
                    <Trophy className="size-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold tracking-tight">Leaderboard</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Rankings for <span className="font-medium text-foreground">{leaderboardPeriodWord}</span>{" "}
                      period •{" "}
                      {leaderboardView === "floor-managers"
                        ? `${floorManagersDemo.length} floor manager${floorManagersDemo.length !== 1 ? "s" : ""}`
                        : `${supervisorLeaderboardRows.length} supervisor team${supervisorLeaderboardRows.length !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <div className="inline-flex rounded-lg border border-border bg-muted/60 p-1">
                    <button
                      type="button"
                      onClick={() => setLeaderboardView("supervisor-teams")}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                        leaderboardView === "supervisor-teams"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="size-3.5" />
                        Supervisor teams
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLeaderboardView("floor-managers")}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                        leaderboardView === "floor-managers"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <UserRound className="size-3.5" />
                        Floor managers
                      </span>
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      className={metricChipClass(leaderboardMetric === "paid")}
                      onClick={() => setLeaderboardMetric("paid")}
                    >
                      <DollarSign className="size-3.5" />
                      Paid revenue
                    </button>
                    <button
                      type="button"
                      className={metricChipClass(leaderboardMetric === "jobs")}
                      onClick={() => setLeaderboardMetric("jobs")}
                    >
                      <CheckCircle2 className="size-3.5" />
                      Jobs
                    </button>
                    <button
                      type="button"
                      className={metricChipClass(leaderboardMetric === "rewards")}
                      onClick={() => setLeaderboardMetric("rewards")}
                    >
                      <Gift className="size-3.5" />
                      Rewards
                    </button>
                    <button
                      type="button"
                      className={metricChipClass(leaderboardMetric === "efficiency")}
                      onClick={() => setLeaderboardMetric("efficiency")}
                    >
                      <Zap className="size-3.5" />
                      Efficiency
                    </button>
                    <button
                      type="button"
                      className={metricChipClass(leaderboardMetric === "onTime")}
                      onClick={() => setLeaderboardMetric("onTime")}
                    >
                      <Clock className="size-3.5" />
                      On-time %
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 rounded-lg border border-blue-200/80 bg-blue-50/80 dark:bg-blue-950/30 dark:border-blue-900/50 px-3 py-2.5 text-xs text-blue-900 dark:text-blue-100">
                <Info className="size-4 shrink-0 mt-0.5 opacity-80" />
                <p className="leading-relaxed text-blue-900/90 dark:text-blue-100/90">
                  <strong className="font-semibold">Paid revenue</strong> = confirmed revenue from paid invoices (demo
                  est.). <strong className="font-semibold">Total revenue</strong> = job value in period.{" "}
                  <strong className="font-semibold">Efficiency</strong> = delivered ÷ jobs.{" "}
                  <strong className="font-semibold">On-time %</strong> = share of delivered jobs by promised time.
                </p>
              </div>
            </CardContent>
          </Card>

          {leaderboardView === "floor-managers" ? (
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-4">
                <CardTitle className="text-base">Floor manager rankings</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Sorted by:{" "}
                  <span className="font-medium text-foreground">
                    {leaderboardSortLabel[leaderboardMetric]}
                  </span>
                </p>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm min-w-[980px]">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-3 px-4 font-medium">Rank</th>
                      <th className="py-3 px-4 font-medium">Floor manager</th>
                      <th className="py-3 px-4 font-medium">Branch</th>
                      <th className="py-3 px-4 font-medium">Supervisor teams</th>
                      <th className="py-3 px-4 font-medium text-right">Jobs</th>
                      <th className="py-3 px-4 font-medium text-right">Paid revenue</th>
                      <th className="py-3 px-4 font-medium text-right">Total revenue</th>
                      <th className="py-3 px-4 font-medium text-right">Rewards</th>
                      <th className="py-3 px-4 font-medium text-right">Efficiency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedFloorLeaderboard.map((row, idx) => (
                      <tr
                        key={row.key}
                        className="border-b border-border/70 bg-amber-50/40 dark:bg-amber-950/15"
                      >
                        <td className="py-3 px-4 align-middle">
                          {idx === 0 ? (
                            <Medal className="size-6 text-amber-500" />
                          ) : (
                            <span className="font-medium tabular-nums">#{idx + 1}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 align-middle">
                          <div className="flex items-center gap-3">
                            <Avatar className="size-9 border border-border">
                              <AvatarFallback className="bg-muted text-xs font-semibold">
                                {getInitials(row.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="font-medium leading-tight">{row.name}</div>
                              <div className="text-xs text-muted-foreground truncate">{row.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 align-middle text-muted-foreground">{row.branch}</td>
                        <td className="py-3 px-4 align-middle">
                          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                            <Users className="size-3.5" />
                            {row.supervisorTeams} team{row.supervisorTeams !== 1 ? "s" : ""}
                          </span>
                        </td>
                        <td className="py-3 px-4 align-middle text-right tabular-nums">{row.jobs}</td>
                        <td className="py-3 px-4 align-middle text-right">
                          <div className="tabular-nums font-medium">{formatCurrency(row.paidRevenue)}</div>
                          {row.showUnpaidBadge && (
                            <Badge
                              variant="warning"
                              className="mt-1 font-normal text-[10px] uppercase tracking-wide"
                            >
                              Unpaid
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 align-middle text-right tabular-nums font-medium">
                          {formatCurrency(row.totalRevenue)}
                        </td>
                        <td className="py-3 px-4 align-middle text-right tabular-nums">
                          {formatCurrency(row.rewards)}
                        </td>
                        <td className="py-3 px-4 align-middle text-right">
                          <Badge variant="success" className="font-normal tabular-nums">
                            {row.efficiency.toFixed(1)}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-4">
                <CardTitle className="text-base">Supervisor team rankings</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Sorted by:{" "}
                  <span className="font-medium text-foreground">
                    {leaderboardSortLabel[leaderboardMetric]}
                  </span>
                </p>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm min-w-[900px]">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-3 px-4 font-medium">Rank</th>
                      <th className="py-3 px-4 font-medium">Supervisor</th>
                      <th className="py-3 px-4 font-medium">Floor manager</th>
                      <th className="py-3 px-4 font-medium">Branch</th>
                      <th className="py-3 px-4 font-medium text-right">Jobs</th>
                      <th className="py-3 px-4 font-medium text-right">Paid revenue</th>
                      <th className="py-3 px-4 font-medium text-right">Rewards</th>
                      <th className="py-3 px-4 font-medium text-right">Efficiency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSupervisorLeaderboard.map((row, idx) => (
                      <tr
                        key={row.key}
                        className="border-b border-border/70 bg-amber-50/40 dark:bg-amber-950/15"
                      >
                        <td className="py-3 px-4">
                          {idx === 0 ? (
                            <Medal className="size-6 text-amber-500" />
                          ) : (
                            <span className="font-medium tabular-nums">#{idx + 1}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-medium">{row.supervisor}</td>
                        <td className="py-3 px-4 text-muted-foreground">{row.floor}</td>
                        <td className="py-3 px-4 text-muted-foreground">{row.branch}</td>
                        <td className="py-3 px-4 text-right tabular-nums">{row.jobs}</td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-medium tabular-nums">{formatCurrency(row.paid)}</span>
                          <Badge variant="outline" className="ml-2 text-[10px] font-normal">
                            Demo
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums">
                          {formatCurrency(row.rewards)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Badge variant="success" className="font-normal">
                            {row.efficiency.toFixed(1)}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="job-details" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Filters</CardTitle>
              <CardDescription>Demo controls — wire to API later</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Start date</label>
                <input
                  type="text"
                  readOnly
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={format(range.start, "MM/dd/yyyy")}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">End date</label>
                <input
                  type="text"
                  readOnly
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={format(range.end, "MM/dd/yyyy")}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Completion</label>
                <input
                  className="flex h-9 w-full rounded-md border border-input bg-muted/50 px-3 text-sm"
                  readOnly
                  value="All jobs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Payment</label>
                <input
                  className="flex h-9 w-full rounded-md border border-input bg-muted/50 px-3 text-sm"
                  readOnly
                  value="All"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Sort by</label>
                <input
                  className="flex h-9 w-full rounded-md border border-input bg-muted/50 px-3 text-sm"
                  readOnly
                  value="Latest first"
                />
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 rounded-xl border border-blue-200/60 bg-blue-500/5 dark:bg-blue-950/20 dark:border-blue-900/40 p-3 sm:p-4">
            <Card className="p-4 shadow-none border-0 bg-transparent">
              <p className="text-xs text-muted-foreground">Total revenue</p>
              <p className="text-lg font-bold">{formatCurrency(jobDetailsSummary.totalRevenue)}</p>
              <p className="text-xs text-muted-foreground">{jobDetailsSummary.n} jobs</p>
            </Card>
            <Card className="p-4 shadow-none border-0 bg-transparent">
              <p className="text-xs text-muted-foreground">Paid revenue</p>
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                {formatCurrency(jobDetailsSummary.paidRevenue)}
              </p>
              <p className="text-xs text-muted-foreground">
                {jobDetailsSummary.paidJobCount} jobs · {jobDetailsSummary.paidPct}%
              </p>
            </Card>
            <Card className="p-4 shadow-none border-0 bg-transparent">
              <p className="text-xs text-muted-foreground">Awaiting payment</p>
              <p className="text-lg font-bold text-amber-700 dark:text-amber-400">
                {formatCurrency(jobDetailsSummary.awaiting)}
              </p>
              <p className="text-xs text-muted-foreground">
                {jobDetailsSummary.n - jobDetailsSummary.paidJobCount} jobs
              </p>
            </Card>
            <Card className="p-4 shadow-none border-0 bg-transparent">
              <p className="text-xs text-muted-foreground">Total rewards</p>
              <p className="text-lg font-bold text-violet-700 dark:text-violet-400">
                {formatCurrency(jobDetailsSummary.totalRewards)}
              </p>
              <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${jobDetailsSummary.rewardProgress}%` }}
                />
              </div>
            </Card>
          </div>
          <Card>
            <CardHeader className="py-3 border-b border-border/60">
              <p className="text-sm text-muted-foreground">
                Showing {jobDetailsSummary.n} of {jobDetailsSummary.n} jobs · Click a row to expand
              </p>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {jobDetailDemo.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No jobs to show for this branch in the selected period.
                </p>
              ) : (
              <table className="w-full text-sm min-w-[960px]">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-3 px-3 w-10" aria-hidden />
                    <th className="py-3 px-2 font-medium">Job ID</th>
                    <th className="py-3 px-2 font-medium">Date</th>
                    <th className="py-3 px-2 font-medium">Branch</th>
                    <th className="py-3 px-2 font-medium">Supervisor</th>
                    <th className="py-3 px-2 font-medium">Team</th>
                    <th className="py-3 px-2 font-medium">Time</th>
                    <th className="py-3 px-2 font-medium text-right">Amount</th>
                    <th className="py-3 px-2 font-medium text-right">Reward</th>
                    <th className="py-3 px-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {jobDetailDemo.map((j) => {
                    const open = expandedJobDetailId === j.id;
                    const ex = j.expand;
                    const balance = Math.max(0, ex.invoiceTotal - ex.paidAmount);
                    const isAwaiting = balance > 0;
                    return (
                      <Fragment key={j.id}>
                        <tr
                          role="button"
                          tabIndex={0}
                          aria-expanded={open}
                          onClick={() =>
                            setExpandedJobDetailId((cur) => (cur === j.id ? null : j.id))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setExpandedJobDetailId((cur) => (cur === j.id ? null : j.id));
                            }
                          }}
                          className={cn(
                            "border-b border-border/70 cursor-pointer transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            open && "bg-muted/30"
                          )}
                        >
                          <td className="py-3 px-2 align-middle text-muted-foreground">
                            <ChevronDown
                              className={cn(
                                "size-4 transition-transform shrink-0",
                                open && "rotate-180"
                              )}
                            />
                          </td>
                          <td className="py-3 px-2 align-middle">
                            <span className="inline-flex items-center gap-1.5 font-mono font-medium">
                              <FileText className="size-3.5 text-muted-foreground" />
                              {j.id}
                            </span>
                          </td>
                          <td className="py-3 px-2 align-middle text-muted-foreground whitespace-nowrap">
                            {j.date}
                          </td>
                          <td className="py-3 px-2 align-middle max-w-[140px] truncate" title={j.branch}>
                            {j.branch}
                          </td>
                          <td className="py-3 px-2 align-middle text-xs text-muted-foreground max-w-[180px]">
                            <span className="line-clamp-2">{j.supervisor}</span>
                          </td>
                          <td className="py-3 px-2 align-middle">
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <Users className="size-3.5" />
                              {j.team}
                            </span>
                          </td>
                          <td className="py-3 px-2 align-middle">
                            <div className="text-emerald-600 dark:text-emerald-400 font-medium">
                              {j.timeSavedLabel}
                            </div>
                            <div className="text-[11px] text-muted-foreground">{j.durationLine}</div>
                          </td>
                          <td className="py-3 px-2 align-middle text-right">
                            <div className="font-semibold">{formatCurrency(j.amount)}</div>
                            <div className="text-[11px] text-muted-foreground">
                              +GST {formatCurrency(j.gst)}
                              {j.estimated && (
                                <span className="text-amber-600 dark:text-amber-500 ml-1">estimated</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-2 align-middle text-right">
                            <div
                              className={cn(
                                "font-medium tabular-nums",
                                j.reward > 0 && "text-emerald-600 dark:text-emerald-400"
                              )}
                            >
                              {formatCurrency(j.reward)}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {j.rewardPct.toFixed(2)}%
                            </div>
                          </td>
                          <td className="py-3 px-2 align-middle">
                            <Badge variant="success" className="gap-1 font-normal">
                              <CheckCircle2 className="size-3" />
                              {j.status}
                            </Badge>
                          </td>
                        </tr>
                        {open && (
                          <tr className="border-b border-border/70 bg-amber-50/25 dark:bg-amber-950/15">
                            <td colSpan={10} className="p-0">
                              <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-3 border-t border-border/60">
                                <div className="space-y-3">
                                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Team members
                                  </h4>
                                  <div className="space-y-2 text-sm">
                                    <p>
                                      <span className="text-muted-foreground">Floor manager</span>
                                      <br />
                                      <span className="font-medium">{ex.floorManager}</span>
                                    </p>
                                    <p>
                                      <span className="text-muted-foreground">Supervisor</span>
                                      <br />
                                      <span className="font-medium">{ex.supervisor}</span>
                                    </p>
                                  </div>
                                </div>
                                <div className="space-y-3 border-border/60 lg:border-x lg:px-4">
                                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Pricing &amp; rewards
                                  </h4>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between gap-2">
                                      <span className="text-muted-foreground">Service value</span>
                                      <span>{formatCurrency(ex.serviceValue)}</span>
                                    </div>
                                    <div className="flex justify-between gap-2">
                                      <span className="text-muted-foreground">GST</span>
                                      <span>{formatCurrency(ex.gst)}</span>
                                    </div>
                                    <div className="border-t border-border/60 my-2" />
                                    <div className="flex justify-between gap-2 font-semibold text-blue-700 dark:text-blue-400">
                                      <span>Total charged</span>
                                      <span>{formatCurrency(ex.totalCharged)}</span>
                                    </div>
                                    <div className="border-t border-border/60 my-2" />
                                    <div className="flex justify-between gap-2 font-semibold text-emerald-600 dark:text-emerald-400">
                                      <span>Total reward</span>
                                      <span>{formatCurrency(ex.rewardTotal)}</span>
                                    </div>
                                    {ex.rewardTotal > 0 && (
                                      <div className="pl-2 space-y-2 text-xs text-muted-foreground border-l-2 border-border ml-0.5">
                                        <p>
                                          Base ({ex.basePct}% of {formatCurrency(ex.totalCharged)}):{" "}
                                          <span className="text-foreground">{formatCurrency(ex.baseReward)}</span>
                                        </p>
                                        {ex.timeBonus > 0 && (
                                          <p className="text-emerald-600 dark:text-emerald-400">
                                            Time bonus: +{formatCurrency(ex.timeBonus)}
                                          </p>
                                        )}
                                        <ul className="list-disc pl-4 space-y-1">
                                          {ex.timeBonusRules.map((rule) => (
                                            <li key={rule}>{rule}</li>
                                          ))}
                                        </ul>
                                        <div className="border-t border-border/50 pt-2 mt-2 space-y-1">
                                          <p className="text-emerald-700 dark:text-emerald-300">
                                            {ex.supervisorShareLabel}: {formatCurrency(ex.supervisorShare)}
                                          </p>
                                          <p className="text-blue-700 dark:text-blue-300">
                                            Applicator pool ({ex.applicatorMembers} members):{" "}
                                            {formatCurrency(ex.applicatorPool)}
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="space-y-3">
                                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Payment status
                                  </h4>
                                  {isAwaiting ? (
                                    <div className="rounded-lg border border-amber-200/90 bg-amber-50/90 dark:bg-amber-950/30 dark:border-amber-800/50 p-3 text-sm text-amber-950 dark:text-amber-100">
                                      <div className="flex items-start gap-2">
                                        <Hourglass className="size-4 shrink-0 text-amber-600 mt-0.5" />
                                        <div>
                                          <p className="font-semibold text-amber-800 dark:text-amber-200">
                                            Awaiting payment
                                          </p>
                                          <p className="text-xs mt-1 opacity-90 leading-relaxed">
                                            {ex.paymentNote}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="mt-3 space-y-1 text-xs border-t border-amber-200/60 dark:border-amber-800/40 pt-2">
                                        <div className="flex justify-between">
                                          <span className="opacity-80">Total amount</span>
                                          <span className="font-medium tabular-nums">
                                            {formatCurrency(ex.invoiceTotal)}
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="opacity-80">Paid amount</span>
                                          <span className="font-medium tabular-nums">
                                            {formatCurrency(ex.paidAmount)}
                                          </span>
                                        </div>
                                        <div className="flex justify-between font-semibold">
                                          <span>Balance</span>
                                          <span className="tabular-nums">{formatCurrency(balance)}</span>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/80 dark:bg-emerald-950/25 p-3 text-sm">
                                      <p className="font-semibold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                                        <CheckCircle2 className="size-4" />
                                        Paid in full (demo)
                                      </p>
                                      <p className="text-xs text-muted-foreground mt-2">{ex.paymentNote}</p>
                                      <div className="mt-2 text-xs flex justify-between">
                                        <span>Total</span>
                                        <span className="font-medium tabular-nums">
                                          {formatCurrency(ex.invoiceTotal)}
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rewards" className="mt-4 space-y-4">
          <div className="rounded-lg border border-blue-200/80 bg-blue-500/5 dark:bg-blue-950/25 px-4 py-3 text-sm">
            <span className="font-semibold text-blue-900 dark:text-blue-200">Monthly reward projections</span>
            <p className="text-muted-foreground mt-1 text-xs">
              Demo copy: supervisor-heavy jobs credit the team pool; mixed jobs split toward applicators
              based on your policy (configure when backend is live).
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard title="Total revenue" value={formatCurrency(totalJobValueAll)} icon={IndianRupee} tone="blue" />
            <KPICard
              title="Projected rewards"
              value={formatCurrency(totalRewardsAll)}
              icon={Trophy}
              tone="emerald"
            />
            <KPICard
              title="Supervisor share (est.)"
              value={formatCurrency(Math.round(totalRewardsAll * 0.55))}
              icon={Users}
              tone="violet"
            />
            <KPICard
              title="Applicator pool (est.)"
              value={formatCurrency(Math.max(0, Math.round(totalRewardsAll * 0.45)))}
              icon={Users}
              tone="orange"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { tier: "Tier 1", rule: "₹5,000+ revenue", pct: "1%" },
              { tier: "Tier 2", rule: "₹10,000+ revenue", pct: "1.5%" },
              { tier: "Tier 3", rule: "₹12,000+ revenue", pct: "1.8%" },
              { tier: "Tier 4", rule: "₹15,000+ revenue", pct: "2%" },
            ].map((t) => (
              <Card key={t.tier}>
                <CardContent className="pt-4">
                  <p className="font-semibold">{t.tier}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t.rule}</p>
                  <p className="text-lg font-bold mt-2 text-emerald-600 dark:text-emerald-400">{t.pct} reward</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Individual reward breakdown</CardTitle>
              <CardDescription>Job-wise distribution (demo)</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground py-8 text-center">
              {hasScopedJobData
                ? "No paid jobs with qualifying rewards in this slice — tiers above are illustrative."
                : "No reward-eligible jobs for this branch in the selected period."}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="mt-4 space-y-4">
          {usingDemo && (
            <div
              role="status"
              className="rounded-lg border border-amber-200/90 bg-amber-50/90 dark:bg-amber-950/35 dark:border-amber-800/60 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
            >
              <span className="font-semibold">Sample data</span>
              <span className="font-normal opacity-90">
                {" "}
                — No job cards matched this period. Charts use realistic placeholders.{" "}
                <span className="text-foreground/80">{rangeDescription}</span>
              </span>
            </div>
          )}

          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
            <p className="text-sm font-medium">Branch performance analytics</p>
            <p className="text-xs text-muted-foreground mt-0.5">{rangeDescription}</p>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/15">
                  <LineChartIcon className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                </div>
                <div>
                  <CardTitle className="text-base">Jobs completed by branch</CardTitle>
                  <CardDescription className="capitalize">{periodSubtitle}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={jobsCompletedChartData}
                    margin={{ top: 8, right: 8, left: 0, bottom: 32 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="branch" tick={{ fill: "currentColor", fontSize: 11 }} />
                    <YAxis
                      width={40}
                      domain={[0, Math.ceil(jobsMax * 1.1)]}
                      allowDecimals={false}
                      tick={{ fill: "currentColor", fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={tooltipBase}
                      formatter={(value) => [Number(value ?? 0), "Jobs completed"]}
                      labelFormatter={(_, payload) =>
                        (payload?.[0]?.payload as { fullName?: string } | undefined)
                          ?.fullName ?? ""
                      }
                    />
                    <Legend verticalAlign="bottom" />
                    <Bar dataKey="jobsCompleted" name="Jobs completed" radius={[4, 4, 0, 0]}>
                      {jobsCompletedChartData.map((_, i) => (
                        <Cell key={i} fill={JOBS_COMPLETED_BAR} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
                    <IndianRupee className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Revenue by branch</CardTitle>
                    <CardDescription>Total job value this period (estimated)</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  Combined:{" "}
                  <span className="font-medium text-foreground">{formatCurrency(totalJobValueAll)}</span>
                </p>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={revenueChartData}
                      margin={{ top: 8, right: 8, left: 0, bottom: 48 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis
                        dataKey="branch"
                        tick={{ fill: "currentColor", fontSize: 11 }}
                        interval={0}
                        angle={-28}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis
                        width={56}
                        tick={{ fill: "currentColor", fontSize: 11 }}
                        tickFormatter={(v) => {
                          if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
                          if (v >= 1000) return `₹${(v / 1000).toFixed(0)}k`;
                          return `₹${v}`;
                        }}
                      />
                      <Tooltip
                        contentStyle={tooltipBase}
                        formatter={(value) => [
                          formatCurrency(Number(value ?? 0)),
                          "Job value",
                        ]}
                        labelFormatter={(_, payload) =>
                          (payload?.[0]?.payload as { fullName?: string } | undefined)
                            ?.fullName ?? ""
                        }
                      />
                      <Bar dataKey="totalJobValue" name="Job value" radius={[4, 4, 0, 0]}>
                        {revenueChartData.map((_, i) => (
                          <Cell key={i} fill="#10b981" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15">
                    <Target className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Efficiency &amp; on-time rate</CardTitle>
                    <CardDescription>Performance metrics by branch</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={efficiencyChartData}
                      margin={{ top: 8, right: 8, left: 0, bottom: 48 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis
                        dataKey="branch"
                        tick={{ fill: "currentColor", fontSize: 11 }}
                        interval={0}
                        angle={-28}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis
                        domain={[0, 100]}
                        width={36}
                        tick={{ fill: "currentColor", fontSize: 11 }}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <Tooltip
                        contentStyle={tooltipBase}
                        formatter={(value, name) => [
                          `${Number(value ?? 0).toFixed(1)}%`,
                          String(name),
                        ]}
                        labelFormatter={(_, payload) =>
                          (payload?.[0]?.payload as { fullName?: string } | undefined)
                            ?.fullName ?? ""
                        }
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="efficiency"
                        name="Efficiency (%)"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        dot={{ fill: "#8b5cf6", r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="onTime"
                        name="On-time rate (%)"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={{ fill: "#10b981", r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Efficiency = delivered ÷ jobs in period. On-time = share of delivered jobs finished by
                  the expected time.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
                  <Trophy className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <CardTitle className="text-base">Rewards distribution</CardTitle>
                  <CardDescription>Total rewards earned by branch (estimated incentives)</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 lg:grid-cols-[1fr_minmax(200px,280px)] lg:items-center">
                <div className="h-[280px] w-full min-h-[220px]">
                  {totalRewardsAll > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={rewardsPieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={52}
                          outerRadius={88}
                          paddingAngle={2}
                        >
                          {rewardsPieData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={tooltipBase}
                          formatter={(value) => [
                            formatCurrency(Number(value ?? 0)),
                            "Rewards",
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-sm text-muted-foreground px-4 text-center">
                      No incentive amounts for this view.
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Breakdown by branch
                  </p>
                  <ul className="space-y-2">
                    {branchRows.map((r, i) => (
                      <li
                        key={r.branchId}
                        className="flex items-center justify-between gap-2 text-sm border-b border-border/60 pb-2 last:border-0"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-sm"
                            style={{
                              backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                            }}
                          />
                          <span className="truncate" title={r.branchName}>
                            {r.branchName}
                          </span>
                        </span>
                        <span className="shrink-0 font-medium tabular-nums">
                          {formatCurrency(r.totalRewards)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {highlights && (
            <div className="rounded-xl border border-blue-200/80 bg-blue-500/5 dark:bg-blue-950/20 dark:border-blue-900/50 p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-4">
                <Target className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <h2 className="text-sm font-semibold text-foreground">Performance highlights</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-background p-4 shadow-sm">
                  <p className="text-xs text-muted-foreground">Top branch (job value)</p>
                  <p
                    className="mt-1 font-semibold text-foreground truncate"
                    title={highlights.topValue.branchName}
                  >
                    {highlights.topValue.branchName}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatCurrency(highlights.topValue.totalJobValue)} ·{" "}
                    {highlights.topValue.deliveredCount}/{highlights.topValue.jobCount} delivered
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-background p-4 shadow-sm">
                  <p className="text-xs text-muted-foreground">Highest efficiency</p>
                  <p className="mt-1 text-lg font-bold text-violet-600 dark:text-violet-400 tabular-nums">
                    {highlights.topEff.efficiencyPct.toFixed(1)}%
                  </p>
                  <p
                    className="text-xs text-muted-foreground mt-1 truncate"
                    title={highlights.topEff.branchName}
                  >
                    {highlights.topEff.branchName}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-background p-4 shadow-sm">
                  <p className="text-xs text-muted-foreground">Total rewards</p>
                  <p className="mt-1 text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                    {formatCurrency(highlights.totalRewards)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Across selected branches</p>
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
