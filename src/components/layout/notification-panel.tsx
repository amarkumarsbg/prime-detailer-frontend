"use client";

import { useRouter } from "next/navigation";
import { useNotificationStore, type NotificationType } from "@/store/notification-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
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
  MessageCircle,
} from "lucide-react";

const TYPE_CONFIG: Record<NotificationType, { icon: typeof ClipboardList; color: string }> = {
  job_created: { icon: ClipboardList, color: "text-blue-500 bg-blue-50 dark:bg-blue-950" },
  job_status: { icon: ClipboardList, color: "text-amber-500 bg-amber-50 dark:bg-amber-950" },
  job_completed: { icon: CheckCircle2, color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950" },
  payment_received: { icon: CreditCard, color: "text-green-500 bg-green-50 dark:bg-green-950" },
  customer_new: { icon: UserPlus, color: "text-violet-500 bg-violet-50 dark:bg-violet-950" },
  vehicle_added: { icon: Car, color: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950" },
  reminder: { icon: Clock, color: "text-orange-500 bg-orange-50 dark:bg-orange-950" },
  whatsapp_sent: { icon: MessageCircle, color: "text-green-600 bg-green-50 dark:bg-green-950" },
  system: { icon: Settings, color: "text-slate-500 bg-slate-100 dark:bg-slate-800" },
};

function timeAgo(dateStr: string) {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface NotificationPanelProps {
  onClose: () => void;
}

export function NotificationPanel({ onClose }: NotificationPanelProps) {
  const router = useRouter();
  const { notifications, markAsRead, markAllAsRead, dismiss, unreadCount } =
    useNotificationStore();

  const handleClick = (id: string, href?: string) => {
    markAsRead(id);
    if (href) {
      router.push(href);
      onClose();
    }
  };

  return (
    <div className="w-full sm:w-[360px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {unreadCount() > 0 && (
            <span className="flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold">
              {unreadCount()}
            </span>
          )}
        </div>
        {unreadCount() > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 px-2"
            onClick={markAllAsRead}
          >
            Mark all read
          </Button>
        )}
      </div>

      {/* Notification list */}
      <ScrollArea className="h-[320px] sm:h-[400px]">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <BellOff className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No notifications</p>
            <p className="text-xs text-muted-foreground/70 mt-1">You&apos;re all caught up!</p>
          </div>
        ) : (
          <div>
            {notifications.map((n) => {
              const config = TYPE_CONFIG[n.type];
              const Icon = config.icon;
              return (
                <div
                  key={n.id}
                  className={`group relative flex gap-3 px-4 py-3 border-b border-border/50 transition-colors cursor-pointer hover:bg-muted/50 ${
                    !n.read ? "bg-primary/3" : ""
                  }`}
                  onClick={() => handleClick(n.id, n.href)}
                >
                  {!n.read && (
                    <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                  <div className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${config.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm leading-tight ${!n.read ? "font-semibold" : "font-medium"}`}>
                        {n.title}
                      </p>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0 pt-0.5">
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                      {n.message}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      dismiss(n.id);
                    }}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex items-center justify-center w-6 h-6 rounded-md hover:bg-muted text-muted-foreground transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-border px-4 py-2.5">
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs h-8 text-primary hover:text-primary"
          onClick={() => {
            router.push("/notifications");
            onClose();
          }}
        >
          View all notifications
        </Button>
      </div>
    </div>
  );
}
