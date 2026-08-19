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
import {
  accountsForVendorPayment,
  cashAccountsForPaymentOut,
  needsPaymentReceivedIn,
} from "@/components/billing/payment-received-in-field";
import { formatCurrency } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { useCashBankStore } from "@/store/cash-bank-store";
import { useInventoryStore } from "@/store/inventory-store";
import type { PaymentMethod, ProductPurchase } from "@/types";
import { purchaseDue } from "@/lib/inventory/purchase-math";
import {
  postPurchasePaymentToCashBank,
  syncPurchaseToExpense,
} from "@/lib/inventory/sync-purchase-expense";

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
];

type VendorPurchasePaymentDialogProps = {
  purchase: ProductPurchase | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function VendorPurchasePaymentDialog({
  purchase,
  open,
  onOpenChange,
}: VendorPurchasePaymentDialogProps) {
  const recordPurchasePayment = useInventoryStore((s) => s.recordPurchasePayment);
  const cashBankAccounts = useCashBankStore((s) => s.accounts);
  const user = useAuthStore((s) => s.user);
  const due = purchase ? purchaseDue(purchase) : 0;
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [paidFromAccountId, setPaidFromAccountId] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [saving, setSaving] = useState(false);

  const isCashPayment = method === "CASH";
  const cashAccount = useMemo(() => cashAccountsForPaymentOut(cashBankAccounts)[0] ?? null, [cashBankAccounts]);
  const bankAccounts = useMemo(
    () => (isCashPayment ? [] : accountsForVendorPayment(cashBankAccounts, method)),
    [cashBankAccounts, method, isCashPayment]
  );
  const resolvedAccountId = isCashPayment ? cashAccount?.id ?? "" : paidFromAccountId;

  useEffect(() => {
    if (!open || !purchase) return;
    setAmount(due > 0 ? String(due) : "");
    setMethod("CASH");
    setPaidFromAccountId("");
    setReferenceNumber("");
  }, [open, purchase, due]);

  useEffect(() => {
    if (!open || isCashPayment) return;
    const stillValid = bankAccounts.some((a) => a.id === paidFromAccountId);
    if (!stillValid) {
      setPaidFromAccountId(bankAccounts[0]?.id ?? "");
    }
  }, [open, isCashPayment, bankAccounts, paidFromAccountId]);

  const submit = async () => {
    if (!purchase) return;
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Enter a payment amount greater than zero.");
      return;
    }
    if (!resolvedAccountId) {
      toast.error(
        isCashPayment
          ? "No cash account found. Add one under Cash & Bank."
          : "Select the bank account this payment is paid from."
      );
      return;
    }
    const account = cashBankAccounts.find((a) => a.id === resolvedAccountId);
    setSaving(true);
    try {
      const result = recordPurchasePayment(purchase.id, {
        amount: n,
        method,
        receivedInAccountId: account?.id,
        receivedInAccountName: account?.displayName,
        referenceNumber: referenceNumber.trim() || undefined,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Could not record payment.");
        return;
      }
      const updated =
        useInventoryStore.getState().productPurchases.find((p) => p.id === purchase.id) ?? purchase;
      await syncPurchaseToExpense(updated, {
        createdBy: user?.id ?? "unknown",
        createdByName: user?.name ?? user?.email ?? "staff",
      });
      const posted = await postPurchasePaymentToCashBank({
        amount: n,
        method,
        accountId: account?.id,
        vendorName: purchase.vendorName,
        purchaseNumber: purchase.purchaseNumber,
        referenceNumber: referenceNumber.trim() || undefined,
      });
      toast.success(
        posted
          ? "Payment posted to Expenses and Cash & Bank."
          : "Expense updated, but no Cash & Bank account was found."
      );
      onOpenChange(false);
    } catch (err) {
      toast.error("Could not post payment to Expenses / Accounting", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const paidFromHint = isCashPayment
    ? null
    : "Select the bank account debited for this payment.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {purchase ? (
            <p className="text-xs text-muted-foreground">
              {purchase.purchaseNumber ?? purchase.reference ?? purchase.id} · {purchase.vendorName} ·
              Due{" "}
              <span className="font-medium text-foreground tabular-nums">{formatCurrency(due)}</span>
            </p>
          ) : (
            <p className="text-sm text-destructive">Purchase not found.</p>
          )}
          <div className="space-y-2">
            <Label htmlFor="vendor-pay-amount">Amount (₹)</Label>
            <Input
              id="vendor-pay-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={!purchase}
            />
          </div>
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select
              value={method}
              onValueChange={(v) => setMethod(v as PaymentMethod)}
              disabled={!purchase}
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
          {!isCashPayment && (
            <div className="space-y-2">
              <Label htmlFor="vendor-pay-account">Paid from account</Label>
              {bankAccounts.length === 0 ? (
                <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  No bank account yet. Add one under Cash &amp; Bank.
                </p>
              ) : (
                <Select
                  value={paidFromAccountId || undefined}
                  onValueChange={setPaidFromAccountId}
                  disabled={!purchase}
                >
                  <SelectTrigger id="vendor-pay-account">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.displayName}
                        {needsPaymentReceivedIn(method) &&
                        (a.accountNumberDisplay || a.bankMeta?.accountNumber)
                          ? ` · ${a.accountNumberDisplay || a.bankMeta?.accountNumber?.slice(-4)}`
                          : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {paidFromHint ? (
                <p className="text-xs text-muted-foreground">{paidFromHint}</p>
              ) : null}
            </div>
          )}
          {isCashPayment && !cashAccount ? (
            <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              No cash account yet. Add one under Cash &amp; Bank.
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="vendor-pay-ref">Reference Number (optional)</Label>
            <Input
              id="vendor-pay-ref"
              placeholder="UPI ref, TXN ID, etc."
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              disabled={!purchase}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!purchase || saving || !resolvedAccountId}
            onClick={() => void submit()}
          >
            {saving ? "Posting…" : "Record Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
