"use client";

import { create } from "zustand";
import { putSingletonDocument } from "@/lib/collection-sync";
import type {
  CustomerMembership,
  CustomerMembershipStatus,
  MembershipPackage,
  MembershipServiceUsage,
  MembershipTier,
} from "@/types";

export const MEMBERSHIP_TIER_DAYS: Record<MembershipTier, number> = {
  MONTHLY: 30,
  QUARTERLY: 90,
  HALF_YEARLY: 180,
  YEARLY: 365,
};

function addDays(isoStart: string, days: number): string {
  const d = new Date(isoStart);
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function subscriptionKey(vehicleId: string | undefined): string {
  return vehicleId ?? "__legacy__";
}

function isSubscriptionActiveNow(sub: CustomerMembership): boolean {
  if (sub.status !== "ACTIVE") return false;
  return new Date(sub.endDate).getTime() >= Date.now();
}

function persistMembership(packages: MembershipPackage[], subscriptions: CustomerMembership[]) {
  void putSingletonDocument("membership", { packages, subscriptions }).catch((err) => {
    if (process.env.NODE_ENV !== "production") console.error(err);
  });
}

interface MembershipState {
  packages: MembershipPackage[];
  subscriptions: CustomerMembership[];
  upsertPackage: (pkg: MembershipPackage) => void;
  removePackage: (id: string) => void;
  setPackageActive: (id: string, isActive: boolean) => void;
  assignMembership: (input: {
    customerId: string;
    packageId: string;
    startDate?: string;
    notes?: string;
    vehicleId?: string;
  }) => { ok: true; id: string } | { ok: false; error: string };
  cancelMembership: (id: string) => void;
  getActiveMembership: (
    customerId: string,
    vehicleId?: string | null
  ) => CustomerMembership | undefined;
  recordMembershipUsages: (
    subscriptionId: string,
    entries: Omit<MembershipServiceUsage, "usedAt">[]
  ) => void;
  getUsedIncludedServiceIds: (sub: CustomerMembership) => Set<string>;
  subscriptionEffectiveStatus: (sub: CustomerMembership) => CustomerMembershipStatus;
}

function genId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useMembershipStore = create<MembershipState>((set, get) => ({
  packages: [],
  subscriptions: [],

  upsertPackage: (pkg) => {
    set((s) => {
      const idx = s.packages.findIndex((p) => p.id === pkg.id);
      const packages =
        idx >= 0
          ? s.packages.map((p, i) => (i === idx ? pkg : p))
          : [...s.packages, pkg];
      persistMembership(packages, s.subscriptions);
      return { packages };
    });
  },

  removePackage: (id) => {
    set((s) => {
      const packages = s.packages.filter((p) => p.id !== id);
      persistMembership(packages, s.subscriptions);
      return { packages };
    });
  },

  setPackageActive: (id, isActive) => {
    set((s) => {
      const packages = s.packages.map((p) => (p.id === id ? { ...p, isActive } : p));
      persistMembership(packages, s.subscriptions);
      return { packages };
    });
  },

  assignMembership: (input) => {
    const pkg = get().packages.find((p) => p.id === input.packageId);
    if (!pkg) return { ok: false, error: "Package not found" };
    if (!pkg.isActive) return { ok: false, error: "Package is inactive" };

    const start = input.startDate ?? new Date().toISOString();
    const days = MEMBERSHIP_TIER_DAYS[pkg.tier];
    const endDate = addDays(start, days);

    const wantKey = subscriptionKey(input.vehicleId);
    const conflict = get().subscriptions.some((sub) => {
      if (sub.customerId !== input.customerId || !isSubscriptionActiveNow(sub)) return false;
      return subscriptionKey(sub.vehicleId) === wantKey;
    });
    if (conflict) {
      return {
        ok: false,
        error: input.vehicleId
          ? "This vehicle already has an active membership. Cancel it first."
          : "Customer already has an active membership. Cancel it first.",
      };
    }

    const sub: CustomerMembership = {
      id: genId("memsub"),
      customerId: input.customerId,
      packageId: input.packageId,
      startDate: start,
      endDate,
      status: "ACTIVE",
      notes: input.notes,
      vehicleId: input.vehicleId,
      usageHistory: [],
    };

    set((s) => {
      const subscriptions = [sub, ...s.subscriptions];
      persistMembership(s.packages, subscriptions);
      return { subscriptions };
    });
    return { ok: true, id: sub.id };
  },

  cancelMembership: (id) => {
    set((s) => {
      const subscriptions = s.subscriptions.map((sub) =>
        sub.id === id ? { ...sub, status: "CANCELLED" as const } : sub
      );
      persistMembership(s.packages, subscriptions);
      return { subscriptions };
    });
  },

  getActiveMembership: (customerId, vehicleId) => {
    const active = get().subscriptions.filter(
      (s) => s.customerId === customerId && isSubscriptionActiveNow(s)
    );
    if (vehicleId) {
      const exact = active.find((s) => s.vehicleId === vehicleId);
      if (exact) return exact;
      return active.find((s) => !s.vehicleId);
    }
    return active[0];
  },

  recordMembershipUsages: (subscriptionId, entries) => {
    if (entries.length === 0) return;
    const usedAt = new Date().toISOString();
    set((s) => {
      const subscriptions = s.subscriptions.map((sub) =>
        sub.id === subscriptionId
          ? {
              ...sub,
              usageHistory: [
                ...(sub.usageHistory ?? []),
                ...entries.map((e) => ({
                  ...e,
                  usedAt,
                })),
              ],
            }
          : sub
      );
      persistMembership(s.packages, subscriptions);
      return { subscriptions };
    });
  },

  getUsedIncludedServiceIds: (sub) => {
    const hist = sub.usageHistory ?? [];
    const used = new Set<string>();
    for (const u of hist) used.add(u.serviceCatalogId);
    return used;
  },

  subscriptionEffectiveStatus: (sub) => {
    if (sub.status === "CANCELLED") return "CANCELLED";
    if (new Date(sub.endDate).getTime() < Date.now()) return "EXPIRED";
    return sub.status;
  },
}));
