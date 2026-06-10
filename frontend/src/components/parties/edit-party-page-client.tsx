"use client";

import { PartyFormPage } from "@/components/parties/party-form-page";
import {
  PartyDetailLoadingShell,
  PartyEmptyState,
} from "@/components/parties/party-loading-states";
import { useParty } from "@/hooks/use-party";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type EditPartyPageClientProps = {
  partyId: string;
};

export function EditPartyPageClient({ partyId }: EditPartyPageClientProps) {
  const { party, partyLoading, partyError, partyNotFound, refreshParty } = useParty(partyId);

  if (partyLoading) {
    return <PartyDetailLoadingShell />;
  }

  if (partyError) {
    return (
      <PartyEmptyState
        title="Could not load party"
        description={partyError}
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={() => void refreshParty()}>Try again</Button>
            <Button variant="outline" asChild>
              <Link href="/parties">Back to parties</Link>
            </Button>
          </div>
        }
      />
    );
  }

  if (partyNotFound || !party) {
    return (
      <PartyEmptyState
        title="Party not found"
        description="This party may have been removed or the link is incorrect."
        action={
          <Button variant="outline" asChild>
            <Link href="/parties">Back to parties</Link>
          </Button>
        }
      />
    );
  }

  return <PartyFormPage key={party.id} mode="edit" party={party} />;
}
