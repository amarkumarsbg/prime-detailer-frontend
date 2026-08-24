"use client";

import { useAppBootstrapStore } from "@/store/app-bootstrap-store";
import { useDomainDataReady } from "@/components/layout/domain-data-sync";

/** True after shell bootstrap + current route domain pack have settled. */
export function useDashboardStoresReady(): boolean {
  const shellReady = useAppBootstrapStore((s) => s.ready);
  const domainReady = useDomainDataReady();
  return shellReady && domainReady;
}
