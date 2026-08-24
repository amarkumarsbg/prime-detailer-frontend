"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { CreditCard } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { ErrorBanner } from "@/components/shared/error-banner";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar } from "@/components/shared/filter-bar";
import { AdminTable, THead, Th, TBody, Tr, Td, TableFooter, AdminTableSkeleton } from "@/components/shared/admin-table";
import { SubscriptionStatusBadge, PaymentStatusBadge, PlanBadge } from "@/components/shared/status-badges";
import { listOrganizations } from "@/api/organizations";
import { formatDate, daysRemainingLabel, termLabel } from "@/lib/utils";
import type { OrgListItem } from "@/types";

export default function SubscriptionsPage() {
  const [orgs, setOrgs] = useState<OrgListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  async function load(silent = false) {
    if (!silent) setLoading(true); else setRefreshing(true);
    setError(null);
    try { setOrgs(await listOrganizations()); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); setRefreshing(false); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return !q ? orgs : orgs.filter((o) => o.organization.name.toLowerCase().includes(q));
  }, [orgs, search]);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <Topbar title="Subscriptions" description="All organization subscriptions" />
      <FilterBar searchValue={search} onSearch={setSearch} searchPlaceholder="Search organizations…" onRefresh={() => load(true)} refreshing={refreshing} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px", background: "#f8fafc" }}>
        {error && <div style={{ marginBottom: "12px" }}><ErrorBanner message={error} onRetry={load} /></div>}
        {loading ? <AdminTableSkeleton rows={8} cols={9} /> : filtered.length === 0 ? (
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px" }}><EmptyState icon={CreditCard} title="No subscriptions found" /></div>
        ) : (
          <>
            <AdminTable>
              <THead><tr><Th>Organization</Th><Th>Plan</Th><Th>Term</Th><Th>Status</Th><Th>Start</Th><Th>Expiry</Th><Th>Days Left</Th><Th>Payment</Th><Th>Branches</Th><Th>Users</Th><Th></Th></tr></THead>
              <TBody>
                {filtered.map((o) => { const s = o.subscription; return (
                  <Tr key={o.organization.id}>
                    <Td><Link href={`/organizations/${o.organization.id}`} style={{ color: "#2563eb", textDecoration: "none", fontWeight: 500 }}>{o.organization.name}</Link></Td>
                    <Td><PlanBadge planCode={s.planCode} /></Td>
                    <Td muted nowrap>{termLabel(s.termMonths)}</Td>
                    <Td><SubscriptionStatusBadge status={s.status} /></Td>
                    <Td muted nowrap>{formatDate(s.startsAt)}</Td>
                    <Td muted nowrap>{formatDate(s.expiresAt)}</Td>
                    <Td muted nowrap>{daysRemainingLabel(s.daysRemaining)}</Td>
                    <Td><PaymentStatusBadge status={s.paymentStatus} /></Td>
                    <Td muted>{o.usage.branchesUsed}/{s.effectiveMaxBranches ?? "∞"}</Td>
                    <Td muted>{o.usage.usersUsed}/{s.limits.maxStaff ?? "∞"}</Td>
                    <Td><Link href={`/organizations/${o.organization.id}`} style={{ fontSize: "12px", fontWeight: 500, color: "#2563eb", textDecoration: "none", padding: "4px 10px", border: "1px solid #bfdbfe", borderRadius: "5px", background: "#eff6ff" }}>Manage</Link></Td>
                  </Tr>
                ); })}
              </TBody>
            </AdminTable>
            <TableFooter showing={filtered.length} total={orgs.length} label="subscriptions" />
          </>
        )}
      </div>
    </div>
  );
}