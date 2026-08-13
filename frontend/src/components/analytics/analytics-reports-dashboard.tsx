"use client";

import { useMemo, useState, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
} from "recharts";
import {
  Download,
  IndianRupee,
  Calendar,
  TrendingUp,
  Package,
  ShoppingCart,
  Boxes,
  AlertTriangle,
  Clock,
  ChevronUp,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KPICard } from "@/components/shared/kpi-card";
import { StaggerGrid } from "@/components/motion/stagger-grid";
import { formatCurrency, cn } from "@/lib/utils";
import { useInvoiceStore } from "@/store/invoice-store";
import { useJobCardStore } from "@/store/job-card-store";
import { useCustomerStore } from "@/store/customer-store";
import { useInventoryStore } from "@/store/inventory-store";
import { useBranchStore } from "@/store/branch-store";
import { filterInvoicesByBranch, useBranchScope } from "@/lib/branch-scope";
import { getStockStatus } from "@/lib/inventory-units";
import { useDashboardStatsStore } from "@/store/dashboard-stats-store";
import {
  rangeStartDays,
  revenueByDay,
  bookingsTrend,
  bookingStatusDistribution,
  topServicesByRevenue,
  revenueByServiceFromInvoices,
  paymentMethodDistribution,
  peakBookingHours,
  partsAnalytics,
  partsByCategory,
  mostUsedPartsFromInvoices,
  customerMetrics,
  revenueBetween,
  type DateRangeKey,
} from "@/lib/analytics/compute-metrics";
import Link from "next/link";
import { CHART_TOOLTIP_PROPS } from "@/lib/chart-tooltip";

const EMERALD = "#059669";

function MotionCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
    >
      {children}
    </motion.div>
  );
}

