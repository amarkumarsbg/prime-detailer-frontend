"use client";

import Link from "next/link";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCashBankStore, type CashBankAccount } from "@/store/cash-bank-store";
import type { PaymentMethod } from "@/types";

/** UPI / Card collect into a bank account (MyBillBook-style). Cash does not. */
export function needsPaymentReceivedIn(method: PaymentMethod): boolean {
  return method === "UPI" || method === "CARD";
}

export function bankAccountsForPaymentIn(
  accounts: CashBankAccount[]
): CashBankAccount[] {
  return accounts.filter((a) => a.type === "bank");
}

export function paymentReceivedInLabel(
  accounts: CashBankAccount[],
  accountId?: string,
  fallbackName?: string
): string | null {
  if (!accountId && !fallbackName) return null;
  const acc = accountId ? accounts.find((a) => a.id === accountId) : undefined;
  if (acc) {
    const tail = acc.accountNumberDisplay || acc.bankMeta?.accountNumber?.slice(-4);
    return tail ? `${acc.displayName} (${tail})` : acc.displayName;
  }
  return fallbackName ?? null;
}

type PaymentReceivedInFieldProps = {
  value: string;
  onChange: (accountId: string) => void;
  disabled?: boolean;
  id?: string;
};

/**
 * Bank account picker for UPI/Card payments — options from Cash & Bank.
 */
export function PaymentReceivedInField({
  value,
  onChange,
  disabled,
  id = "payment-received-in",
}: PaymentReceivedInFieldProps) {
  const accounts = useCashBankStore((s) => s.accounts);
  const banks = bankAccountsForPaymentIn(accounts);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Payment Received In</Label>
      {banks.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          No bank accounts yet.{" "}
          <Link href="/cash-bank" className="font-medium text-primary underline-offset-2 hover:underline">
            Add one in Cash &amp; Bank
          </Link>
        </p>
      ) : (
        <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger id={id}>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            {banks.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.displayName}
                {a.accountNumberDisplay || a.bankMeta?.accountNumber
                  ? ` · ${a.accountNumberDisplay || a.bankMeta?.accountNumber?.slice(-4)}`
                  : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
