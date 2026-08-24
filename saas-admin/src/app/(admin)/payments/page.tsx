"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { FileText, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/topbar";
import { ErrorBanner } from "@/components/shared/error-banner";
import { RefreshingBar } from "@/components/shared/loading";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar, FilterSelect } from "@/components/shared/filter-bar";
import { AdminTable, THead, Th, TBody, Tr, Td, TableFooter, AdminTableSkeleton } from "@/components/shared/admin-table";
import { PaymentStatusBadge } from "@/components/shared/status-badges";
import { listPlatformPayments, type PlatformPaymentRow } from "@/api/platform";
import { verifyPayment } from "@/api/organizations";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export default function PaymentsPage() {
  const [rows, setRows] = useState<PlatformPaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [verifying, setVerifying] = useState<string | null>(null); // payment id being verified
  async function load(silent = false) {
    if (!silent) setLoading(true); else setRefreshing(true);
    setError(null);
    try { const res = await listPlatformPayments({ limit: 200, status: filterStatus !== "all" ? filterStatus : undefined }); setRows(res.payments); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); setRefreshing(false); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [filterStatus]);
  const pending = useMemo(() => rows.filter((r) => r.status === "PENDING" || r.status === "PROCESSING"), [rows]);
  const others = useMemo(() => rows.filter((r) => r.status !== "PENDING" && r.status !== "PROCESSING"), [rows]);
  const displayed = useMemo(() => {
    const all = [...pending, ...others];
    if (!search) return all;
    const q = search.toLowerCase();
    return all.filter((r) => r.organizationName.toLowerCase().includes(q) || (r.txnReference ?? "").toLowerCase().includes(q));
  }, [pending, others, search]);
  async function handleVerify(row: PlatformPaymentRow, outcome: "PAID" | "FAILED") {
    if (verifying) return; // prevent duplicate
    setVerifying(row.id);
    try { await verifyPayment(row.organizationId, { paymentId: row.id, outcome }); toast.success(`Payment marked as ${outcome}.`); await load(true); }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setVerifying(null); }
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <Topbar title="Payments" description={`${rows.length} payment records`} />
      <FilterBar searchValue={search} onSearch={setSearch} searchPlaceholder="Search org or txn ref…" onRefresh={() => load(true)} refreshing={refreshing}>
        <FilterSelect value={filterStatus} onChange={setFilterStatus}>
          <option value="all">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PROCESSING">Processing</option>
          <option value="PAID">Paid</option>
          <option value="FAILED">Failed</option>
        </FilterSelect>
      </FilterBar>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px", background: "#f8fafc" }}>
        {error && <div style={{ marginBottom: "12px" }}><ErrorBanner message={error} onRetry={load} /></div>}
        {loading ? <AdminTableSkeleton rows={8} cols={8} /> : displayed.length === 0 ? (
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px" }}><EmptyState icon={FileText} title="No payments found" /></div>
        ) : (
          <>
            <AdminTable>
              <THead><tr><Th>Organization</Th><Th>Plan</Th><Th>Bill</Th><Th>Amount</Th><Th>Method</Th><Th>Status</Th><Th>Txn Ref</Th><Th>Created</Th><Th>Verified</Th><Th></Th></tr></THead>
              <TBody>
                {displayed.map((r) => (
                  <Tr key={r.id}>
                    <Td><Link href={`/organizations/${r.organizationId}`} style={{ color: "#2563eb", textDecoration: "none", fontWeight: 500 }}>{r.organizationName}</Link></Td>
                    <Td muted>{r.planName}</Td>
                    <Td mono muted>{r.billNumber ?? "—"}</Td>
                    <Td style={{ fontWeight: 500 }}>{r.amount != null ? formatCurrency(r.amount, r.currency) : "—"}</Td>
                    <Td muted>{r.method ?? "—"}</Td>
                    <Td><PaymentStatusBadge status={r.status} /></Td>
                    <Td mono muted nowrap>{r.txnReference ?? "—"}</Td>
                    <Td muted nowrap>{formatDateTime(r.createdAt)}</Td>
                    <Td muted nowrap>{r.verifiedAt ? formatDateTime(r.verifiedAt) : "—"}</Td>
                    <Td>
                      {(r.status === "PENDING" || r.status === "PROCESSING") && (
                        <div style={{ display: "flex", gap: "4px" }}>
                          <button disabled={!!verifying} onClick={() => handleVerify(r, "PAID")} style={{ display: "flex", alignItems: "center", gap: "3px", padding: "3px 8px", border: "1px solid #bbf7d0", borderRadius: "5px", background: "#f0fdf4", color: "#15803d", fontSize: "11px", fontWeight: 500, cursor: verifying ? "not-allowed" : "pointer", opacity: verifying ? 0.6 : 1 }}>{verifying === r.id ? <Loader2 style={{ width: "11px", height: "11px", animation: "spin 1s linear infinite" }} /> : <CheckCircle2 style={{ width: "11px", height: "11px" }} />} Paid</button>
                          <button disabled={!!verifying} onClick={() => handleVerify(r, "FAILED")} style={{ display: "flex", alignItems: "center", gap: "3px", padding: "3px 8px", border: "1px solid #fecaca", borderRadius: "5px", background: "#fef2f2", color: "#dc2626", fontSize: "11px", fontWeight: 500, cursor: verifying ? "not-allowed" : "pointer", opacity: verifying ? 0.6 : 1 }}>{verifying === r.id ? <Loader2 style={{ width: "11px", height: "11px", animation: "spin 1s linear infinite" }} /> : <XCircle style={{ width: "11px", height: "11px" }} />} Failed</button>
                        </div>
                      )}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </AdminTable>
            <TableFooter showing={displayed.length} total={rows.length} label="payments" />
          </>
        )}
      </div>
    </div>
  );
}