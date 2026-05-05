"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useReminderStore } from "@/store/reminder-store";
import { useSettingsStore } from "@/store/settings-store";
import { useNotificationStore } from "@/store/notification-store";
import { ApiError } from "@/lib/api-client";
import { buildServiceReminderWhatsAppMessage } from "@/lib/whatsapp-customer-messages";
import {
  sendCustomerWhatsApp,
  openWhatsAppComposer,
  isWhatsAppNotConfiguredError,
} from "@/lib/whatsapp-send";
import { useDashboardFilterStore, DASHBOARD_FILTER } from "@/store/dashboard-filter-store";
import { isDueSoonReminder } from "@/lib/dashboard-filters";
import { FilterBanner } from "@/components/shared/filter-banner";
import { formatDate } from "@/lib/utils";
import type { ServiceReminder, ReminderStatus, ReminderType } from "@/types";
import {
  Bell,
  Car,
  Phone,
  Calendar,
  Gauge,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Droplets,
  Shield,
  Disc3,
  Snowflake,
  Battery,
  FileCheck,
  Wrench,
  X,
  MessageCircle,
  Sparkles,
  Send,
} from "lucide-react";

function reminderWasSent(r: ServiceReminder): boolean {
  return Boolean(r.lastMessageSentAt || r.whatsappSent);
}

const REMINDER_TYPE_CONFIG: Record<ReminderType, { label: string; icon: React.ElementType; color: string }> = {
  GENERAL_SERVICE: { label: "General Service", icon: Wrench, color: "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30" },
  OIL_CHANGE: { label: "Oil Change", icon: Droplets, color: "text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30" },
  BRAKE_INSPECTION: { label: "Brake Inspection", icon: Disc3, color: "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30" },
  TIRE_ROTATION: { label: "Tire Rotation", icon: Disc3, color: "text-violet-600 bg-violet-100 dark:text-violet-400 dark:bg-violet-900/30" },
  AC_SERVICE: { label: "AC Service", icon: Snowflake, color: "text-cyan-600 bg-cyan-100 dark:text-cyan-400 dark:bg-cyan-900/30" },
  BATTERY_CHECK: { label: "Battery Check", icon: Battery, color: "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30" },
  INSURANCE: { label: "Insurance Renewal", icon: Shield, color: "text-indigo-600 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-900/30" },
  PUC: { label: "PUC Certificate", icon: FileCheck, color: "text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30" },
  PPF_MAINTENANCE: { label: "PPF Maintenance", icon: Shield, color: "text-rose-600 bg-rose-100 dark:text-rose-400 dark:bg-rose-900/30" },
  CERAMIC_MAINTENANCE: { label: "Ceramic Maintenance", icon: Shield, color: "text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-900/30" },
};

const STATUS_CONFIG: Record<ReminderStatus, { label: string; color: string; dot: string }> = {
  OVERDUE: { label: "Overdue", color: "text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/30 dark:border-red-900", dot: "bg-red-500" },
  DUE: { label: "Due Now", color: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-900", dot: "bg-amber-500" },
  UPCOMING: { label: "Upcoming", color: "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/30 dark:border-blue-900", dot: "bg-blue-500" },
  COMPLETED: { label: "Completed", color: "text-green-700 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950/30 dark:border-green-900", dot: "bg-green-500" },
  DISMISSED: { label: "Dismissed", color: "text-gray-700 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-950/30 dark:border-gray-800", dot: "bg-gray-400" },
};

function getDaysUntilDue(dueDate: string): number {
  const now = new Date();
  const due = new Date(dueDate);
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function DueBadge({ dueDate }: { dueDate: string }) {
  const days = getDaysUntilDue(dueDate);
  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
        <AlertTriangle className="w-3 h-3" />
        {Math.abs(days)}d overdue
      </span>
    );
  }
  if (days === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        <Clock className="w-3 h-3" />
        Due today
      </span>
    );
  }
  if (days <= 7) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        <Clock className="w-3 h-3" />
        {days}d left
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
      <Calendar className="w-3 h-3" />
      {days}d away
    </span>
  );
}

