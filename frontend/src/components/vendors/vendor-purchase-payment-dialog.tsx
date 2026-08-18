"use client";

import { useEffect, useState } from "react";
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
  needsPaymentReceivedIn,
  PaymentReceivedInField,
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
  const [receivedInAccountId, setReceivedInAccountId] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const showReceivedIn = needsPaymentReceivedIn(method);

  useEffect(() => {
    if (!open || !purchase) return;
    setAmount(due > 0 ? String(due) : "");
    setMethod("CASH");
    setReceivedInAccountId("");
    setReferenceNumber("");
  }, [open, purchase, due]);

  const submit = () => {
    if (!purchase) return;
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Enter a payment amount greater than zero.");
      return;
    }
    if (showReceivedIn && !receivedInAccountId) {
      toast.error("Select Payment Received In", {
        description: "Choose the bank account for UPI or Card payments.",
      });
      return;
    }
    const account = showReceivedIn
      ? cashBankAccounts.find((a) => a.id === receivedInAccountId)
      : undefined;
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
    const updated = useInventoryStore.getState().productPurchases.find((p) => p.id === purchase.id);
    if (updated) {
      void syncPurchaseToExpense(updated, {
        createdBy: user?.id ?? "unknown",
        createdByName: user?.name ?? user?.email ?? "staff",
      });
    }
    const posted = postPurchasePaymentToCashBank({
      amount: n,
      method,
      accountId: account?.id,
      vendorName: purchase.vendorName,
      purchaseNumber: purchase.purchaseNumber,
      referenceNumber: referenceNumber.trim() || undefined,
    });
    toast.success(
      posted ? "Payment recorded in Expenses and Accounting." : "Payment recorded on the purchase."
    );
    onOpenChange(false);
  };

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
              onValueChange={(v) => {
                const next = v as PaymentMethod;
                setMethod(next);
                if (!needsPaymentReceivedIn(next)) setReceivedInAccountId("");
              }}
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
          {showReceivedIn ? (
            <PaymentReceivedInField
              value={receivedInAccountId}
              onChange={setReceivedInAccountId}
              disabled={!purchase}
              id="vendor-pay-received-in"
            />
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
            disabled={!purchase || (showReceivedIn && !receivedInAccountId)}
            onClick={submit}
          >
            Record Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
