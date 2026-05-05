"use client";

import { cn } from "@/lib/utils";

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-muted/50 px-4 py-3 flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="px-4 py-3 border-t border-border flex gap-4">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border p-5">
          <div className="flex items-center gap-4">
            <Skeleton className="w-12 h-12 rounded-xl" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="rounded-xl border border-border p-6">
        <div className="flex items-center gap-6">
          <Skeleton className="w-20 h-20 rounded-full" />
          <div className="space-y-3 flex-1">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-24" />
            <div className="flex gap-8">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border p-5">
            <div className="flex items-center gap-4">
              <Skeleton className="w-12 h-12 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-10" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      <CardGridSkeleton />
      <TableSkeleton />
    </div>
  );
}

function KpiTileSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-36 max-w-full" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
      </div>
    </div>
  );
}

/** Matches dashboard layout: header, alerts, KPI bands, funnel, quick actions, branches, activity, table. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44 sm:w-48" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="h-10 w-full sm:w-[11.5rem]" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <Skeleton className="h-10 w-56 rounded-lg" />
        <Skeleton className="h-10 w-52 rounded-lg" />
      </div>

      <div className="space-y-5">
        <div>
          <Skeleton className="mb-3 h-3 w-40" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <KpiTileSkeleton key={i} />
            ))}
          </div>
        </div>
        <div>
          <Skeleton className="mb-3 h-3 w-24" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <KpiTileSkeleton key={i} />
            ))}
          </div>
        </div>
        <div>
          <Skeleton className="mb-3 h-3 w-28" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <KpiTileSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-row items-center justify-between border-b border-border/60 p-4 sm:p-6 sm:pb-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-12" />
        </div>
        <div className="p-4 pt-0 sm:p-6 sm:pt-0">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="min-h-28 rounded-xl" />
            ))}
          </div>
        </div>
      </div>

      <div>
        <Skeleton className="mb-3 h-3 w-28" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="min-h-[140px] rounded-xl border border-border p-5">
              <div className="flex h-full min-h-[108px] flex-col items-center justify-center gap-3">
                <Skeleton className="h-11 w-11 rounded-xl" />
                <div className="w-full space-y-2 text-center">
                  <Skeleton className="mx-auto h-4 w-32" />
                  <Skeleton className="mx-auto h-3 w-40" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Skeleton className="mb-3 h-5 w-64" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border p-4 sm:p-6">
            <Skeleton className="mb-4 h-5 w-40" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border p-4 sm:p-6">
            <Skeleton className="mb-4 h-5 w-44" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border">
        <div className="flex flex-row flex-wrap items-center justify-between gap-2 border-b border-border/60 p-4 sm:p-6 sm:pb-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-9 w-36 rounded-md" />
        </div>
        <div className="p-4 pt-0 sm:p-6 sm:pt-0">
          <TableSkeleton rows={6} cols={6} />
        </div>
      </div>
    </div>
  );
}

export { Skeleton };
