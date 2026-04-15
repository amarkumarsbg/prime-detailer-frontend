"use client";

import { create } from "zustand";
import type { Branch } from "@/types";
import { apiGet, apiPost, apiPut } from "@/lib/api-client";

function nextBranchId(list: Branch[]): string {
  const nums = list
    .map((b) => {
      const m = /^br-(\d+)$/.exec(b.id);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter((n) => n > 0);
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `br-${String(next).padStart(3, "0")}`;
}

interface BranchStore {
  branches: Branch[];
  addBranch: (input: Omit<Branch, "id"> & { id?: string }) => Promise<Branch>;
  updateBranch: (id: string, updates: Partial<Omit<Branch, "id">>) => Promise<boolean>;
  deactivateBranch: (id: string) => Promise<void>;
  resetToSeed: () => Promise<void>;
}

export const useBranchStore = create<BranchStore>((set, get) => ({
  branches: [],

  resetToSeed: async () => {
    const { branches } = await apiGet<{ branches: Branch[] }>("/api/branches");
    set({ branches });
  },

  addBranch: async (input) => {
    const list = get().branches;
    const id = input.id ?? nextBranchId(list);
    const code =
      input.code?.trim() || `SITE-${id.replace(/^br-/, "").toUpperCase()}`;
    const branch: Branch = {
      id,
      name: input.name.trim(),
      address: input.address.trim(),
      phone: input.phone.trim(),
      isActive: input.isActive ?? true,
      qrCodeId: input.qrCodeId ?? `qr-${id}`,
      code,
      city: input.city?.trim() ?? "",
      state: input.state?.trim() ?? "",
      pincode: input.pincode?.trim() ?? "",
      email: input.email?.trim() || undefined,
      managerName: input.managerName?.trim() || undefined,
      managerPhone: input.managerPhone?.trim() || undefined,
    };
    const { branch: created } = await apiPost<{ branch: Branch }>("/api/branches", branch);
    set({ branches: [...list, created] });
    return created;
  },

  updateBranch: async (id, updates) => {
    const list = get().branches;
    const i = list.findIndex((b) => b.id === id);
    if (i < 0) return false;
    const body: Record<string, unknown> = { ...updates };
    if (updates.name !== undefined) body.name = updates.name.trim();
    if (updates.address !== undefined) body.address = updates.address.trim();
    if (updates.phone !== undefined) body.phone = updates.phone.trim();
    if (updates.code !== undefined) body.code = updates.code.trim();
    if (updates.city !== undefined) body.city = updates.city.trim();
    if (updates.state !== undefined) body.state = updates.state.trim();
    if (updates.pincode !== undefined) body.pincode = updates.pincode.trim();
    if (updates.email !== undefined) body.email = updates.email.trim() || null;
    if (updates.managerName !== undefined) body.managerName = updates.managerName.trim() || null;
    if (updates.managerPhone !== undefined)
      body.managerPhone = updates.managerPhone.trim() || null;
    const { branch } = await apiPut<{ branch: Branch }>(`/api/branches/${id}`, body);
    set({
      branches: list.map((b) => (b.id === id ? branch : b)),
    });
    return true;
  },

  deactivateBranch: async (id) => {
    await get().updateBranch(id, { isActive: false });
  },
}));
