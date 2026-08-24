"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { ErrorBanner } from "@/components/shared/error-banner";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar, FilterSelect } from "@/components/shared/filter-bar";
import { AdminTable, THead, Th, TBody, Tr, Td, TableFooter, AdminTableSkeleton } from "@/components/shared/admin-table";
import { SubscriptionStatusBadge, PaymentStatusBadge, PlanBadge } from "@/components/shared/status-badges";
import { listOrganizations } from "@/api/organizations";
import { formatDate, daysRemainingLabel } from "@/lib/utils";
import type { OrgListItem, PlanCode } from "@/types";

type FS = "all" | "active" | "expired" | "past_due" | "expiring" | "cancelled";

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<OrgListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState<PlanCode | "all">("all");
  const [filterStatus, setFilterStatus] = useState<FS>("all");

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
    return orgs.filter((o) => {
      if (q && !o.organization.name.toLowerCase().includes(q)) return false;
      if (filterPlan !== "all" && o.subscription.planCode !== filterPlan) return false;
      const s = o.subscription;
      if (filterStatus === "active") return s.status === "ACTIVE";
      if (filterStatus === "expired") return s.status === "EXPIRED";
      if (filterStatus === "past_due") return s.status === "PAST_DUE";
      if (filterStatus === "cancelled") return s.status === "CANCELLED";
      if (filterStatus === "expiring") { const d = s.daysRemaining; return d != null && d > 0 && d <= 30; }
      return true;
    });
  }, [orgs, search, filterPlan, filterStatus]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <Topbar title="Organizations" description={`${orgs.length} customer organizations`} />
      <FilterBar searchValue={search} onSearch={setSearch} searchPlaceholder="Search organizations…" onRefresh={() => load(true)} refreshing={refreshing}>
        <FilterSelect value={filterPlan} onChange={(v) => setFilterPlan(v as PlanCode | "all")}>
          <option value="all">All Plans</option>
          <option value="STARTER">Starter</option>
          <option value="GROWTH">Growth</option>
          <option value="BUSINESS">Business</option>
          <option value="ENTERPRISE">Enterprise</option>
          <option value="CUSTOM">Custom</option>
        </FilterSelect>
        <FilterSelect value={filterStatus} onChange={(v) => setFilterStatus(v as FS)}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="past_due">Past Due</option>
          <option value="expiring">Expiring Soon</option>
          <option value="cancelled">Cancelled</option>
        </FilterSelect>
      </FilterBar>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px", background: "#f8fafc" }}>
        {error && <div style={{ marginBottom: "12px" }}><ErrorBanner message={error} onRetry={load} /></div>}
        {loading ? <AdminTableSkeleton rows={8} cols={7} /> : filtered.length === 0 ? (
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px" }}>
            <EmptyState icon={Building2} title="No organizations found" description={search || filterPlan !== "all" || filterStatus !== "all" ? "Try adjusting your filters." : "No organizations yet."} />
          </div>
        ) : (
          <>
            <AdminTable>
              <THead><tr><Th>Organization</Th><Th>Plan</Th><Th>Status</Th><Th>Expiry</Th><Th>Payment</Th><Th>Branches</Th><Th>Users</Th><Th></Th></tr></THead>
              <TBody>
                {filtered.map((org) => (
                  <Tr key={org.organization.id}>
                    <Td>
                      <Link href={`/organizations/${org.organization.id}`} style={{ color: "#2563eb", textDecoration: "none", fontWeight: 500 }}>{org.organization.name}</Link>
                      <div style={{ fontSize: "11px", color: "#94a3b8", fontFamily: "monospace" }}>{org.organization.id}</div>
                    </Td>
                    <Td><PlanBadge planCode={org.subscription.planCode} /></Td>
                    <Td><SubscriptionStatusBadge status={org.subscription.status} /></Td>
                    <Td muted nowrap><div>{formatDate(org.subscription.expiresAt)}</div><div style={{ fontSize: "11px", color: "#94a3b8" }}>{daysRemainingLabel(org.subscription.daysRemaining)}</div></Td>
                    <Td><PaymentStatusBadge status={org.subscription.paymentStatus} /></Td>
                    <Td muted>{org.usage.branchesUsed} / {org.subscription.effectiveMaxBranches ?? "∞"}</Td>
                    <Td muted>{org.usage.usersUsed} / {org.subscription.limits.maxStaff ?? "∞"}</Td>
                    <Td><Link href={`/organizations/${org.organization.id}`} style={{ fontSize: "12px", fontWeight: 500, color: "#2563eb", textDecoration: "none", padding: "4px 10px", border: "1px solid #bfdbfe", borderRadius: "5px", background: "#eff6ff" }}>Manage</Link></Td>
                  </Tr>
                ))}
              </TBody>
            </AdminTable>
            <TableFooter showing={filtered.length} total={orgs.length} label="organizations" />
          </>
        )}
      </div>
    </div>
  );
}