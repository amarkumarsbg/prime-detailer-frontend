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
    applyBrandFavicon(hex);
  }, [brandPrimary, brandPrimaryPreview]);

  return null;
}
