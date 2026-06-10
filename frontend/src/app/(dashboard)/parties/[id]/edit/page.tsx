import { EditPartyPageClient } from "@/components/parties/edit-party-page-client";
import { PartyDetailLoadingShell } from "@/components/parties/party-loading-states";
import { Suspense } from "react";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditPartyPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <Suspense fallback={<PartyDetailLoadingShell />}>
      <EditPartyPageClient partyId={decodeURIComponent(id)} />
    </Suspense>
  );
}
