/** Default matches current product primary in globals.css. */
export const DEFAULT_BRAND_PRIMARY = "#14B8A6";

export type BrandPreset = {
  id: string;
  label: string;
  hex: string;
};

export const BRAND_COLOR_PRESETS: BrandPreset[] = [
  { id: "blue", label: "Blue", hex: "#3B82F6" },
  { id: "indigo", label: "Indigo", hex: "#6366F1" },
  { id: "purple", label: "Purple", hex: "#A855F7" },
  { id: "red", label: "Red", hex: "#EF4444" },
  { id: "orange", label: "Orange", hex: "#F97316" },
  { id: "amber", label: "Amber", hex: "#F59E0B" },
  { id: "green", label: "Green", hex: "#059669" },
  { id: "teal", label: "Teal", hex: "#14B8A6" },
  { id: "slate", label: "Slate", hex: "#475569" },
];

/** Expand #RGB → #RRGGBB and uppercase. Returns null if invalid. */
export function normalizeHex(raw: string): string | null {
  const s = String(raw ?? "").trim();
  const m3 = /^#([0-9a-fA-F]{3})$/.exec(s);
  if (m3) {
    const [r, g, b] = m3[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  const m6 = /^#([0-9a-fA-F]{6})$/.exec(s);
  if (m6) return `#${m6[1]}`.toUpperCase();
  return null;
}

export function isValidHex(raw: string): boolean {
  return normalizeHex(raw) !== null;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const n = normalizeHex(hex);
  if (!n) return null;
  return {
    r: parseInt(n.slice(1, 3), 16),
    g: parseInt(n.slice(3, 5), 16),
    b: parseInt(n.slice(5, 7), 16),
  };
}

/** Relative luminance (sRGB) 0–1. */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const R = channel(rgb.r);
  const G = channel(rgb.g);
  const B = channel(rgb.b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** White or near-black label color for text on the brand fill. */
export function contrastForeground(hex: string): string {
  // Bias toward white on mid-saturation brand fills (typical primary buttons).
  return relativeLuminance(hex) > 0.55 ? "#0F172A" : "#FFFFFF";
}

export function brandGlowDim(hex: string, alpha = 0.1): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(59, 130, 246, ${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export type BrandCssVars = {
  primary: string;
  primaryForeground: string;
  ring: string;
  sidebarActive: string;
  sidebarActiveForeground: string;
  sidebarGlow: string;
  sidebarGlowDim: string;
  sidebarAccent: string;
};

export function resolveBrandCssVars(hex: string): BrandCssVars {
  const primary = normalizeHex(hex) ?? DEFAULT_BRAND_PRIMARY;
  const primaryForeground = contrastForeground(primary);
  return {
    primary,
    primaryForeground,
    ring: primary,
    sidebarActive: primary,
    sidebarActiveForeground: primaryForeground,
    sidebarGlow: primary,
    sidebarGlowDim: brandGlowDim(primary, 0.1),
    sidebarAccent: brandGlowDim(primary, 0.15),
  };
}

/** Apply brand tokens on :root so Tailwind `bg-primary` / sidebar active follow. */
export function applyBrandCssVars(hex: string, root: HTMLElement = document.documentElement): void {
  const v = resolveBrandCssVars(hex);
  root.style.setProperty("--primary", v.primary);
  root.style.setProperty("--primary-foreground", v.primaryForeground);
  root.style.setProperty("--ring", v.ring);
  root.style.setProperty("--sidebar-active", v.sidebarActive);
  root.style.setProperty("--sidebar-active-foreground", v.sidebarActiveForeground);
  root.style.setProperty("--sidebar-glow", v.sidebarGlow);
  root.style.setProperty("--sidebar-glow-dim", v.sidebarGlowDim);
  root.style.setProperty("--sidebar-accent", v.sidebarAccent);
}

export function matchingBrandPresetId(hex: string): string | null {
  const n = normalizeHex(hex);
  if (!n) return null;
  return BRAND_COLOR_PRESETS.find((p) => p.hex === n)?.id ?? null;
}

/** SVG favicon: rounded-square brand fill + white car glyph (24×24 Lucide paths, scaled in 100×100 viewBox). */
export function buildBrandFaviconSvg(hex: string): string {
  const color = normalizeHex(hex) ?? DEFAULT_BRAND_PRIMARY;
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect width="100" height="100" rx="18" ry="18" fill="${color}" />
      <g transform="translate(4, 4) scale(3.83)" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8" />
        <path d="M7 14h.01" />
        <path d="M17 14h.01" />
        <rect width="18" height="8" x="3" y="10" rx="2" />
        <path d="M5 18v2" />
        <path d="M19 18v2" />
      </g>
    </svg>
  `
    .trim()
    .replace(/\s+/g, " ");
}

/** Update the document favicon to match the active brand color. */
export function applyBrandFavicon(hex: string): void {
  if (typeof document === "undefined") return;
  const svg = buildBrandFaviconSvg(hex);
  const href = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;

  let link = document.querySelector<HTMLLinkElement>("link[data-brand-favicon]");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/svg+xml";
    link.setAttribute("data-brand-favicon", "true");
    document.head.appendChild(link);
  }
  link.href = href;
}
