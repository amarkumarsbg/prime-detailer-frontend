"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiGet } from "@/lib/api-client";
import type { SubscriptionBillRow } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

function openSubscriptionBillPrint(bill: SubscriptionBillRow & { organizationName?: string }) {
  const orgName = bill.organizationName ?? "Business";
  const html = `<!DOCTYPE html><html><head><title>${bill.billNumber}</title>
<style>
  body{font-family:system-ui,sans-serif;padding:32px;color:#0f172a}
  h1{font-size:20px;margin:0 0 8px}
  .muted{color:#64748b;font-size:13px}
  table{width:100%;border-collapse:collapse;margin-top:24px}
  td{padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:14px}
  td:first-child{color:#64748b;width:40%}
  .foot{margin-top:28px;font-size:12px;color:#64748b}
</style></head><body>
  <h1>Subscription bill</h1>
  <p class="muted">${bill.billNumber} · ${orgName}</p>
  <table>
    <tr><td>Plan</td><td>${bill.planName}</td></tr>
    <tr><td>Term of usage</td><td>${bill.termLabel} (${bill.termMonths} months)</td></tr>
    <tr><td>Period start</td><td>${formatDate(bill.periodStart)}</td></tr>
    <tr><td>Expiry / period end</td><td><strong>${formatDate(bill.periodEnd)}</strong></td></tr>
    <tr><td>Amount</td><td>${bill.amount != null ? formatCurrency(bill.amount) : "—"} ${bill.currency}</td></tr>
    <tr><td>Issued</td><td>${formatDate(bill.createdAt)}</td></tr>
  </table>
  <p class="foot">This receipt covers SaaS subscription access for the term above. Business data is retained after expiry; exports may be locked until renewal.</p>
  <script>window.onload=function(){window.print();}</script>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) {
    toast.error("Allow pop-ups to download the bill");
    return;
  }
  w.document.write(html);
  w.document.close();
}

export function SubscriptionBillsSection() {
  const [bills, setBills] = useState<SubscriptionBillRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiGet<{ bills: SubscriptionBillRow[] }>(
          "/api/organization/subscription/bills"
        );
        if (!cancelled) setBills(data.bills ?? []);
      } catch {
        if (!cancelled) setBills([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading subscription bills…</p>;
  }

  if (bills.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No subscription bills yet. Bills appear here after a paid renewal.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Subscription bills</p>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2">Bill #</th>
              <th className="px-3 py-2">Term</th>
              <th className="px-3 py-2">Expires</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {bills.map((b) => (
              <tr key={b.id} className="border-b last:border-0">
                <td className="px-3 py-2 font-medium">{b.billNumber}</td>
                <td className="px-3 py-2">{b.termLabel}</td>
                <td className="px-3 py-2">{formatDate(b.periodEnd)}</td>
                <td className="px-3 py-2 text-right">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void (async () => {
                        try {
                          const full = await apiGet<SubscriptionBillRow>(
                            `/api/organization/subscription/bills/${encodeURIComponent(b.id)}`
                          );
                          openSubscriptionBillPrint(full);
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Could not open bill");
                        }
                      })();
                    }}
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Download
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
