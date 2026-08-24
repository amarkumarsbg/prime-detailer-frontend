import type { Customer, ExpenseVendorProfile } from "@/types";
import type { Party, PartyKind } from "@/types/party";
import { loadHiddenPartyIds, loadPartyOverrides } from "./party-persistence";

function nowIso() {
  return new Date().toISOString();
}

function mergeParty(base: Party): Party {
  const overrides = loadPartyOverrides();
  const patch = overrides[base.id];
  if (!patch) return base;
  return {
    ...base,
    ...patch,
    customFields: patch.customFields ?? base.customFields,
    updatedAt: patch.updatedAt ?? base.updatedAt,
  };
}

export function buildPartiesFromSources(args: {
  customers: Customer[];
  vendorDirectory: ExpenseVendorProfile[];
  vendorNamesFromExpenses: string[];
}): Party[] {
  const { customers, vendorDirectory, vendorNamesFromExpenses } = args;
  const byId = new Map<string, Party>();

  for (const c of customers) {
    const id = `c:${c.id}`;
    const base: Party = {
      id,
      kind: "customer",
      name: c.name,
      category: undefined,
      mobile: c.phone || undefined,
      email: c.email || undefined,
      billingAddress: c.address || undefined,
      shippingAddress: c.address || undefined,
      openingBalance: 0,
      customFields: [],
      customerId: c.id,
      createdAt: c.createdAt,
      updatedAt: nowIso(),
    };
    byId.set(id, mergeParty(base));
  }

  const vendorKeys = new Set<string>();
  for (const v of vendorDirectory) {
    const name = v.name?.trim();
    if (name) vendorKeys.add(name);
  }
  for (const n of vendorNamesFromExpenses) {
    if (n?.trim()) vendorKeys.add(n.trim());
  }

  for (const name of vendorKeys) {
    const profile = vendorDirectory.find((v) => v.name.trim() === name);
    const id = profile?.id ? `v:${profile.id}` : `v:${encodeURIComponent(name)}`;
    if (byId.has(id)) continue;
    const base: Party = {
      id,
      kind: "supplier",
      name,
      category: undefined,
      mobile: profile?.phone,
      email: profile?.email,
      gstin: profile?.gstNumber,
      pan: profile?.panNumber,
      billingAddress: profile?.address,
      shippingAddress: profile?.address,
      openingBalance: 0,
      creditPeriodDays: profile?.paymentTerms
        ? parseInt(profile.paymentTerms.replace(/\D/g, ""), 10) || undefined
        : undefined,
      customFields: [],
      vendorKey: name,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    byId.set(id, mergeParty(base));
  }

  const overrides = loadPartyOverrides();
  for (const [id, patch] of Object.entries(overrides)) {
    if (byId.has(id)) continue;
    if (!patch?.name || !patch.kind) continue;
    byId.set(id, {
      id,
      kind: patch.kind as PartyKind,
      name: patch.name,
      category: patch.category,
      mobile: patch.mobile,
      email: patch.email,
      gstin: patch.gstin,
      pan: patch.pan,
      billingAddress: patch.billingAddress,
      shippingAddress: patch.shippingAddress,
      shippingAddresses: patch.shippingAddresses,
      openingBalance: patch.openingBalance ?? 0,
      openingBalanceSide: patch.openingBalanceSide,
      creditPeriodDays: patch.creditPeriodDays,
      creditLimit: patch.creditLimit,
      contactPersonName: patch.contactPersonName,
      dateOfBirth: patch.dateOfBirth,
      bankAccounts: patch.bankAccounts,
      customFields: patch.customFields ?? [],
      customerId: patch.customerId,
      vendorKey: patch.vendorKey,
      createdAt: patch.createdAt ?? nowIso(),
      updatedAt: patch.updatedAt ?? nowIso(),
    });
  }

  const hidden = loadHiddenPartyIds();
  return [...byId.values()]
    .filter((p) => !hidden.has(p.id))
    .sort((a, b) => a.name.localeCompare(b.name));
}
