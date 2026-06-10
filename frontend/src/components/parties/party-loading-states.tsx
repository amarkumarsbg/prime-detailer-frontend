"use client";

import type { ReactNode } from "react";
import { Loader2, Users } from "lucide-react";
import { cn } from "@/lib/utils";

function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={cn("h-10 w-10 animate-spin text-violet-600 dark:text-violet-400", className)}
    />
  );
}

export function PartyDetailLoadingShell() {
  return (
    <div className="flex h-[calc(100dvh-7.25rem)] max-h-[calc(100dvh-7.25rem)] items-center justify-center rounded-lg border border-border bg-background md:h-[calc(100dvh-8rem)] md:max-h-[calc(100dvh-8rem)]">
      <Spinner />
    </div>
  );
}

export function PartiesListLoading() {
  return (
    <div className="flex h-[calc(100dvh-7.25rem)] max-h-[calc(100dvh-7.25rem)] items-center justify-center md:h-[calc(100dvh-8rem)] md:max-h-[calc(100dvh-8rem)]">
      <Spinner />
    </div>
  );
}

type PartyEmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function PartyEmptyState({ title, description, action }: PartyEmptyStateProps) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Users className="h-7 w-7 text-muted-foreground" />
      </div>
      <div className="space-y-1 max-w-sm">
        <p className="text-base font-semibold text-foreground">{title}</p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
