"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { apiGet, apiPatch } from "@/lib/api-client";
import type { OrganizationEntitlement, PlanCode } from "@/types";
import { branchLimitLabel } from "@/lib/plan-limits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PLAN_OPTIONS: PlanCode[] = ["STARTER", "GROWTH", "BUSINESS", "ENTERPRISE", "CUSTOM"];

export default function SaasAdminOrganizationDetailPage() {
  const params = useParams();
  const orgId = typeof params.orgId === "string" ? params.orgId : "";
  const [row, setRow] = useState<OrganizationEntitlement | null>(null);
  const [overrideInput, setOverrideInput] = useState("");
  const [planCode, setPlanCode] = useState<PlanCode>("STARTER");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const data = await apiGet<OrganizationEntitlement>(
      `/api/platform/organizations/${encodeURIComponent(orgId)}`
    );
    setRow(data);
    setPlanCode(data.subscription.planCode);
    setOverrideInput(
      data.subscription.maxBranchesOverride === null
        ? ""
        : String(data.subscription.maxBranchesOverride)
    );
  };

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    void (async () => {
      try {
        await load();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const save = async () => {
    if (!orgId) return;
    setSaving(true);
    try {
      const trimmed = overrideInput.trim();
      const maxBranchesOverride =
        trimmed === "" ? null : Number.parseInt(trimmed, 10);
      if (trimmed !== "" && (!Number.isFinite(maxBranchesOverride) || maxBranchesOverride! < 0)) {
        toast.error("Override must be a non-negative integer or empty");
        return;
      }
      const data = await apiPatch<OrganizationEntitlement>(
        `/api/platform/organizations/${encodeURIComponent(orgId)}/subscription`,
        {
          planCode,
          maxBranchesOverride,
        }
      );
      setRow(data);
      setOverrideInput(
        data.subscription.maxBranchesOverride === null
          ? ""
          : String(data.subscription.maxBranchesOverride)
      );
      toast.success("Subscription updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!row) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/saas-admin/organizations"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Organizations
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{row.organization.name}</h1>
        <p className="font-mono text-xs text-muted-foreground">{row.organization.id}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Branch entitlement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Current usage: {row.usage.branchesUsed} /{" "}
            {branchLimitLabel(row.subscription.effectiveMaxBranches)} (plan{" "}
            {row.subscription.planName})
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="planCode">Plan</Label>
              <Select value={planCode} onValueChange={(v) => setPlanCode(v as PlanCode)}>
                <SelectTrigger id="planCode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxOverride">maxBranchesOverride</Label>
              <Input
                id="maxOverride"
                inputMode="numeric"
                placeholder="Empty = use plan default"
                value={overrideInput}
                onChange={(e) => setOverrideInput(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Wins over plan template limits. Leave empty to clear the override.
              </p>
            </div>
          </div>

          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
