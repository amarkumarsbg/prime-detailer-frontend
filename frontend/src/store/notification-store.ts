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
  | "system";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  href?: string;
  createdAt: string;
}

function persist(notifications: Notification[]) {
  void postCollectionSnapshot("notifications", notifications).catch(console.error);
}

interface NotificationState {
  notifications: Notification[];
  addNotification: (
    n: Omit<Notification, "id" | "createdAt" | "read"> & Partial<Pick<Notification, "read">>
  ) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  dismiss: (id: string) => void;
  unreadCount: () => number;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],

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
      const notifications = [notification, ...s.notifications];
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
