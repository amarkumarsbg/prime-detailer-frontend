"use client";

import { useEffect } from "react";
import {
  applyBrandCssVars,
  applyBrandFavicon,
  DEFAULT_BRAND_PRIMARY,
  normalizeHex,
} from "@/lib/brand-color";
import { useSettingsStore } from "@/store/settings-store";

/**
 * Keeps CSS primary / sidebar-active tokens and favicon in sync with company brandPrimary.
 * Mount once under ThemeProvider (root layout).
 */
export function BrandThemeApplier() {
  const brandPrimary = useSettingsStore((s) => s.brandPrimary);
  const brandPrimaryPreview = useSettingsStore((s) => s.brandPrimaryPreview);

  useEffect(() => {
    const hex =
      normalizeHex(brandPrimaryPreview ?? brandPrimary) ?? DEFAULT_BRAND_PRIMARY;
    applyBrandCssVars(hex);

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img">
        <rect width="32" height="32" rx="8" fill="${hex}"/>
        <g transform="translate(4 4)" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8"/>
          <circle cx="7" cy="14" r="1" fill="#fff" stroke="none"/>
          <circle cx="17" cy="14" r="1" fill="#fff" stroke="none"/>
          <rect width="18" height="8" x="3" y="10" rx="2"/>
          <path d="M5 18v2"/>
          <path d="M19 18v2"/>
        </g>
      </svg>
    `.trim().replace(/\s+/g, " ");

    applyBrandFavicon(svg);
  }, [brandPrimary, brandPrimaryPreview]);

  return null;
}
