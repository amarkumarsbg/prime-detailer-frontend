"use client";

import { ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PartyShippingAddress } from "@/types/party";
import { cn } from "@/lib/utils";

export type ShippingAddressFormValues = {
  name: string;
  street: string;
  state: string;
  pincode: string;
  city: string;
};

export function emptyShippingForm(defaultName: string): ShippingAddressFormValues {
  return {
    name: defaultName,
    street: "",
    state: "",
    pincode: "",
    city: "",
  };
}

export function shippingFormFromAddress(
  addr: PartyShippingAddress | null,
  defaultName: string
): ShippingAddressFormValues {
  if (!addr) return emptyShippingForm(defaultName);
  return {
    name: addr.name,
    street: addr.street ?? "",
    state: addr.state ?? "",
    pincode: addr.pincode ?? "",
    city: addr.city ?? "",
  };
}

function FormField({
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
      <Label className="text-xs font-normal text-[#6B7A99]">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

const inputClass =
  "h-10 w-full rounded-md border-neutral-300 bg-white text-sm text-neutral-800 placeholder:text-neutral-400";

type ShippingAddressFormProps = {
  form: ShippingAddressFormValues;
  onChange: (next: ShippingAddressFormValues) => void;
};

export function ShippingAddressForm({ form, onChange }: ShippingAddressFormProps) {
  const set = (key: keyof ShippingAddressFormValues, value: string) => {
    onChange({ ...form, [key]: value });
  };

  return (
    <div className="space-y-4">
      <FormField label="Shipping Name" required>
        <Input
          className={inputClass}
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
        />
      </FormField>
      <FormField label="Street Address" required>
        <Textarea
          className="min-h-[96px] resize-y rounded-md border-neutral-300 bg-white text-sm placeholder:text-neutral-400"
          value={form.street}
          onChange={(e) => set("street", e.target.value)}
          placeholder="Enter Street Address"
        />
      </FormField>
      <FormField label="State">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 pointer-events-none z-[1]" />
          <Input
            className={cn(inputClass, "pl-9 pr-9")}
            value={form.state}
            onChange={(e) => set("state", e.target.value)}
            placeholder="Enter State"
          />
          <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 pointer-events-none" />
        </div>
      </FormField>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Pincode">
          <Input
            className={inputClass}
            value={form.pincode}
            onChange={(e) => set("pincode", e.target.value)}
            placeholder="Enter pin code"
          />
        </FormField>
        <FormField label="City">
          <Input
            className={inputClass}
            value={form.city}
            onChange={(e) => set("city", e.target.value)}
            placeholder="Enter City"
          />
        </FormField>
      </div>
    </div>
  );
}

export function formToShippingAddress(
  form: ShippingAddressFormValues,
  initial: PartyShippingAddress | null
): PartyShippingAddress | null {
  const name = form.name.trim();
  const street = form.street.trim();
  if (!name || !street) return null;
  return {
    id: initial?.id ?? `ship-${Date.now()}`,
    name,
    street,
    state: form.state.trim() || undefined,
    pincode: form.pincode.trim() || undefined,
    city: form.city.trim() || undefined,
    isDefault: initial?.isDefault,
  };
}
