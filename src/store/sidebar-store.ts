"use client";

import { create } from "zustand";

interface SidebarState {
  collapsed: boolean;
  mobileOpen: boolean;
  setCollapsed: (collapsed: boolean) => void;
  setMobileOpen: (open: boolean) => void;
  toggleCollapsed: () => void;
  toggleMobileOpen: () => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  collapsed: false,
  mobileOpen: false,
  setCollapsed: (collapsed) => set({ collapsed }),
  setMobileOpen: (mobileOpen) => set({ mobileOpen }),
  toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
  toggleMobileOpen: () => set((s) => ({ mobileOpen: !s.mobileOpen })),
}));
