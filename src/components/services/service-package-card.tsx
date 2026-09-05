"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatServiceDurationLabel } from "@/lib/service-duration";
import { formatCurrency } from "@/lib/utils";
import type { ServiceCatalogItem } from "@/types";
import {
  Package,
  Globe,
  Clock,
  Pencil,
  Trash2,
  Boxes,
  Sparkles,
} from "lucide-react";
import { isGstRegistered } from "@/lib/gst-tax";
import { useSettingsStore } from "@/store/settings-store";

function gstDisplay(s: ServiceCatalogItem): string {
  if (s.gstApplicable === false) return "No GST";
  const p = s.gstPercent ?? 18;
  return `GST ${p.toFixed(2)}%`;
}

export function ServicePackageCard({
  service,
  onEdit,
  onDelete,
}: {
  service: ServiceCatalogItem;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const gstOn = isGstRegistered(useSettingsStore((s) => s.gstRegistrationStatus));
  const scope = service.scope ?? "GLOBAL";
  const sp = service.segmentPricing;

  return (
    <Card className="overflow-hidden border-border/80 shadow-sm transition-shadow duration-300 hover:shadow-md">
      <CardContent className="p-3.5 sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 sm:h-10 sm:w-10">
              <Package className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold leading-snug line-clamp-2">
                {service.name}
              </h3>
              <Badge
                variant="secondary"
                className="mt-1.5 max-w-full truncate text-[10px] font-normal bg-muted text-muted-foreground"
              >
                {service.category}
              </Badge>
            </div>
          </div>
          <Badge className="shrink-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300">
            {service.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5">
          {service.isHighEnd && (
            <Badge
              variant="outline"
              className="gap-1 border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/50 dark:text-amber-200"
            >
              <Sparkles className="h-3 w-3 shrink-0" />
              High-end
            </Badge>
          )}
          <Badge
            variant="outline"
            className={
              scope === "GLOBAL"
                ? "gap-1 border-blue-200 bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                : "gap-1 border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
            }
          >
            <Globe className="h-3 w-3" />
            {scope === "GLOBAL" ? "Global" : "Branch"}
          </Badge>
          {gstOn ? (
            <Badge variant="secondary" className="text-[10px] font-normal">
              {gstDisplay(service)}
            </Badge>
          ) : null}
          <Badge variant="secondary" className="gap-1 text-[10px] font-normal">
            <Clock className="h-3 w-3" />
            {formatServiceDurationLabel(service)}
          </Badge>
        </div>

        {service.description ? (
          <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:mb-4 sm:line-clamp-3">
            {service.description}
          </p>
        ) : null}

        <div className="mb-3 rounded-lg bg-muted/40 p-2.5 sm:mb-4 sm:p-3">
          <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Pricing</span>
            {gstOn && service.gstApplicable !== false ? (
              <span className="font-normal normal-case">
                + {service.gstPercent ?? 18}% GST
              </span>
            ) : null}
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {(
              [
                { key: "HATCHBACK" as const, label: "Hatch", emoji: "🚗" },
                { key: "SEDAN" as const, label: "Sedan", emoji: "🚙" },
                { key: "SUV" as const, label: "SUV", emoji: "🚐" },
              ] as const
            ).map((row) => (
              <div
                key={row.key}
                className="flex flex-col items-center rounded-md border border-border/60 bg-background px-1 py-2 text-center"
              >
                <span className="mb-0.5 text-base leading-none sm:mb-1 sm:text-lg" aria-hidden>
                  {row.emoji}
                </span>
                <span className="text-[9px] font-medium uppercase text-muted-foreground">
                  {row.label}
                </span>
                <span className="mt-0.5 text-[11px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400 sm:text-xs">
                  {formatCurrency(sp[row.key])}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1 border-emerald-200 px-1.5 text-emerald-700 sm:h-8 sm:px-2"
            asChild
          >
            <Link href={`/services/${service.id}/parts`} className="gap-1">
              <Boxes className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate text-xs">Parts</span>
            </Link>
          </Button>
          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1 border-emerald-200 px-1.5 text-emerald-700 sm:h-8 sm:px-2"
              onClick={onEdit}
            >
              <Pencil className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate text-xs">Edit</span>
            </Button>
          )}
          {onDelete && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1 border-destructive/30 px-1.5 text-destructive hover:bg-destructive/10 sm:h-8 sm:px-2"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate text-xs">Delete</span>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
