"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ShippingAddressForm,
  emptyShippingForm,
  formToShippingAddress,
  shippingFormFromAddress,
  type ShippingAddressFormValues,
} from "@/components/parties/shipping-address-form";
import { cn } from "@/lib/utils";
import type { PartyShippingAddress } from "@/types/party";

type AddShippingAddressDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName: string;
  initial?: PartyShippingAddress | null;
  onSubmit: (address: PartyShippingAddress) => void;
};

/** Standalone add/edit dialog (optional); manage flow uses inline form. */
export function AddShippingAddressDialog({
  open,
  onOpenChange,
  defaultName,
  initial,
  onSubmit,
}: AddShippingAddressDialogProps) {
  const [form, setForm] = useState<ShippingAddressFormValues>(() =>
    emptyShippingForm(defaultName)
  );

  useEffect(() => {
    if (!open) return;
    setForm(shippingFormFromAddress(initial ?? null, defaultName));
  }, [open, initial, defaultName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const addr = formToShippingAddress(form, initial ?? null);
    if (!addr) return;
    onSubmit(addr);
    onOpenChange(false);
  };

  const formValid = Boolean(form.name.trim() && form.street.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "gap-0 p-0 overflow-hidden rounded-xl border border-neutral-200",
          "w-[calc(100%-2rem)] sm:max-w-[520px] shadow-xl z-[100]"
        )}
      >
        <div className="border-b border-neutral-200 px-6 py-5 pr-12">
          <DialogTitle className="text-base font-semibold leading-tight text-neutral-800">
            {initial ? "Edit Shipping Address" : "Add Shipping Address"}
          </DialogTitle>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5">
            <ShippingAddressForm form={form} onChange={setForm} />
          </div>
          <div className="flex justify-end gap-3 border-t border-neutral-200 px-6 py-5">
            <Button
              type="button"
              variant="outline"
              className="h-10 min-w-[88px] rounded-lg border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-10 min-w-[88px] rounded-lg bg-[#5B4FCF] px-6 text-white hover:bg-[#4f46b8] disabled:opacity-50"
              disabled={!formValid}
            >
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
