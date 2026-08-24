"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api-client";
import type { OrganizationEntitlement } from "@/types";
import { branchLimitLabel } from "@/lib/plan-limits";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function SaasAdminOrganizationsPage() {
  const [rows, setRows] = useState<OrganizationEntitlement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiGet<{ organizations: OrganizationEntitlement[] }>(
          "/api/platform/organizations"
        );
        if (!cancelled) setRows(data.organizations);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load organizations");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <p className="text-sm text-muted-foreground">Loading organizations…</p>;
  if (error) return <p className="text-sm text-destructive">{error}</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
        <p className="text-sm text-muted-foreground">
          Adjust branch limits without signing into a customer account.
        </p>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Studio</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Branches</th>
              <th className="px-4 py-3 font-medium">Override</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.organization.id} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">{row.organization.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{row.organization.id}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span>{row.subscription.planName}</span>
                    <Badge variant="secondary">{row.subscription.status}</Badge>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {row.usage.branchesUsed} / {branchLimitLabel(row.subscription.effectiveMaxBranches)}
                </td>
                <td className="px-4 py-3">
                  {row.subscription.maxBranchesOverride === null
                    ? "—"
                    : row.subscription.maxBranchesOverride}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/saas-admin/organizations/${row.organization.id}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No organizations found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
