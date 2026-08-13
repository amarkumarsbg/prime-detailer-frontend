"use client";

import { useEffect } from "react";
import {
  applyBrandCssVars,
  DEFAULT_BRAND_PRIMARY,
  normalizeHex,
} from "@/lib/brand-color";
import { useSettingsStore } from "@/store/settings-store";

/**
 * Keeps CSS primary / sidebar-active tokens in sync with company brandPrimary.
 * Mount once under ThemeProvider (root layout).
 */
export function BrandThemeApplier() {
  const brandPrimary = useSettingsStore((s) => s.brandPrimary);

  useEffect(() => {
    const hex = normalizeHex(brandPrimary) ?? DEFAULT_BRAND_PRIMARY;
    applyBrandCssVars(hex);
  }, [brandPrimary]);

  return null;
}
