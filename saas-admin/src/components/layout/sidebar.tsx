"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Building2, CreditCard, FileText,
  RefreshCw, Receipt, Tag, Users, ClipboardList, LogOut,
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useSidebarStore } from "@/store/sidebar-store";

const NAV_SECTIONS = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Organizations", href: "/organizations", icon: Building2 },
    ],
  },
  {
    label: "Billing",
    items: [
      { label: "Subscriptions", href: "/subscriptions", icon: CreditCard },
      { label: "Payments", href: "/payments", icon: FileText },
      { label: "Renewals", href: "/renewals", icon: RefreshCw },
      { label: "Bills", href: "/bills", icon: Receipt },
    ],
  },
  {
    label: "Platform",
    items: [
      { label: "Plans", href: "/plans", icon: Tag },
      { label: "Referrals", href: "/referrals", icon: Users },
      { label: "Audit Logs", href: "/audit", icon: ClipboardList },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, clearSession } = useAuthStore();
  const { collapsed, collapse } = useSidebarStore();

  const W = collapsed ? "56px" : "260px";

  return (
    <aside
      style={{
        width: W,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        background: "#ffffff",
        borderRight: "1px solid #cbd5e1",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        transition: "width 0.2s ease",
        overflow: "hidden",
      }}
    >
      {/* Brand header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          height: "64px",
          padding: "0 10px",
          borderBottom: "1px solid #cbd5e1",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            background: "#3b82f6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 700,
            fontSize: "15px",
            flexShrink: 0,
          }}
        >
          P
        </div>
        {!collapsed && (
          <div style={{ minWidth: 0, overflow: "hidden" }}>
            <p style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", margin: 0, lineHeight: 1.2, whiteSpace: "nowrap" }}>
              Prime Detailers
            </p>
            <p style={{ fontSize: "11px", color: "#475569", margin: 0, opacity: 0.8 }}>SaaS Admin</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: collapsed ? "12px 0" : "12px 10px", display: "flex", flexDirection: "column", gap: collapsed ? "4px" : "12px" }}>
        {NAV_SECTIONS.map((section, groupIdx) => (
          <section key={section.label} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {!collapsed && (
              <div style={{ padding: groupIdx === 0 ? "0 12px 6px" : "16px 12px 6px" }}>
                <h2 style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#0f172a", margin: 0 }}>
                  {section.label}
                </h2>
              </div>
            )}
            {collapsed && groupIdx > 0 && (
              <div style={{ height: "1px", background: "#f1f5f9", margin: "6px 8px" }} />
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "2px", padding: collapsed ? "0 4px" : "0 6px" }}>
              {section.items.map(({ label, href, icon: Icon }) => {
                const active = isActive(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    title={collapsed ? label : undefined}
                    aria-label={label}
                    onClick={() => collapse()}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: collapsed ? 0 : "10px",
                      padding: collapsed ? "9px" : "9px 12px",
                      borderRadius: "10px",
                      fontSize: "13px",
                      fontWeight: 500,
                      textDecoration: "none",
                      transition: "background 0.15s, color 0.15s, transform 0.15s",
                      background: active ? "#3b82f6" : "transparent",
                      color: active ? "#ffffff" : "#475569",
                      justifyContent: collapsed ? "center" : undefined,
                      transformOrigin: "left center",
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLAnchorElement;
                      el.style.transform = "scale(1.04)";
                      if (!active) {
                        el.style.background = "#dbeafe";
                        el.style.color = "#0f172a";
                      }
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLAnchorElement;
                      el.style.transform = "scale(1)";
                      if (!active) {
                        el.style.background = "transparent";
                        el.style.color = "#475569";
                      }
                    }}
                  >
                    <Icon style={{ width: "16px", height: "16px", flexShrink: 0, opacity: active ? 1 : 0.9 }} />
                    {!collapsed && <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </nav>

      {/* Footer / Profile */}
      <div
        style={{
          flexShrink: 0,
          borderTop: "1px solid #cbd5e1",
          padding: collapsed ? "10px 4px" : "10px",
          display: "flex",
          flexDirection: "column",
          gap: "2px",
        }}
      >
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", borderRadius: "10px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#3b82f6", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, flexShrink: 0 }}>
              {user?.name?.[0]?.toUpperCase() ?? "A"}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontSize: "13px", fontWeight: 500, color: "#0f172a", margin: 0, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.name ?? "Admin"}</p>
              <p style={{ fontSize: "10px", color: "#64748b", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.role}</p>
            </div>
          </div>
        )}
        <button
          title={collapsed ? "Sign out" : undefined}
          aria-label="Sign out"
          onClick={() => { clearSession(); window.location.href = "/login"; }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: collapsed ? 0 : "10px",
            padding: collapsed ? "9px" : "8px 12px",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: 500,
            color: "#dc2626",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            width: "100%",
            justifyContent: collapsed ? "center" : undefined,
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#fef2f2"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
        >
          <LogOut style={{ width: "16px", height: "16px", flexShrink: 0 }} />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}
