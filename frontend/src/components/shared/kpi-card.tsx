"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type KPICardTone =
  | "emerald"
  | "blue"
  | "amber"
  | "violet"
  | "orange"
  | "slate"
  | "rose";

const toneIconClass: Record<KPICardTone, string> = {
  emerald:
    "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400",
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400",
  amber:
    "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400",
  violet:
    "bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400",
  orange:
    "bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400",
  slate:
    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  rose: "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400",
};

/** Full-card wash: top-left tint → light / card base (accounting-style KPI tiles). */
const toneSurfaceClass: Record<KPICardTone, string> = {
  emerald:
    "border-emerald-200/65 bg-gradient-to-br from-emerald-100 via-white to-background shadow-sm shadow-emerald-900/[0.04] dark:border-emerald-800/55 dark:from-emerald-950/45 dark:via-card dark:to-card dark:shadow-none",
  blue:
    "border-blue-200/65 bg-gradient-to-br from-blue-100 via-white to-background shadow-sm shadow-blue-900/[0.04] dark:border-blue-800/55 dark:from-blue-950/45 dark:via-card dark:to-card dark:shadow-none",
  amber:
    "border-amber-200/65 bg-gradient-to-br from-amber-100 via-white to-background shadow-sm shadow-amber-900/[0.04] dark:border-amber-800/55 dark:from-amber-950/45 dark:via-card dark:to-card dark:shadow-none",
  violet:
    "border-violet-200/65 bg-gradient-to-br from-violet-100 via-white to-background shadow-sm shadow-violet-900/[0.04] dark:border-violet-800/55 dark:from-violet-950/45 dark:via-card dark:to-card dark:shadow-none",
  orange:
    "border-orange-200/65 bg-gradient-to-br from-orange-100 via-white to-background shadow-sm shadow-orange-900/[0.04] dark:border-orange-800/55 dark:from-orange-950/45 dark:via-card dark:to-card dark:shadow-none",
  slate:
    "border-slate-200/70 bg-gradient-to-br from-slate-100 via-white to-background shadow-sm dark:border-slate-700/60 dark:from-slate-900/50 dark:via-card dark:to-card dark:shadow-none",
  rose:
    "border-rose-200/65 bg-gradient-to-br from-rose-100 via-white to-background shadow-sm shadow-rose-900/[0.04] dark:border-rose-800/55 dark:from-rose-950/45 dark:via-card dark:to-card dark:shadow-none",
};

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  /** e.g. "All branches" under the metric (competitor-style scope). */
  footerNote?: string;
  icon: LucideIcon;
  trend?: { value: number; isPositive: boolean };
  className?: string;
  tone?: KPICardTone;
  variant?: "default" | "featured";
}

export function KPICard({
  title,
  value,
  subtitle,
  footerNote,
  icon: Icon,
  trend,
  className,
  tone,
  variant = "default",
}: KPICardProps) {
  const isFeatured = variant === "featured";

  return (
    <Card
      className={cn(
        "flex h-full min-h-0 flex-col translate-y-0 transform-gpu backface-hidden will-change-transform",
        "transition-[transform,box-shadow] duration-[12000ms] ease-[cubic-bezier(0.45,0,0.55,1)]",
        "motion-safe:hover:-translate-y-1 hover:shadow-lg dark:hover:shadow-md",
        tone ? toneSurfaceClass[tone] : "hover:shadow-md dark:hover:shadow-md",
        isFeatured &&
          !tone &&
          "border-emerald-200/70 shadow-sm dark:border-emerald-900/60",
        className
      )}
    >
      {/* Plain div: CardContent forces pt-0 on sm+ and pins content to the top. */}
      <div className="flex min-h-0 flex-1 flex-col justify-center p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p
              className={cn(
                "font-bold tracking-tight",
                isFeatured ? "text-3xl" : "text-2xl"
              )}
            >
              {value}
            </p>
            {(subtitle || trend) && (
              <div className="flex flex-wrap items-center gap-2">
                {trend && (
                  <span
                    className={cn(
                      "text-xs font-medium px-1.5 py-0.5 rounded",
                      trend.isPositive
                        ? "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950"
                        : "text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-950"
                    )}
                  >
                    {trend.isPositive ? "+" : ""}
                    {trend.value}%
                  </span>
                )}
                {subtitle && (
                  <span className="text-xs text-muted-foreground">
                    {subtitle}
                  </span>
                )}
              </div>
            )}
            {footerNote && (
              <p className="text-xs text-muted-foreground pt-0.5">{footerNote}</p>
            )}
          </div>
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-xl",
              isFeatured ? "h-12 w-12" : "h-11 w-11",
              tone
                ? toneIconClass[tone]
                : "bg-primary/10 text-primary"
            )}
          >
            <Icon className={isFeatured ? "h-6 w-6" : "h-5 w-5"} />
          </div>
        </div>
      </div>
    </Card>
  );
}
