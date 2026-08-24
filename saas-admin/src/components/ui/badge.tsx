import * as React from "react";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" | "muted";

const variantStyles: Record<BadgeVariant, React.CSSProperties> = {
  default:     { background: "#2563eb", color: "#fff", border: "1px solid #1d4ed8" },
  secondary:   { background: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1" },
  destructive: { background: "#fef2f2", color: "#b91c1c", border: "1px solid #fca5a5" },
  outline:     { background: "transparent", color: "#334155", border: "1px solid #cbd5e1" },
  success:     { background: "#f0fdf4", color: "#15803d", border: "1px solid #86efac" },
  warning:     { background: "#fffbeb", color: "#b45309", border: "1px solid #fcd34d" },
  info:        { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #93c5fd" },
  muted:       { background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0" },
};

const BASE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: "9999px",
  padding: "3px 8px",
  fontSize: "11.5px",
  fontWeight: 600,
  lineHeight: 1.4,
  whiteSpace: "nowrap",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
}

function Badge({ variant = "default", style, className, ...props }: BadgeProps) {
  return (
    <div
      style={{ ...BASE_STYLE, ...variantStyles[variant], ...style }}
      className={className}
      {...props}
    />
  );
}

// Keep cva export as no-op so any existing imports don't break
export const badgeVariants = () => "";
export { Badge };
