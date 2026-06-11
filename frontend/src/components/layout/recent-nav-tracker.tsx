"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackRecentNav } from "@/lib/recent-nav";
import { flattenNavItems } from "@/lib/nav-items";

/** Records sidebar visits for the mobile drawer quick-links section. */
export function RecentNavTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const items = flattenNavItems();
    const match = items.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
    );
    if (match) {
      trackRecentNav(match.href, match.label);
    }
  }, [pathname]);

  return null;
}
