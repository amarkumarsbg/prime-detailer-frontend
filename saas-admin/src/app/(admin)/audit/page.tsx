"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, ChevronDown, ChevronRight } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { ErrorBanner } from "@/components/shared/error-banner";
import { RefreshingBar } from "@/components/shared/loading";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar } from "@/components/shared/filter-bar";
import { AdminTable, THead, Th, TBody, Tr, Td, TableFooter, AdminTableSkeleton } from "@/components/shared/admin-table";
import { listPlatformAudit, type PlatformAuditRow } from "@/api/platform";
import { formatDateTime } from "@/lib/utils";

export default function AuditPage() {
  const [rows, setRows] = useState<PlatformAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [actionFilter, setActionFilter] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load(silent = false) {
    if (!silent) setLoading(true); else setRefreshing(true);
    setError(null);
    try { const res = await listPlatformAudit({ limit: 200, action: actionFilter || undefined }); setRows(res.logs); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); setRefreshing(false); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <Topbar title="Audit Logs" description={`${rows.length} platform events`} />
      <FilterBar searchValue={actionFilter} onSearch={setActionFilter} searchPlaceholder="Filter by action…" onRefresh={() => load(true)} refreshing={refreshing} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px", background: "#f8fafc" }}>
        {error && <div style={{ marginBottom: "12px" }}><ErrorBanner message={error} onRetry={load} /></div>}
        {loading ? <AdminTableSkeleton rows={8} cols={5} /> : rows.length === 0 ? (
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px" }}><EmptyState icon={ClipboardList} title="No audit events found" /></div>
        ) : (
          <>
            <AdminTable>
              <THead><tr><Th width="28px"></Th><Th>Event</Th><Th>Organization</Th><Th>Actor</Th><Th>Timestamp</Th></tr></THead>
              <TBody>
                {rows.map((r) => (
                  <React.Fragment key={r.id}>
                    <Tr onClick={() => setExpanded((prev) => prev === r.id ? null : r.id)}>
                      <Td><span style={{ color: "#94a3b8", display: "flex" }}>{expanded === r.id ? <ChevronDown style={{ width: "14px", height: "14px" }} /> : <ChevronRight style={{ width: "14px", height: "14px" }} />}</span></Td>
                      <Td><code style={{ fontSize: "12px", fontFamily: "monospace", fontWeight: 600, color: "#1e40af", background: "#eff6ff", padding: "2px 6px", borderRadius: "4px" }}>{r.action}</code></Td>
                      <Td><Link href={`/organizations/${r.organizationId}`} onClick={(e) => e.stopPropagation()} style={{ color: "#2563eb", textDecoration: "none", fontWeight: 500 }}>{r.organizationName}</Link></Td>
                      <Td muted>{r.actor}</Td>
                      <Td muted nowrap>{formatDateTime(r.createdAt)}</Td>
                    </Tr>
                    {expanded === r.id && (
                      <tr style={{ background: "#f8fafc" }}>
                        <td colSpan={5} style={{ padding: "12px 20px", borderBottom: "1px solid #f1f5f9" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "12px" }}>
                            <div>
                              <p style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", margin: "0 0 4px", textTransform: "uppercase" }}>Before</p>
                              <pre style={{ margin: 0, padding: "8px 10px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "11px", overflow: "auto", maxHeight: "120px", color: "#374151" }}>{JSON.stringify(r.before, null, 2) ?? "—"}</pre>
                            </div>
                            <div>
                              <p style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", margin: "0 0 4px", textTransform: "uppercase" }}>After</p>
                              <pre style={{ margin: 0, padding: "8px 10px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "11px", overflow: "auto", maxHeight: "120px", color: "#374151" }}>{JSON.stringify(r.after, null, 2) ?? "—"}</pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </TBody>
            </AdminTable>
            <TableFooter showing={rows.length} total={rows.length} label="events" />
          </>
        )}
      </div>
    </div>
  );
}