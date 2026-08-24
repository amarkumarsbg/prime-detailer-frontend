/**
 * Shared design tokens for the SaaS Admin Portal.
 * Import these constants anywhere you need consistent values.
 */

export const COLORS = {
  primary: "#2563eb",
  primaryHover: "#1d4ed8",
  surface: "#ffffff",
  bg: "#f8fafc",
  border: "#e2e8f0",
  borderSubtle: "#f1f5f9",
  text: "#0f172a",
  textMuted: "#64748b",
  textSubtle: "#94a3b8",
  // Semantic
  success: "#16a34a",
  successBg: "#f0fdf4",
  successBorder: "#bbf7d0",
  warning: "#d97706",
  warningBg: "#fffbeb",
  warningBorder: "#fde68a",
  danger: "#dc2626",
  dangerBg: "#fef2f2",
  dangerBorder: "#fecaca",
  info: "#2563eb",
  infoBg: "#eff6ff",
  infoBorder: "#bfdbfe",
} as const;

export const RADIUS = {
  sm: "6px",
  md: "8px",
  lg: "12px",
  xl: "16px",
} as const;

export const SHADOW = {
  sm: "0 1px 2px rgba(0,0,0,0.05)",
  md: "0 1px 3px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)",
  lg: "0 4px 16px rgba(0,0,0,0.08)",
} as const;
