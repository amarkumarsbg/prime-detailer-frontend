"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { PartyFormPage } from "@/components/parties/party-form-page";
import { useParties, getPartyById } from "@/hooks/use-parties";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function EditPartyPage() {
  const params = useParams();
  const id = decodeURIComponent(String(params.id ?? ""));
  const { parties } = useParties();
  const party = useMemo(() => getPartyById(parties, id), [parties, id]);

  if (!party) {
    return (
      <div className="py-12 text-center space-y-4">
        <p className="text-muted-foreground">Party not found.</p>
        <Button variant="outline" asChild>
          <Link href="/parties">Back to parties</Link>
        </Button>
      </div>
    );
  }

  return <PartyFormPage key={party.id} mode="edit" party={party} />;
}
