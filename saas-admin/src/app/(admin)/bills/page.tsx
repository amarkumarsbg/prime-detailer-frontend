"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Receipt } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { ErrorBanner } from "@/components/shared/error-banner";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar } from "@/components/shared/filter-bar";
import { AdminTable, THead, Th, TBody, Tr, Td, TableFooter, AdminTableSkeleton } from "@/components/shared/admin-table";
import { PaymentStatusBadge } from "@/components/shared/status-badges";
import { listPlatformBills, type PlatformBillRow } from "@/api/platform";
import { formatCurrency, formatDate, termLabel } from "@/lib/utils";

export default function BillsPage() {
  const [rows, setRows] = useState<PlatformBillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  async function load(silent = false) {
    if (!silent) setLoading(true); else setRefreshing(true);
    setError(null);
    try { const res = await listPlatformBills({ limit: 200 }); setRows(res.bills); }
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
      <Topbar title="Bills" description={`${rows.length} subscription bills`} />
      <FilterBar searchValue={search} onSearch={setSearch} searchPlaceholder="Search org or bill…" onRefresh={() => load(true)} refreshing={refreshing} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px", background: "#f8fafc" }}>
        {error && <div style={{ marginBottom: "12px" }}><ErrorBanner message={error} onRetry={load} /></div>}
        {loading ? <AdminTableSkeleton rows={8} cols={9} /> : filtered.length === 0 ? (
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px" }}><EmptyState icon={Receipt} title="No bills found" /></div>
        ) : (
          <>
            <AdminTable>
              <THead><tr><Th>Organization</Th><Th>Bill #</Th><Th>Plan</Th><Th>Term</Th><Th>Base</Th><Th>Extras</Th><Th>Referral</Th><Th>GST</Th><Th>Total</Th><Th>Payment</Th><Th>Date</Th></tr></THead>
              <TBody>
                {filtered.map((b) => (
                  <Tr key={b.id}>
                    <Td><Link href={`/organizations/${b.organizationId}`} style={{ color: "#2563eb", textDecoration: "none", fontWeight: 500 }}>{b.organizationName}</Link></Td>
                    <Td mono muted>{b.billNumber}</Td>
                    <Td muted>{b.planName}</Td>
                    <Td muted nowrap>{termLabel(b.termMonths)}</Td>
                    <Td muted>{formatCurrency(b.baseAmount)}</Td>
                    <Td muted>{(b.extraBranchCost + b.extraUserCost + b.onboardingFee) > 0 ? formatCurrency(b.extraBranchCost + b.extraUserCost + b.onboardingFee) : "—"}</Td>
                    <Td><span style={{ color: b.referralDiscount > 0 ? "#16a34a" : "#94a3b8" }}>{b.referralDiscount > 0 ? `-${formatCurrency(b.referralDiscount)}` : "—"}</span></Td>
                    <Td muted>{formatCurrency(b.gstAmount)}</Td>
                    <Td style={{ fontWeight: 500 }}>{formatCurrency(b.totalAmount, b.currency)}</Td>
                    <Td><PaymentStatusBadge status={b.paymentStatus} /></Td>
                    <Td muted nowrap>{formatDate(b.createdAt)}</Td>
                  </Tr>
                ))}
              </TBody>
            </AdminTable>
            <TableFooter showing={filtered.length} total={rows.length} label="bills" />
          </>
        )}
      </div>
    </div>
  );
}