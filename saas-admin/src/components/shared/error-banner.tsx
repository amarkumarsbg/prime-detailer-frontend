"use client";

import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "10px",
        padding: "12px 14px",
        background: "#fef2f2",
        border: "1px solid #fecaca",
        borderRadius: "8px",
        fontSize: "13px",
        color: "#b91c1c",
        lineHeight: "1.5",
      }}
      role="alert"
    >
      <AlertCircle style={{ width: "15px", height: "15px", marginTop: "1px", flexShrink: 0, color: "#ef4444" }} />
      <span style={{ flex: 1 }}>{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: "2px 8px",
            borderRadius: "4px",
            border: "1px solid #fca5a5",
            background: "transparent",
            color: "#dc2626",
            fontSize: "12px",
            fontWeight: 500,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <RefreshCw style={{ width: "11px", height: "11px" }} />
          Retry
        </button>
      )}
    </div>
  );
}
