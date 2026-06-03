"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddBankAccountDialog } from "@/components/parties/add-bank-account-dialog";
import { useParties } from "@/hooks/use-parties";
import {
  emptyPartyForm,
  formToPartyPatch,
  partyToForm,
  defaultOpeningSide,
  type PartyFormState,
} from "@/lib/party/party-form-state";
import type { Party, PartyBankAccount } from "@/types/party";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-foreground border-b border-border pb-2 mb-4">
      {children}
    </h2>
  );
}

function Field({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs text-muted-foreground font-normal">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

type PartyFormPageProps = {
  mode: "create" | "edit";
  party?: Party;
};

export function PartyFormPage({ mode, party }: PartyFormPageProps) {
  const router = useRouter();
  const { parties, upsertParty } = useParties();
  const [form, setForm] = useState<PartyFormState>(() =>
    party ? partyToForm(party) : emptyPartyForm()
  );
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<PartyBankAccount | null>(null);

  const categorySuggestions = useMemo(() => {
    const set = new Set<string>();
    for (const p of parties) {
      if (p.category?.trim()) set.add(p.category.trim());
    }
    return [...set].sort();
  }, [parties]);

  const set = <K extends keyof PartyFormState>(key: K, value: PartyFormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleKindChange = (kind: PartyFormState["kind"]) => {
    setForm((f) => ({
      ...f,
      kind,
      openingBalanceSide: defaultOpeningSide(kind),
    }));
  };

  const handleSameAsBilling = (checked: boolean) => {
    setForm((f) => ({
      ...f,
      sameAsBilling: checked,
      shippingAddress: checked ? f.billingAddress : f.shippingAddress,
    }));
  };

  const handleGstinLookup = () => {
    const gst = form.gstin.trim();
    if (!gst) {
      toast.error("Enter a GSTIN first");
      return;
    }
    toast.info("GSTIN lookup is not connected yet", {
      description: "Party details from GSTIN will be available when the API is added.",
    });
  };

  const persist = async (saveAndNew: boolean): Promise<boolean> => {
    const name = form.name.trim();
    if (!name) {
      toast.error("Party name is required");
      return false;
    }

    const patch = formToPartyPatch(form);
    const saved = await upsertParty(mode === "edit" && party ? party.id : null, {
      ...patch,
      name,
      kind: form.kind,
      customFields: patch.customFields ?? [],
      openingBalance: patch.openingBalance ?? 0,
    });

    if (!saved) {
      toast.error("Could not save party");
      return false;
    }

    toast.success(mode === "edit" ? "Party updated" : "Party created");

    if (saveAndNew) {
      setForm(emptyPartyForm(form.kind));
      return true;
    }
    router.push(`/parties/${encodeURIComponent(saved.id)}`);
    return true;
  };

  const title = mode === "edit" ? "Edit Party" : "Create Party";
  const backHref =
    mode === "edit" && party
      ? `/parties/${encodeURIComponent(party.id)}`
      : "/parties";

  return (
    <div className="flex flex-col min-h-0">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-background/95 backdrop-blur px-1 py-3 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="shrink-0" asChild>
            <Link href={backHref} aria-label="Back">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-lg font-semibold truncate">{title}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {mode === "create" && (
            <Button
              type="button"
              variant="outline"
              className="border-primary text-primary hover:bg-primary/5"
              onClick={() => persist(true)}
            >
              Save &amp; New
            </Button>
          )}
          <Button type="button" onClick={() => persist(false)}>
            Save
          </Button>
        </div>
      </header>

      <div className="space-y-8 pb-16 max-w-6xl">
        <section>
          <SectionTitle>General Details</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="Party Name" required className="sm:col-span-2 lg:col-span-1">
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Enter name"
                required
              />
            </Field>
            <Field label="Mobile Number">
              <Input
                value={form.mobile}
                onChange={(e) => set("mobile", e.target.value)}
                placeholder="Enter mobile number"
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="Enter email"
              />
            </Field>
            <Field label="Opening Balance">
              <div className="flex rounded-md border border-input overflow-hidden">
                <span className="inline-flex items-center px-3 bg-muted text-sm border-r border-input">
                  ₹
                </span>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  className="border-0 rounded-none focus-visible:ring-0"
                  value={form.openingBalance}
                  onChange={(e) => set("openingBalance", e.target.value)}
                />
                <Select
                  value={form.openingBalanceSide}
                  onValueChange={(v) =>
                    set("openingBalanceSide", v as PartyFormState["openingBalanceSide"])
                  }
                >
                  <SelectTrigger className="w-[130px] border-0 border-l rounded-none focus:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="toCollect">To Collect</SelectItem>
                    <SelectItem value="toPay">To Pay</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Field>
            <Field label="GSTIN" className="sm:col-span-2">
              <div className="flex gap-2">
                <Input
                  value={form.gstin}
                  onChange={(e) => set("gstin", e.target.value)}
                  placeholder="ex: 29XXXXX9438X1XX"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0 bg-primary/10 text-primary hover:bg-primary/15"
                  onClick={handleGstinLookup}
                >
                  Get Details
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Note: You can auto populate party details from GSTIN.
              </p>
            </Field>
            <Field label="PAN Number">
              <Input
                value={form.pan}
                onChange={(e) => set("pan", e.target.value)}
                placeholder="Enter party PAN Number"
              />
            </Field>
            <Field label="Party Type" required>
              <Select
                value={form.kind}
                onValueChange={(v) => handleKindChange(v as PartyFormState["kind"])}
                disabled={mode === "edit"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="supplier">Supplier</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Party Category">
              <Input
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                placeholder="Search Categories"
                list="party-category-suggestions"
              />
              <datalist id="party-category-suggestions">
                {categorySuggestions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
          </div>
        </section>

        <section>
          <SectionTitle>Address</SectionTitle>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Field label="Billing Address">
              <Textarea
                value={form.billingAddress}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((f) => ({
                    ...f,
                    billingAddress: v,
                    shippingAddress: f.sameAsBilling ? v : f.shippingAddress,
                  }));
                }}
                placeholder="Enter billing address"
                rows={4}
              />
            </Field>
            <div className="space-y-2">
              <div className="flex items-center justify-end gap-2">
                <Checkbox
                  id="same-billing"
                  checked={form.sameAsBilling}
                  onCheckedChange={(c) => handleSameAsBilling(c === true)}
                />
                <Label htmlFor="same-billing" className="text-sm font-normal cursor-pointer">
                  Same as Billing address
                </Label>
              </div>
              <Field label="Shipping Address">
                <Textarea
                  value={form.sameAsBilling ? form.billingAddress : form.shippingAddress}
                  onChange={(e) => set("shippingAddress", e.target.value)}
                  placeholder="Enter shipping address"
                  rows={4}
                  disabled={form.sameAsBilling}
                />
              </Field>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 max-w-xl">
            <Field label="Credit Period">
              <div className="flex rounded-md border border-input overflow-hidden">
                <Input
                  type="number"
                  min={0}
                  className="border-0 rounded-none focus-visible:ring-0"
                  value={form.creditPeriodDays}
                  onChange={(e) => set("creditPeriodDays", e.target.value)}
                />
                <span className="inline-flex items-center px-3 bg-muted text-sm border-l border-input text-muted-foreground">
                  Days
                </span>
              </div>
            </Field>
            <Field label="Credit Limit">
              <div className="flex rounded-md border border-input overflow-hidden">
                <span className="inline-flex items-center px-3 bg-muted text-sm border-r border-input">
                  ₹
                </span>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  className="border-0 rounded-none focus-visible:ring-0"
                  value={form.creditLimit}
                  onChange={(e) => set("creditLimit", e.target.value)}
                />
              </div>
            </Field>
          </div>
        </section>

        <section>
          <SectionTitle>Contact Person Details</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="Contact Person Name" className="sm:col-span-2">
              <Input
                value={form.contactPersonName}
                onChange={(e) => set("contactPersonName", e.target.value)}
                placeholder="Ex: Ankit Mishra"
              />
            </Field>
            <Field label="Date of Birth">
              <Input
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => set("dateOfBirth", e.target.value)}
              />
            </Field>
          </div>
        </section>

        <section>
          <SectionTitle>Party Bank Account</SectionTitle>
          {form.bankAccounts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-10 px-4 text-center">
              <Building2 className="h-10 w-10 mx-auto text-muted-foreground/60 mb-3" />
              <p className="text-sm text-muted-foreground mb-3">
                Add party bank information to manage transactions
              </p>
              <Button
                type="button"
                variant="link"
                className="text-primary"
                onClick={() => {
                  setEditingBank(null);
                  setBankDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Bank Account
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {form.bankAccounts.map((acc) => (
                <div
                  key={acc.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-4"
                >
                  <div className="text-sm">
                    <p className="font-medium">
                      {acc.bankName ?? "Bank"} — {acc.accountNumber}
                    </p>
                    <p className="text-muted-foreground">
                      {[acc.accountHolderName, acc.ifsc, acc.upiId]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingBank(acc);
                        setBankDialogOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() =>
                        set(
                          "bankAccounts",
                          form.bankAccounts.filter((b) => b.id !== acc.id)
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="link"
                className="text-primary px-0"
                onClick={() => {
                  setEditingBank(null);
                  setBankDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Bank Account
              </Button>
            </div>
          )}
        </section>

        <section>
          <SectionTitle>Custom Field</SectionTitle>
          <div className="space-y-3">
            {form.customFields.map((cf, i) => (
              <div key={i} className="flex flex-wrap gap-2 items-end">
                <Field label="Field name" className="flex-1 min-w-[140px]">
                  <Input
                    value={cf.key}
                    onChange={(e) => {
                      const next = [...form.customFields];
                      next[i] = { ...next[i], key: e.target.value };
                      set("customFields", next);
                    }}
                    placeholder="Label"
                  />
                </Field>
                <Field label="Value" className="flex-1 min-w-[140px]">
                  <Input
                    value={cf.value}
                    onChange={(e) => {
                      const next = [...form.customFields];
                      next[i] = { ...next[i], value: e.target.value };
                      set("customFields", next);
                    }}
                    placeholder="Value"
                  />
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mb-0.5 text-destructive"
                  onClick={() =>
                    set(
                      "customFields",
                      form.customFields.filter((_, j) => j !== i)
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                set("customFields", [...form.customFields, { key: "", value: "" }])
              }
            >
              <Plus className="h-4 w-4 mr-1" />
              Add custom field
            </Button>
          </div>
        </section>
      </div>

      <AddBankAccountDialog
        open={bankDialogOpen}
        onOpenChange={setBankDialogOpen}
        initial={editingBank}
        onSubmit={(account) => {
          if (editingBank) {
            set(
              "bankAccounts",
              form.bankAccounts.map((b) => (b.id === account.id ? account : b))
            );
          } else {
            set("bankAccounts", [...form.bankAccounts, account]);
          }
          setEditingBank(null);
        }}
      />
    </div>
  );
}
