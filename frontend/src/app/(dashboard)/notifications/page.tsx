"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { useNotificationStore, type Notification, type NotificationType } from "@/store/notification-store";
import { useScopedNotifications } from "@/hooks/use-scoped-data";
import { useBranchScope } from "@/lib/branch-scope";
import { useAppBootstrapStore } from "@/store/app-bootstrap-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ClipboardList,
  CreditCard,
  UserPlus,
  Car,
  Clock,
  Settings,
  CheckCircle2,
  X,
  BellOff,
  CheckCheck,
  MessageCircle,
  Mail,
} from "lucide-react";

const TYPE_CONFIG: Record<NotificationType, { icon: typeof ClipboardList; color: string; label: string }> = {
  job_created: { icon: ClipboardList, color: "text-blue-500 bg-blue-50 dark:bg-blue-950", label: "Job Card" },
  job_status: { icon: ClipboardList, color: "text-amber-500 bg-amber-50 dark:bg-amber-950", label: "Status Update" },
  job_completed: { icon: CheckCircle2, color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950", label: "Completed" },
  payment_received: { icon: CreditCard, color: "text-green-500 bg-green-50 dark:bg-green-950", label: "Payment" },
  customer_new: { icon: UserPlus, color: "text-violet-500 bg-violet-50 dark:bg-violet-950", label: "Customer" },
  vehicle_added: { icon: Car, color: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950", label: "Vehicle" },
  reminder: { icon: Clock, color: "text-orange-500 bg-orange-50 dark:bg-orange-950", label: "Reminder" },
  whatsapp_sent: { icon: MessageCircle, color: "text-green-600 bg-green-50 dark:bg-green-950", label: "WhatsApp" },
  email_sent: { icon: Mail, color: "text-sky-600 bg-sky-50 dark:bg-sky-950", label: "Email" },
  system: { icon: Settings, color: "text-slate-500 bg-slate-100 dark:bg-slate-800", label: "System" },
};

function formatTime(dateStr: string) {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

function NotificationItem({
  notification,
  onNavigate,
}: {
  notification: Notification;
  onNavigate: (id: string, href?: string) => void;
}) {
  const { markAsRead, dismiss } = useNotificationStore();
  const config = TYPE_CONFIG[notification.type];
  const Icon = config.icon;

  return (
    <div
      className={`group relative flex gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border transition-colors ${
        notification.href ? "cursor-pointer hover:bg-muted/50" : ""
      } ${!notification.read ? "border-primary/20 bg-primary/2" : "border-border"}`}
      onClick={() => onNavigate(notification.id, notification.href)}
    >
      <div className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${config.color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <p className={`text-sm truncate ${!notification.read ? "font-semibold" : "font-medium"}`}>
              {notification.title}
            </p>
            {!notification.read && (
              <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
            )}
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
            {formatTime(notification.createdAt)}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          {notification.message}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <span className={`inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full ${config.color}`}>
            {config.label}
          </span>
          {!notification.read && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                markAsRead(notification.id);
              }}
              className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
            >
              Mark read
            </button>
          )}
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          dismiss(notification.id);
        }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex items-center justify-center w-7 h-7 rounded-lg hover:bg-muted text-muted-foreground transition-opacity"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const { viewingLabel } = useBranchScope();
  const notifications = useScopedNotifications();
  const unreadCount = notifications.filter((n) => !n.read).length;
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const bootstrapRefresh = useAppBootstrapStore((s) => s.refresh);
  const [tab, setTab] = useState("all");

  useEffect(() => {
    void bootstrapRefresh();
  }, [bootstrapRefresh]);

  const filtered = tab === "all"
    ? notifications
    : tab === "unread"
    ? notifications.filter((n) => !n.read)
    : notifications.filter((n) => n.read);

  const handleNavigate = (id: string, href?: string) => {
    useNotificationStore.getState().markAsRead(id);
    if (href) router.push(href);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Notifications"
        description={
          viewingLabel !== "All branches"
            ? `${unreadCount} unread for ${viewingLabel}. Switch to All branches in the header to see org-wide alerts.`
            : `You have ${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
        }
        actions={
          unreadCount > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                for (const n of notifications) {
                  if (!n.read) markAsRead(n.id);
                }
              }}
            >
              <CheckCheck className="w-4 h-4 mr-2" />
              Mark all read
            </Button>
          ) : undefined
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">
            All ({notifications.length})
          </TabsTrigger>
          <TabsTrigger value="unread">
            Unread ({unreadCount})
          </TabsTrigger>
          <TabsTrigger value="read">
            Read ({notifications.length - unreadCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <BellOff className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <p className="text-sm font-medium text-muted-foreground">
                  {tab === "unread" ? "No unread notifications" : "No notifications"}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  {tab === "unread"
                    ? "You're all caught up!"
                    : "Notifications will appear here as things happen."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
