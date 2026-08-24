import { Suspense } from "react";
import { PartyDetailClient } from "@/components/parties/party-detail-client";
import { PartyDetailLoadingShell } from "@/components/parties/party-loading-states";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PartyDetailPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <Suspense fallback={<PartyDetailLoadingShell />}>
      <PartyDetailClient partyId={decodeURIComponent(id)} />
    </Suspense>
  );
}
