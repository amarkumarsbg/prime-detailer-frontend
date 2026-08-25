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

function toPositiveInt(value: unknown, fallback = 1): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  const rounded = Math.floor(n);
  return rounded >= 1 ? rounded : fallback;
}

export function membershipIncludedQuantity(pkg: MembershipPackage, serviceCatalogId: string): number {
  const raw = pkg.includedServiceQuantities?.[serviceCatalogId];
  return toPositiveInt(raw, 1);
}

function normalizeIncludedServiceIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function normalizeApplicableVehicleSegments(
  segments: MembershipPackage["applicableVehicleSegments"]
): MembershipPackage["applicableVehicleSegments"] {
  if (!segments || segments.length === 0) return undefined;
  const seen = new Set<string>();
  const out: NonNullable<MembershipPackage["applicableVehicleSegments"]> = [];
  for (const segment of segments) {
    if (!segment || seen.has(segment)) continue;
    seen.add(segment);
    out.push(segment);
  }
  return out.length > 0 ? out : undefined;
}

export function normalizeMembershipPackage(pkg: MembershipPackage): MembershipPackage {
  const includedServiceIds = normalizeIncludedServiceIds(pkg.includedServiceIds ?? []);
  const includedServiceQuantities: Record<string, number> = {};
  for (const sid of includedServiceIds) {
    includedServiceQuantities[sid] = membershipIncludedQuantity(pkg, sid);
  }
  const applicableVehicleSegments = normalizeApplicableVehicleSegments(
    pkg.applicableVehicleSegments
  );
  return {
    ...pkg,
    includedServiceIds,
    includedServiceQuantities,
    applicableVehicleSegments,
  };
}

export function normalizeMembershipPackages(packages: MembershipPackage[]): MembershipPackage[] {
  return packages.map(normalizeMembershipPackage);
}

export function usageQuantity(entry: MembershipServiceUsage): number {
  return toPositiveInt(entry.quantity, 1);
}

export function usedMembershipCounts(sub: CustomerMembership): Map<string, number> {
  const m = new Map<string, number>();
  for (const u of sub.usageHistory ?? []) {
    const qty = usageQuantity(u);
    m.set(u.serviceCatalogId, (m.get(u.serviceCatalogId) ?? 0) + qty);
  }
  return m;
}

export function normalizeMembershipSubscription(sub: CustomerMembership): CustomerMembership {
  const usageHistory = (sub.usageHistory ?? []).map((u) => ({
    ...u,
    quantity: usageQuantity(u),
  }));
  return {
    ...sub,
    usageHistory,
  };
}

export function normalizeMembershipSubscriptions(subscriptions: CustomerMembership[]): CustomerMembership[] {
  return subscriptions.map(normalizeMembershipSubscription);
}

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
  redeemMembershipServiceUsage: (input: {
    subscriptionId: string;
    serviceCatalogId: string;
    serviceName?: string;
    jobCardId?: string;
    quantity?: number;
  }) => { ok: true; remaining: number } | { ok: false; error: string; remaining: number };
  rollbackMembershipServiceUsage: (input: {
    subscriptionId: string;
    serviceCatalogId: string;
    jobCardId?: string;
    quantity?: number;
  }) => { ok: true; remaining: number } | { ok: false; error: string; remaining: number };
  getUsedIncludedServiceCount: (sub: CustomerMembership, serviceCatalogId: string) => number;
  getRemainingIncludedServiceCount: (
    sub: CustomerMembership,
    pkg: MembershipPackage,
    serviceCatalogId: string
  ) => number;
  getUsedIncludedServiceIds: (sub: CustomerMembership) => Set<string>;
  subscriptionEffectiveStatus: (sub: CustomerMembership) => CustomerMembershipStatus;
  linkMembershipInvoice: (subscriptionId: string, invoiceId: string) => void;
}

