"use client";

import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { cn, formatInrTable } from "@/lib/utils";
import { balanceFlow } from "@/lib/party/ledger-math";
import type { Party } from "@/types/party";
import { ArrowDownRight, ArrowUpRight, Search } from "lucide-react";

type PartyListPanelProps = {
  parties: Array<Party & { balance: number }>;
  query: string;
  onQueryChange: (q: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
};

function idsMatch(a: string | null, b: string): boolean {
  if (!a) return false;
  if (a === b) return true;
  try {
    return decodeURIComponent(a) === decodeURIComponent(b);
  } catch {
    return false;
  }
}

export function PartyListPanel({
  parties,
  query,
  onQueryChange,
  selectedId,
  onSelect,
  className,
}: PartyListPanelProps) {
  const selectedRef = useRef<HTMLButtonElement | null>(null);

  const filtered = parties
    .filter((p) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.mobile?.toLowerCase().includes(q) ?? false) ||
        (p.category?.toLowerCase().includes(q) ?? false)
      );
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedId, filtered.length]);

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden border-r border-border bg-muted/30",
        className
      )}
    >
      <div className="shrink-0 p-3 border-b border-border bg-background">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search Party"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            className="pl-8 h-9 bg-background"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-2">
        {filtered.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground text-center">No parties match</p>
        ) : (
          filtered.map((p) => {
            const flow = balanceFlow(p.kind, p.balance);
            const active = idsMatch(selectedId, p.id);
            const kindLabel = p.kind === "customer" ? "Customer" : "Supplier";
            return (
              <button
                key={p.id}
                ref={active ? selectedRef : undefined}
                type="button"
                onClick={() => onSelect(p.id)}
                className={cn(
                  "relative w-full rounded-lg border p-3 text-left transition-colors overflow-hidden",
                  active
                    ? "border-neutral-200 border-r-[5px] border-r-violet-600 bg-violet-50 shadow-sm dark:border-border dark:border-r-violet-500 dark:bg-violet-950/30"
                    : "border-neutral-200 bg-white hover:border-violet-300 hover:bg-violet-50/40 dark:border-border dark:bg-card dark:hover:bg-violet-950/15"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-sm truncate",
                        active ? "font-semibold text-foreground" : "font-medium text-foreground"
                      )}
                    >
                      {p.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{kindLabel}</p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0 tabular-nums text-sm font-medium">
                    {flow === "in" && (
                      <ArrowDownRight className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    )}
                    {flow === "out" && (
                      <ArrowUpRight className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                    )}
                    <span
                      className={cn(
                        flow === "in" && "text-emerald-700 dark:text-emerald-400",
                        flow === "out" && "text-rose-700 dark:text-rose-400"
                      )}
                    >
                      {formatInrTable(p.balance)}
                    </span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
