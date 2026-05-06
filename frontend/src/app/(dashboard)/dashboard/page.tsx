"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KPICard } from "@/components/shared/kpi-card";
import { JobCardStatusBadge } from "@/components/shared/status-badge";
import { useJobCardStore } from "@/store/job-card-store";
import { useBranchStore } from "@/store/branch-store";
import { useAuthStore } from "@/store/auth-store";
import { useDashboardStatsStore } from "@/store/dashboard-stats-store";
import { useReminderStore } from "@/store/reminder-store";
import { isAllBranchesScope } from "@/lib/all-branches";
import { useInventoryStore } from "@/store/inventory-store";
import { useCustomerStore } from "@/store/customer-store";
import { getStockStatus } from "@/lib/inventory-units";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  Car,
  CarFront,
  Wrench,
  IndianRupee,
  UserPlus,
  Plus,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Package,
  Receipt,
  Bell,
  TrendingDown,
  UserX,
  ClipboardList,
  AlertCircle,
  Building2,
  Star,
  Calendar,
  Users,
  BarChart3,
  Eye,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { StaggerGrid } from "@/components/motion/stagger-grid";
import {
  alertStaggerContainer,
  alertStaggerItem,
  easeSmooth,
} from "@/components/motion/dashboard-motion";
import { useDashboardFilterStore, DASHBOARD_FILTER } from "@/store/dashboard-filter-store";
import {
  isTodaysBookingsJob,
  isReadyForDeliveryJob,
  isInactiveCustomer,
} from "@/lib/dashboard-filters";
import type { DashboardStats, JobCard } from "@/types";
import { DashboardSkeleton } from "@/components/shared/skeleton-loader";
import { useDashboardStoresReady } from "@/hooks/use-dashboard-stores-ready";
import { useSettingsStore } from "@/store/settings-store";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { notifyJobReadyWhatsApp } from "@/lib/whatsapp-automation-triggers";

const PENDING_BOOKING_STATUSES: JobCard["status"][] = [
  "RECEIVED",
  "INSPECTION",
  "AWAITING_SERVICE",
];

const FUNNEL_IN_PROGRESS: JobCard["status"][] = [
  "INSPECTION",
  "AWAITING_SERVICE",
  "QUALITY_CHECK",
];

const BRANCH_SHORT: Record<string, string> = {
  "br-main": "PD-DEL",
  "br-002": "PD-NOI",
};

const EMPTY_DASHBOARD_STATS: DashboardStats = {
  averageRating: 0,
  carsReceivedToday: 0,
  carsDeliveredToday: 0,
  inProgressServices: 0,
  dailyRevenue: 0,
  totalExpensesToday: 0,
  netProfitToday: 0,
  newCustomersToday: 0,
  inactiveCustomers: 0,
  activeJobCards: 0,
  pendingPayments: 0,
  monthlyRevenue: [],
  serviceBreakdown: [],
  todaysBookings: [],
  readyForDelivery: [],
};

