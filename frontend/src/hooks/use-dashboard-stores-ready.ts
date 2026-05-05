"use client";

import { useAppBootstrapStore } from "@/store/app-bootstrap-store";

/** True after `/api/bootstrap` has populated all entity stores. */
export function useDashboardStoresReady(): boolean {
  return useAppBootstrapStore((s) => s.ready);
}
