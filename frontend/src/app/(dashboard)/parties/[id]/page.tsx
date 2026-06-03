import { Suspense } from "react";
import { PartyDetailClient } from "@/components/parties/party-detail-client";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PartyDetailPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
          Loading party…
        </div>
      }
    >
      <PartyDetailClient partyId={decodeURIComponent(id)} />
    </Suspense>
  );
}
