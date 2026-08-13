/** Shared Recharts Tooltip props — theme-aware, no opaque hover band. */
export const CHART_TOOLTIP_PROPS = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: "0.5rem",
    color: "var(--popover-foreground)",
    boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
  },
  /** Recharts defaults these to near-black; force theme foreground. */
  labelStyle: {
    color: "var(--popover-foreground)",
  },
  itemStyle: {
    color: "var(--popover-foreground)",
  },
  /**
   * Default cursor is a full-height gray rect that ignores dark theme.
   * Disable it — tooltip alone is enough for bar/line charts.
   */
  cursor: false as const,
};
