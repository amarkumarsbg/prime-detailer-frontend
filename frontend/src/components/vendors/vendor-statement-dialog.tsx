"use client";

import { useMemo, useState } from "react";
import { BookMarked, Receipt, ShoppingCart } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  dialogMobileSheetContentClasses,
  dialogMobileSheetHeaderClasses,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { VendorPurchasePaymentDialog } from "@/components/vendors/vendor-purchase-payment-dialog";
import {
  derivePaymentStatus,
  purchaseAmountPaid,
  purchaseDue,
  purchaseGrandTotal,
} from "@/lib/inventory/purchase-math";
import { paymentStatusClass, paymentStatusLabel } from "@/lib/inventory/movement-labels";
import {
  expensePaidAmount,
  expensePayableAmount,
  type VendorSummary,
} from "@/lib/vendors/vendor-metrics";

export function VendorStatementDialog({
  vendor,
  onClose,
  onEdit,
}: {
  vendor: VendorSummary | null;
  onClose: () => void;
  onEdit: () => void;
}) {
  const [payTargetId, setPayTargetId] = useState<string | null>(null);

  const ledger = useMemo(() => {
    if (!vendor) return [];
    const purchaseRows = vendor.purchases.map((p) => ({
      id: p.id,
      at: p.purchasedAt,
      kind: "Purchase" as const,
      ref: p.purchaseNumber ?? p.reference ?? p.id,
      total: purchaseGrandTotal(p),
      paid: purchaseAmountPaid(p),
      due: purchaseDue(p),
    }));
    const expenseRows = vendor.expenses.map((e) => ({
      id: e.id,
      at: e.date,
      kind: "Expense" as const,
      ref: e.title,
      total: e.amount,
      paid: expensePaidAmount(e),
      due: expensePayableAmount(e),
    }));
    return [...purchaseRows, ...expenseRows].sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
    );
  }, [vendor]);

  if (!vendor) return null;

  const payTarget = vendor.purchases.find((p) => p.id === payTargetId) ?? null;

  return (
    <>
    <Dialog open={!!vendor} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(dialogMobileSheetContentClasses, "max-h-[min(92dvh,800px)] sm:max-w-3xl")}
      >
        <DialogHeader className={cn(dialogMobileSheetHeaderClasses, "pb-3")}>
          <DialogTitle>Vendor Statement — {vendor.vendorName}</DialogTitle>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{vendor.vendorName}</p>
                <Badge variant={vendor.isActive ? "success" : "secondary"}>
                  {vendor.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              {vendor.profile?.contactPerson ? (
                <p className="text-sm text-muted-foreground">{vendor.profile.contactPerson}</p>
              ) : null}
            </div>
            <div className="grid grid-cols-3 gap-4 text-right text-xs sm:min-w-[280px]">
              <div>
                <p className="font-semibold uppercase tracking-wide text-muted-foreground">Purchases</p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums">{vendor.purchaseCount}</p>
              </div>
              <div>
                <p className="font-semibold uppercase tracking-wide text-muted-foreground">Total paid</p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(vendor.paid)}
                </p>
              </div>
              <div>
                <p className="font-semibold uppercase tracking-wide text-muted-foreground">Balance due</p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums text-orange-600 dark:text-orange-400">
                  {formatCurrency(vendor.outstanding)}
                </p>
              </div>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-4 px-6 py-4">
            {vendor.outstanding > 0.01 ? (
              <div className="flex flex-col gap-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between dark:border-orange-900/50 dark:bg-orange-950/30">
                <p className="text-sm text-orange-800 dark:text-orange-300">
                  Outstanding balance of {formatCurrency(vendor.outstanding)} is payable to this vendor.
                </p>
                {vendor.purchases.some((p) => purchaseDue(p) > 0.01) ? (
                  <Button
                    type="button"
                    size="sm"
                    className="shrink-0"
                    onClick={() => {
                      const next = [...vendor.purchases]
                        .filter((p) => purchaseDue(p) > 0.01)
                        .sort((a, b) => new Date(a.purchasedAt).getTime() - new Date(b.purchasedAt).getTime())[0];
                      if (next) setPayTargetId(next.id);
                    }}
                  >
                    Record payment
                  </Button>
                ) : null}
              </div>
            ) : null}

            <Tabs defaultValue="purchases">
              <TabsList className="h-auto w-full justify-start gap-0 overflow-x-auto rounded-none border-b border-border bg-transparent p-0">
                <TabsTrigger
                  value="purchases"
                  className="gap-1.5 rounded-none border-b-2 border-transparent px-3 py-2 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Purchases & dues
                </TabsTrigger>
                <TabsTrigger
                  value="ledger"
                  className="gap-1.5 rounded-none border-b-2 border-transparent px-3 py-2 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                >
                  <BookMarked className="h-3.5 w-3.5" />
                  Ledger
                </TabsTrigger>
                <TabsTrigger
                  value="expenses"
                  className="gap-1.5 rounded-none border-b-2 border-transparent px-3 py-2 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                >
                  <Receipt className="h-3.5 w-3.5" />
                  Expenses
                </TabsTrigger>
              </TabsList>

              <TabsContent value="purchases" className="mt-4 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <Metric label="Purchases" value={formatCurrency(vendor.purchaseVolume)} />
                  <Metric
                    label="Paid"
                    value={formatCurrency(vendor.purchases.reduce((s, p) => s + purchaseAmountPaid(p), 0))}
                    className="text-emerald-600 dark:text-emerald-400"
                  />
                  <Metric
                    label="Outstanding"
                    value={formatCurrency(vendor.purchases.reduce((s, p) => s + purchaseDue(p), 0))}
                    className="text-orange-600 dark:text-orange-400"
                  />
                </div>
                {vendor.purchases.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No purchases yet.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                          <th className="px-3 py-2 font-medium">Purchase #</th>
                          <th className="px-3 py-2 font-medium">Date</th>
                          <th className="px-3 py-2 text-right font-medium">Total</th>
                          <th className="px-3 py-2 text-right font-medium">Paid</th>
                          <th className="px-3 py-2 text-right font-medium">Due</th>
                          <th className="px-3 py-2 font-medium">Status</th>
                          <th className="px-3 py-2 text-right font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...vendor.purchases]
                          .sort((a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime())
                          .map((p) => {
                            const st = derivePaymentStatus(p);
                            const due = purchaseDue(p);
                            return (
                              <tr key={p.id} className="border-b border-border/60 last:border-0">
                                <td className="px-3 py-2 font-medium">
                                  {p.purchaseNumber ?? p.reference ?? p.id}
                                </td>
                                <td className="px-3 py-2 text-muted-foreground">{formatDate(p.purchasedAt)}</td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                  {formatCurrency(purchaseGrandTotal(p))}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                                  {formatCurrency(purchaseAmountPaid(p))}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-orange-600 dark:text-orange-400">
                                  {formatCurrency(due)}
                                </td>
                                <td className="px-3 py-2">
                                  <span
                                    className={cn(
                                      "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
                                      paymentStatusClass(st)
                                    )}
                                  >
                                    {paymentStatusLabel(st)}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {due > 0.01 ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-8"
                                      onClick={() => setPayTargetId(p.id)}
                                    >
                                      Pay
                                    </Button>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="ledger" className="mt-4">
                {ledger.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No ledger entries yet.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                          <th className="px-3 py-2 font-medium">Date</th>
                          <th className="px-3 py-2 font-medium">Type</th>
                          <th className="px-3 py-2 font-medium">Reference</th>
                          <th className="px-3 py-2 text-right font-medium">Total</th>
                          <th className="px-3 py-2 text-right font-medium">Paid</th>
                          <th className="px-3 py-2 text-right font-medium">Due</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledger.map((row) => (
                          <tr key={`${row.kind}-${row.id}`} className="border-b border-border/60 last:border-0">
                            <td className="px-3 py-2 text-muted-foreground">{formatDate(row.at)}</td>
                            <td className="px-3 py-2">{row.kind}</td>
                            <td className="px-3 py-2 font-medium">{row.ref}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.total)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(row.paid)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-orange-600 dark:text-orange-400">
                              {formatCurrency(row.due)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="expenses" className="mt-4">
                {vendor.expenses.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No expenses for this vendor.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                          <th className="px-3 py-2 font-medium">Date</th>
                          <th className="px-3 py-2 font-medium">Title</th>
                          <th className="px-3 py-2 text-right font-medium">Amount</th>
                          <th className="px-3 py-2 text-right font-medium">Paid</th>
                          <th className="px-3 py-2 text-right font-medium">Due</th>
                          <th className="px-3 py-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...vendor.expenses]
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .map((e) => (
                            <tr key={e.id} className="border-b border-border/60 last:border-0">
                              <td className="px-3 py-2 text-muted-foreground">{formatDate(e.date)}</td>
                              <td className="px-3 py-2 font-medium">{e.title}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(e.amount)}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                                {formatCurrency(expensePaidAmount(e))}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-orange-600 dark:text-orange-400">
                                {formatCurrency(expensePayableAmount(e))}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">{e.paymentStatus}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
        <div className="flex shrink-0 justify-end gap-2 border-t border-border px-6 py-3">
          <Button type="button" variant="outline" onClick={onEdit}>
            Edit vendor
          </Button>
          <Button type="button" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    <VendorPurchasePaymentDialog
      purchase={payTarget}
      open={!!payTarget}
      onOpenChange={(open) => {
        if (!open) setPayTargetId(null);
      }}
    />
    </>
  );
}

function Metric({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-sm font-semibold tabular-nums", className)}>{value}</p>
    </div>
  );
}
