import type { Party, PartyShippingAddress } from "@/types/party";

export function formatShippingAddressSummary(addr: PartyShippingAddress): string {
  const parts = [addr.street, addr.city, addr.state, addr.pincode].filter(
    (p) => p && String(p).trim()
  );
  const line = parts.join(", ");
  return line ? `${addr.name} — ${line}` : addr.name;
}

export function formatShippingAddressShort(addr: PartyShippingAddress): string {
  const parts = [addr.street, addr.city, addr.state, addr.pincode].filter(
    (p) => p && String(p).trim()
  );
  return parts.join(", ");
}

/** List row: bold name + address line or "No Address". */
export function shippingAddressListLines(addr: PartyShippingAddress): {
  name: string;
  subtitle: string;
} {
  const detail = formatShippingAddressShort(addr);
  const hasDetail = Boolean(detail.trim());
  return {
    name: addr.name,
    subtitle: hasDetail ? detail : "No Address",
  };
}

export function getPartyShippingAddresses(party: Party): PartyShippingAddress[] {
  if (party.shippingAddresses && party.shippingAddresses.length > 0) {
    return party.shippingAddresses;
  }
  if (party.shippingAddress?.trim()) {
    return [
      {
        id: "legacy-shipping",
        name: party.name,
        street: party.shippingAddress,
        isDefault: true,
      },
    ];
  }
  return [];
}

export function primaryShippingDisplay(party: Party): string | undefined {
  const list = getPartyShippingAddresses(party);
  const def = list.find((a) => a.isDefault) ?? list[0];
  if (!def) return party.shippingAddress;
  const { subtitle } = shippingAddressListLines(def);
  return subtitle === "No Address" ? undefined : subtitle;
}

export function partyPatchFromShippingAddresses(
  party: Party,
  addresses: PartyShippingAddress[]
): Partial<Party> {
  const normalized =
    addresses.length === 0
      ? []
      : addresses.some((a) => a.isDefault)
        ? addresses
        : addresses.map((a, i) => ({ ...a, isDefault: i === 0 }));

  const def = normalized.find((a) => a.isDefault) ?? normalized[0];
  return {
    shippingAddresses: normalized,
    shippingAddress: def
      ? formatShippingAddressShort(def) || undefined
      : undefined,
  };
}