export default function RemindersPage() {
  const reminders = useReminderStore((s) => s.reminders);
  const updateReminder = useReminderStore((s) => s.updateReminder);
  const whatsappReminderEnabled = useSettingsStore((s) => s.whatsappReminderEnabled);
  const activeFilter = useDashboardFilterStore((s) => s.activeFilter);
  const setActiveFilter = useDashboardFilterStore((s) => s.setActiveFilter);
  const [activeTab, setActiveTab] = useState("all");

  const counts = useMemo(() => ({
    all: reminders.filter((r) => r.status !== "COMPLETED" && r.status !== "DISMISSED").length,
    overdue: reminders.filter((r) => r.status === "OVERDUE").length,
    due: reminders.filter((r) => r.status === "DUE").length,
    upcoming: reminders.filter((r) => r.status === "UPCOMING").length,
    sent: reminders.filter(reminderWasSent).length,
    completed: reminders.filter((r) => r.status === "COMPLETED").length,
  }), [reminders]);

  const filtered = useMemo(() => {
    let list: ServiceReminder[];
    if (activeTab === "all") list = reminders.filter((r) => r.status !== "COMPLETED" && r.status !== "DISMISSED");
    else if (activeTab === "completed") list = reminders.filter((r) => r.status === "COMPLETED");
    else if (activeTab === "sent") list = reminders.filter(reminderWasSent);
    else list = reminders.filter((r) => r.status === activeTab.toUpperCase());
    if (activeFilter === DASHBOARD_FILTER.DUE_SOON) {
      list = list.filter(isDueSoonReminder);
    }
    return list;
  }, [reminders, activeTab, activeFilter]);

  const handleMarkComplete = (id: string) => {
    updateReminder(id, { status: "COMPLETED" as ReminderStatus });
    toast.success("Reminder marked as completed");
  };

  const handleDismiss = (id: string) => {
    updateReminder(id, { status: "DISMISSED" as ReminderStatus });
    toast.info("Reminder dismissed");
  };

  const handleSendWhatsAppReminder = async (reminder: ServiceReminder) => {
    if (!whatsappReminderEnabled) {
      toast.error("WhatsApp reminders are off", {
        description: "Turn on “WhatsApp Reminders” under Settings → Reminders.",
      });
      return;
    }
    const message = buildServiceReminderWhatsAppMessage(reminder);
    const markSent = () => {
      const now = new Date().toISOString();
      updateReminder(reminder.id, {
        whatsappSent: true,
        lastMessageSentAt: now,
      });
    };
    try {
      await sendCustomerWhatsApp(reminder.customerPhone, message);
      markSent();
      toast.success("WhatsApp reminder sent", {
        description: `Sent to ${reminder.customerName} at ${reminder.customerPhone}`,
      });
      useNotificationStore.getState().addNotification({
        type: "whatsapp_sent",
        title: "Service reminder via WhatsApp",
        message: `${reminder.customerName} — ${reminder.vehicleRegNumber}`,
        href: "/reminders",
      });
    } catch (e) {
      if (isWhatsAppNotConfiguredError(e)) {
        openWhatsAppComposer(reminder.customerPhone, message);
        markSent();
        toast.info("WhatsApp opened", {
          description: "Finish sending in the app. Reminder marked as sent.",
        });
        useNotificationStore.getState().addNotification({
          type: "whatsapp_sent",
          title: "Reminder — WhatsApp composer",
          message: `${reminder.customerName} — ${reminder.vehicleRegNumber}`,
          href: "/reminders",
        });
        return;
      }
      toast.error("WhatsApp failed", {
        description: e instanceof ApiError ? e.message : "Could not send reminder",
      });
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="Service Reminders" />

      {activeFilter === DASHBOARD_FILTER.DUE_SOON && (
        <FilterBanner
          message="⚠ Showing due service reminders"
          onDismiss={() => setActiveFilter(null)}
        />
      )}

      {!whatsappReminderEnabled && (
        <p className="text-sm rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          WhatsApp reminder sending is disabled in{" "}
          <Link href="/settings" className="font-medium underline underline-offset-2">
            Settings → Reminders
          </Link>
          . Enable “WhatsApp Reminders” to send messages from this page.
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="border-red-200 dark:border-red-900">
          <CardContent className="!flex !items-center gap-3 !px-4 !py-5 sm:!px-5 sm:!py-6">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{counts.overdue}</p>
              <p className="text-xs text-muted-foreground">Overdue</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 dark:border-amber-900">
          <CardContent className="!flex !items-center gap-3 !px-4 !py-5 sm:!px-5 sm:!py-6">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{counts.due}</p>
              <p className="text-xs text-muted-foreground">Due Now</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 dark:border-blue-900">
          <CardContent className="!flex !items-center gap-3 !px-4 !py-5 sm:!px-5 sm:!py-6">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{counts.upcoming}</p>
              <p className="text-xs text-muted-foreground">Upcoming</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-violet-200 dark:border-violet-900">
          <CardContent className="!flex !items-center gap-3 !px-4 !py-5 sm:!px-5 sm:!py-6">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30">
              <Send className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{counts.sent}</p>
              <p className="text-xs text-muted-foreground">Sent</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200 dark:border-green-900">
          <CardContent className="!flex !items-center gap-3 !px-4 !py-5 sm:!px-5 sm:!py-6">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{counts.completed}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex h-auto min-h-10 w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="all">All Active ({counts.all})</TabsTrigger>
          <TabsTrigger value="overdue">Overdue ({counts.overdue})</TabsTrigger>
          <TabsTrigger value="due">Due ({counts.due})</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming ({counts.upcoming})</TabsTrigger>
          <TabsTrigger value="sent">Sent ({counts.sent})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({counts.completed})</TabsTrigger>
        </TabsList>

        {(["all", "overdue", "due", "upcoming", "sent", "completed"] as const).map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-4">
            {filtered.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Bell className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">
                    {tab === "sent"
                      ? "No sent reminders yet. Send a WhatsApp reminder from an active row — it will appear here."
                      : `No ${tab === "all" ? "active" : tab} reminders`}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filtered
                  .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                  .map((reminder) => {
                    const typeConfig = REMINDER_TYPE_CONFIG[reminder.type];
                    const statusConfig = STATUS_CONFIG[reminder.status];
                    const TypeIcon = typeConfig.icon;

                    return (
                      <Card key={reminder.id} className={`border ${statusConfig.color} transition-all hover:shadow-md`}>
                        <CardContent className="!p-4">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            <div className={`flex items-center justify-center w-12 h-12 rounded-xl shrink-0 ${typeConfig.color}`}>
                              <TypeIcon className="w-6 h-6" />
                            </div>

                            <div className="flex-1 min-w-0 space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-semibold">{typeConfig.label}</h3>
                                <DueBadge dueDate={reminder.dueDate} />
                                <span className="text-[10px] font-medium uppercase text-muted-foreground">
                                  {reminder.frequency}
                                </span>
                                {reminder.isHighEndService && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                    <Sparkles className="w-3 h-3" />
                                    High-end
                                  </span>
                                )}
                                {reminderWasSent(reminder) && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-violet-100 text-violet-800 dark:bg-violet-900/35 dark:text-violet-300">
                                    <Send className="w-3 h-3 shrink-0" />
                                    Reminder sent
                                    {reminder.lastMessageSentAt && (
                                      <span className="tabular-nums opacity-90">
                                        {formatDate(reminder.lastMessageSentAt)}
                                      </span>
                                    )}
                                  </span>
                                )}
                              </div>

                              {reminder.isHighEndService && (reminder.totalDurationMonths != null || reminder.intervalMonths != null) && (
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                  {reminder.totalDurationMonths != null && (
                                    <span>Duration: {reminder.totalDurationMonths} months</span>
                                  )}
                                  {reminder.intervalMonths != null && (
                                    <span>Interval: every {reminder.intervalMonths} months</span>
                                  )}
                                </div>
                              )}

                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                  <Car className="w-3.5 h-3.5" />
                                  <Link href={`/vehicles/${reminder.vehicleId}`} className="hover:text-primary transition-colors">
                                    {reminder.vehicleRegNumber}
                                  </Link>
                                  <span className="text-xs">({reminder.vehicleMakeModel})</span>
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <Phone className="w-3.5 h-3.5" />
                                  {reminder.customerName}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  Due: {formatDate(reminder.dueDate)}
                                </span>
                                {reminder.lastServiceDate && (
                                  <span>Last service: {formatDate(reminder.lastServiceDate)}</span>
                                )}
                                {reminder.odometerAtLastService && (
                                  <span className="flex items-center gap-1">
                                    <Gauge className="w-3 h-3" />
                                    {reminder.odometerAtLastService.toLocaleString()} km
                                    {reminder.nextDueOdometer && ` → ${reminder.nextDueOdometer.toLocaleString()} km`}
                                  </span>
                                )}
                              </div>

                              {reminder.notes && (
                                <p className="text-xs text-muted-foreground italic">{reminder.notes}</p>
                              )}
                            </div>

                            {reminder.status !== "COMPLETED" && reminder.status !== "DISMISSED" && (
                              <div className="flex items-center gap-2 shrink-0">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void handleSendWhatsAppReminder(reminder)}
                                  disabled={!whatsappReminderEnabled}
                                  title={
                                    whatsappReminderEnabled
                                      ? undefined
                                      : "Enable WhatsApp reminders in Settings → Reminders"
                                  }
                                  className="text-xs"
                                >
                                  <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
                                  Send WhatsApp Reminder
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleMarkComplete(reminder.id)}
                                  className="text-xs text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/30"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                                  Done
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleDismiss(reminder.id)}
                                  className="w-8 h-8 text-muted-foreground hover:text-destructive"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            )}

                            {reminder.status === "COMPLETED" && (
                              <div className="shrink-0">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Completed
                                </span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
