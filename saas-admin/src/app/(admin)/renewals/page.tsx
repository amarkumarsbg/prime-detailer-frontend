"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { ErrorBanner } from "@/components/shared/error-banner";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar } from "@/components/shared/filter-bar";
import { AdminTable, THead, Th, TBody, Tr, Td, TableFooter, AdminTableSkeleton } from "@/components/shared/admin-table";
import { PaymentStatusBadge } from "@/components/shared/status-badges";
import { listPlatformRenewals, type PlatformRenewalRow } from "@/api/platform";
import { formatCurrency, formatDate, termLabel } from "@/lib/utils";

export default function RenewalsPage() {
  const [rows, setRows] = useState<PlatformRenewalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  async function load(silent = false) {
    if (!silent) setLoading(true); else setRefreshing(true);
    setError(null);
    try { const res = await listPlatformRenewals({ limit: 200 }); setRows(res.renewals); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); setRefreshing(false); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return !q ? rows : rows.filter((r) => r.organizationName.toLowerCase().includes(q) || r.billNumber.toLowerCase().includes(q));
  }, [rows, search]);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <Topbar title="Renewals" description={`${rows.length} renewal records`} />
      <FilterBar searchValue={search} onSearch={setSearch} searchPlaceholder="Search org or bill…" onRefresh={() => load(true)} refreshing={refreshing} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px", background: "#f8fafc" }}>
        {error && <div style={{ marginBottom: "12px" }}><ErrorBanner message={error} onRetry={load} /></div>}
        {loading ? <AdminTableSkeleton rows={8} cols={8} /> : filtered.length === 0 ? (
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px" }}><EmptyState icon={RefreshCw} title="No renewals found" /></div>
        ) : (
          <>
            <AdminTable>
              <THead><tr><Th>Organization</Th><Th>Bill</Th><Th>Plan</Th><Th>Term</Th><Th>Prev. Expiry</Th><Th>New Expiry</Th><Th>Total</Th><Th>Payment</Th><Th>Date</Th></tr></THead>
              <TBody>
                {filtered.map((r) => (
                  <Tr key={r.billId}>
                    <Td><Link href={`/organizations/${r.organizationId}`} style={{ color: "#2563eb", textDecoration: "none", fontWeight: 500 }}>{r.organizationName}</Link></Td>
                    <Td mono muted>{r.billNumber}</Td>
                    <Td muted>{r.planName}</Td>
                    <Td muted nowrap>{termLabel(r.termMonths)}</Td>
                    <Td muted nowrap>{formatDate(r.previousExpiry)}</Td>
                    <Td muted nowrap>{formatDate(r.newExpiry)}</Td>
                    <Td style={{ fontWeight: 500 }}>{formatCurrency(r.totalAmount, r.currency)}</Td>
                    <Td><PaymentStatusBadge status={r.paymentStatus as never} /></Td>
                    <Td muted nowrap>{formatDate(r.renewalDate)}</Td>
                  </Tr>
                ))}
              </TBody>
            </AdminTable>
            <TableFooter showing={filtered.length} total={rows.length} label="renewals" />
          </>
        )}
      </div>
    </div>
  );
}