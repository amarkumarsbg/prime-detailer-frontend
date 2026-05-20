"use client";

import { create } from "zustand";
import { postCollectionSnapshot } from "@/lib/collection-sync";

export type NotificationType =
  | "job_created"
  | "job_status"
  | "job_completed"
  | "payment_received"
  | "customer_new"
  | "vehicle_added"
  | "reminder"
  | "whatsapp_sent"
  | "email_sent"
  | "system";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  href?: string;
  /** When set, notification is scoped to this branch in the header selector. */
  branchId?: string;
  createdAt: string;
}

function sortByNewest(list: Notification[]): Notification[] {
  return [...list].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/** Merge API/bootstrap data with in-memory items so refresh does not drop new alerts. */
export function mergeNotificationLists(
  server: Notification[],
  local: Notification[]
): Notification[] {
  const byId = new Map<string, Notification>();
  for (const n of server) byId.set(n.id, n);
  for (const n of local) {
    const prev = byId.get(n.id);
    if (!prev || new Date(n.createdAt).getTime() >= new Date(prev.createdAt).getTime()) {
      byId.set(n.id, n);
    }
  }
  return sortByNewest(Array.from(byId.values()));
}

function persist(notifications: Notification[]) {
  void postCollectionSnapshot("notifications", notifications).catch((err) => {
    if (process.env.NODE_ENV !== "production") console.error(err);
  });
}

interface NotificationState {
  notifications: Notification[];
  /** Called from bootstrap — merges with current list instead of replacing. */
  hydrateFromBootstrap: (server: Notification[]) => void;
  addNotification: (
    n: Omit<Notification, "id" | "createdAt" | "read"> & Partial<Pick<Notification, "read">>
  ) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  dismiss: (id: string) => void;
  unreadCount: () => number;
}

export function selectUnreadNotificationCount(s: NotificationState): number {
  return s.notifications.filter((n) => !n.read).length;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],

  hydrateFromBootstrap: (server) => {
    set((s) => ({
      notifications: mergeNotificationLists(server, s.notifications),
    }));
  },

  addNotification: (n) => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? `notif-${crypto.randomUUID()}`
        : `notif-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const notification: Notification = {
      read: false,
      ...n,
      id,
      createdAt: new Date().toISOString(),
    };
    set((s) => {
      const notifications = sortByNewest([notification, ...s.notifications]);
      persist(notifications);
      return { notifications };
    });
  },

  markAsRead: (id) => {
    set((s) => {
      const notifications = s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      persist(notifications);
      return { notifications };
    });
  },

  markAllAsRead: () => {
    set((s) => {
      const notifications = s.notifications.map((n) => ({ ...n, read: true }));
      persist(notifications);
      return { notifications };
    });
  },

  dismiss: (id) => {
    set((s) => {
      const notifications = s.notifications.filter((n) => n.id !== id);
      persist(notifications);
      return { notifications };
    });
  },

  unreadCount: () => get().notifications.filter((n) => !n.read).length,
}));