function daysAgoMidnight(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function DashboardPage() {
  const router = useRouter();
  const setActiveFilter = useDashboardFilterStore((s) => s.setActiveFilter);
  const branches = useBranchStore((s) => s.branches);
  const { jobCards } = useJobCardStore();
  const currentBranch = useAuthStore((s) => s.currentBranch);
  const parts = useInventoryStore((s) => s.parts);
  const customers = useCustomerStore((s) => s.customers);
  const stats =
    useDashboardStatsStore((s) => s.stats) ?? EMPTY_DASHBOARD_STATS;
  const serviceReminders = useReminderStore((s) => s.reminders);
  const businessName = useSettingsStore((s) => s.businessName);

  const viewingLabel = useMemo(() => {
    if (!currentBranch || isAllBranchesScope(currentBranch)) return "All branches";
    return currentBranch.name;
  }, [currentBranch]);

  const selectedBranchId = useMemo(() => {
    if (!currentBranch || isAllBranchesScope(currentBranch)) return null;
    return currentBranch.id;
  }, [currentBranch]);

  const scopedJobCards = useMemo(() => {
    if (!selectedBranchId) return jobCards;
    return jobCards.filter((jc) => jc.branchId === selectedBranchId);
  }, [jobCards, selectedBranchId]);

  const todaysBookingsLive = useMemo(
    () => scopedJobCards.filter(isTodaysBookingsJob),
    [scopedJobCards]
  );
  const readyForDeliveryLive = useMemo(
    () => scopedJobCards.filter(isReadyForDeliveryJob),
    [scopedJobCards]
  );

  const executive = useMemo(() => {
    const d30 = daysAgoMidnight(30);
    const d60 = daysAgoMidnight(60);
    const createdIn30 = scopedJobCards.filter((jc) => new Date(jc.createdAt) >= d30);
    const createdPrevWindow = scopedJobCards.filter((jc) => {
      const c = new Date(jc.createdAt);
      return c >= d60 && c < d30;
    });
    const rev30 = createdIn30.reduce((s, j) => s + j.estimatedAmount, 0);
    const revPrev = createdPrevWindow.reduce((s, j) => s + j.estimatedAmount, 0);
    const revenueTrend =
      revPrev > 0
        ? {
            value: Math.abs(Math.round(((rev30 - revPrev) / revPrev) * 100)),
            isPositive: rev30 >= revPrev,
          }
        : undefined;

    const todaysJobCount = scopedJobCards.filter(isTodaysBookingsJob).length;
    const pendingBookings = scopedJobCards.filter((jc) =>
      PENDING_BOOKING_STATUSES.includes(jc.status)
    ).length;
    const completed30d = scopedJobCards.filter((jc) => {
      if (jc.status !== "DELIVERED") return false;
      const end = jc.actualDelivery
        ? new Date(jc.actualDelivery)
        : new Date(jc.updatedAt);
      return end >= d30;
    }).length;
    const activeCustomers = customers.filter((c) => {
      if (isInactiveCustomer(c)) return false;
      return scopedJobCards.some((jc) => jc.customerId === c.id);
    }).length;

    return {
      totalRevenue30d: rev30,
      revenueTrend,
      todaysJobCount,
      pendingBookings,
      completed30d,
      activeCustomers,
    };
  }, [scopedJobCards, customers]);

  const jobsToday = useMemo(
    () => scopedJobCards.filter(isTodaysBookingsJob),
    [scopedJobCards]
  );

  const todaysFunnel = useMemo(() => {
    const total = jobsToday.length;
    const assigned = jobsToday.filter(
      (j) =>
        Boolean(j.mechanicId) &&
        !["DELIVERED", "CANCELLED", "READY"].includes(j.status)
    ).length;
    const inProgress = jobsToday.filter((j) =>
      FUNNEL_IN_PROGRESS.includes(j.status)
    ).length;
    const completed = jobsToday.filter((j) => j.status === "DELIVERED").length;
    return { total, assigned, inProgress, completed };
  }, [jobsToday]);

  const branchPerformance = useMemo(() => {
    const d30 = daysAgoMidnight(30);
    const branchList = selectedBranchId
      ? branches.filter((b) => b.id === selectedBranchId)
      : branches;
    return branchList.map((branch) => {
      const scoped = scopedJobCards.filter(
        (jc) => jc.branchId === branch.id && new Date(jc.createdAt) >= d30
      );
      const bookings = scoped.length;
      const completed = scoped.filter((jc) => jc.status === "DELIVERED").length;
      const revenue = scoped.reduce((s, j) => s + j.estimatedAmount, 0);
      const completionRate =
        bookings > 0 ? Math.round((completed / bookings) * 100) : 0;
      return {
        branch,
        code: BRANCH_SHORT[branch.id] ?? branch.id.toUpperCase(),
        revenue,
        bookings,
        completed,
        completionRate,
        jobCards: bookings,
        rating: 0,
      };
    });
  }, [scopedJobCards, branches, selectedBranchId]);

  const recentBookings = useMemo(
    () =>
      [...scopedJobCards].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [scopedJobCards]
  );

  const alerts = useMemo(() => {
    const items: {
      id: string;
      icon: React.ElementType;
      label: string;
      count: number;
      href: string;
      color: string;
      bgColor: string;
    }[] = [];

    const overdueJobs = scopedJobCards.filter((jc) => {
      const expected = new Date(jc.expectedDelivery);
      return expected < new Date() && !["DELIVERED", "CANCELLED"].includes(jc.status);
    });
    if (overdueJobs.length > 0) {
      items.push({
        id: "overdue",
        icon: AlertTriangle,
        label: "Overdue job cards",
        count: overdueJobs.length,
        href: "/job-cards",
        color: "text-red-700 dark:text-red-400",
        bgColor: "bg-red-100 dark:bg-red-900/30",
      });
    }

    const lowStock = parts.filter((p) => getStockStatus(p).label === "Low Stock");
    if (lowStock.length > 0) {
      items.push({
        id: "stock",
        icon: Package,
        label: "Low stock items",
        count: lowStock.length,
        href: "/inventory",
        color: "text-amber-700 dark:text-amber-400",
        bgColor: "bg-amber-100 dark:bg-amber-900/30",
      });
    }

    if (stats.pendingPayments > 0) {
      items.push({
        id: "payments",
        icon: Receipt,
        label: "Pending payments",
        count: stats.pendingPayments,
        href: "/billing",
        color: "text-orange-700 dark:text-orange-400",
        bgColor: "bg-orange-100 dark:bg-orange-900/30",
      });
    }

    const overdueReminders = serviceReminders.filter(
      (r) => r.status === "OVERDUE" || r.status === "DUE"
    );
    if (overdueReminders.length > 0) {
      items.push({
        id: "reminders",
        icon: Bell,
        label: "Due service reminders",
        count: overdueReminders.length,
        href: "/reminders",
        color: "text-violet-700 dark:text-violet-400",
        bgColor: "bg-violet-100 dark:bg-violet-900/30",
      });
    }

    if (stats.inactiveCustomers > 0) {
      items.push({
        id: "inactive",
        icon: UserX,
        label: "Inactive customers",
        count: stats.inactiveCustomers,
        href: "/customers",
        color: "text-slate-700 dark:text-slate-400",
        bgColor: "bg-slate-100 dark:bg-slate-900/30",
      });
    }

    return items;
  }, [
    stats.pendingPayments,
    stats.inactiveCustomers,
    scopedJobCards,
    parts,
    serviceReminders,
  ]);

  const branchNameById = useMemo(
    () => Object.fromEntries(branches.map((b) => [b.id, b.name])),
    [branches]
  );

  const dashboardStoresReady = useDashboardStoresReady();
  const reduceMotion = useReducedMotion();

  if (!dashboardStoresReady) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 shrink-0" />
            <span>
              Viewing:{" "}
              <span className="font-medium text-foreground">{viewingLabel}</span>
            </span>
            <span className="text-muted-foreground/70">&middot;</span>
            <time dateTime={new Date().toISOString().slice(0, 10)} className="tabular-nums">
              {formatDate(new Date())}
            </time>
          </p>
        </div>
        <Link href="/job-cards/new" className="w-full sm:w-auto shrink-0">
          <Button className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" />
            New Job Card
          </Button>
        </Link>
      </div>

      {alerts.length > 0 &&
        (reduceMotion ? (
          <div className="flex flex-wrap gap-2">
            {alerts.map((alert) => {
              const filterMap: Record<string, string> = {
                overdue: DASHBOARD_FILTER.OVERDUE,
                stock: DASHBOARD_FILTER.LOW_STOCK,
                payments: DASHBOARD_FILTER.PENDING_PAYMENT,
                reminders: DASHBOARD_FILTER.DUE_SOON,
                inactive: DASHBOARD_FILTER.INACTIVE,
              };
              const filter = filterMap[alert.id];
              return (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => {
                    if (filter) setActiveFilter(filter);
                    router.push(alert.href);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-border ${alert.bgColor} cursor-pointer text-left`}
                >
                  <alert.icon className={`w-4 h-4 ${alert.color}`} />
                  <span className={`text-sm font-semibold ${alert.color}`}>{alert.count}</span>
                  <span className="text-xs text-muted-foreground">{alert.label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <motion.div
            variants={alertStaggerContainer}
            initial="hidden"
            animate="show"
            className="flex flex-wrap gap-2"
          >
            {alerts.map((alert) => {
              const filterMap: Record<string, string> = {
                overdue: DASHBOARD_FILTER.OVERDUE,
                stock: DASHBOARD_FILTER.LOW_STOCK,
                payments: DASHBOARD_FILTER.PENDING_PAYMENT,
                reminders: DASHBOARD_FILTER.DUE_SOON,
                inactive: DASHBOARD_FILTER.INACTIVE,
              };
              const filter = filterMap[alert.id];
              return (
                <motion.button
                  key={alert.id}
                  type="button"
                  variants={alertStaggerItem}
                  onClick={() => {
                    if (filter) setActiveFilter(filter);
                    router.push(alert.href);
                  }}
                  whileHover={{
                    y: -1,
                    transition: { delay: 0.2, duration: 0.75, ease: easeSmooth },
                  }}
                  whileTap={{ scale: 0.99 }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-border ${alert.bgColor} cursor-pointer text-left hover:shadow-sm`}
                >
                  <alert.icon className={`w-4 h-4 ${alert.color}`} />
                  <span className={`text-sm font-semibold ${alert.color}`}>{alert.count}</span>
                  <span className="text-xs text-muted-foreground">{alert.label}</span>
                </motion.button>
              );
            })}
          </motion.div>
        ))}

      {/* Revenue & collections — all money metrics first */}
      <div className="space-y-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Revenue &amp; collections
          </p>
          <StaggerGrid className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <KPICard
              tone="emerald"
              title="Total Revenue"
              value={formatCurrency(executive.totalRevenue30d)}
              subtitle="Last 30 days"
              footerNote={viewingLabel}
              icon={IndianRupee}
              trend={executive.revenueTrend}
            />
            <KPICard
              tone="emerald"
              title="Today's Revenue"
              value={formatCurrency(stats.dailyRevenue)}
              subtitle="collected"
              icon={IndianRupee}
            />
            <KPICard
              tone="blue"
              title="Net Profit Today"
              value={formatCurrency(stats.netProfitToday)}
              subtitle="revenue - expenses"
              icon={IndianRupee}
            />
            <KPICard
              tone="amber"
              title="Pending Payments"
              value={stats.pendingPayments}
              subtitle="awaiting collection"
              icon={AlertCircle}
            />
            <KPICard
              tone="rose"
              title="Total Expenses Today"
              value={formatCurrency(stats.totalExpensesToday)}
              subtitle="today"
              icon={TrendingDown}
            />
          </StaggerGrid>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Overview
          </p>
          <StaggerGrid className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KPICard
              tone="blue"
              title={"Today's Jobs"}
              value={executive.todaysJobCount}
              footerNote={viewingLabel}
              icon={Calendar}
            />
            <KPICard
              tone="amber"
              title="Pending Bookings"
              value={executive.pendingBookings}
              footerNote={viewingLabel}
              icon={Clock}
            />
            <KPICard
              tone="violet"
              title="Completed Services"
              value={executive.completed30d}
              subtitle="Last 30 days"
              footerNote={viewingLabel}
              icon={CheckCircle2}
            />
            <KPICard
              tone="orange"
              title="Average Rating"
              value={stats.averageRating.toFixed(1)}
              footerNote={viewingLabel}
              icon={Star}
            />
            <KPICard
              tone="blue"
              title="Active Customers"
              value={executive.activeCustomers}
              footerNote={viewingLabel}
              icon={Users}
            />
          </StaggerGrid>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Operations
          </p>
          <StaggerGrid className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
            <KPICard
              tone="blue"
              title="Cars Received"
              value={stats.carsReceivedToday}
              subtitle="today"
              icon={Car}
              trend={{ value: 12, isPositive: true }}
            />
            <KPICard
              tone="violet"
              title="Cars Delivered"
              value={stats.carsDeliveredToday}
              subtitle="today"
              icon={CarFront}
              trend={{ value: 8, isPositive: true }}
            />
            <KPICard
              tone="orange"
              title="In Progress"
              value={stats.inProgressServices}
              subtitle="services"
              icon={Wrench}
            />
            <KPICard
              tone="emerald"
              title="Active Job Cards"
              value={stats.activeJobCards}
              subtitle="in progress"
              icon={ClipboardList}
            />
            <KPICard
              tone="blue"
              title="New Customers"
              value={stats.newCustomersToday}
              subtitle="today"
              icon={UserPlus}
            />
            <KPICard
              tone="slate"
              title="Inactive Customers"
              value={stats.inactiveCustomers}
              subtitle="need follow-up"
              icon={UserX}
            />
          </StaggerGrid>
        </div>
      </div>

      {/* Today's Jobs funnel */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-base font-semibold">Today&apos;s Jobs</CardTitle>
          <Button variant="link" className="h-auto p-0 text-emerald-600" asChild>
            <Link href="/job-cards">Show</Link>
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          <StaggerGrid className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {(
              [
                {
                  label: "Total",
                  value: todaysFunnel.total,
                  className:
                    "bg-slate-100/90 text-slate-900 dark:bg-slate-800/50 dark:text-slate-100",
                },
                {
                  label: "Assigned",
                  value: todaysFunnel.assigned,
                  className:
                    "bg-sky-100/90 text-sky-900 dark:bg-sky-950/40 dark:text-sky-100",
                },
                {
                  label: "In Progress",
                  value: todaysFunnel.inProgress,
                  className:
                    "bg-violet-100/90 text-violet-900 dark:bg-violet-950/40 dark:text-violet-100",
                },
                {
                  label: "Completed",
                  value: todaysFunnel.completed,
                  className:
                    "bg-emerald-100/90 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
                },
              ] as const
            ).map((tile) => (
              <div
                key={tile.label}
                className={`flex min-h-28 flex-col items-center justify-center rounded-xl px-3 py-5 text-center ${tile.className}`}
              >
                <p className="text-xs font-medium opacity-80">{tile.label}</p>
                <p className="text-3xl font-bold tabular-nums mt-1">{tile.value}</p>
              </div>
            ))}
          </StaggerGrid>
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Quick actions
        </p>
        <StaggerGrid className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              {
                href: "/job-cards",
                title: "Manage Job Cards",
                desc: "View and assign jobs",
                icon: Wrench,
              },
              {
                href: "/services",
                title: "Service Packages",
                desc: "Manage services",
                icon: Calendar,
              },
              {
                href: "/customers",
                title: "Users",
                desc: "Manage customers & staff",
                icon: Users,
              },
              {
                href: "/reports",
                title: "Analytics",
                desc: "View detailed reports",
                icon: BarChart3,
              },
            ] as const
          ).map((item) => (
            <Link key={item.href} href={item.href} className="block h-full min-h-[140px]">
              <Card className="h-full translate-y-0 transform-gpu will-change-transform transition-[transform,box-shadow] duration-[12000ms] ease-[cubic-bezier(0.45,0,0.55,1)] motion-safe:hover:-translate-y-1 hover:shadow-md">
                <div className="flex h-full min-h-[140px] flex-col items-center justify-center gap-3 px-5 py-8 text-center">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </StaggerGrid>
      </div>

      {/* Branch performance */}
      <div>
        <p className="text-sm font-semibold flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          Branch Performance (Last 30 Days)
        </p>
        <StaggerGrid className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {branchPerformance.map(
            ({ branch, code, revenue, bookings, completed, completionRate, jobCards, rating }) => (
              <Card key={branch.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{branch.name}</CardTitle>
                  <p className="text-xs font-mono text-muted-foreground">{code}</p>
                </CardHeader>
                <CardContent className="grid gap-2 text-sm">
                  {(
                    [
                      ["Revenue", formatCurrency(revenue)],
                      ["Bookings", String(bookings)],
                      ["Completed", String(completed)],
                      ["Completion Rate", `${completionRate}%`],
                      ["Job Cards", String(jobCards)],
                      ["Rating", String(rating)],
                    ] as const
                  ).map(([label, val]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between gap-4 border-b border-border/60 py-2 last:border-0"
                    >
                      <span className="text-muted-foreground">{label}</span>
                      <span
                        className={
                          label === "Revenue"
                            ? "font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums"
                            : label === "Completion Rate"
                              ? "font-medium text-blue-600 dark:text-blue-400 tabular-nums"
                              : "font-medium tabular-nums text-right"
                        }
                      >
                        {val}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          )}
        </StaggerGrid>
      </div>

      {/* Today's Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-base font-semibold">Today&apos;s Bookings</CardTitle>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Job cards created today</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setActiveFilter(DASHBOARD_FILTER.TODAYS_BOOKINGS);
                router.push("/job-cards");
              }}
            >
              View all <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {todaysBookingsLive.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No bookings today</p>
            ) : (
              <div className="max-h-[min(260px,45vh)] overflow-y-auto overscroll-contain space-y-3 pr-1 -mr-0.5 [scrollbar-gutter:stable]">
                {todaysBookingsLive.map((jc) => (
                  <Link
                    key={jc.id}
                    href={`/job-cards/${jc.id}`}
                    className="flex shrink-0 items-center justify-between rounded-lg border border-border p-3 transition-[background-color,border-color] duration-[850ms] ease-[cubic-bezier(0.45,0,0.55,1)] hover:bg-muted/50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{jc.jobNumber}</span>
                        <JobCardStatusBadge status={jc.status} />
                      </div>
                      <p className="text-sm font-medium mt-1 truncate">{jc.customerName}</p>
                      <p className="text-xs text-muted-foreground">
                        {jc.vehicleRegNumber} &middot; {jc.vehicleMakeModel}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-xs text-muted-foreground">
                        {jc.mechanicName || "Unassigned"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <CardTitle className="text-base font-semibold">Ready for Delivery</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setActiveFilter(DASHBOARD_FILTER.READY_FOR_DELIVERY);
                router.push("/job-cards");
              }}
            >
              View all <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {readyForDeliveryLive.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No vehicles ready for delivery
              </p>
            ) : (
              <div className="max-h-[min(260px,45vh)] overflow-y-auto overscroll-contain space-y-3 pr-1 -mr-0.5 [scrollbar-gutter:stable]">
                {readyForDeliveryLive.map((jc) => (
                  <div
                    key={jc.id}
                    className="flex shrink-0 items-center gap-2 rounded-lg border border-border p-3 transition-[background-color,border-color] duration-[850ms] ease-[cubic-bezier(0.45,0,0.55,1)] hover:bg-muted/50"
                  >
                    <Link
                      href={`/job-cards/${jc.id}`}
                      className="flex flex-1 min-w-0 items-center justify-between gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{jc.jobNumber}</span>
                          <JobCardStatusBadge status={jc.status} />
                        </div>
                        <p className="text-sm font-medium mt-1 truncate">{jc.customerName}</p>
                        <p className="text-xs text-muted-foreground">
                          {jc.vehicleRegNumber} &middot; {jc.vehicleMakeModel}
                        </p>
                      </div>
                      <div className="text-right ml-4 shrink-0">
                        <p className="text-xs text-muted-foreground">{jc.customerPhone}</p>
                      </div>
                    </Link>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-[#25D366] hover:text-[#128C7E] hover:bg-emerald-500/10"
                      title="WhatsApp: ready for pickup"
                      onClick={() => notifyJobReadyWhatsApp(jc, businessName)}
                    >
                      <WhatsAppIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent bookings table */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-4">
          <CardTitle className="text-base font-semibold">Recent Bookings</CardTitle>
          <Button variant="default" size="sm" asChild>
            <Link href="/bookings">View All Bookings</Link>
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="md:hidden space-y-2">
            {recentBookings.slice(0, 10).map((jc, i) => (
              <div
                key={jc.id}
                className={cn(
                  "rounded-lg border border-border/80 p-3 text-sm",
                  i % 2 === 0 ? "bg-background" : "bg-muted/25"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-primary">{jc.jobNumber}</span>
                  <JobCardStatusBadge status={jc.status} className="shrink-0 whitespace-nowrap text-[10px]" />
                </div>
                <p className="font-medium mt-1.5 leading-tight">{jc.customerName}</p>
                <p className="text-xs text-muted-foreground mt-1">{jc.services[0]?.name ?? "—"}</p>
                <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  <dt className="text-muted-foreground">Booked</dt>
                  <dd className="text-foreground">{formatDate(jc.createdAt)}</dd>
                  <dt className="text-muted-foreground">Price</dt>
                  <dd className="text-foreground tabular-nums font-medium">{formatCurrency(jc.estimatedAmount)}</dd>
                  <dt className="text-muted-foreground">Branch</dt>
                  <dd className="text-foreground min-w-0 truncate">{branchNameById[jc.branchId] ?? jc.branchId}</dd>
                </dl>
                <div className="flex items-center justify-end gap-1 mt-3 pt-2 border-t border-border/80">
                  <Button variant="outline" size="sm" className="h-8" asChild>
                    <Link href={`/job-cards/${jc.id}`}>
                      <ClipboardList className="w-3.5 h-3.5 mr-1.5" />
                      Open
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
                    <Link href={`/job-cards/${jc.id}`} aria-label="View job card">
                      <Eye className="w-4 h-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-3 py-3.5 align-middle font-semibold whitespace-nowrap">ID</th>
                  <th className="px-3 py-3.5 align-middle font-semibold">Customer</th>
                  <th className="px-3 py-3.5 align-middle font-semibold">Service</th>
                  <th className="px-3 py-3.5 align-middle font-semibold whitespace-nowrap">Booking Date</th>
                  <th className="px-3 py-3.5 align-middle font-semibold whitespace-nowrap">Booked On</th>
                  <th className="px-3 py-3.5 align-middle font-semibold whitespace-nowrap">Price</th>
                  <th className="px-3 py-3.5 align-middle font-semibold min-w-[140px] w-[9rem]">Status</th>
                  <th className="px-3 py-3.5 align-middle font-semibold">Branch</th>
                  <th className="px-3 py-3.5 align-middle font-semibold text-center w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentBookings.slice(0, 10).map((jc, i) => (
                  <tr key={jc.id} className={cnRow(i)}>
                    <td className="px-3 py-3.5 align-middle font-mono text-xs whitespace-nowrap">{jc.jobNumber}</td>
                    <td className="px-3 py-3.5 align-middle font-medium max-w-[140px]">{jc.customerName}</td>
                    <td className="px-3 py-3.5 align-middle text-muted-foreground max-w-[200px]">
                      {jc.services[0]?.name ?? "—"}
                    </td>
                    <td className="px-3 py-3.5 align-middle whitespace-nowrap text-muted-foreground">
                      {formatDate(jc.createdAt)}
                    </td>
                    <td className="px-3 py-3.5 align-middle whitespace-nowrap text-muted-foreground">
                      {formatDate(jc.createdAt)}
                    </td>
                    <td className="px-3 py-3.5 align-middle whitespace-nowrap tabular-nums">
                      {formatCurrency(jc.estimatedAmount)}
                    </td>
                    <td className="px-3 py-3.5 align-middle">
                      <JobCardStatusBadge status={jc.status} className="whitespace-nowrap shrink-0" />
                    </td>
                    <td className="px-3 py-3.5 align-middle text-muted-foreground max-w-[180px]">
                      {branchNameById[jc.branchId] ?? jc.branchId}
                    </td>
                    <td className="px-3 py-3.5 align-middle text-center">
                      <div className="inline-flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                          <Link href={`/job-cards/${jc.id}`} aria-label="Open job card">
                            <ClipboardList className="w-4 h-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                          <Link href={`/job-cards/${jc.id}`} aria-label="View job card">
                            <Eye className="w-4 h-4" />
                          </Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function cnRow(i: number): string {
  return i % 2 === 0 ? "border-b border-border/60 bg-background" : "border-b border-border/60 bg-muted/20";
}
