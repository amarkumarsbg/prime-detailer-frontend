"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useActivityLogStore } from "@/store/activity-log-store";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials, formatDateTime } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Pencil,
  ArrowRightLeft,
  CreditCard,
  UserPlus,
  CheckCircle2,
  XCircle,
  Package,
  ClipboardList,
  Users,
  Car,
  Receipt,
  Calendar,
  UserCog,
  MessageCircle,
  RefreshCw,
  Wallet,
  FileText,
  Banknote,
} from "lucide-react";
import type { ActivityAction, ActivityEntityType } from "@/types";

const ACTION_ICON_MAP: Record<ActivityAction, { icon: React.ElementType; className: string }> = {
  CREATED: { icon: Plus, className: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" },
  UPDATED: { icon: Pencil, className: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
  STATUS_CHANGED: { icon: ArrowRightLeft, className: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400" },
  PAYMENT_RECEIVED: { icon: CreditCard, className: "bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400" },
  ASSIGNED: { icon: UserPlus, className: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400" },
  COMPLETED: { icon: CheckCircle2, className: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" },
  CANCELLED: { icon: XCircle, className: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" },
  STOCK_ADJUSTED: { icon: Package, className: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" },
  WHATSAPP_SENT: { icon: MessageCircle, className: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" },
  MECHANIC_SWITCHED: { icon: RefreshCw, className: "bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400" },
  OWNERSHIP_TRANSFERRED: { icon: ArrowRightLeft, className: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" },
  WALLET_CREDITED: { icon: Wallet, className: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" },
  WALLET_DEBITED: { icon: Wallet, className: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400" },
};

const ENTITY_ICON_MAP: Record<ActivityEntityType, React.ElementType> = {
  JOB_CARD: ClipboardList,
  CUSTOMER: Users,
  VEHICLE: Car,
  INVOICE: Receipt,
  APPOINTMENT: Calendar,
  INVENTORY: Package,
  STAFF: UserCog,
  QUOTATION: FileText,
  EXPENSE: Banknote,
  WALLET: Wallet,
};

const ENTITY_ROUTE_MAP: Record<ActivityEntityType, string> = {
  JOB_CARD: "/job-cards",
  CUSTOMER: "/customers",
  VEHICLE: "/vehicles",
  INVOICE: "/billing",
  APPOINTMENT: "/appointments",
  INVENTORY: "/inventory",
  STAFF: "/staff",
  QUOTATION: "/quotations",
  EXPENSE: "/reports",
  WALLET: "/customers",
};

const ACTION_LABELS: Record<ActivityAction, string> = {
  CREATED: "Created",
  UPDATED: "Updated",
  STATUS_CHANGED: "Status Changed",
  PAYMENT_RECEIVED: "Payment Received",
  ASSIGNED: "Assigned",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  STOCK_ADJUSTED: "Stock Adjusted",
  WHATSAPP_SENT: "WhatsApp Sent",
  MECHANIC_SWITCHED: "Mechanic Switched",
  OWNERSHIP_TRANSFERRED: "Ownership Transferred",
  WALLET_CREDITED: "Wallet Credited",
  WALLET_DEBITED: "Wallet Debited",
};

const ENTITY_LABELS: Record<ActivityEntityType, string> = {
  JOB_CARD: "Job Card",
  CUSTOMER: "Customer",
  VEHICLE: "Vehicle",
  INVOICE: "Invoice",
  APPOINTMENT: "Appointment",
  INVENTORY: "Inventory",
  STAFF: "Staff",
  QUOTATION: "Quotation",
  EXPENSE: "Expense",
  WALLET: "Wallet",
};

export default function ActivityPage() {
  const router = useRouter();
  const logs = useActivityLogStore((s) => s.logs);
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const sorted = useMemo(() => {
    let result = [...logs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (entityFilter !== "all") {
      result = result.filter((l) => l.entityType === entityFilter);
    }
    if (actionFilter !== "all") {
      result = result.filter((l) => l.action === actionFilter);
    }
    return result;
  }, [entityFilter, actionFilter, logs]);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof sorted> = {};
    sorted.forEach((log) => {
      const date = new Date(log.createdAt).toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(log);
    });
    return groups;
  }, [sorted]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Activity Log"
        description="Track all actions across the system"
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All Entities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entities</SelectItem>
            {(Object.keys(ENTITY_LABELS) as ActivityEntityType[]).map((key) => (
              <SelectItem key={key} value={key}>{ENTITY_LABELS[key]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All Actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {(Object.keys(ACTION_LABELS) as ActivityAction[]).map((key) => (
              <SelectItem key={key} value={key}>{ACTION_LABELS[key]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-6">
        {Object.entries(grouped).map(([date, logs]) => (
          <div key={date}>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">{date}</h3>
            <Card>
              <CardContent className="!p-0 divide-y divide-border">
                {logs.map((log) => {
                  const actionStyle = ACTION_ICON_MAP[log.action];
                  const ActionIcon = actionStyle.icon;
                  const EntityIcon = ENTITY_ICON_MAP[log.entityType];
                  const route = ENTITY_ROUTE_MAP[log.entityType];
                  const hasDetailRoute = !["EXPENSE"].includes(log.entityType);

                  return (
                    <div
                      key={log.id}
                      className="flex items-start gap-4 p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => {
                        if (route && log.entityId && hasDetailRoute) {
                          router.push(`${route}/${log.entityId}`);
                        } else if (route && !hasDetailRoute) {
                          router.push(route);
                        }
                      }}
                    >
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${actionStyle.className}`}>
                        <ActionIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{log.details}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Avatar className="w-4 h-4">
                              <AvatarFallback className="text-[8px] bg-muted">{getInitials(log.userName)}</AvatarFallback>
                            </Avatar>
                            {log.userName}
                          </div>
                          <span>&middot;</span>
                          <div className="flex items-center gap-1">
                            <EntityIcon className="w-3 h-3" />
                            {log.entityLabel}
                          </div>
                          <span className="hidden sm:inline">&middot;</span>
                          <span className="hidden sm:inline">{formatDateTime(log.createdAt)}</span>
                        </div>
                      </div>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium hidden md:inline-flex ${actionStyle.className}`}>
                        {ACTION_LABELS[log.action]}
                      </span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {sorted.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No activity found matching your filters.
        </div>
      )}
    </div>
  );
}
