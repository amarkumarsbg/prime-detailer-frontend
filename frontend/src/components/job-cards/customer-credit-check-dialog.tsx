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
  dialogMobileSheetContentClasses,
  dialogMobileSheetHeaderClasses,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
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
import { useSettingsStore } from "@/store/settings-store";
import { useCustomerStore } from "@/store/customer-store";
import { useWalletStore } from "@/store/wallet-store";
import { notifyCustomerPaymentRecordedWhatsApp } from "@/lib/payment-received-whatsapp";
import { pushActivityLog } from "@/lib/activity-log-helper";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  needsPaymentReceivedIn,
  PaymentReceivedInField,
} from "@/components/billing/payment-received-in-field";
import { useCashBankStore } from "@/store/cash-bank-store";
import type { Invoice, PaymentMethod } from "@/types";

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
  { value: "WALLET", label: "Wallet" },
];

function sumPayments(inv: Invoice): number {
  return inv.payments.reduce((s, p) => s + p.amount, 0) + (inv.walletAmountUsed || 0);
}

function balanceDue(inv: Invoice): number {
  return inv.grandTotal - sumPayments(inv);
}

export function CustomerCreditCheckDialog({
  open,
  onOpenChange,
  onPrepareClose,
  customerId,
  customerName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called before close so a parent booking shell dialog is not dismissed on mobile. */
  onPrepareClose?: () => void;
  customerId: string | null;
  customerName: string;
}) {
  const invoices = useInvoiceStore((s) => s.invoices);
  const recordInvoicePayment = useInvoiceStore((s) => s.recordPayment);
  const user = useAuthStore((s) => s.user);
  const businessName = useSettingsStore((s) => s.businessName);
  const cashBankAccounts = useCashBankStore((s) => s.accounts);

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
  const [receivedInAccountId, setReceivedInAccountId] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [useWallet, setUseWallet] = useState(false);
  const [addExtraToWallet, setAddExtraToWallet] = useState(false);

  const showReceivedIn = needsPaymentReceivedIn(paymentMethod);

  useEffect(() => {
    if (!open) {
      queueMicrotask(() => {
        setRecordOpen(false);
        setTargetInvoice(null);
        setPaymentAmount("");
        setReferenceNumber("");
        setPaymentMethod("CASH");
        setReceivedInAccountId("");
        setUseWallet(false);
        setAddExtraToWallet(false);
      });
    }
  }, [open]);

  const openRecordFor = (inv: Invoice) => {
    const bal = balanceDue(inv);
    setTargetInvoice(inv);
    setPaymentAmount(bal > 0 ? String(Math.round(bal * 100) / 100) : "");
    setPaymentMethod("CASH");
    setReceivedInAccountId("");
    setReferenceNumber("");
    setUseWallet(false);
    setAddExtraToWallet(false);
    setRecordOpen(true);
  };

  const handleRecordPayment = async () => {
    if (!targetInvoice) return;
    const amount = Number(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    if (showReceivedIn && !receivedInAccountId) {
      toast.error("Select Payment Received In", {
        description: "Choose the bank account for UPI or Card payments.",
      });
      return;
    }
    
    const invoiceCustomer = useCustomerStore.getState().customers.find((c) => c.id === targetInvoice.customerId);
    const maxPay = balanceDue(targetInvoice);

    const walletAmountUsed = useWallet
      ? Math.min(invoiceCustomer?.walletBalance || 0, maxPay)
      : 0;

    const remainingPayable = maxPay - walletAmountUsed;

    const extraAmount = amount > remainingPayable
      ? Math.round((amount - remainingPayable) * 100) / 100
      : 0;

    if (extraAmount > 0 && !addExtraToWallet) {
      toast.error("Amount exceeds balance due", {
        description: `Maximum ${formatCurrency(remainingPayable)} for ${targetInvoice.invoiceNumber} unless adding extra to wallet.`,
      });
      return;
    }

    const performedBy = user?.id?.toLowerCase() ?? "usr-001";
    const paidAt = new Date().toISOString();
    const remainingAfter = Math.max(0, maxPay - walletAmountUsed - amount);
    const receivedInAccount = showReceivedIn
      ? cashBankAccounts.find((a) => a.id === receivedInAccountId)
      : undefined;

    const result = await recordInvoicePayment(
      targetInvoice.id,
      {
        invoiceId: targetInvoice.id,
        amount,
        method: paymentMethod,
        referenceNumber: referenceNumber.trim() || undefined,
        paidAt,
        receivedInAccountId: receivedInAccount?.id,
        receivedInAccountName: receivedInAccount?.displayName,
        addExtraToWallet: addExtraToWallet && extraAmount > 0,
        extraAmount: addExtraToWallet && extraAmount > 0 ? extraAmount : undefined,
      },
      { performedBy },
      walletAmountUsed
    );

    if (!result.ok) {
      toast.error("Could not record payment", { description: result.inventoryError });
      return;
    }

    toast.success("Payment recorded");

    try {
      await useCustomerStore.getState().fetchCustomers();
      await useWalletStore.getState().fetchTransactions();
    } catch (e) {
      console.error("Failed to reload customer/wallet state:", e);
    }

    pushActivityLog({
      action: "PAYMENT_RECEIVED",
      entityType: "INVOICE",
      entityId: targetInvoice.id,
      entityLabel: targetInvoice.invoiceNumber,
      details: `${formatCurrency(amount)} received on ${targetInvoice.invoiceNumber} (job card credit check)`,
    });
    void notifyCustomerPaymentRecordedWhatsApp({
      invoice: targetInvoice,
      amount,
      method: paymentMethod,
      referenceNumber: referenceNumber.trim() || undefined,
      paidAt,
      remainingBalanceAfter: remainingAfter,
      businessName,
    });
    setRecordOpen(false);
    setTargetInvoice(null);
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) onPrepareClose?.();
          onOpenChange(next);
        }}
      >
        <DialogContent className={cn(dialogMobileSheetContentClasses, "max-h-[min(90vh,640px)]")}>
          <DialogHeader className={dialogMobileSheetHeaderClasses}>
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
                          <Link
                            href={`/billing/${inv.id}`}
                            className="font-mono font-bold text-indigo-600 hover:text-indigo-800 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                          >
                            {inv.invoiceNumber}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            Job {inv.jobNumber} · {formatDateTime(inv.createdAt)}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="shrink-0 tabular-nums bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/50 font-semibold"
                        >
                          Due {formatCurrency(bal)}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>
                          Total {formatCurrency(inv.grandTotal)} · Paid {formatCurrency(paid)}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-8 px-3 shadow-sm active:scale-95 transition-transform"
                            onClick={() => openRecordFor(inv)}
                          >
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

      <Dialog
        open={recordOpen}
        onOpenChange={(next) => {
          if (!next) onPrepareClose?.();
          setRecordOpen(next);
        }}
      >
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
            {(() => {
              if (!targetInvoice) return null;
              const invoiceCustomer = useCustomerStore.getState().customers.find((c) => c.id === targetInvoice.customerId);
              if (invoiceCustomer && invoiceCustomer.walletBalance > 0) {
                const remainingBalance = balanceDue(targetInvoice);
                return (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        Wallet Balance: ₹{invoiceCustomer.walletBalance}
                      </span>
                      <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useWallet}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setUseWallet(checked);
                            const walletUse = checked
                              ? Math.min(invoiceCustomer.walletBalance, remainingBalance)
                              : 0;
                            setPaymentAmount(String(Math.max(0, Math.round((remainingBalance - walletUse) * 100) / 100)));
                          }}
                          className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                        />
                        Use Wallet Balance
                      </label>
                    </div>
                    {useWallet && (
                      <div className="text-xs space-y-1 pt-1 border-t border-emerald-500/10 font-mono text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Invoice Remaining:</span>
                          <span>₹{remainingBalance}</span>
                        </div>
                        <div className="flex justify-between text-rose-500">
                          <span>Wallet Used:</span>
                          <span>-₹{Math.min(invoiceCustomer.walletBalance, remainingBalance)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-foreground">
                          <span>Amount to Pay:</span>
                          <span>₹{Math.max(0, Math.round((remainingBalance - Math.min(invoiceCustomer.walletBalance, remainingBalance)) * 100) / 100)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }
              return null;
            })()}

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

            {(() => {
              if (!targetInvoice) return null;
              const invoiceCustomer = useCustomerStore.getState().customers.find((c) => c.id === targetInvoice.customerId);
              const remainingBalance = balanceDue(targetInvoice);
              const walletUse = useWallet && invoiceCustomer
                ? Math.min(invoiceCustomer.walletBalance, remainingBalance)
                : 0;
              const inputAmt = Number(paymentAmount) || 0;
              const targetBalance = remainingBalance - walletUse;
              const extra = inputAmt > targetBalance ? Math.round((inputAmt - targetBalance) * 100) / 100 : 0;
              
              if (extra > 0) {
                return (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-3">
                    <div className="text-xs space-y-1 font-mono text-muted-foreground">
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
                        id="chk-credit-pay-ref"
                        type="checkbox"
                        checked={addExtraToWallet}
                        onChange={(e) => setAddExtraToWallet(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                      />
                      <Label htmlFor="chk-credit-pay-ref" className="text-xs font-semibold cursor-pointer select-none">
                        Add ₹{extra} to customer wallet?
                      </Label>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            <div className="space-y-2">
              <Label>Method</Label>
              <Select
                value={paymentMethod}
                onValueChange={(v) => {
                  const next = v as PaymentMethod;
                  setPaymentMethod(next);
                  if (!needsPaymentReceivedIn(next)) setReceivedInAccountId("");
                }}
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
            {showReceivedIn ? (
              <PaymentReceivedInField
                value={receivedInAccountId}
                onChange={setReceivedInAccountId}
                id="credit-payment-received-in"
              />
            ) : null}
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
            <Button
              type="button"
              onClick={() => void handleRecordPayment()}
              disabled={!targetInvoice || (showReceivedIn && !receivedInAccountId)}
            >
              Save payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
