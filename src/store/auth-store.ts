"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, Branch } from "@/types";
import { ALL_BRANCHES_BRANCH } from "@/lib/all-branches";

type SignupResult = { ok: true } | { ok: false; message: string };

interface AuthState {
  user: User | null;
  currentBranch: Branch | null;
  isAuthenticated: boolean;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (input: {
    name: string;
    email: string;
    phone: string;
    password: string;
  }) => Promise<SignupResult>;
  logout: () => void;
  setBranch: (branch: Branch) => void;
}

function canOrgWideRole(role: User["role"]): boolean {
  return (
    role === "SUPER_ADMIN" || role === "ADMIN" || role === "MANAGER"
  );
}

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      currentBranch: null,
      isAuthenticated: false,
      accessToken: null,

      login: async (email: string, password: string) => {
        const trimmed = email.trim();
        if (!trimmed || !password) return false;
        try {
          const res = await fetch(`${apiBase()}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: trimmed, password }),
          });
          const body = (await res.json()) as {
            data: {
              accessToken: string;
              user: User;
              branch: Branch | null;
            } | null;
            error: { message?: string } | null;
          };
          if (!res.ok || body.error || !body.data) {
            return false;
          }
          const { accessToken, user, branch } = body.data;
          const canOrgWide = canOrgWideRole(user.role);
          const homeBranch = branch ?? null;
          set({
            accessToken,
            user,
            currentBranch: canOrgWide ? ALL_BRANCHES_BRANCH : homeBranch,
            isAuthenticated: true,
          });
          return true;
        } catch {
          return false;
        }
      },

      signup: async ({ name, email, phone, password }) => {
        const emailTrim = email.trim();
        if (!name.trim() || !emailTrim || !phone.trim() || !password) {
          return { ok: false, message: "Please fill in all fields" };
        }
        try {
          const res = await fetch(`${apiBase()}/api/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: name.trim(),
              email: emailTrim,
              phone: phone.trim(),
              password,
            }),
          });
          const body = (await res.json()) as {
            data: {
              accessToken: string;
              user: User;
              branch: Branch | null;
            } | null;
            error: { message?: string } | null;
          };
          if (!res.ok || body.error || !body.data) {
            return {
              ok: false,
              message: body.error?.message ?? "Could not create account",
            };
          }
          const { accessToken, user, branch } = body.data;
          const canOrgWide = canOrgWideRole(user.role);
          const homeBranch = branch ?? null;
          set({
            accessToken,
            user,
            currentBranch: canOrgWide ? ALL_BRANCHES_BRANCH : homeBranch,
            isAuthenticated: true,
          });
          return { ok: true };
        } catch {
          return { ok: false, message: "Network error — is the API running?" };
        }
      },

      logout: () => {
        set({
          user: null,
          currentBranch: null,
          isAuthenticated: false,
          accessToken: null,
        });
      },

      setBranch: (branch: Branch) => {
        set({ currentBranch: branch });
      },
    }),
    {
      name: "prime-detailers-auth",
      partialize: (state) => ({
        user: state.user,
        currentBranch: state.currentBranch,
        isAuthenticated: state.isAuthenticated,
        accessToken: state.accessToken,
      }),
    }
  )
);
