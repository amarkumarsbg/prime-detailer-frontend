"use client";

import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }: EmptyStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        textAlign: "center",
        color: "#94a3b8",
      }}
    >
      <div
        style={{
          width: "44px",
          height: "44px",
          borderRadius: "10px",
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "12px",
        }}
      >
        <Icon style={{ width: "20px", height: "20px", color: "#94a3b8" }} />
      </div>
      <p style={{ fontSize: "14px", fontWeight: 500, color: "#475569", margin: "0 0 4px" }}>{title}</p>
      {description && (
        <p style={{ fontSize: "13px", color: "#94a3b8", margin: "0 0 16px", maxWidth: "280px" }}>{description}</p>
      )}
      {action}
    </div>
  );
}
