"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { pushActivityLog } from "@/lib/activity-log-helper";
import { invoiceOutstanding } from "@/lib/party/ledger-math";
import { notifyCustomerPaymentRecordedWhatsApp } from "@/lib/payment-received-whatsapp";
import { formatCurrency } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { useCustomerStore } from "@/store/customer-store";
import { useInvoiceStore } from "@/store/invoice-store";
import { useSettingsStore } from "@/store/settings-store";
import { useWalletStore } from "@/store/wallet-store";
import type { PaymentMethod } from "@/types";

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
];

type RecordPaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Invoice to collect against. Dialog no-ops if missing/closed. */
  invoiceId: string | null;
  onSuccess?: (invoiceId: string) => void;
};

/**
 * Shared “Record Payment” modal used from invoice detail, job cards, ledger, etc.
 * Persists through the invoice store immediately (real-time collection sync).
 */
export function RecordPaymentDialog({
  open,
  onOpenChange,
  invoiceId,
  onSuccess,
}: RecordPaymentDialogProps) {
  const invoices = useInvoiceStore((s) => s.invoices);
  const recordInvoicePayment = useInvoiceStore((s) => s.recordPayment);
  const customers = useCustomerStore((s) => s.customers);
  const user = useAuthStore((s) => s.user);
  const businessName = useSettingsStore((s) => s.businessName);
  const referralRewardAmount = useSettingsStore((s) => s.referralRewardAmount);

  const invoice = useMemo(
    () => (invoiceId ? invoices.find((i) => i.id === invoiceId) ?? null : null),
    [invoices, invoiceId]
  );
  const customer = useMemo(
    () =>
      invoice ? customers.find((c) => c.id === invoice.customerId) ?? null : null,
    [customers, invoice]
  );

  const remainingBalance = invoice ? invoiceOutstanding(invoice) : 0;

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [useWallet, setUseWallet] = useState(false);
  const [addExtraToWallet, setAddExtraToWallet] = useState(false);
  const [dialogRemainingBalance, setDialogRemainingBalance] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !invoice) return;
    const due = invoiceOutstanding(invoice);
    setDialogRemainingBalance(due);
    setPaymentAmount(due > 0 ? String(due) : "");
    setPaymentMethod("CASH");
    setReferenceNumber("");
    setUseWallet(false);
    setAddExtraToWallet(false);
  }, [open, invoice]);

  const handleRecordPayment = async () => {
    const amount = Number(paymentAmount);
    if (!invoice || !Number.isFinite(amount) || amount <= 0) return;

    setSaving(true);
    try {
      const paidAt = new Date().toISOString();
      const totalPaidBefore =
        invoice.payments.reduce((sum, p) => sum + p.amount, 0) +
        (invoice.walletAmountUsed || 0);

      const walletAmountUsed = useWallet
        ? Math.min(customer?.walletBalance || 0, dialogRemainingBalance)
        : 0;

      const extraAmount =
        amount > dialogRemainingBalance - walletAmountUsed
          ? Math.round((amount - (dialogRemainingBalance - walletAmountUsed)) * 100) / 100
          : 0;

      const remainingAfter = Math.max(
        0,
        dialogRemainingBalance - walletAmountUsed - amount
      );

      const performedBy = user?.id?.toLowerCase() ?? "usr-001";
      const result = await recordInvoicePayment(
        invoice.id,
        {
          invoiceId: invoice.id,
          amount,
          method: paymentMethod,
          referenceNumber: referenceNumber.trim() || undefined,
          paidAt,
          addExtraToWallet: addExtraToWallet && extraAmount > 0,
          extraAmount: addExtraToWallet && extraAmount > 0 ? extraAmount : undefined,
        },
        { performedBy },
        walletAmountUsed
      );

      if (!result.ok) {
        toast.error("Could not record payment", {
          description: result.inventoryError ?? "Unknown error",
        });
        return;
      }

      toast.success("Payment recorded");

      try {
        await useCustomerStore.getState().fetchCustomers();
        await useWalletStore.getState().fetchTransactions();
      } catch (e) {
        console.error("Failed to reload customer/wallet state:", e);
      }

      const totalPaidAfter = totalPaidBefore + amount + walletAmountUsed;
      const latestInvoice =
        useInvoiceStore.getState().invoices.find((i) => i.id === invoice.id) || invoice;
      const isFullyPaidNow = totalPaidAfter >= latestInvoice.grandTotal - 0.01;

      if (isFullyPaidNow) {
        const buyer =
          useCustomerStore.getState().customers.find((c) => c.id === latestInvoice.customerId) ||
          customer;
        if (buyer) {
          const pointsRedeemed = latestInvoice.rewardDiscount || 0;
          const discountAmt = latestInvoice.discountAmount || 0;
          const refDiscount = latestInvoice.referralDiscount || 0;
          const taxable = Math.max(
            0,
            latestInvoice.subtotal - discountAmt - pointsRedeemed - refDiscount
          );
          const pointsEarned = Math.floor(taxable / 100);
          const nextPoints = Math.max(0, buyer.rewardPoints - pointsRedeemed + pointsEarned);

          await useCustomerStore.getState().updateCustomer(buyer.id, {
            rewardPoints: nextPoints,
            totalVisits: (buyer.totalVisits || 0) + 1,
          });

          toast.success(
            `Loyalty points updated: ${buyer.name} earned ${pointsEarned} points and redeemed ${pointsRedeemed} points.`
          );
        }

        if (latestInvoice.referralAdvocateId) {
          const advocate = useCustomerStore
            .getState()
            .customers.find((c) => c.id === latestInvoice.referralAdvocateId);
          if (advocate) {
            const nextAdvocatePoints = (advocate.rewardPoints || 0) + referralRewardAmount;
            await useCustomerStore.getState().updateCustomer(advocate.id, {
              rewardPoints: nextAdvocatePoints,
            });
            toast.success(
              `Referrer credited: ${advocate.name} received ${referralRewardAmount} referral reward points.`
            );
          }
        }
      }

      pushActivityLog({
        action: "PAYMENT_RECEIVED",
        entityType: "INVOICE",
        entityId: invoice.id,
        entityLabel: invoice.invoiceNumber,
        details: `${formatCurrency(amount)} received on ${invoice.invoiceNumber}`,
      });
      void notifyCustomerPaymentRecordedWhatsApp({
        invoice: latestInvoice,
        amount,
        method: paymentMethod,
        referenceNumber: referenceNumber.trim() || undefined,
        paidAt,
        remainingBalanceAfter: remainingAfter,
        businessName,
      });

      onOpenChange(false);
      onSuccess?.(invoice.id);
    } finally {
      setSaving(false);
    }
  };

  const walletUse = useWallet
    ? Math.min(customer?.walletBalance || 0, dialogRemainingBalance)
    : 0;
  const inputAmt = Number(paymentAmount) || 0;
  const targetBalance = dialogRemainingBalance - walletUse;
  const extra =
    inputAmt > targetBalance ? Math.round((inputAmt - targetBalance) * 100) / 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {invoice ? (
            <p className="text-xs text-muted-foreground">
              {invoice.invoiceNumber} · {invoice.customerName} · Due{" "}
              <span className="font-medium text-foreground tabular-nums">
                {formatCurrency(remainingBalance)}
              </span>
            </p>
          ) : (
            <p className="text-sm text-destructive">Invoice not found.</p>
          )}

          {customer && customer.walletBalance > 0 && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  Wallet Balance: ₹{customer.walletBalance}
                </span>
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useWallet}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setUseWallet(checked);
                      const walletAmt = checked
                        ? Math.min(customer.walletBalance, dialogRemainingBalance)
                        : 0;
                      setPaymentAmount(
                        String(
                          Math.max(0, Math.round((dialogRemainingBalance - walletAmt) * 100) / 100)
                        )
                      );
                    }}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  Use Wallet Balance
                </label>
              </div>
              {useWallet && (
                <div className="space-y-1 border-t border-emerald-500/10 pt-1 font-mono text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Invoice Remaining:</span>
                    <span>₹{dialogRemainingBalance}</span>
                  </div>
                  <div className="flex justify-between text-rose-500">
                    <span>Wallet Used:</span>
                    <span>
                      -₹{Math.min(customer.walletBalance, dialogRemainingBalance)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-foreground">
                    <span>Amount to Pay:</span>
                    <span>
                      ₹
                      {Math.max(
                        0,
                        Math.round(
                          (dialogRemainingBalance -
                            Math.min(customer.walletBalance, dialogRemainingBalance)) *
                            100
                        ) / 100
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="record-payment-amount">Amount (₹)</Label>
            <Input
              id="record-payment-amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="Enter amount"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              disabled={!invoice}
            />
          </div>

          {extra > 0 ? (
            <div className="space-y-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <div className="space-y-1 font-mono text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Invoice Amount:</span>
                  <span>₹{targetBalance}</span>
                </div>
                <div className="flex justify-between">
                  <span>Amount Received:</span>
                  <span>₹{inputAmt}</span>
                </div>
                <div className="flex justify-between font-bold text-amber-600">
                  <span>Extra Amount:</span>
                  <span>₹{extra}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 border-t border-amber-500/10 pt-2">
                <input
                  id="record-payment-add-wallet"
                  type="checkbox"
                  checked={addExtraToWallet}
                  onChange={(e) => setAddExtraToWallet(e.target.checked)}
                  className="h-4 w-4 cursor-pointer rounded border-border text-primary focus:ring-primary"
                />
                <Label
                  htmlFor="record-payment-add-wallet"
                  className="cursor-pointer select-none text-xs font-semibold"
                >
                  Add ₹{extra} to customer wallet?
                </Label>
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
              disabled={!invoice}
            >
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
            <Label htmlFor="record-payment-ref">Reference Number (optional)</Label>
            <Input
              id="record-payment-ref"
              placeholder="UPI ref, TXN ID, etc."
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              disabled={!invoice}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleRecordPayment()}
            disabled={
              saving ||
              !invoice ||
              !paymentAmount ||
              Number.isNaN(Number(paymentAmount)) ||
              Number(paymentAmount) <= 0
            }
          >
            {saving ? "Recording…" : "Record Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
