"use client";

import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
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
import {
  getPartyShippingAddresses,
  partyPatchFromShippingAddresses,
  shippingAddressListLines,
} from "@/lib/party/party-shipping";
import { cn } from "@/lib/utils";
import type { Party, PartyShippingAddress } from "@/types/party";

type ManageShippingAddressesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  party: Party;
  onSave: (patch: Partial<Party>) => void;
};

const COL_GRID = "grid grid-cols-[minmax(0,1fr)_72px_128px] items-center gap-x-4";

type View = "list" | "form";

function AddressCell({ addr }: { addr: PartyShippingAddress }) {
  const { name, subtitle } = shippingAddressListLines(addr);
  return (
    <div className="min-w-0 pr-2">
      <p className="font-semibold text-neutral-900 leading-snug">{name}</p>
      <p className="text-sm text-neutral-600 mt-0.5">{subtitle}</p>
    </div>
  );
}

export function ManageShippingAddressesDialog({
  open,
  onOpenChange,
  party,
  onSave,
}: ManageShippingAddressesDialogProps) {
  const [addresses, setAddresses] = useState<PartyShippingAddress[]>([]);
  const [view, setView] = useState<View>("list");
  const [editing, setEditing] = useState<PartyShippingAddress | null>(null);
  const [form, setForm] = useState<ShippingAddressFormValues>(() =>
    emptyShippingForm(party.name)
  );

  useEffect(() => {
    if (!open) return;
    setAddresses(getPartyShippingAddresses(party));
    setView("list");
    setEditing(null);
  }, [open, party]);

  const setDefault = (id: string) => {
    setAddresses((list) =>
      list.map((a) => ({
        ...a,
        isDefault: a.id === id,
      }))
    );
  };

  const openEdit = (addr: PartyShippingAddress) => {
    setEditing(addr);
    setForm(shippingFormFromAddress(addr, party.name));
    setView("form");
  };

  const openAdd = () => {
    setEditing(null);
    setForm(emptyShippingForm(party.name));
    setView("form");
  };

  const backToList = () => {
    setView("list");
    setEditing(null);
  };

  const handleFormSave = () => {
    const addr = formToShippingAddress(form, editing);
    if (!addr) return;

    setAddresses((list) => {
      const idx = list.findIndex((a) => a.id === addr.id);
      if (idx >= 0) {
        const next = [...list];
        next[idx] = { ...addr, isDefault: list[idx].isDefault };
        return next;
      }
      const isFirst = list.length === 0;
      return [...list, { ...addr, isDefault: isFirst || Boolean(addr.isDefault) }];
    });
    backToList();
  };

  const handleDone = () => {
    onSave(partyPatchFromShippingAddresses(party, addresses));
    onOpenChange(false);
  };

  const formValid = Boolean(form.name.trim() && form.street.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "gap-0 p-0 overflow-hidden rounded-xl border border-neutral-200",
          "w-[calc(100%-2rem)] sm:max-w-[720px] shadow-xl"
        )}
      >
        <div className="border-b border-neutral-200 px-6 py-5 pr-12">
          <DialogTitle className="text-base font-semibold leading-tight text-neutral-800">
            {view === "list"
              ? "Manage Shipping Addresses"
              : editing
                ? "Edit Shipping Address"
                : "Add Shipping Address"}
          </DialogTitle>
        </div>

        {view === "list" ? (
          <>
            <div className="px-6">
              <div
                className={cn(
                  COL_GRID,
                  "border-b border-neutral-200 py-3 text-sm font-normal text-[#858D9D]"
                )}
              >
                <span>Address</span>
                <span className="text-center">Edit</span>
                <span className="text-right">Default Address</span>
              </div>

              {addresses.map((addr) => (
                <div
                  key={addr.id}
                  className={cn(
                    COL_GRID,
                    "border-b border-neutral-100 py-4",
                    addr.isDefault && "bg-violet-50/80 -mx-6 px-6"
                  )}
                >
                  <AddressCell addr={addr} />
                  <div className="flex justify-center">
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#858D9D] hover:bg-violet-100/80 hover:text-neutral-800"
                      aria-label="Edit address"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openEdit(addr);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex justify-end pr-1">
                    <input
                      type="radio"
                      name="default-shipping"
                      checked={Boolean(addr.isDefault)}
                      onChange={() => setDefault(addr.id)}
                      className="h-4 w-4 cursor-pointer accent-[#5B4FCF]"
                      aria-label={`Default: ${addr.name}`}
                    />
                  </div>
                </div>
              ))}

              <div className="border-b border-neutral-200 py-4">
                <button
                  type="button"
                  className="text-sm font-normal text-blue-600 hover:text-blue-700 no-underline hover:no-underline"
                  onClick={openAdd}
                >
                  + Add New Shipping Address
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-5">
              <Button
                type="button"
                variant="outline"
                className="h-10 min-w-[88px] rounded-lg border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="h-10 min-w-[88px] rounded-lg bg-[#5B4FCF] px-6 text-white hover:bg-[#4f46b8]"
                onClick={handleDone}
              >
                Done
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="px-6 py-5">
              <ShippingAddressForm form={form} onChange={setForm} />
            </div>
            <div className="flex justify-end gap-3 border-t border-neutral-200 px-6 py-5">
              <Button
                type="button"
                variant="outline"
                className="h-10 min-w-[88px] rounded-lg border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50"
                onClick={backToList}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="h-10 min-w-[88px] rounded-lg bg-[#5B4FCF] px-6 text-white hover:bg-[#4f46b8] disabled:opacity-50"
                disabled={!formValid}
                onClick={handleFormSave}
              >
                Save
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
