"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/topbar";
import { ErrorBanner } from "@/components/shared/error-banner";
import { RefreshingBar } from "@/components/shared/loading";
import { AdminTableSkeleton } from "@/components/shared/admin-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SubscriptionStatusBadge, PaymentStatusBadge, PlanBadge, GraceStatusBadge } from "@/components/shared/status-badges";
import { getOrganization, patchOrganizationSubscription, verifyPayment, markPaid } from "@/api/organizations";
import { formatCurrency, formatDate, formatDateTime, daysRemainingLabel, termLabel } from "@/lib/utils";
import type { OrgDetail, PlanCode, SubscriptionPaymentRow, SubscriptionBillRow } from "@/types";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</dt>
      <dd className="text-sm text-slate-900">{value ?? "—"}</dd>
    </div>
  );
}

export default function OrgDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Patch subscription state
  const [patching, setPatching] = useState(false);
  const [patchStatus, setPatchStatus] = useState<string>("");
  const [patchPlan, setPatchPlan] = useState<PlanCode>("STARTER");
  const [patchNotes, setPatchNotes] = useState("");

  // Mark paid state
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [markPaidAmount, setMarkPaidAmount] = useState("");
  const [markPaidTxn, setMarkPaidTxn] = useState("");
  const [markPaidNotes, setMarkPaidNotes] = useState("");
  const [markPaidLoading, setMarkPaidLoading] = useState(false);

  async function load(silent = false) {
    if (!silent) setLoading(true); else setRefreshing(true);
    setError(null);
    try {
      const data = await getOrganization(id);
      setOrg(data);
      setPatchStatus(data.subscription.status);
      setPatchPlan(data.subscription.planCode);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load organization");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handlePatchSubscription() {
    if (!org) return;
    setPatching(true);
    try {
      const updated = await patchOrganizationSubscription(org.organization.id, {
        status: patchStatus as OrgDetail["subscription"]["status"],
        planCode: patchPlan,
        notes: patchNotes || undefined,
      });
      setOrg(updated);
      toast.success("Subscription updated successfully.");
      setMarkPaidOpen(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setPatching(false);
    }
  }

  async function handleMarkPaid() {
    if (!org) return;
    setMarkPaidLoading(true);
    try {
      await markPaid(org.organization.id, {
        amount: markPaidAmount ? Number(markPaidAmount) : undefined,
        txnReference: markPaidTxn || null,
        notes: markPaidNotes || null,
      });
      toast.success("Subscription marked as paid and activated.");
      setMarkPaidOpen(false);
      setMarkPaidAmount("");
      setMarkPaidTxn("");
      setMarkPaidNotes("");
      await load(true);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to mark as paid.");
    } finally {
      setMarkPaidLoading(false);
    }
  }

  async function handleVerifyPayment(payment: SubscriptionPaymentRow, outcome: "PAID" | "FAILED") {
    if (!org) return;
    try {
      await verifyPayment(org.organization.id, {
        paymentId: payment.id,
        outcome,
        txnReference: payment.txnReference,
      });
      toast.success(`Payment marked as ${outcome}.`);
      await load(true);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Verification failed.");
    }
  }

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar />
      <div style={{ padding: "16px 24px", background: "#f8fafc", flex: 1 }}><AdminTableSkeleton rows={6} cols={4} /></div>
    </div>
  );
  if (error || !org) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Topbar />
        <div style={{ padding: "20px 24px" }}><ErrorBanner message={error ?? "Organization not found."} onRetry={() => load()} /></div>
      </div>
    );
  }

  const sub = org.subscription;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <RefreshingBar show={refreshing} />
      <Topbar
        title={org.organization.name}
        description={`ID: ${org.organization.id}`}
        actions={
          <div style={{ display: "flex", gap: "6px" }}>
            <Button variant="outline" size="sm" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /> Back</Button>
            <Button variant="outline" size="sm" onClick={() => load(true)}><RefreshCw className="h-4 w-4" /> Refresh</Button>
            <Button size="sm" onClick={() => setMarkPaidOpen(true)}>Mark Paid</Button>
          </div>
        }
      />
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", background: "#f8fafc" }} className="space-y-5">

        {/* Header overview */}
        <div className="flex flex-wrap gap-3 items-center">
          <PlanBadge planCode={sub.planCode} />
          <SubscriptionStatusBadge status={sub.status} />
          <PaymentStatusBadge status={sub.paymentStatus} />
          <GraceStatusBadge status={sub.graceOrLock} />
          {sub.exportLocked && <Badge variant="destructive">Export Locked</Badge>}
        </div>

        {/* Subscription section */}
        <Section title="Subscription">
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-5">
            <Field label="Plan" value={sub.planName} />
            <Field label="Term" value={termLabel(sub.termMonths)} />
            <Field label="Start Date" value={formatDate(sub.startsAt)} />
            <Field label="Expiry Date" value={formatDate(sub.expiresAt)} />
            <Field label="Days Remaining" value={daysRemainingLabel(sub.daysRemaining)} />
            <Field label="Branches" value={`${org.usage.branchesUsed} / ${sub.effectiveMaxBranches ?? "∞"}`} />
            <Field label="Users" value={`${org.usage.usersUsed} / ${sub.limits.maxStaff ?? "∞"}`} />
            <Field label="Payment Status" value={<PaymentStatusBadge status={sub.paymentStatus} />} />
          </dl>
        </Section>

        {/* Patch subscription */}
        <Section title="Manage Subscription">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Plan</label>
              <select
                className="w-full h-9 px-3 rounded-md border border-[var(--border)] text-sm bg-white"
                value={patchPlan}
                onChange={(e) => setPatchPlan(e.target.value as PlanCode)}
              >
                {(["STARTER","GROWTH","BUSINESS","ENTERPRISE","CUSTOM"] as PlanCode[]).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Status</label>
              <select
                className="w-full h-9 px-3 rounded-md border border-[var(--border)] text-sm bg-white"
                value={patchStatus}
                onChange={(e) => setPatchStatus(e.target.value)}
              >
                {["ACTIVE","PAST_DUE","EXPIRED","CANCELLED"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Notes (optional)</label>
              <Input
                placeholder="Internal note…"
                value={patchNotes}
                onChange={(e) => setPatchNotes(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4">
            <Button onClick={handlePatchSubscription} disabled={patching}>
              {patching && <Loader2 className="h-4 w-4 animate-spin" />}
              {patching ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </Section>

        {/* Payments */}
        <Section title={`Payments (${org.payments.length})`}>
          {org.payments.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No payments recorded.</p>
          ) : (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-y border-[var(--border)]">
                  <tr>
                    <th className="text-left px-5 py-2.5 font-semibold text-slate-500">ID</th>
                    <th className="text-left px-5 py-2.5 font-semibold text-slate-500">Amount</th>
                    <th className="text-left px-5 py-2.5 font-semibold text-slate-500">Method</th>
                    <th className="text-left px-5 py-2.5 font-semibold text-slate-500">Status</th>
                    <th className="text-left px-5 py-2.5 font-semibold text-slate-500">Txn Ref</th>
                    <th className="text-left px-5 py-2.5 font-semibold text-slate-500">Created</th>
                    <th className="text-left px-5 py-2.5 font-semibold text-slate-500">Verified</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {org.payments.map((p: SubscriptionPaymentRow) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-mono text-xs text-slate-500 max-w-[100px] truncate">{p.id}</td>
                      <td className="px-5 py-3">{p.amount != null ? formatCurrency(p.amount, p.currency) : "—"}</td>
                      <td className="px-5 py-3 text-slate-600">{p.method ?? "—"}</td>
                      <td className="px-5 py-3"><PaymentStatusBadge status={p.status} /></td>
                      <td className="px-5 py-3 text-slate-600 text-xs font-mono">{p.txnReference ?? "—"}</td>
                      <td className="px-5 py-3 text-slate-500 text-xs">{formatDateTime(p.createdAt)}</td>
                      <td className="px-5 py-3 text-slate-500 text-xs">{p.verifiedAt ? formatDateTime(p.verifiedAt) : "—"}</td>
                      <td className="px-5 py-3">
                        {(p.status === "PENDING" || p.status === "PROCESSING") && (
                          <div className="flex gap-1.5">
                            <Button size="sm" variant="outline" onClick={() => handleVerifyPayment(p, "PAID")} className="text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Paid
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleVerifyPayment(p, "FAILED")} className="text-red-600 border-red-200 hover:bg-red-50">
                              <XCircle className="h-3.5 w-3.5" />
                              Failed
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Bills */}
        <Section title={`Bills (${org.bills.length})`}>
          {org.bills.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No bills generated.</p>
          ) : (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-y border-[var(--border)]">
                  <tr>
                    <th className="text-left px-5 py-2.5 font-semibold text-slate-500">Bill #</th>
                    <th className="text-left px-5 py-2.5 font-semibold text-slate-500">Plan</th>
                    <th className="text-left px-5 py-2.5 font-semibold text-slate-500">Term</th>
                    <th className="text-left px-5 py-2.5 font-semibold text-slate-500">Period</th>
                    <th className="text-right px-5 py-2.5 font-semibold text-slate-500">Base</th>
                    <th className="text-right px-5 py-2.5 font-semibold text-slate-500">GST</th>
                    <th className="text-right px-5 py-2.5 font-semibold text-slate-500">Total</th>
                    <th className="text-left px-5 py-2.5 font-semibold text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {org.bills.map((b: SubscriptionBillRow) => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-700">{b.billNumber}</td>
                      <td className="px-5 py-3 text-slate-600">{b.planName}</td>
                      <td className="px-5 py-3 text-slate-600">{b.termLabel}</td>
                      <td className="px-5 py-3 text-slate-500 text-xs">{formatDate(b.periodStart)} – {formatDate(b.periodEnd)}</td>
                      <td className="px-5 py-3 text-right">{formatCurrency(b.baseAmount, b.currency)}</td>
                      <td className="px-5 py-3 text-right text-slate-500">{formatCurrency(b.gstAmount, b.currency)}</td>
                      <td className="px-5 py-3 text-right font-semibold">{formatCurrency(b.totalAmount, b.currency)}</td>
                      <td className="px-5 py-3"><PaymentStatusBadge status={b.paymentStatus} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>

      {/* Mark Paid Modal */}
      {markPaidOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md space-y-4 p-6">
            <h2 className="text-lg font-semibold text-slate-900">Mark Subscription Paid</h2>
            <p className="text-sm text-slate-500">
              This will immediately activate the subscription for <strong>{org.organization.name}</strong>.
              A renewal record and bill will be generated.
            </p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">Amount Received (optional)</label>
                <Input type="number" placeholder="e.g. 9999" value={markPaidAmount} onChange={(e) => setMarkPaidAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">Transaction Reference</label>
                <Input placeholder="e.g. UTR123456789" value={markPaidTxn} onChange={(e) => setMarkPaidTxn(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">Admin Notes</label>
                <Input placeholder="e.g. Cash payment received" value={markPaidNotes} onChange={(e) => setMarkPaidNotes(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setMarkPaidOpen(false)} disabled={markPaidLoading}>Cancel</Button>
              <Button onClick={handleMarkPaid} disabled={markPaidLoading}>
                {markPaidLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {markPaidLoading ? "Processing…" : "Confirm Mark Paid"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
