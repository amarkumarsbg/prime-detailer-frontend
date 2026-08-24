"use client";

import { create } from "zustand";
import type { AdminUser } from "@/types";

interface AuthState {
  user: AdminUser | null;
  token: string | null;
  isAuthenticated: boolean;
  setSession: (token: string, user: AdminUser) => void;
  clearSession: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  setSession: (token, user) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("admin_token", token);
      localStorage.setItem("admin_user", JSON.stringify(user));
    }
    set({ token, user, isAuthenticated: true });
  },

  clearSession: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_user");
    }
    set({ token: null, user: null, isAuthenticated: false });
  },

  hydrate: () => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("admin_token");
    const userRaw = localStorage.getItem("admin_user");
    if (token && userRaw) {
      try {
        const user = JSON.parse(userRaw) as AdminUser;
        set({ token, user, isAuthenticated: true });
      } catch {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_user");
      }
    }
  },
}));

/** Only PLATFORM_OWNER can access the SaaS Admin Portal. */
export function isAdminRole(role: string | undefined): boolean {
  return role === "PLATFORM_OWNER";
}
