"use client";

import { CheckCircle2, Clock, Timer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ServiceTimerDeliverySnapshot } from "@/types";

function formatDurationMs(ms: number): string {
  const totalS = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalS / 60);
  const s = totalS % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
  }
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatOverdue(ms: number): string {
  const totalS = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalS / 60);
  const s = totalS % 60;
  const h = Math.floor(m / 60);
  if (h >= 1) {
    const rm = m % 60;
    return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
  }
  return `${m}m ${s}s`;
}

export interface ServiceTimerDeliverySummaryProps {
  snapshot: ServiceTimerDeliverySnapshot;
}

export function ServiceTimerDeliverySummary({ snapshot }: ServiceTimerDeliverySummaryProps) {
  const onTime = snapshot.overdueMs <= 0;
  const pauseMin = Math.round(snapshot.totalPauseMs / 60_000);
  const bufferUsed =
    snapshot.bufferTotalMinutes > 0
      ? Math.round(
          ((snapshot.bufferTotalMinutes - snapshot.bufferRemainingMinutes) /
            snapshot.bufferTotalMinutes) *
            100
        )
      : 0;

  return (
    <Card className="border-border/80 shadow-sm overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 font-semibold">
          <Timer className="w-5 h-5 text-muted-foreground shrink-0" aria-hidden />
          Service timer — delivery summary
        </CardTitle>
        <p className="text-xs text-muted-foreground font-normal">
          Recorded at {new Date(snapshot.closedAt).toLocaleString()}
        </p>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div
          className={
            onTime
              ? "rounded-lg border border-emerald-200 bg-emerald-50/80 dark:bg-emerald-950/25 dark:border-emerald-800 px-3 py-2.5 flex items-start gap-2"
              : "rounded-lg border border-red-200 bg-red-50/80 dark:bg-red-950/25 dark:border-red-900/60 px-3 py-2.5 flex items-start gap-2"
          }
        >
          {onTime ? (
            <>
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden />
              <div>
                <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
                  Completed within allocated service time
                </p>
                <p className="text-xs text-emerald-800/90 dark:text-emerald-300/90 mt-0.5">
                  Active work {formatDurationMs(snapshot.activeElapsedMs)} · Allocated{" "}
                  {snapshot.allocatedMinutes} min
                </p>
              </div>
            </>
          ) : (
            <>
              <Clock className="w-5 h-5 text-red-600 shrink-0 mt-0.5" aria-hidden />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  Over service allocation by {formatOverdue(snapshot.overdueMs)}
                </p>
                <p className="text-xs text-red-800/90 dark:text-red-300/90 mt-0.5">
                  Active work {formatDurationMs(snapshot.activeElapsedMs)} · Allocated{" "}
                  {snapshot.allocatedMinutes} min
                </p>
              </div>
            </>
          )}
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <div className="rounded-md border bg-muted/30 px-3 py-2">
            <dt className="text-xs text-muted-foreground">Total pause time</dt>
            <dd className="font-medium tabular-nums">
              {pauseMin} {pauseMin === 1 ? "minute" : "minutes"}
            </dd>
          </div>
          <div className="rounded-md border bg-muted/30 px-3 py-2">
            <dt className="text-xs text-muted-foreground">Buffer at delivery</dt>
            <dd className="font-medium">
              {snapshot.bufferRemainingMinutes} / {snapshot.bufferTotalMinutes} min left
              {snapshot.bufferTotalMinutes > 0 ? (
                <span className="text-muted-foreground font-normal"> · {bufferUsed}% used</span>
              ) : null}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
