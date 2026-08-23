"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api-client";
import { useOrganizationStore } from "@/store/organization-store";
import { formatDate } from "@/lib/utils";
import { formatPaymentStatus } from "@/lib/subscription-export-lock";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  OrganizationEntitlement,
  SubscriptionPricingBreakdown,
  SubscriptionRenewalHistoryRow,
} from "@/types";

type RenewResult = {
  entitlement: OrganizationEntitlement;
  payment: { id: string; status: string };
};

type QuoteResponse = {
  breakdown: SubscriptionPricingBreakdown;
};

const TERM_OPTIONS = [12, 24, 36, 60] as const;

function parseCount(value: string): number {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function money(amount: number): string {
  return amount.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export function SubscriptionRenewalWorkbench({
  entitlement,
  onEntitlementUpdated,
}: {
  entitlement: OrganizationEntitlement;
  onEntitlementUpdated?: () => Promise<void> | void;
}) {
  const setEntitlement = useOrganizationStore((s) => s.setEntitlement);
  const initialTerm = entitlement.subscription.termMonths ?? 12;

  const [termMonths, setTermMonths] = useState<number>(initialTerm);
  const [extraBranchesInput, setExtraBranchesInput] = useState("0");
  const [extraUsersInput, setExtraUsersInput] = useState("0");
  const [referralCode, setReferralCode] = useState("");
  const [quote, setQuote] = useState<SubscriptionPricingBreakdown | null>(null);
  const [history, setHistory] = useState<SubscriptionRenewalHistoryRow[]>([]);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [renewLoading, setRenewLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const extraBranches = useMemo(() => parseCount(extraBranchesInput), [extraBranchesInput]);
  const extraUsers = useMemo(() => parseCount(extraUsersInput), [extraUsersInput]);
  const normalizedReferral = useMemo(() => {
    const trimmed = referralCode.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, [referralCode]);

  useEffect(() => {
    setTermMonths(entitlement.subscription.termMonths ?? 12);
  }, [entitlement.subscription.termMonths]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await apiGet<{ renewals: SubscriptionRenewalHistoryRow[] }>(
        "/api/organization/subscription/renewals"
      );
      setHistory(data.renewals);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load renewal history");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    void loadHistory();
  }, []);

  const fetchQuote = async () => {
    setQuoteLoading(true);
    try {
      const data = await apiPost<QuoteResponse>("/api/organization/subscription/pricing", {
        termMonths,
        extraBranches,
        extraUsers,
        referralCode: normalizedReferral,
      });
      setQuote(data.breakdown);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not calculate pricing");
    } finally {
      setQuoteLoading(false);
    }
  };

  const submitRenewal = async () => {
    setRenewLoading(true);
    try {
      const data = await apiPost<RenewResult>("/api/organization/subscription/renew", {
        method: "MANUAL",
        notes: "Renewal requested from settings plan and billing",
        termMonths,
        extraBranches,
        extraUsers,
        referralCode: normalizedReferral,
      });
      setEntitlement(data.entitlement);
      toast.success("Renewal request submitted", {
        description: "Payment status is Pending. We will verify payment and unlock exports.",
      });
      await Promise.resolve(onEntitlementUpdated?.());
      await loadHistory();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit renewal request");
    } finally {
      setRenewLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Renewal quote</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Validity</Label>
              <Select value={String(termMonths)} onValueChange={(v) => setTermMonths(Number.parseInt(v, 10))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TERM_OPTIONS.map((t) => (
                    <SelectItem key={t} value={String(t)}>
                      {t / 12} {t === 12 ? "year" : "years"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Extra branches</Label>
              <Input
                type="number"
                min={0}
                value={extraBranchesInput}
                onChange={(e) => setExtraBranchesInput(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Extra users</Label>
              <Input
                type="number"
                min={0}
                value={extraUsersInput}
                onChange={(e) => setExtraUsersInput(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Referral code</Label>
              <Input
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void fetchQuote()} disabled={quoteLoading}>
              {quoteLoading ? "Calculating..." : "Calculate pricing"}
            </Button>
            <Button
              type="button"
              onClick={() => void submitRenewal()}
              disabled={renewLoading || quoteLoading}
            >
              {renewLoading ? "Submitting..." : "Request payment"}
            </Button>
          </div>

          {quote ? (
            <div className="rounded-md border bg-muted/20 p-3 text-sm">
              <p className="font-medium">Pricing summary ({quote.planName}, {quote.termLabel})</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <p>Base subscription: <span className="font-medium">Rs {money(quote.baseAmount)}</span></p>
                <p>Extra branch cost: <span className="font-medium">Rs {money(quote.extraBranchCost)}</span></p>
                <p>Extra user cost: <span className="font-medium">Rs {money(quote.extraUserCost)}</span></p>
                <p>Onboarding fee: <span className="font-medium">Rs {money(quote.onboardingFee)}</span></p>
                <p>Referral discount: <span className="font-medium">- Rs {money(quote.referralDiscount)}</span></p>
                <p>GST ({quote.gstPercent}%): <span className="font-medium">Rs {money(quote.gstAmount)}</span></p>
              </div>
              <p className="mt-2 text-base font-semibold">Final amount: Rs {money(quote.finalAmount)} {quote.currency}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Final allowance after renewal: branches {quote.finalAllowedBranches ?? "unlimited"}, users {quote.finalAllowedUsers ?? "unlimited"}
              </p>
              {quote.referralValidationMessage ? (
                <p className="mt-2 text-xs text-muted-foreground">{quote.referralValidationMessage}</p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Renewal history</CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <p className="text-sm text-muted-foreground">Loading renewal history...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No renewal history yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-225 text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2">Bill #</th>
                    <th className="px-3 py-2">Renewal date</th>
                    <th className="px-3 py-2">Term</th>
                    <th className="px-3 py-2">Previous expiry</th>
                    <th className="px-3 py-2">New expiry</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2 text-right">GST</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Txn Ref</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.billId} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium">{row.billNumber}</td>
                      <td className="px-3 py-2">{formatDate(row.renewalDate)}</td>
                      <td className="px-3 py-2">{row.termLabel}</td>
                      <td className="px-3 py-2">{formatDate(row.previousExpiry)}</td>
                      <td className="px-3 py-2">{formatDate(row.newExpiry)}</td>
                      <td className="px-3 py-2 text-right">{money(row.amount)}</td>
                      <td className="px-3 py-2 text-right">{money(row.gstAmount)}</td>
                      <td className="px-3 py-2">{formatPaymentStatus(row.paymentStatus)}</td>
                      <td className="px-3 py-2 font-mono text-xs">{row.txnReference ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
