import type {
  OpeningBalanceSide,
  Party,
  PartyBankAccount,
  PartyCustomField,
  PartyKind,
} from "@/types/party";

export type PartyFormState = {
  name: string;
  mobile: string;
  email: string;
  openingBalance: string;
  openingBalanceSide: OpeningBalanceSide;
  gstin: string;
  pan: string;
  kind: PartyKind;
  category: string;
  billingAddress: string;
  shippingAddress: string;
  sameAsBilling: boolean;
  creditPeriodDays: string;
  creditLimit: string;
  contactPersonName: string;
  dateOfBirth: string;
  bankAccounts: PartyBankAccount[];
  customFields: PartyCustomField[];
};

export function defaultOpeningSide(kind: PartyKind): OpeningBalanceSide {
  return kind === "customer" ? "toCollect" : "toPay";
}

export function emptyPartyForm(kind: PartyKind = "customer"): PartyFormState {
  return {
    name: "",
    mobile: "",
    email: "",
    openingBalance: "0",
    openingBalanceSide: defaultOpeningSide(kind),
    gstin: "",
    pan: "",
    kind,
    category: "",
    billingAddress: "",
    shippingAddress: "",
    sameAsBilling: true,
    creditPeriodDays: "30",
    creditLimit: "0",
    contactPersonName: "",
    dateOfBirth: "",
    bankAccounts: [],
    customFields: [],
  };
}

export function partyToForm(party: Party): PartyFormState {
  return {
    name: party.name,
    mobile: party.mobile ?? "",
    email: party.email ?? "",
    openingBalance: String(party.openingBalance ?? 0),
    openingBalanceSide:
      party.openingBalanceSide ?? defaultOpeningSide(party.kind),
    gstin: party.gstin ?? "",
    pan: party.pan ?? "",
    kind: party.kind,
    category: party.category ?? "",
    billingAddress: party.billingAddress ?? "",
    shippingAddress: party.shippingAddress ?? "",
    sameAsBilling:
      !party.shippingAddress ||
      party.shippingAddress === (party.billingAddress ?? ""),
    creditPeriodDays: String(party.creditPeriodDays ?? 30),
    creditLimit: String(party.creditLimit ?? 0),
    contactPersonName: party.contactPersonName ?? "",
    dateOfBirth: party.dateOfBirth ?? "",
    bankAccounts: party.bankAccounts ?? [],
    customFields: party.customFields ?? [],
  };
}

export function formToPartyPatch(form: PartyFormState): Partial<Party> {
  const shipping = form.sameAsBilling
    ? form.billingAddress.trim() || undefined
    : form.shippingAddress.trim() || undefined;

  return {
    name: form.name.trim(),
    kind: form.kind,
    mobile: form.mobile.trim() || undefined,
    email: form.email.trim() || undefined,
    openingBalance: Math.max(0, Number(form.openingBalance) || 0),
    openingBalanceSide: form.openingBalanceSide,
    gstin: form.gstin.trim() || undefined,
    pan: form.pan.trim() || undefined,
    category: form.category.trim() || undefined,
    billingAddress: form.billingAddress.trim() || undefined,
    shippingAddress: shipping,
    creditPeriodDays: Number(form.creditPeriodDays) || undefined,
    creditLimit: Number(form.creditLimit) || undefined,
    contactPersonName: form.contactPersonName.trim() || undefined,
    dateOfBirth: form.dateOfBirth.trim() || undefined,
    bankAccounts: form.bankAccounts,
    customFields: form.customFields.filter((f) => f.key.trim() || f.value.trim()),
    vendorKey: form.kind === "supplier" ? form.name.trim() : undefined,
  };
}
