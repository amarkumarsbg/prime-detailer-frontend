import { useActivityLogStore } from "@/store/activity-log-store";
import { useAuthStore } from "@/store/auth-store";
import type { ActivityAction, ActivityEntityType, ActivityLog } from "@/types";

export function pushActivityLog(params: {
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId: string;
  entityLabel: string;
  details: string;
}): void {
  const user = useAuthStore.getState().user;
  const entry: ActivityLog = {
    id: `al-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    entityLabel: params.entityLabel,
    userId: user?.email ?? "system",
    userName: user?.name ?? "System",
    details: params.details,
    createdAt: new Date().toISOString(),
  };
  useActivityLogStore.getState().addLog(entry);
}
