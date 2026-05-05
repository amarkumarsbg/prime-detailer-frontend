"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { useInvoiceStore } from "@/store/invoice-store";
import { useAuthStore } from "@/store/auth-store";
import { pushActivityLog } from "@/lib/activity-log-helper";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { Invoice, PaymentMethod } from "@/types";

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
  { value: "WALLET", label: "Wallet" },
];

function sumPayments(inv: Invoice): number {
  return inv.payments.reduce((s, p) => s + p.amount, 0);
}

function balanceDue(inv: Invoice): number {
  return inv.grandTotal - sumPayments(inv);
}

export function CustomerCreditCheckDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string | null;
  customerName: string;
}) {
  const invoices = useInvoiceStore((s) => s.invoices);
  const recordInvoicePayment = useInvoiceStore((s) => s.recordPayment);
  const user = useAuthStore((s) => s.user);

  const pending = useMemo(() => {
    if (!customerId) return [];
    return invoices
      .filter((inv) => inv.customerId === customerId && inv.status !== "DRAFT")
      .map((inv) => ({ inv, bal: balanceDue(inv) }))
      .filter(({ bal }) => bal > 0.01)
      .sort((a, b) => b.inv.createdAt.localeCompare(a.inv.createdAt));
  }, [invoices, customerId]);

  const [recordOpen, setRecordOpen] = useState(false);
  const [targetInvoice, setTargetInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [referenceNumber, setReferenceNumber] = useState("");

  useEffect(() => {
    if (!open) {
      setRecordOpen(false);
      setTargetInvoice(null);
      setPaymentAmount("");
      setReferenceNumber("");
      setPaymentMethod("CASH");
    }
  }, [open]);

  const openRecordFor = (inv: Invoice) => {
    const bal = balanceDue(inv);
    setTargetInvoice(inv);
    setPaymentAmount(bal > 0 ? String(Math.round(bal * 100) / 100) : "");
    setPaymentMethod("CASH");
    setReferenceNumber("");
    setRecordOpen(true);
  };

  const handleRecordPayment = async () => {
    if (!targetInvoice) return;
    const amount = Number(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    const maxPay = balanceDue(targetInvoice);
    if (amount > maxPay + 0.01) {
      toast.error("Amount exceeds balance due", {
        description: `Maximum ${formatCurrency(maxPay)} for ${targetInvoice.invoiceNumber}`,
      });
      return;
    }

    const performedBy = user?.id?.toLowerCase() ?? "usr-001";
    const result = await recordInvoicePayment(
      targetInvoice.id,
      {
        invoiceId: targetInvoice.id,
        amount,
        method: paymentMethod,
        referenceNumber: referenceNumber.trim() || undefined,
        paidAt: new Date().toISOString(),
      },
      { performedBy }
    );

    if (!result.ok) {
      toast.error("Could not record payment", { description: result.inventoryError });
      return;
    }

    toast.success("Payment recorded");
    pushActivityLog({
      action: "PAYMENT_RECEIVED",
      entityType: "INVOICE",
      entityId: targetInvoice.id,
      entityLabel: targetInvoice.invoiceNumber,
      details: `${formatCurrency(amount)} received on ${targetInvoice.invoiceNumber} (job card credit check)`,
    });
    setRecordOpen(false);
    setTargetInvoice(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[min(90vh,640px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 space-y-1 border-b border-border px-6 pb-4 pt-6 text-left">
            <DialogTitle>Credit &amp; pending payments</DialogTitle>
            <DialogDescription>
              {customerName.trim() || "Customer"}
              {customerId ? (
                <span className="block text-xs text-muted-foreground/90 mt-1">
                  Outstanding invoices for this customer. Payments are saved to billing records.
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {!customerId ? (
              <p className="text-sm text-muted-foreground">No customer selected.</p>
            ) : pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No pending payments. This customer has no issued invoices with a balance due.
              </p>
            ) : (
              <ul className="space-y-3">
                {pending.map(({ inv, bal }) => {
                  const paid = sumPayments(inv);
                  return (
                    <li
                      key={inv.id}
                      className="rounded-lg border border-border/80 bg-muted/20 p-3 text-sm space-y-2"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 space-y-0.5">
                          <p className="font-mono font-semibold">{inv.invoiceNumber}</p>
                          <p className="text-xs text-muted-foreground">
                            Job {inv.jobNumber} · {formatDateTime(inv.createdAt)}
                          </p>
                        </div>
                        <Badge variant="outline" className="shrink-0 tabular-nums">
                          Due {formatCurrency(bal)}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>
                          Total {formatCurrency(inv.grandTotal)} · Paid {formatCurrency(paid)}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" variant="secondary" onClick={() => openRecordFor(inv)}>
                            Record payment
                          </Button>
                          <Button type="button" size="sm" variant="ghost" asChild className="h-8">
                            <Link href={`/billing/${inv.id}`}>Open billing</Link>
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-border px-6 py-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={recordOpen} onOpenChange={setRecordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>
              {targetInvoice ? (
                <>
                  {targetInvoice.invoiceNumber} — balance {formatCurrency(balanceDue(targetInvoice))}
                </>
              ) : (
                "Select an invoice from the list."
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-2">
              <Label htmlFor="credit-pay-amt">Amount (INR)</Label>
              <Input
                id="credit-pay-amt"
                inputMode="decimal"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Method</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="credit-pay-ref">Reference (optional)</Label>
              <Input
                id="credit-pay-ref"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="UPI ref / receipt #"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setRecordOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleRecordPayment()} disabled={!targetInvoice}>
              Save payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
