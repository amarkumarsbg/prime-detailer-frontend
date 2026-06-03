"use client";

import { useState } from "react";
import { Briefcase, CreditCard, FileText } from "lucide-react";
import { ManageShippingAddressesDialog } from "@/components/parties/manage-shipping-addresses-dialog";
import { signedOpeningBalance } from "@/lib/party/ledger-math";
import { primaryShippingDisplay } from "@/lib/party/party-shipping";
import { cn, formatInrTable } from "@/lib/utils";
import type { Party } from "@/types/party";

type PartyProfileTabProps = {
  party: Party;
  onUpdateParty: (patch: Partial<Party>) => void;
};

function displayValue(value?: string | number | null): string {
  if (value === undefined || value === null) return "—";
  const s = String(value).trim();
  return s.length > 0 ? s : "—";
}

function partyTypeLabel(kind: Party["kind"]): string {
  return kind === "customer" ? "Customer" : "Supplier";
}

function ProfileSectionCard({
  icon: Icon,
  title,
  children,
  footer,
  className,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-background shadow-sm",
        className
      )}
    >
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-3">
        <Icon className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="px-4 py-4">{children}</div>
      {footer ? (
        <div className="border-t border-border bg-background px-4 py-3">{footer}</div>
      ) : null}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground break-words">
        {displayValue(value)}
      </p>
    </div>
  );
}

export function PartyProfileTab({ party, onUpdateParty }: PartyProfileTabProps) {
  const [manageShippingOpen, setManageShippingOpen] = useState(false);

  const openingBalance = formatInrTable(Math.abs(signedOpeningBalance(party)));
  const creditPeriod = party.creditPeriodDays
    ? `${party.creditPeriodDays} Days`
    : undefined;
  const creditLimit =
    party.creditLimit !== undefined && party.creditLimit !== null
      ? formatInrTable(party.creditLimit)
      : undefined;
  const shippingDisplay = primaryShippingDisplay(party);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ProfileSectionCard icon={FileText} title="General Details">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DetailField label="Party Name" value={party.name} />
            <DetailField label="Party Type" value={partyTypeLabel(party.kind)} />
            <DetailField label="Mobile Number" value={party.mobile} />
            <DetailField label="Party Category" value={party.category} />
            <DetailField label="Email" value={party.email} />
            <DetailField label="Opening Balance" value={openingBalance} />
          </div>
        </ProfileSectionCard>

        <ProfileSectionCard
          icon={Briefcase}
          title="Business Details"
          footer={
            <button
              type="button"
              className="text-sm font-medium text-blue-600 hover:text-blue-700 no-underline hover:no-underline dark:text-blue-500"
              onClick={() => setManageShippingOpen(true)}
            >
              Manage Shipping Addresses
            </button>
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DetailField label="GSTIN" value={party.gstin} />
            <DetailField label="PAN Number" value={party.pan} />
            <DetailField label="Billing Address" value={party.billingAddress} />
            <DetailField label="Shipping Address" value={shippingDisplay} />
          </div>
        </ProfileSectionCard>

        <ProfileSectionCard icon={CreditCard} title="Credit Details" className="md:max-w-none">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DetailField label="Credit Period" value={creditPeriod} />
            <DetailField label="Credit Limit" value={creditLimit} />
          </div>
        </ProfileSectionCard>
      </div>

      <ManageShippingAddressesDialog
        open={manageShippingOpen}
        onOpenChange={setManageShippingOpen}
        party={party}
        onSave={onUpdateParty}
      />
    </>
  );
}
