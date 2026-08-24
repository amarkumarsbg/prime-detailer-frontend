"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api-client";
import { useOrganizationStore } from "@/store/organization-store";
import { formatCurrency, formatDate } from "@/lib/utils";
import { formatPaymentStatus } from "@/lib/subscription-export-lock";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calculator,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  History,
} from "lucide-react";
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

function paymentStatusIcon(status: string | null | undefined) {
  switch (status) {
    case "PAID": return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
    case "PENDING": return <Clock className="h-3.5 w-3.5 text-amber-500" />;
    case "PROCESSING": return <RefreshCw className="h-3.5 w-3.5 text-blue-500" />;
    case "FAILED": return <XCircle className="h-3.5 w-3.5 text-destructive" />;
    default: return <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function paymentStatusBadgeVariant(status: string | null | undefined): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "PAID": return "default";
    case "PENDING": return "secondary";
    case "PROCESSING": return "secondary";
    case "FAILED": return "destructive";
    default: return "outline";
  }
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
        notes: "Renewal requested from settings — Plan & Billing",
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

  const currentPaymentStatus = entitlement.subscription.paymentStatus;
  const hasPendingPayment = currentPaymentStatus === "PENDING" || currentPaymentStatus === "PROCESSING";

  return (
    <div className="space-y-6">
      {/* Renewal / Upgrade Configurator */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Calculator className="h-4 w-4 text-primary" />
          Renew / Upgrade Plan
        </h3>

        {hasPendingPayment && (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900/40 dark:bg-amber-950/30">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-medium text-amber-900 dark:text-amber-100">Payment verification in progress</p>
              <p className="mt-0.5 text-amber-700 dark:text-amber-300">
                Your payment request is {currentPaymentStatus === "PROCESSING" ? "being processed" : "pending verification"}.
                Your subscription and exports will be restored once payment is confirmed.
              </p>
            </div>
          </div>
        )}

        <div className="rounded-lg border bg-card p-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Validity</Label>
              <Select value={String(termMonths)} onValueChange={(v) => { setTermMonths(Number.parseInt(v, 10)); setQuote(null); }}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TERM_OPTIONS.map((t) => (
                    <SelectItem key={t} value={String(t)}>
                      {t === 12 ? "1 year" : t === 24 ? "2 years" : t === 36 ? "3 years" : "5 years"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Extra branches</Label>
              <Input
                type="number"
                min={0}
                className="h-9"
                value={extraBranchesInput}
                onChange={(e) => { setExtraBranchesInput(e.target.value); setQuote(null); }}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Extra users</Label>
              <Input
                type="number"
                min={0}
                className="h-9"
                value={extraUsersInput}
                onChange={(e) => { setExtraUsersInput(e.target.value); setQuote(null); }}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Referral code</Label>
              <Input
                className="h-9"
                value={referralCode}
                onChange={(e) => { setReferralCode(e.target.value); setQuote(null); }}
                placeholder="Optional"
              />
            </div>
          </div>

          {/* Pricing Summary */}
          {quote && (
            <div className="rounded-md border bg-muted/30 p-3.5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Pricing Summary — {quote.planName} · {quote.termLabel}
              </p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Base subscription</span>
                  <span className="font-medium">{formatCurrency(quote.baseAmount)}</span>
                </div>
                {quote.extraBranchCost > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Extra branches ({quote.extraBranches})</span>
                    <span className="font-medium">+ {formatCurrency(quote.extraBranchCost)}</span>
                  </div>
                )}
                {quote.extraUserCost > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Extra users ({quote.extraUsers})</span>
                    <span className="font-medium">+ {formatCurrency(quote.extraUserCost)}</span>
                  </div>
                )}
                {quote.onboardingApplied && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Onboarding fee (one-time)</span>
                    <span className="font-medium">+ {formatCurrency(quote.onboardingFee)}</span>
                  </div>
                )}
                {quote.referralApplied && (
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                    <span>Referral discount ({quote.referralCode})</span>
                    <span className="font-medium">− {formatCurrency(quote.referralDiscount)}</span>
                  </div>
                )}
                {quote.referralValidationMessage && !quote.referralApplied && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">{quote.referralValidationMessage}</p>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>GST ({quote.gstPercent}%)</span>
                  <span className="font-medium">+ {formatCurrency(quote.gstAmount)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-base font-bold">
                  <span>Total amount</span>
                  <span>{formatCurrency(quote.finalAmount)} {quote.currency}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                After renewal: branches {quote.finalAllowedBranches ?? "unlimited"}, users {quote.finalAllowedUsers ?? "unlimited"}
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void fetchQuote()}
              disabled={quoteLoading}
            >
              <Calculator className="mr-1.5 h-3.5 w-3.5" />
              {quoteLoading ? "Calculating…" : "Calculate pricing"}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void submitRenewal()}
              disabled={renewLoading || quoteLoading}
            >
              {renewLoading ? "Submitting…" : "Request payment"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Submitting creates a pending payment request. Your team will be notified to verify and confirm. 
            Exports unlock automatically once payment is marked paid.
          </p>
        </div>
      </div>

      {/* Renewal History */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <History className="h-4 w-4 text-primary" />
          Renewal History
        </h3>
        {historyLoading ? (
          <p className="text-sm text-muted-foreground">Loading renewal history…</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No renewal history yet. History appears after paid renewals.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2.5">Bill #</th>
                  <th className="px-3 py-2.5">Renewal date</th>
                  <th className="px-3 py-2.5">Term</th>
                  <th className="px-3 py-2.5">Old expiry</th>
                  <th className="px-3 py-2.5">New expiry</th>
                  <th className="px-3 py-2.5 text-right">Amount</th>
                  <th className="px-3 py-2.5 text-right">GST</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Txn ref</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.billId} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2.5 font-mono text-xs font-medium">{row.billNumber}</td>
                    <td className="px-3 py-2.5">{formatDate(row.renewalDate)}</td>
                    <td className="px-3 py-2.5">{row.termLabel}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{formatDate(row.previousExpiry)}</td>
                    <td className="px-3 py-2.5 font-medium">{formatDate(row.newExpiry)}</td>
                    <td className="px-3 py-2.5 text-right font-medium">{formatCurrency(row.amount)}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">{formatCurrency(row.gstAmount)}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant={paymentStatusBadgeVariant(row.paymentStatus)} className="flex w-fit items-center gap-1 text-xs">
                        {paymentStatusIcon(row.paymentStatus)}
                        {formatPaymentStatus(row.paymentStatus)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{row.txnReference ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

