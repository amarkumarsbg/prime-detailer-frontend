"use client";

import { useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Pause,
  Play,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { TimerAdjustment } from "@/types";
import type { UseJobTimerResult } from "@/hooks/use-job-timer";

export interface TimerControlsBufferCardProps {
  timer: UseJobTimerResult;
  timerIsPaused: boolean;
  allocatedMinutes: number;
  canPauseResume: boolean;
  canAdjustBuffer: boolean;
  onPause: () => void;
  onResume: () => void;
  onBufferDelta: (delta: number) => void;
  bufferAdjustments?: TimerAdjustment[];
}

function formatAlloc(m: number): string {
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return rm > 0 ? `${h}h ${rm}m allocated` : `${h}h allocated`;
  }
  return `${m} min allocated`;
}

export function TimerControlsBufferCard({
  timer,
  timerIsPaused,
  allocatedMinutes,
  canPauseResume,
  canAdjustBuffer,
  onPause,
  onResume,
  onBufferDelta,
  bufferAdjustments = [],
}: TimerControlsBufferCardProps) {
  const [logOpen, setLogOpen] = useState(false);

  if (!timer.active) return null;

  const activeMin = Math.floor(timer.activeElapsedMs / 60_000);
  const activeSec = Math.floor((timer.activeElapsedMs % 60_000) / 1000);

  return (
    <Card className="border-border/80 shadow-sm overflow-hidden">
      <CardHeader className="pb-3 space-y-1">
        <CardTitle className="text-base flex items-center gap-2 font-semibold">
          <Clock className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden />
          Timer Controls &amp; Buffer Management
        </CardTitle>
        <p className="text-sm text-muted-foreground font-normal">
          {formatAlloc(allocatedMinutes)}
          <span className="text-muted-foreground/80">
            {" "}
            · Elapsed {activeMin}m {activeSec}s
          </span>
        </p>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {timer.isOverdue && (
          <div
            className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-2 min-w-0 text-red-700 dark:text-red-400">
              <XCircle className="w-5 h-5 shrink-0" aria-hidden />
              <span className="text-sm font-medium">
                Overdue: Overdue by {timer.overdueLabel}
              </span>
            </div>
            {timerIsPaused && (
              <Badge variant="warning" className="shrink-0 gap-1 border border-amber-400/60">
                <Pause className="w-3 h-3" aria-hidden />
                Paused
              </Badge>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
          {timerIsPaused ? (
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"
              disabled={!canPauseResume}
              onClick={onResume}
            >
              <Play className="w-4 h-4 mr-2" />
              Resume Timer
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto border-amber-500/50"
              disabled={!canPauseResume}
              onClick={onPause}
            >
              <Pause className="w-4 h-4 mr-2" />
              Pause Timer
            </Button>
          )}

          {timerIsPaused && (
            <div
              className={cn(
                "inline-flex items-center gap-2 rounded-md border border-amber-400/70",
                "bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-600/50"
              )}
            >
              <Clock className="w-4 h-4 shrink-0 opacity-80" aria-hidden />
              <span>Paused: {timer.pausedManualLabel} (manual)</span>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-orange-300 bg-orange-50 dark:bg-orange-950/25 dark:border-orange-800/80 px-3 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" aria-hidden />
            <div>
              <p className="font-semibold text-orange-900 dark:text-orange-200">
                Buffer: {timer.bufferRemaining} min remaining
              </p>
              <p className="text-sm text-orange-800/90 dark:text-orange-300/90">
                {timer.bufferTotal} min total · {timer.bufferUsedPercent}% used
              </p>
            </div>
          </div>
          <div className="w-full sm:w-40 shrink-0 sm:pt-1">
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden" aria-hidden>
              <div
                className="h-full rounded-full bg-orange-500 transition-[width] duration-500"
                style={{ width: `${Math.min(100, timer.bufferUsedPercent)}%` }}
              />
            </div>
          </div>
        </div>

        {canAdjustBuffer && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground mr-1">Buffer adjust (supervisor):</span>
            <Button type="button" size="sm" variant="secondary" onClick={() => onBufferDelta(-5)}>
              −5 min
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => onBufferDelta(5)}>
              +5 min
            </Button>
          </div>
        )}

        {bufferAdjustments.length > 0 && (
          <Collapsible open={logOpen} onOpenChange={setLogOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground -ml-2">
                {logOpen ? (
                  <ChevronUp className="w-4 h-4 mr-1" />
                ) : (
                  <ChevronDown className="w-4 h-4 mr-1" />
                )}
                Buffer adjustment log ({bufferAdjustments.length})
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 pl-1 pt-1 border-l-2 border-muted ml-1">
              {bufferAdjustments.slice(-12).reverse().map((a, i) => (
                <p key={`${a.adjustedAt}-${i}`} className="text-xs text-muted-foreground">
                  {a.adjustedBy}: {a.deltaMinutes > 0 ? "+" : ""}
                  {a.deltaMinutes} min · {new Date(a.adjustedAt).toLocaleString()}
                </p>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        <p className="text-xs text-muted-foreground pt-1">
          Total pause time: {timer.totalPauseMinutesRounded}{" "}
          {timer.totalPauseMinutesRounded === 1 ? "minute" : "minutes"}
        </p>
      </CardContent>
    </Card>
  );
}
