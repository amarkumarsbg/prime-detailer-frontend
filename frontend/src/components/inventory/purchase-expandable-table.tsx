"use client";

import { useState, Fragment } from "react";
import { ChevronDown, ChevronUp, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  derivePaymentStatus,
  purchaseAmountPaid,
  purchaseDue,
  purchaseGrandTotal,
} from "@/lib/inventory/purchase-math";
import { paymentStatusClass, paymentStatusLabel } from "@/lib/inventory/movement-labels";
import type { ProductPurchase } from "@/types";

function purchaseLines(p: ProductPurchase): { name: string; qty: number; total: number }[] {
  if (p.items && p.items.length > 0) {
    return p.items.map((line) => ({
      name: line.partName,
      qty: line.quantity,
      total: line.lineTotal,
    }));
  }
  if (p.quantityMl > 0) {
    return [
      {
        name: "Fluid purchase",
        qty: p.quantityMl,
        total: purchaseGrandTotal(p),
      },
    ];
  }
  return [];
}

export function PurchaseExpandableTable({
  purchases,
  onPay,
}: {
  purchases: ProductPurchase[];
  onPay?: (purchase: ProductPurchase) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (purchases.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No purchases yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="w-8 px-2 py-2.5" />
            <th className="px-3 py-2.5">Purchase #</th>
            <th className="px-3 py-2.5">Date</th>
            <th className="px-3 py-2.5 text-right">Total</th>
            <th className="px-3 py-2.5 text-right">Paid</th>
            <th className="px-3 py-2.5 text-right">Due</th>
            <th className="px-3 py-2.5">Pay status</th>
            <th className="px-3 py-2.5 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {purchases.map((p) => {
            const expanded = openId === p.id;
            const st = derivePaymentStatus(p);
            const due = purchaseDue(p);
            const lines = purchaseLines(p);
            const payments = p.payments ?? [];
            return (
              <Fragment key={p.id}>
                <tr className="border-b border-border/60">
                  <td className="px-2 py-2.5">
                    <button
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                      aria-label={expanded ? "Collapse purchase" : "Expand purchase"}
                      onClick={() => setOpenId(expanded ? null : p.id)}
                    >
                      {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      className="font-medium text-primary hover:underline"
                      onClick={() => setOpenId(expanded ? null : p.id)}
                    >
                      {p.purchaseNumber ?? p.reference ?? p.id}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{formatDate(p.purchasedAt)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                    {formatCurrency(purchaseGrandTotal(p))}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(purchaseAmountPaid(p))}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-orange-700 dark:text-orange-400">
                    {formatCurrency(due)}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
                        paymentStatusClass(st)
                      )}
                    >
                      {paymentStatusLabel(st)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {due > 0.01 && onPay ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-primary"
                        aria-label="Record payment"
                        onClick={() => onPay(p)}
                      >
                        <CreditCard className="h-4 w-4" />
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
                {expanded ? (
                  <tr className="border-b border-border/60 bg-muted/30">
                    <td colSpan={8} className="px-4 py-4">
                      <div className="grid gap-6 sm:grid-cols-2">
                        <div>
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Items ({lines.length})
                          </p>
                          {lines.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No line items.</p>
                          ) : (
                            <div className="space-y-2">
                              {lines.map((line, i) => (
                                <div
                                  key={`${p.id}-line-${i}`}
                                  className="flex items-center justify-between rounded-md border border-border/60 bg-background px-3 py-2"
                                >
                                  <span className="text-sm">
                                    {line.name} × {line.qty}
                                  </span>
                                  <span className="text-sm font-medium tabular-nums">
                                    {formatCurrency(line.total)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Payment history
                          </p>
                          {payments.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No payments recorded yet</p>
                          ) : (
                            <div className="space-y-2">
                              {payments.map((pay) => (
                                <div
                                  key={pay.id}
                                  className="flex items-center justify-between rounded-md border border-border/60 bg-background px-3 py-2"
                                >
                                  <div>
                                    <p className="text-sm font-medium tabular-nums">
                                      {formatCurrency(pay.amount)}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                      {formatDate(pay.paidAt)}
                                      {pay.method ? ` · ${pay.method}` : ""}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
