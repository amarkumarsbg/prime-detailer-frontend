import type { Party } from "@/types/party";

const STORAGE_KEY = "party-master:v1";

export function loadPartyOverrides(): Record<string, Partial<Party>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Partial<Party>>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function savePartyOverrides(overrides: Record<string, Partial<Party>>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    /* ignore quota */
  }
}

export function savePartyOverride(id: string, patch: Partial<Party>): void {
  const all = loadPartyOverrides();
  all[id] = { ...all[id], ...patch, updatedAt: new Date().toISOString() };
  savePartyOverrides(all);
}

const HIDDEN_KEY = "party-hidden:v1";

export function loadHiddenPartyIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(HIDDEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function hideParty(id: string): void {
  const hidden = loadHiddenPartyIds();
  hidden.add(id);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hidden]));
    } catch {
      /* ignore */
    }
  }
  if (id.startsWith("p:")) {
    const all = loadPartyOverrides();
    delete all[id];
    savePartyOverrides(all);
  }
}

export function deletePartyOverride(id: string): void {
  hideParty(id);
}

export function loadManualParties(): Party[] {
  const all = loadPartyOverrides();
  return Object.entries(all)
    .filter(([, v]) => v && typeof v === "object" && v.name && v.kind)
    .map(([id, v]) => ({
      id,
      kind: v.kind!,
      name: v.name!,
      category: v.category,
      mobile: v.mobile,
      email: v.email,
      gstin: v.gstin,
      pan: v.pan,
      billingAddress: v.billingAddress,
      shippingAddress: v.shippingAddress,
      shippingAddresses: v.shippingAddresses,
      openingBalance: v.openingBalance ?? 0,
      openingBalanceSide: v.openingBalanceSide,
      creditPeriodDays: v.creditPeriodDays,
      creditLimit: v.creditLimit,
      contactPersonName: v.contactPersonName,
      dateOfBirth: v.dateOfBirth,
      bankAccounts: v.bankAccounts,
      customFields: v.customFields ?? [],
      customerId: v.customerId,
      vendorKey: v.vendorKey,
      createdAt: v.createdAt ?? new Date().toISOString(),
      updatedAt: v.updatedAt ?? new Date().toISOString(),
    }));
}
