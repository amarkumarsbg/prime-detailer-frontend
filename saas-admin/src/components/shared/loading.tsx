"use client";

import { Loader2 } from "lucide-react";

// ─── Thin animated bar at the top of the viewport ────────────────────────────
// Shows when cached data is visible but a background refresh is running.
// Zero layout impact — position: fixed, 2px tall, pointer-events none.

export function RefreshingBar({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div
      role="status"
      aria-label="Refreshing data"
      aria-live="polite"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "2px",
        zIndex: 9999,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          height: "100%",
          background: "linear-gradient(90deg, transparent 0%, #3b82f6 50%, transparent 100%)",
          backgroundSize: "200% 100%",
          animation: "admin-shimmer 1.4s ease-in-out infinite",
        }}
      />
    </div>
  );
}

// ─── Centered inline spinner with optional label ─────────────────────────────

interface InlineLoaderProps {
  label?: string;
}

export function InlineLoader({ label = "Loading…" }: InlineLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        padding: "48px 24px",
        color: "#64748b",
        fontSize: "13px",
      }}
    >
      <Loader2 style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite", color: "#3b82f6" }} />
      <span>{label}</span>
    </div>
  );
}

// ─── Small button spinner ─────────────────────────────────────────────────────

interface BtnSpinnerProps {
  /** Text shown while loading, e.g. "Saving…" */
  label: string;
  size?: number;
}

export function BtnSpinner({ label, size = 14 }: BtnSpinnerProps) {
  return (
    <>
      <Loader2 style={{ width: size, height: size, animation: "spin 1s linear infinite", flexShrink: 0 }} />
      {label}
    </>
  );
}