export function AnalyticsReportsDashboard() {
  const [range, setRange] = useState<DateRangeKey>("7d");
  const invoices = useInvoiceStore((s) => s.invoices);
  const jobCards = useJobCardStore((s) => s.jobCards);
  const customers = useCustomerStore((s) => s.customers);
  const parts = useInventoryStore((s) => s.parts);
  const { selectedBranchId, viewingLabel } = useBranchScope();
  const branches = useBranchStore((s) => s.branches);
  const averageRating = useDashboardStatsStore((s) => s.stats?.averageRating ?? 0);

  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const start = useMemo(() => rangeStartDays(days), [days]);

  const scopedJobs = useMemo(
    () =>
      selectedBranchId
        ? jobCards.filter((j) => j.branchId === selectedBranchId)
        : jobCards,
    [jobCards, selectedBranchId]
  );

  const scopedInvoices = useMemo(
    () => filterInvoicesByBranch(invoices, jobCards, selectedBranchId),
    [invoices, jobCards, selectedBranchId]
  );

  const scopeLabel = viewingLabel;

  const metrics = useMemo(() => {
    const revDaily = revenueByDay(scopedInvoices, start);
    const totalRev = revDaily.reduce((s, d) => s + d.amount, 0);
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - days);
    const prevRev = revenueBetween(scopedInvoices, prevStart, start);
    const trendPct =
      prevRev > 0 ? ((totalRev - prevRev) / prevRev) * 100 : totalRev > 0 ? 100 : 0;

    const jobsInRange = scopedJobs.filter((j) => new Date(j.createdAt) >= start);
    const completed = jobsInRange.filter((j) => j.status === "DELIVERED").length;
    const bookings = jobsInRange.length;

    const peak =
      revDaily.length > 0
        ? revDaily.reduce(
            (best, d) => (d.amount > best.amount ? d : best),
            revDaily[0]
          )
        : { label: "—", amount: 0 };

    const nonzeroDays = revDaily.filter((x) => x.amount > 0).length;
    const avgPeriod = nonzeroDays > 0 ? totalRev / nonzeroDays : 0;

    const statusDist = bookingStatusDistribution(scopedJobs, start, 6);
    const topSvc = topServicesByRevenue(scopedJobs, start, 4);
    const svcTable = revenueByServiceFromInvoices(scopedInvoices, start);
    const payDist = paymentMethodDistribution(scopedInvoices, start);
    const hours = peakBookingHours(scopedJobs, start);
    const trendBook = bookingsTrend(scopedJobs, start);
    const partsM = partsAnalytics(scopedInvoices, parts, start);
    const catRows = partsByCategory(parts);
    const mostUsed = mostUsedPartsFromInvoices(scopedInvoices, start, 5);
    const cust = customerMetrics(customers, scopedJobs, start);
    const lowStockParts = parts.filter((p) => getStockStatus(p).label === "Low Stock");

    const busiestHour = hours.reduce((b, h) => (h.count > b.count ? h : b), hours[0]);

    return {
      revDaily,
      totalRev,
      trendPct,
      bookings,
      completed,
      peak,
      avgPeriod,
      statusDist,
      topSvc,
      svcTable,
      payDist,
      hours,
      trendBook,
      partsM,
      catRows,
      mostUsed,
      cust,
      lowStockParts,
      busiestHour,
    };
  }, [scopedInvoices, scopedJobs, customers, parts, start, days]);

  const scrollTop = useCallback(() => {
    document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const onExport = () => {
    toast.success("Report export queued.");
  };

  return (
    <div className="relative space-y-6 pb-20">
      <PageHeader
        title="Analytics & Reports"
        description={`Branch: ${scopeLabel}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={range} onValueChange={(v) => setRange(v as DateRangeKey)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="90d">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={onExport}>
              <Download className="mr-2 h-4 w-4" />
              Export Report
            </Button>
          </div>
        }
      />

      <StaggerGrid className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          tone="emerald"
          title="Total revenue"
          value={formatCurrency(metrics.totalRev)}
          subtitle="week performance"
          icon={IndianRupee}
          trend={{
            value: Math.min(9999, Math.abs(Math.round(metrics.trendPct * 100) / 100)),
            isPositive: metrics.trendPct >= 0,
          }}
        />
        <KPICard
          tone="emerald"
          title="Total bookings"
          value={metrics.bookings}
          subtitle="in selected period"
          icon={Calendar}
        />
        <KPICard
          tone="emerald"
          title="Completed"
          value={metrics.completed}
          subtitle="delivered jobs"
          icon={TrendingUp}
        />
        <KPICard
          tone="emerald"
          title="Avg. rating"
          value={averageRating.toFixed(1)}
          subtitle="customer feedback"
          icon={BarChart3}
        />
      </StaggerGrid>

      <MotionCard>
        <Card className="overflow-hidden border-border/80 bg-gradient-to-br from-white to-emerald-50/40 dark:from-card dark:to-emerald-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Revenue over time</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-[280px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.revDaily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/80" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <YAxis
                    width={48}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `₹${Math.round(v / 1000)}k`}
                  />
                  <Tooltip
                    {...CHART_TOOLTIP_PROPS}
                    formatter={(v) => [formatCurrency(Number(v ?? 0)), "Revenue"]}
                  />
                  <Bar
                    dataKey="amount"
                    name="Revenue"
                    fill={EMERALD}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={48}
                    animationDuration={900}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                {
                  label: "Total revenue",
                  value: formatCurrency(metrics.totalRev),
                  sub: "period total",
                  tint: "from-emerald-50 to-background dark:from-emerald-950/40 dark:to-card",
                },
                {
                  label: "Avg / period",
                  value: formatCurrency(metrics.avgPeriod),
                  sub: "per active day",
                  tint: "from-emerald-50 to-background dark:from-emerald-950/40 dark:to-card",
                },
                {
                  label: "Peak data point",
                  value: metrics.peak.label,
                  sub: formatCurrency(metrics.peak.amount),
                  tint: "from-muted/40 to-background dark:from-muted/20 dark:to-card",
                },
              ].map((c) => (
                <div
                  key={c.label}
                  className={cn(
                    "rounded-xl border border-border/60 bg-gradient-to-br px-4 py-3 shadow-sm",
                    c.tint
                  )}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    {c.label}
                  </p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{c.value}</p>
                  <p className="text-xs text-muted-foreground">{c.sub}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </MotionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <MotionCard>
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
              <div>
                <CardTitle className="text-base">Booking status distribution</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Showing {metrics.statusDist.rows.length} of {metrics.statusDist.totalStatuses} statuses
                </p>
              </div>
              <Link href="/job-cards" className="text-xs font-medium text-emerald-600 hover:underline">
                Show all
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              {metrics.statusDist.rows.map((row) => (
                <div key={row.name} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="font-medium">{row.name}</span>
                    </span>
                    <span className="flex items-center gap-2 tabular-nums">
                      <span>{row.count}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{row.pct}%</span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className="h-full rounded-full bg-emerald-500"
                      initial={false}
                      animate={{ width: `${row.pct}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-3 gap-2 border-t pt-4 text-center text-sm">
                <div>
                  <p className="text-lg font-bold">{metrics.completed}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
                <div>
                  <p className="text-lg font-bold">
                    {scopedJobs.filter((j) => j.status === "CANCELLED").length}
                  </p>
                  <p className="text-xs text-muted-foreground">Cancelled</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-emerald-600">
                    {metrics.bookings > 0
                      ? `${Math.round((metrics.completed / metrics.bookings) * 100)}%`
                      : "0%"}
                  </p>
                  <p className="text-xs text-muted-foreground">Success rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </MotionCard>

        <MotionCard>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top performing services</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {metrics.topSvc.length === 0 ? (
                <p className="text-sm text-muted-foreground">No service data in this range.</p>
              ) : (
                metrics.topSvc.map((s, idx) => (
                  <motion.div
                    key={s.name}
                    initial={{ opacity: 0, x: 8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 p-3"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.bookings} bookings</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-600">{formatCurrency(s.revenue)}</p>
                      <p className="text-[10px] uppercase text-muted-foreground">revenue</p>
                    </div>
                  </motion.div>
                ))
              )}
              <p className="pt-1 text-center text-xs text-muted-foreground">
                Based on {metrics.topSvc.length} active services
              </p>
            </CardContent>
          </Card>
        </MotionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <MotionCard>
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Customer retention</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center py-4">
              <div className="h-44 w-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "retained", value: metrics.cust.retentionPct },
                        { name: "rest", value: Math.max(0, 100 - metrics.cust.retentionPct) },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={72}
                      startAngle={90}
                      endAngle={-270}
                      dataKey="value"
                      stroke="none"
                    >
                      <Cell fill={EMERALD} />
                      <Cell fill="#e5e7eb" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <p className="text-3xl font-bold tabular-nums">{metrics.cust.retentionPct.toFixed(2)}%</p>
              <p className="text-xs text-muted-foreground">Customer retention rate</p>
            </CardContent>
          </Card>
        </MotionCard>

        <MotionCard>
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Rating distribution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[5, 4, 3, 2, 1].map((stars) => (
                <div key={stars} className="flex items-center gap-2 text-sm">
                  <span className="w-8 shrink-0">{stars}★</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-0 rounded-full bg-emerald-500" />
                  </div>
                  <span className="w-6 text-right tabular-nums text-muted-foreground">0</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </MotionCard>

        <MotionCard>
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Customer metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Total customers", value: metrics.cust.total, tone: "emerald" as const },
                { label: "New (period)", value: metrics.cust.newWeek, tone: "emerald" as const },
                { label: "Active (period)", value: metrics.cust.activeWeek, tone: "slate" as const },
              ].map((m) => (
                <div
                  key={m.label}
                  className={cn(
                    "rounded-xl border px-4 py-3",
                    m.tone === "emerald"
                      ? "border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-card"
                      : "border-border bg-muted/40"
                  )}
                >
                  <p
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wider",
                      m.tone === "emerald" ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"
                    )}
                  >
                    {m.label}
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-2xl font-bold",
                      m.tone === "emerald" ? "text-emerald-700 dark:text-emerald-300" : "text-foreground"
                    )}
                  >
                    {m.value}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </MotionCard>
      </div>

      <div>
        <div className="mb-3 flex items-center gap-2">
          <Package className="h-5 w-5 text-emerald-600" />
          <h2 className="text-lg font-semibold">Parts analytics</h2>
        </div>
        <StaggerGrid className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KPICard
            tone="emerald"
            title="Parts revenue"
            value={formatCurrency(metrics.partsM.partsRevenue)}
            subtitle={`${metrics.partsM.marginPct}% profit margin`}
            icon={IndianRupee}
          />
          <KPICard
            tone="emerald"
            title="Parts used"
            value={metrics.partsM.partsUsed}
            subtitle={`${formatCurrency(metrics.partsM.partsProfit)} profit`}
            icon={ShoppingCart}
          />
          <KPICard
            tone="emerald"
            title="On-hand value"
            value={formatCurrency(metrics.partsM.inventoryValue)}
            subtitle={`${parts.length} parts in stock`}
            icon={Boxes}
          />
          <KPICard
            tone={metrics.partsM.stockAlerts > 0 ? "rose" : "emerald"}
            title="Stock alerts"
            value={metrics.partsM.stockAlerts}
            subtitle={`${metrics.lowStockParts.length} low stock`}
            icon={AlertTriangle}
          />
        </StaggerGrid>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <MotionCard>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Most used parts</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
              {metrics.mostUsed.length === 0 ? (
                <p className="text-sm text-muted-foreground">No parts usage in this range.</p>
              ) : (
                metrics.mostUsed.map((row, i) => (
                  <div
                    key={row.name}
                    className="flex items-start gap-3 rounded-lg border border-transparent bg-muted/20 px-2 py-2 transition-[background-color,border-color] duration-200 ease-out hover:border-emerald-200/50 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20"
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-snug">{row.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.units} units · {row.times} times
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-600">{formatCurrency(row.cost)}</p>
                      <p className="text-[10px] uppercase text-muted-foreground">{row.margin.toFixed(1)}% margin</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </MotionCard>

        <MotionCard>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Most profitable parts</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
              {metrics.mostUsed.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data.</p>
              ) : (
                metrics.mostUsed.map((row, i) => {
                  const profit = row.cost * (row.margin / 100);
                  return (
                    <div
                      key={`p-${row.name}`}
                      className="flex items-start gap-3 rounded-lg border border-transparent bg-muted/20 px-2 py-2 transition-[background-color,border-color] duration-200 ease-out hover:border-emerald-200/50 hover:bg-emerald-50/30"
                    >
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-snug">{row.name}</p>
                        <p className="text-xs text-muted-foreground">Revenue: {formatCurrency(row.cost)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-emerald-600">{formatCurrency(profit)}</p>
                        <p className="text-[10px] uppercase text-muted-foreground">profit</p>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </MotionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <MotionCard>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Low stock alerts</CardTitle>
            </CardHeader>
            <CardContent>
              {metrics.lowStockParts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <AlertTriangle className="mb-2 h-10 w-10 opacity-40" />
                  <p className="text-sm">No low stock alerts</p>
                </div>
              ) : (
                <ul className="space-y-2 text-sm">
                  {metrics.lowStockParts.slice(0, 8).map((p) => (
                    <li key={p.id} className="flex justify-between gap-2 border-b border-border/60 py-2 last:border-0">
                      <span className="truncate font-medium">{p.name}</span>
                      <span className="shrink-0 tabular-nums text-rose-600">{p.quantity} left</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </MotionCard>

        <MotionCard>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Parts by category</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
              {metrics.catRows.map((c) => (
                <div
                  key={c.category}
                  className="rounded-xl border border-border/60 bg-gradient-to-br from-muted/30 to-background p-3 transition-[box-shadow] duration-300 ease-in-out hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      {c.category}
                    </span>
                    <span className="text-sm font-bold">{c.count} parts</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Stock</p>
                      <p className="font-bold tabular-nums">{c.stock}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Value</p>
                      <p className="font-bold tabular-nums">{formatCurrency(c.value)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </MotionCard>
      </div>

      <MotionCard>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payment methods distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 text-3xl font-bold tabular-nums">
              {formatCurrency(metrics.payDist.total)}
            </div>
            <div className="space-y-4">
              {metrics.payDist.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payment data in this period.</p>
              ) : null}
              {metrics.payDist.rows.map((row) => (
                <div key={row.method} className="space-y-1">
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-sm bg-emerald-500" />
                      {row.method}
                    </span>
                    <span>{formatCurrency(row.amount)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
                      initial={false}
                      animate={{ width: `${row.pct}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {row.count} transactions ({row.pct.toFixed(1)}%)
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </MotionCard>

      <MotionCard>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue by service category</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Service</th>
                  <th className="px-3 py-2 text-right font-medium">Bookings</th>
                  <th className="px-3 py-2 text-right font-medium">Revenue</th>
                  <th className="px-3 py-2 text-right font-medium">Avg price</th>
                  <th className="px-3 py-2 text-right font-medium">Growth</th>
                </tr>
              </thead>
              <tbody>
                {metrics.svcTable.slice(0, 12).map((r) => (
                  <tr key={r.service} className="border-b border-border/60 transition-colors duration-200 ease-out hover:bg-muted/40">
                    <td className="max-w-[220px] truncate px-3 py-2.5 font-medium">{r.service}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.bookings}</td>
                    <td
                      className={cn(
                        "px-3 py-2.5 text-right font-semibold tabular-nums",
                        r.revenue > 0 ? "text-emerald-600" : "text-muted-foreground"
                      )}
                    >
                      {formatCurrency(r.revenue)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                      {formatCurrency(r.avgPrice)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                        {r.revenue > 0 ? "+100%" : "+0%"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </MotionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <MotionCard>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Peak booking hours</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.hours.filter((_, i) => i >= 8 && i <= 20)} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/80" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={1} />
                    <YAxis allowDecimals={false} width={32} tick={{ fontSize: 10 }} />
                    <Tooltip {...CHART_TOOLTIP_PROPS} />
                    <Bar dataKey="count" fill={EMERALD} radius={[6, 6, 0, 0]} animationDuration={800} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex items-center justify-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm dark:bg-emerald-950/30">
                <Clock className="h-4 w-4 text-emerald-600" />
                <span>
                  Busiest:{" "}
                  <strong>{metrics.busiestHour.label}</strong>{" "}
                  <span className="text-emerald-700 dark:text-emerald-400">
                    ({metrics.busiestHour.count} bookings)
                  </span>
                </span>
              </div>
            </CardContent>
          </Card>
        </MotionCard>

        <MotionCard>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Booking trends over time</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics.trendBook} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="fillBook" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={EMERALD} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={EMERALD} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/80" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} width={28} tick={{ fontSize: 10 }} />
                    <Tooltip {...CHART_TOOLTIP_PROPS} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke={EMERALD}
                      strokeWidth={2}
                      fill="url(#fillBook)"
                      animationDuration={1000}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { k: "Total", v: metrics.trendBook.reduce((s, d) => s + d.count, 0) },
                  {
                    k: "Avg/day",
                    v:
                      metrics.trendBook.length > 0
                        ? Math.round(
                            metrics.trendBook.reduce((s, d) => s + d.count, 0) / metrics.trendBook.length
                          )
                        : 0,
                  },
                  {
                    k: "Peak day",
                    v: metrics.trendBook.reduce((b, d) => (d.count > b.count ? d : b), metrics.trendBook[0] ?? { count: 0 }).count,
                  },
                ].map((x) => (
                  <div
                    key={x.k}
                    className="rounded-xl border border-emerald-200/50 bg-gradient-to-br from-emerald-50 to-white px-3 py-2 text-center dark:from-emerald-950/40 dark:to-card"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      {x.k}
                    </p>
                    <p className="text-xl font-bold text-emerald-800 dark:text-emerald-200">{x.v}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </MotionCard>
      </div>

      <motion.button
        type="button"
        aria-label="Scroll to top"
        onClick={scrollTop}
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-colors duration-200 ease-in-out hover:bg-primary/90"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <ChevronUp className="h-5 w-5" />
      </motion.button>
    </div>
  );
}
