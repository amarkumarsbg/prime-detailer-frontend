"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, CheckCircle2, AlertTriangle, XCircle, CreditCard } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { StatCard } from "@/components/shared/stat-card";
import { ErrorBanner } from "@/components/shared/error-banner";
import { RefreshingBar } from "@/components/shared/loading";
import { EmptyState } from "@/components/shared/empty-state";
import { AdminTable, THead, Th, TBody, Tr, Td, TableFooter, AdminTableSkeleton } from "@/components/shared/admin-table";
import { SubscriptionStatusBadge, PaymentStatusBadge, PlanBadge } from "@/components/shared/status-badges";
import { listOrganizations } from "@/api/organizations";
import { formatDate, daysRemainingLabel } from "@/lib/utils";
import type { OrgListItem } from "@/types";

interface Stats { total: number; active: number; expiringSoon: number; expired: number; pendingPayments: number; }

function computeStats(orgs: OrgListItem[]): Stats {
  const now = Date.now();
  let active = 0, expiringSoon = 0, expired = 0, pendingPayments = 0;
  for (const org of orgs) {
    const sub = org.subscription;
    if (sub.status === "ACTIVE") active++;
    const exp = sub.expiresAt ? new Date(sub.expiresAt).getTime() : null;
    if (exp && exp - now > 0 && exp - now < 30 * 86400000) expiringSoon++;
    if (sub.status === "EXPIRED") expired++;
    if (sub.paymentStatus === "PENDING" || sub.paymentStatus === "PROCESSING") pendingPayments++;
  }
  return { total: orgs.length, active, expiringSoon, expired, pendingPayments };
}

export default function DashboardPage() {
  const [orgs, setOrgs] = useState<OrgListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  async function load(silent = false) {
    if (!silent) setLoading(true); else setRefreshing(true);
    setError(null);
    try { setOrgs(await listOrganizations()); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); setRefreshing(false); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);
  const stats = computeStats(orgs);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <RefreshingBar show={refreshing} />
      <Topbar title="Dashboard" description="Platform overview" />
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", background: "#f8fafc" }}>
        {error && <div style={{ marginBottom: "16px" }}><ErrorBanner message={error} onRetry={load} /></div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px", marginBottom: "20px" }}>
          <StatCard label="Total Orgs" value={loading ? "—" : stats.total} icon={Building2} iconBg="#eff6ff" iconColor="#2563eb" loading={loading} />
          <StatCard label="Active" value={loading ? "—" : stats.active} sub="subscriptions" icon={CheckCircle2} iconBg="#f0fdf4" iconColor="#16a34a" loading={loading} />
          <StatCard label="Expiring Soon" value={loading ? "—" : stats.expiringSoon} sub="within 30 days" icon={AlertTriangle} iconBg="#fffbeb" iconColor="#d97706" loading={loading} />
          <StatCard label="Expired" value={loading ? "—" : stats.expired} sub="need renewal" icon={XCircle} iconBg="#fef2f2" iconColor="#dc2626" loading={loading} />
          <StatCard label="Pending Payment" value={loading ? "—" : stats.pendingPayments} sub="awaiting" icon={CreditCard} iconBg="#fff7ed" iconColor="#ea580c" loading={loading} />
        </div>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px 10px", borderBottom: "1px solid #f1f5f9" }}>
            <p style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a", margin: 0 }}>Recent Organizations</p>
            <Link href="/organizations" style={{ fontSize: "12px", color: "#2563eb", textDecoration: "none", fontWeight: 500 }}>View all →</Link>
          </div>
          {loading ? <AdminTableSkeleton rows={5} cols={6} /> : orgs.length === 0 ? (
            <EmptyState icon={Building2} title="No organizations yet" />
          ) : (
            <AdminTable>
              <THead><tr><Th>Organization</Th><Th>Plan</Th><Th>Status</Th><Th>Expiry</Th><Th>Payment</Th><Th>Usage</Th></tr></THead>
              <TBody>
                {orgs.slice(0, 8).map((org) => (
                  <Tr key={org.organization.id}>
                    <Td><Link href={`/organizations/${org.organization.id}`} style={{ color: "#2563eb", textDecoration: "none", fontWeight: 500 }}>{org.organization.name}</Link></Td>
                    <Td><PlanBadge planCode={org.subscription.planCode} /></Td>
                    <Td><SubscriptionStatusBadge status={org.subscription.status} /></Td>
                    <Td muted nowrap><div>{formatDate(org.subscription.expiresAt)}</div><div style={{ fontSize: "11px", color: "#94a3b8" }}>{daysRemainingLabel(org.subscription.daysRemaining)}</div></Td>
                    <Td><PaymentStatusBadge status={org.subscription.paymentStatus} /></Td>
                    <Td muted>{org.usage.branchesUsed}/{org.subscription.effectiveMaxBranches ?? "∞"} br · {org.usage.usersUsed}/{org.subscription.limits.maxStaff ?? "∞"} users</Td>
                  </Tr>
                ))}
              </TBody>
            </AdminTable>
          )}
          {!loading && orgs.length > 0 && <TableFooter showing={Math.min(orgs.length, 8)} total={orgs.length} label="organizations" />}
        </div>
      </div>
    </div>
  );
}