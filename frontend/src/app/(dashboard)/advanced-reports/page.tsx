"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  downloadCustomerLifetimeAnalysisPdf,
  downloadRevenuePerformancePdf,
  downloadSimpleTablePdf,
} from "@/lib/advanced-report-pdf";
import { useAdvancedReportSchedulesStore } from "@/store/advanced-report-schedules-store";
import { useCustomerStore } from "@/store/customer-store";
import { useScopedInvoices, useScopedJobCards } from "@/hooks/use-scoped-data";
import { useBranchScope } from "@/lib/branch-scope";
import { useSettingsStore } from "@/store/settings-store";
import {
  BarChart3,
  Calendar,
  Clock,
  Download,
  Filter,
  LineChart,
  PieChart,
  Plus,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";

type MainView = "generate" | "schedules";

function ToggleSwitch({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        enabled ? "bg-primary" : "bg-muted"
      )}
      aria-pressed={enabled}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
          enabled ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );
}

const REPORT_TYPES = [
  "Revenue & Performance",
  "Customer Analytics",
  "Lead Conversion Report",
  "Executive Summary",
] as const;

const FORMATS = ["PDF", "Excel", "CSV"] as const;

const FREQUENCIES = [
  "Daily",
  "Every Monday",
  "Weekly (Friday)",
  "Monthly (1st)",
  "Monthly Summary",
] as const;

