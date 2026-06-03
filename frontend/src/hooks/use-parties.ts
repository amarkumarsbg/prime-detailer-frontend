"use client";

import { useCallback, useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut, ApiError } from "@/lib/api-client";
import type { Party, PartyKind, PartyWithBalance } from "@/types/party";

export function useParties(): {
  parties: Party[];
  partiesLoading: boolean;
  partiesError: string | null;
  refreshParties: () => Promise<void>;
  upsertParty: (id: string | null, input: Partial<Party> & { name: string; kind: PartyKind }) => Promise<Party | null>;
  removeParty: (id: string) => Promise<void>;
} {
  const [parties, setParties] = useState<Party[]>([]);
  const [partiesLoading, setPartiesLoading] = useState(true);
  const [partiesError, setPartiesError] = useState<string | null>(null);

  const refreshParties = useCallback(async () => {
    setPartiesLoading(true);
    setPartiesError(null);
    try {
      const data = await apiGet<{ parties: Party[] | PartyWithBalance[] }>("/api/parties?balance=true");
      setParties(data.parties);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Failed to load parties";
      setPartiesError(message);
    } finally {
      setPartiesLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshParties();
  }, [refreshParties]);

  const upsertParty = useCallback(
    async (id: string | null, input: Partial<Party> & { name: string; kind: PartyKind }) => {
      try {
        const data = id
          ? await apiPut<{ party: Party }>(`/api/parties/${encodeURIComponent(id)}`, input)
          : await apiPost<{ party: Party }>("/api/parties", input);
        await refreshParties();
        return data.party;
      } catch (e) {
        const message = e instanceof ApiError ? e.message : "Failed to save party";
        setPartiesError(message);
        return null;
      }
    },
    [refreshParties]
  );

  const removeParty = useCallback(
    async (id: string) => {
      try {
        await apiDelete(`/api/parties/${encodeURIComponent(id)}`);
        await refreshParties();
      } catch (e) {
        const message = e instanceof ApiError ? e.message : "Failed to remove party";
        setPartiesError(message);
      }
    },
    [refreshParties]
  );

  return { parties, partiesLoading, partiesError, refreshParties, upsertParty, removeParty };
}

export function getPartyById(parties: Party[], id: string): Party | undefined {
  return parties.find((p) => p.id === id);
}
