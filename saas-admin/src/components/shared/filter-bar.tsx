"use client";

import type { ReactNode } from "react";
import { Search, RefreshCw } from "lucide-react";

interface FilterBarProps {
  searchValue?: string;
  searchPlaceholder?: string;
  onSearch?: (v: string) => void;
  children?: ReactNode; // extra filter controls (selects, etc.)
  onRefresh?: () => void;
  refreshing?: boolean;
  rightSlot?: ReactNode; // buttons on the far right
}

export function FilterBar({
  searchValue,
  searchPlaceholder = "Search…",
  onSearch,
  children,
  onRefresh,
  refreshing,
  rightSlot,
}: FilterBarProps) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "8px",
        padding: "12px 24px",
        borderBottom: "1px solid #f1f5f9",
        background: "#ffffff",
      }}
    >
      {onSearch && (
        <div style={{ position: "relative", minWidth: "200px", maxWidth: "280px", flex: "1 1 200px" }}>
          <Search
            style={{
              position: "absolute",
              left: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "14px",
              height: "14px",
              color: "#94a3b8",
              pointerEvents: "none",
            }}
          />
          <input
            type="search"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearch(e.target.value)}
            style={{
              width: "100%",
              height: "34px",
              paddingLeft: "32px",
              paddingRight: "10px",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              fontSize: "13px",
              color: "#0f172a",
              background: "#f8fafc",
              outline: "none",
              boxSizing: "border-box",
            }}
            onFocus={(e) => { e.target.style.borderColor = "#2563eb"; e.target.style.background = "#fff"; }}
            onBlur={(e) => { e.target.style.borderColor = "#e2e8f0"; e.target.style.background = "#f8fafc"; }}
          />
        </div>
      )}
      {children}
      {(onRefresh || rightSlot) && (
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
          {rightSlot}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={refreshing}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                height: "34px",
                padding: "0 12px",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                background: "#fff",
                fontSize: "12px",
                fontWeight: 500,
                color: "#475569",
                cursor: refreshing ? "not-allowed" : "pointer",
                opacity: refreshing ? 0.7 : 1,
              }}
            >
              <RefreshCw style={{ width: "13px", height: "13px", animation: refreshing ? "spin 1s linear infinite" : "none" }} />
              Refresh
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Small styled select for use inside FilterBar ─────────────────────────────

interface FilterSelectProps {
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  label?: string;
}

export function FilterSelect({ value, onChange, children, label }: FilterSelectProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
      {label && <span style={{ fontSize: "12px", color: "#64748b", whiteSpace: "nowrap" }}>{label}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          height: "34px",
          padding: "0 8px",
          border: "1px solid #e2e8f0",
          borderRadius: "6px",
          fontSize: "12px",
          color: "#374151",
          background: "#fff",
          outline: "none",
          cursor: "pointer",
        }}
      >
        {children}
      </select>
    </div>
  );
}
