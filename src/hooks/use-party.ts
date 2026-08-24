"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, ApiError } from "@/lib/api-client";
import type { Party } from "@/types/party";

export function useParty(partyId: string): {
  party: Party | null;
  partyLoading: boolean;
  partyError: string | null;
  partyNotFound: boolean;
  refreshParty: () => Promise<void>;
} {
  const [party, setParty] = useState<Party | null>(null);
  const [partyLoading, setPartyLoading] = useState(true);
  const [partyError, setPartyError] = useState<string | null>(null);
  const [partyNotFound, setPartyNotFound] = useState(false);

  const refreshParty = useCallback(async () => {
    const id = decodeURIComponent(partyId);
    if (!id) {
      setParty(null);
      setPartyNotFound(true);
      setPartyLoading(false);
      return;
    }

    setPartyLoading(true);
    setPartyError(null);
    setPartyNotFound(false);

    try {
      const data = await apiGet<{ party: Party }>(`/api/parties/${encodeURIComponent(id)}`);
      setParty(data.party);
    } catch (e) {
      setParty(null);
      if (e instanceof ApiError && e.status === 404) {
        setPartyNotFound(true);
      } else {
        setPartyError(e instanceof ApiError ? e.message : "Failed to load party");
      }
    } finally {
      setPartyLoading(false);
    }
  }, [partyId]);

  useEffect(() => {
    void refreshParty();
  }, [refreshParty]);

  return { party, partyLoading, partyError, partyNotFound, refreshParty };
}