export default function AdvancedReportsPage() {
  const [mainView, setMainView] = useState<MainView>("generate");
  const jobCards = useScopedJobCards();
  const customers = useCustomerStore((s) => s.customers);
  const invoices = useScopedInvoices();
  const { viewingLabel } = useBranchScope();
  const businessName = useSettingsStore((s) => s.businessName);
  const schedules = useAdvancedReportSchedulesStore((s) => s.schedules);
  const addSchedule = useAdvancedReportSchedulesStore((s) => s.addSchedule);
  const removeSchedule = useAdvancedReportSchedulesStore((s) => s.removeSchedule);

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleName, setScheduleName] = useState("");
  const [scheduleReportType, setScheduleReportType] = useState<string>(REPORT_TYPES[0]);
  const [scheduleFormat, setScheduleFormat] = useState<string>(FORMATS[0]);
  const [scheduleRecipients, setScheduleRecipients] = useState("");
  const [scheduleFrequency, setScheduleFrequency] = useState<string>(FREQUENCIES[1]);
  const [scheduleActive, setScheduleActive] = useState(true);

  const [revRange, setRevRange] = useState("30");
  const [customerActiveOnly, setCustomerActiveOnly] = useState(true);
  const [leadStatus, setLeadStatus] = useState("all");
  const [execPeriod, setExecPeriod] = useState("monthly");

  const resetScheduleForm = () => {
    setScheduleName("");
    setScheduleReportType(REPORT_TYPES[0]);
    setScheduleFormat(FORMATS[0]);
    setScheduleRecipients("");
    setScheduleFrequency(FREQUENCIES[1]);
    setScheduleActive(true);
  };

  const handleCreateSchedule = () => {
    const name = scheduleName.trim() || "Untitled schedule";
    addSchedule({
      name,
      reportType: scheduleReportType,
      format: scheduleFormat,
      recipients: scheduleRecipients.trim() || "—",
      frequency: scheduleFrequency,
      active: scheduleActive,
    });
    toast.success("Automation created", { description: name });
    setScheduleOpen(false);
    resetScheduleForm();
    setMainView("schedules");
  };

  const daysFromRange = () => parseInt(revRange, 10) || 30;

  function formatInrCompact(n: number): string {
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
    return `₹${Math.round(n)}`;
  }

  const handleGenerateReport = (kind: "revenue" | "customer" | "lead" | "executive") => {
    try {
      if (kind === "revenue") {
        downloadRevenuePerformancePdf({
          businessName,
          days: daysFromRange(),
          jobCards,
        });
        toast.success("PDF downloaded", {
          description: "Revenue performance report saved to your device.",
        });
        return;
      }

      if (kind === "customer") {
        downloadCustomerLifetimeAnalysisPdf({
          businessName,
          activeOnly: customerActiveOnly,
          customers,
          invoices,
          jobCards,
        });

        toast.success("PDF downloaded", { description: "Customer lifetime analysis saved." });
        return;
      }

      if (kind === "lead") {
        downloadSimpleTablePdf({
          businessName,
          title: "Lead conversion report",
          periodNote: `Filter: ${leadStatus === "all" ? "All statuses" : leadStatus}`,
          columns: ["Lead", "Source", "Stage", "Est. value (₹)"],
          rows: [
            ["Fleet quote — ORP", "Walk-in", "Qualified", "45,000"],
            ["Ceramic package", "WhatsApp", "New", "12,500"],
            ["Corporate fleet", "Referral", leadStatus === "won" ? "Won" : "Proposed", "2,10,000"],
          ],
          kpis: [
            { label: "Leads", value: "12" },
            { label: "Conv. rate", value: "34%" },
            { label: "Pipeline (₹)", value: "2.6L" },
          ],
          fileSlug: "lead-conversion",
        });
        toast.success("PDF downloaded", { description: "Lead conversion report saved." });
        return;
      }

      const delivered = jobCards.filter((j) => j.status === "DELIVERED").length;
      const open = jobCards.filter((j) => !["DELIVERED", "CANCELLED"].includes(j.status)).length;
      const estRev = jobCards.reduce((s, j) => s + (j.estimatedAmount ?? 0), 0);
      downloadSimpleTablePdf({
        businessName,
        title: "Executive summary",
        periodNote:
          execPeriod === "weekly"
            ? "Period: weekly snapshot"
            : execPeriod === "quarterly"
              ? "Period: quarterly snapshot"
              : "Period: monthly snapshot",
        columns: ["Metric", "Value"],
        rows: [
          ["Total job cards (all time)", String(jobCards.length)],
          ["Delivered", String(delivered)],
          ["In progress / open", String(open)],
          ["Total estimated value (₹)", String(Math.round(estRev))],
        ],
        kpis: [
          { label: "Jobs", value: String(jobCards.length) },
          { label: "Delivered", value: String(delivered) },
          { label: "Est. value", value: formatInrCompact(estRev) },
        ],
        fileSlug: "executive-summary",
      });
      toast.success("PDF downloaded", { description: "Executive summary saved." });
    } catch (e) {
      toast.error("Could not generate PDF", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    }
  };

  const cardIcon = "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";

  return (
    <div className="space-y-6 pb-10">
      <PageHeader title="Advanced Reports" />

      <div className="flex flex-col gap-4 border-l-4 border-blue-500 pl-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Advanced Reporting</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Generate deep insights and schedule automated reports.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setMainView("generate")}
            className={cn(
              "h-9 rounded-md border px-4 text-sm font-medium transition-colors",
              mainView === "generate"
                ? "border-border bg-muted/80 text-foreground"
                : "border-transparent bg-background text-emerald-700 dark:text-emerald-400 hover:bg-muted/50"
            )}
          >
            Generate now
          </button>
          <button
            type="button"
            onClick={() => setMainView("schedules")}
            className={cn(
              "h-9 rounded-md border px-4 text-sm font-medium transition-colors",
              mainView === "schedules"
                ? "border-border bg-muted/80 text-emerald-700 dark:text-emerald-400"
                : "border-transparent bg-background text-muted-foreground hover:bg-muted/50"
            )}
          >
            Schedules
          </button>
        </div>
      </div>

      {mainView === "generate" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="shadow-sm">
            <CardHeader className="space-y-1">
              <div className="flex items-start gap-3">
                <div className={cardIcon}>
                  <LineChart className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-base">Revenue &amp; Performance</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Detailed breakdown of sales, bookings, and revenue trends over time.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="size-3.5" />
                  Range
                </Label>
                <Select value={revRange} onValueChange={setRevRange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="90">Last 90 days</SelectItem>
                    <SelectItem value="365">Last 12 months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={() => handleGenerateReport("revenue")}
              >
                <Download className="size-4 mr-2" />
                Download PDF
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="space-y-1">
              <div className="flex items-start gap-3">
                <div className={cardIcon}>
                  <Users className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-base">Customer analytics</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Analyze customer segments, lifetime value, and engagement metrics.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                <Checkbox
                  id="active-customers"
                  checked={customerActiveOnly}
                  onCheckedChange={(v) => setCustomerActiveOnly(v === true)}
                />
                <Label htmlFor="active-customers" className="text-sm cursor-pointer flex items-center gap-2">
                  <UserRound className="size-3.5 text-muted-foreground" />
                  Active customers only
                </Label>
              </div>
              <Button
                className="w-full"
                onClick={() => handleGenerateReport("customer")}
              >
                <Download className="size-4 mr-2" />
                Download PDF
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="space-y-1">
              <div className="flex items-start gap-3">
                <div className={cardIcon}>
                  <BarChart3 className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-base">Lead conversion report</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Track lead sources, conversion rates, and sales pipeline efficiency.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Filter className="size-3.5" />
                  Status
                </Label>
                <Select value={leadStatus} onValueChange={setLeadStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="qualified">Qualified</SelectItem>
                    <SelectItem value="won">Won</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={() => handleGenerateReport("lead")}
              >
                <Download className="size-4 mr-2" />
                Download PDF
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="space-y-1">
              <div className="flex items-start gap-3">
                <div className={cardIcon}>
                  <PieChart className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-base">Executive summary</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    A high-level overview of all business metrics in one comprehensive PDF.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="size-3.5" />
                  Period
                </Label>
                <Select value={execPeriod} onValueChange={setExecPeriod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly summary</SelectItem>
                    <SelectItem value="monthly">Monthly summary</SelectItem>
                    <SelectItem value="quarterly">Quarterly summary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={() => handleGenerateReport("executive")}
              >
                <Download className="size-4 mr-2" />
                Download PDF
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-border/60">
            <CardTitle className="text-base">Automated delivery schedules</CardTitle>
            <Button
              type="button"
              onClick={() => setScheduleOpen(true)}
            >
              <Plus className="size-4 mr-2" />
              Add schedule
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {schedules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground mb-4">
                  <Clock className="size-7" />
                </div>
                <p className="text-sm font-medium text-foreground">No automated schedules yet.</p>
                <button
                  type="button"
                  onClick={() => setScheduleOpen(true)}
                  className="mt-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                >
                  Create your first automation
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-3 px-4 font-medium">Report details</th>
                      <th className="py-3 px-4 font-medium">Frequency &amp; info</th>
                      <th className="py-3 px-4 font-medium">Next delivery</th>
                      <th className="py-3 px-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.map((row) => (
                      <tr key={row.id} className="border-b border-border/70">
                        <td className="py-3 px-4">
                          <div className="font-medium">{row.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {row.reportType} · {row.format}
                          </div>
                          <div className="text-xs text-muted-foreground truncate max-w-[260px]">
                            {row.recipients}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          <div>{row.frequency}</div>
                          <div className="text-xs mt-1">
                            {row.active ? (
                              <span className="text-emerald-600 dark:text-emerald-400">Active</span>
                            ) : (
                              <span className="text-muted-foreground">Paused</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 tabular-nums text-muted-foreground">
                          {row.nextDelivery}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              removeSchedule(row.id);
                              toast.message("Schedule removed");
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog
        open={scheduleOpen}
        onOpenChange={(open) => {
          setScheduleOpen(open);
          if (!open) resetScheduleForm();
        }}
      >
        <DialogContent className="sm:max-w-lg" showClose>
          <DialogHeader>
            <DialogTitle>New automation schedule</DialogTitle>
            <DialogDescription>
              Configure when and where to send your reports.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="sch-name">Schedule name</Label>
              <Input
                id="sch-name"
                placeholder="Monthly sales overview"
                value={scheduleName}
                onChange={(e) => setScheduleName(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Report type</Label>
                <Select value={scheduleReportType} onValueChange={setScheduleReportType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Format</Label>
                <Select value={scheduleFormat} onValueChange={setScheduleFormat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sch-recipients">Recipients (comma separated)</Label>
              <Textarea
                id="sch-recipients"
                placeholder="manager@example.com, admin@example.com"
                rows={3}
                value={scheduleRecipients}
                onChange={(e) => setScheduleRecipients(e.target.value)}
                className="resize-none"
              />
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-2 flex-1 min-w-0">
                <Label>Frequency</Label>
                <Select value={scheduleFrequency} onValueChange={setScheduleFrequency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3 pb-1">
                <ToggleSwitch enabled={scheduleActive} onToggle={() => setScheduleActive((v) => !v)} />
                <span className="text-sm font-medium">Active</span>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setScheduleOpen(false);
                resetScheduleForm();
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleCreateSchedule}>
              Create automation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