function genId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useMembershipStore = create<MembershipState>((set, get) => ({
  packages: [],
  subscriptions: [],

  upsertPackage: (pkg) => {
    set((s) => {
      const normalized = normalizeMembershipPackage(pkg);
      const idx = s.packages.findIndex((p) => p.id === normalized.id);
      const packages =
        idx >= 0
          ? s.packages.map((p, i) => (i === idx ? normalized : p))
          : [...s.packages, normalized];
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
                  quantity: toPositiveInt(e.quantity, 1),
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

  redeemMembershipServiceUsage: (input) => {
    const quantity = toPositiveInt(input.quantity, 1);
    const sub = get().subscriptions.find((s) => s.id === input.subscriptionId);
    if (!sub) return { ok: false, error: "Membership subscription not found", remaining: 0 };
    if (!isSubscriptionActiveNow(sub)) {
      return { ok: false, error: "Membership is not active", remaining: 0 };
    }
    const pkg = get().packages.find((p) => p.id === sub.packageId);
    if (!pkg) return { ok: false, error: "Membership package not found", remaining: 0 };

    const included = membershipIncludedQuantity(pkg, input.serviceCatalogId);
    if (!pkg.includedServiceIds.includes(input.serviceCatalogId)) {
      return { ok: false, error: "Service is not included in this membership", remaining: 0 };
    }

    const used = usedMembershipCounts(sub).get(input.serviceCatalogId) ?? 0;
    const remaining = Math.max(0, included - used);
    if (remaining < quantity) {
      return {
        ok: false,
        error: `No remaining uses for this service (${remaining} left)`,
        remaining,
      };
    }

    const usedAt = new Date().toISOString();
    set((s) => {
      const subscriptions = s.subscriptions.map((row) =>
        row.id === input.subscriptionId
          ? {
              ...row,
              usageHistory: [
                ...(row.usageHistory ?? []),
                {
                  usedAt,
                  serviceCatalogId: input.serviceCatalogId,
                  quantity,
                  serviceName: input.serviceName,
                  jobCardId: input.jobCardId,
                },
              ],
            }
          : row
      );
      persistMembership(s.packages, subscriptions);
      return { subscriptions };
    });

    return { ok: true, remaining: remaining - quantity };
  },

  rollbackMembershipServiceUsage: (input) => {
    const quantity = toPositiveInt(input.quantity, 1);
    const sub = get().subscriptions.find((s) => s.id === input.subscriptionId);
    if (!sub) return { ok: false, error: "Membership subscription not found", remaining: 0 };
    const pkg = get().packages.find((p) => p.id === sub.packageId);
    if (!pkg || !pkg.includedServiceIds.includes(input.serviceCatalogId)) {
      return { ok: false, error: "Service is not included in this membership", remaining: 0 };
    }

    const history = sub.usageHistory ?? [];
    const matchesRow = (u: MembershipServiceUsage) => {
      if (u.serviceCatalogId !== input.serviceCatalogId) return false;
      if (input.jobCardId && u.jobCardId !== input.jobCardId) return false;
      return true;
    };

    let available = 0;
    for (const u of history) {
      if (!matchesRow(u)) continue;
      available += usageQuantity(u);
    }
    const included = membershipIncludedQuantity(pkg, input.serviceCatalogId);
    const used = usedMembershipCounts(sub).get(input.serviceCatalogId) ?? 0;
    const remaining = Math.max(0, included - used);

    if (available < quantity) {
      return {
        ok: false,
        error: `No usage available to rollback (${available} found, ${quantity} needed)`,
        remaining,
      };
    }

    const nextHistory: MembershipServiceUsage[] = history.map((u) => ({
      ...u,
      quantity: usageQuantity(u),
    }));
    let toRollback = quantity;
    for (let i = nextHistory.length - 1; i >= 0 && toRollback > 0; i -= 1) {
      const u = nextHistory[i];
      if (!matchesRow(u)) continue;
      const qty = usageQuantity(u);
      if (qty <= toRollback) {
        nextHistory.splice(i, 1);
        toRollback -= qty;
      } else {
        nextHistory[i] = { ...u, quantity: qty - toRollback };
        toRollback = 0;
      }
    }

    set((s) => {
      const subscriptions = s.subscriptions.map((row) =>
        row.id === input.subscriptionId
          ? {
              ...row,
              usageHistory: nextHistory,
            }
          : row
      );
      persistMembership(s.packages, subscriptions);
      return { subscriptions };
    });

    return { ok: true, remaining: Math.min(included, remaining + quantity) };
  },

  getUsedIncludedServiceCount: (sub, serviceCatalogId) => {
    return usedMembershipCounts(sub).get(serviceCatalogId) ?? 0;
  },

  getRemainingIncludedServiceCount: (sub, pkg, serviceCatalogId) => {
    if (!pkg.includedServiceIds.includes(serviceCatalogId)) return 0;
    const used = usedMembershipCounts(sub).get(serviceCatalogId) ?? 0;
    return Math.max(0, membershipIncludedQuantity(pkg, serviceCatalogId) - used);
  },

  getUsedIncludedServiceIds: (sub) => {
    const used = new Set<string>();
    for (const [serviceCatalogId, count] of usedMembershipCounts(sub)) {
      if (count > 0) used.add(serviceCatalogId);
    }
    return used;
  },

  subscriptionEffectiveStatus: (sub) => {
    if (sub.status === "CANCELLED") return "CANCELLED";
    if (new Date(sub.endDate).getTime() < Date.now()) return "EXPIRED";
    return sub.status;
  },

  linkMembershipInvoice: (subscriptionId, invoiceId) => {
    if (!subscriptionId || !invoiceId) return;
    set((s) => {
      const subscriptions = s.subscriptions.map((sub) =>
        sub.id === subscriptionId ? { ...sub, invoiceId } : sub
      );
      persistMembership(s.packages, subscriptions);
      return { subscriptions };
    });
  },
}));
