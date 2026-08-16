"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAppBootstrapStore } from "@/store/app-bootstrap-store";
import { resourcesForPath } from "@/lib/domain-data-map";
import {
  areDomainResourcesReady,
  ensureDomainResources,
} from "@/lib/domain-data-loader";

/**
 * Loads permission-scoped domain data for the active dashboard route into Zustand.
 */
export function DomainDataSync() {
  const pathname = usePathname();
  const shellReady = useAppBootstrapStore((s) => s.ready);

  useEffect(() => {
    if (!shellReady) return;
    const resources = resourcesForPath(pathname);
    void ensureDomainResources(resources);
  }, [pathname, shellReady]);

  return null;
}

/** True when shell bootstrap is ready and the current route's domain pack has settled. */
export function useDomainDataReady(pathname?: string): boolean {
  const shellReady = useAppBootstrapStore((s) => s.ready);
  const path = usePathname();
  const effective = pathname ?? path;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!shellReady) {
      setReady(false);
      return;
    }
    const resources = resourcesForPath(effective);
    let cancelled = false;
    void (async () => {
      await ensureDomainResources(resources);
      if (!cancelled) {
        setReady(areDomainResourcesReady(resources));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shellReady, effective]);

  return shellReady && ready;
}
