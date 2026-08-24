"use client";
import type { ReactNode } from "react";
import { Bell, PanelLeft } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useSidebarStore } from "@/store/sidebar-store";

interface TopbarProps { title?: string; description?: string; actions?: ReactNode; }

export function Topbar({ title, description, actions }: TopbarProps) {
  const user = useAuthStore((s) => s.user);
  const { collapsed, expand } = useSidebarStore();

  return (
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: "64px", padding: "0 24px", background: "#ffffff", borderBottom: "1px solid #e2e8f0", flexShrink: 0, gap: "12px" }}>
      {/* Expand sidebar button — only visible when sidebar is collapsed */}
      {collapsed && (
        <button
          aria-label="Expand sidebar"
          title="Expand sidebar"
          onClick={expand}
          style={{ width: "32px", height: "32px", borderRadius: "8px", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#475569", flexShrink: 0, transition: "background 0.15s" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#f1f5f9")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
        >
          <PanelLeft style={{ width: "16px", height: "16px" }} />
        </button>
      )}
      {/* Page title / subtitle */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <h1 style={{ fontSize: "16px", fontWeight: 600, color: "#0f172a", margin: 0, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</h1>}
        {description && <p style={{ fontSize: "12px", color: "#64748b", margin: "1px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{description}</p>}
      </div>
      {/* Right: page actions + notifications + user */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
        {actions}
        <button aria-label="Notifications" title="Notifications" style={{ width: "32px", height: "32px", borderRadius: "8px", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }} onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#f1f5f9")} onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}><Bell style={{ width: "16px", height: "16px" }} /></button>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingLeft: "8px", borderLeft: "1px solid #e2e8f0" }}>
          <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#2563eb", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, flexShrink: 0 }}>{user?.name?.[0]?.toUpperCase() ?? "A"}</div>
        </div>
      </div>
    </header>
  );
}
