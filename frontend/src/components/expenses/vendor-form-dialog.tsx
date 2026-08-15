"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogMobileSheetContentClasses,
  dialogMobileSheetHeaderClasses,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ExpenseVendorProfile } from "@/types";
import type { AddVendorDirectoryInput } from "@/store/expense-store";

export type VendorFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor?: ExpenseVendorProfile | null;
  /** Prefill name when creating from a purchase-only vendor row. */
  initialName?: string;
  onSave: (input: AddVendorDirectoryInput) => Promise<boolean>;
};

export function VendorFormDialog({
  open,
  onOpenChange,
  vendor = null,
  initialName = "",
  onSave,
}: VendorFormDialogProps) {
  const isEdit = Boolean(vendor);
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [address, setAddress] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setName(vendor?.name ?? initialName);
      setContactPerson(vendor?.contactPerson ?? "");
      setEmail(vendor?.email ?? "");
      setPhone(vendor?.phone ?? "");
      setPaymentTerms(vendor?.paymentTerms ?? "");
      setAddress(vendor?.address ?? "");
      setGstNumber(vendor?.gstNumber ?? "");
      setPanNumber(vendor?.panNumber ?? "");
      setNotes(vendor?.notes ?? "");
    });
  }, [open, vendor, initialName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const ok = await onSave({
        name: name.trim(),
        contactPerson: contactPerson.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        paymentTerms: paymentTerms.trim() || undefined,
        address: address.trim() || undefined,
        gstNumber: gstNumber.trim() || undefined,
        panNumber: panNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      if (ok) onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(dialogMobileSheetContentClasses, "max-h-[90dvh]")}>
        <DialogHeader className={cn(dialogMobileSheetHeaderClasses, "pb-2")}>
          <DialogTitle>{isEdit ? "Edit Vendor" : "Add Vendor"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-6 py-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="space-y-2">
              <Label htmlFor="vendor-name">Vendor Name</Label>
              <Input
                id="vendor-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., ABC Suppliers Ltd."
                autoComplete="organization"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-contact">Contact Person</Label>
              <Input
                id="vendor-contact"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="Contact name"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="vendor-email">Email</Label>
                <Input
                  id="vendor-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vendor@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor-phone">Phone</Label>
                <Input
                  id="vendor-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone number"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-terms">Payment Terms</Label>
              <Input
                id="vendor-terms"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="e.g., Net 30, COD"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-address">Address</Label>
              <Textarea
                id="vendor-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Full address"
                rows={3}
                className="min-h-[72px] resize-y"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="vendor-gst">GST Number</Label>
                <Input
                  id="vendor-gst"
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value)}
                  placeholder="GST Number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor-pan">PAN Number</Label>
                <Input
                  id="vendor-pan"
                  value={panNumber}
                  onChange={(e) => setPanNumber(e.target.value)}
                  placeholder="PAN Number"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-notes">Notes</Label>
              <Textarea
                id="vendor-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
                rows={3}
                className="min-h-[72px] resize-y"
              />
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t border-border px-6 py-4">
            <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? "Saving…" : isEdit ? "Update Vendor" : "Create Vendor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
