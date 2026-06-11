"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogMobileSheetContentClasses,
  dialogMobileSheetHeaderClasses,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PartyBankAccount } from "@/types/party";
import { cn } from "@/lib/utils";

type AddBankAccountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: PartyBankAccount | null;
  onSubmit: (account: PartyBankAccount) => void;
};

function BankFormField({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5 min-w-0", className)}>
      <Label className="text-xs font-normal text-muted-foreground leading-snug min-h-[2.5rem] flex items-end">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

export function AddBankAccountDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: AddBankAccountDialogProps) {
  const [accountNumber, setAccountNumber] = useState("");
  const [confirmNumber, setConfirmNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [holder, setHolder] = useState("");
  const [bankName, setBankName] = useState("");
  const [branch, setBranch] = useState("");
  const [upiId, setUpiId] = useState("");

  useEffect(() => {
    if (!open) return;
    setAccountNumber(initial?.accountNumber ?? "");
    setConfirmNumber(initial?.accountNumber ?? "");
    setIfsc(initial?.ifsc ?? "");
    setHolder(initial?.accountHolderName ?? "");
    setBankName(initial?.bankName ?? "");
    setBranch(initial?.branchName ?? "");
    setUpiId(initial?.upiId ?? "");
  }, [open, initial]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = accountNumber.trim();
    if (!num) return;
    if (num !== confirmNumber.trim()) return;
    onSubmit({
      id: initial?.id ?? `bank-${Date.now()}`,
      accountNumber: num,
      ifsc: ifsc.trim() || undefined,
      accountHolderName: holder.trim() || undefined,
      bankName: bankName.trim() || undefined,
      branchName: branch.trim() || undefined,
      upiId: upiId.trim() || undefined,
    });
    onOpenChange(false);
  };

  const mismatch =
    confirmNumber.trim().length > 0 && accountNumber.trim() !== confirmNumber.trim();

  const inputClass = "h-10 w-full";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(dialogMobileSheetContentClasses, "sm:max-w-[640px]")}>
        <DialogHeader className={dialogMobileSheetHeaderClasses}>
          <DialogTitle>{initial ? "Edit Bank Account" : "Add Bank Account"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-5">
            <div className="grid grid-cols-2 gap-x-5 gap-y-5">
              <BankFormField label="Bank Account Number" required>
                <Input
                  className={inputClass}
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="ex: 123456789"
                  required
                />
              </BankFormField>
              <BankFormField label="Re-Enter Bank Account Number" required>
                <Input
                  className={inputClass}
                  value={confirmNumber}
                  onChange={(e) => setConfirmNumber(e.target.value)}
                  placeholder="ex: 123456789"
                  required
                />
              </BankFormField>
              {mismatch && (
                <p className="col-span-2 -mt-2 text-xs text-destructive">
                  Account numbers do not match.
                </p>
              )}
              <BankFormField label="IFSC Code">
                <Input
                  className={inputClass}
                  value={ifsc}
                  onChange={(e) => setIfsc(e.target.value)}
                  placeholder="ex: ICIC0001234"
                />
              </BankFormField>
              <BankFormField label="Account Holder's Name">
                <Input
                  className={inputClass}
                  value={holder}
                  onChange={(e) => setHolder(e.target.value)}
                  placeholder="ex: Babu Lal"
                />
              </BankFormField>
              <BankFormField label="Bank Name">
                <Input
                  className={inputClass}
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="ex: ICICI Bank"
                />
              </BankFormField>
              <BankFormField label="Branch Name">
                <Input
                  className={inputClass}
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="ex: Mumbai"
                />
              </BankFormField>
            </div>
            <BankFormField label="UPI ID" className="max-w-none">
              <Input
                className={inputClass}
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="ex: babulal@upi"
              />
            </BankFormField>
          </div>
          <DialogFooter className="px-6 py-4 border-t border-border bg-muted/30 sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mismatch || !accountNumber.trim()}>
              Submit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
