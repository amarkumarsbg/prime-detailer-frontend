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
  onEdit: () => void;
  onDelete: () => void;
}) {
  const scope = service.scope ?? "GLOBAL";
  const sp = service.segmentPricing;

  return (
    <Card className="overflow-hidden border-border/80 shadow-sm hover:shadow-md transition-shadow duration-500">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
              <Package className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm leading-snug">{service.name}</h3>
              <Badge
                variant="secondary"
                className="mt-1.5 text-[10px] font-normal bg-muted text-muted-foreground"
              >
                {service.category}
              </Badge>
            </div>
          </div>
          <Badge className="shrink-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300">
            {service.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
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
          <Badge variant="secondary" className="text-[10px] font-normal">
            {gstDisplay(service)}
          </Badge>
          <Badge variant="secondary" className="gap-1 text-[10px] font-normal">
            <Clock className="h-3 w-3" />
            {formatServiceDurationLabel(service)}
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed mb-4">
          {service.description}
        </p>

        <div className="rounded-lg bg-muted/40 p-3 mb-4">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            <span>Pricing</span>
            <span className="font-normal normal-case">
              + {service.gstPercent ?? 18}% GST
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { key: "HATCHBACK" as const, label: "HATCHBACK", emoji: "🚗" },
                { key: "SEDAN" as const, label: "SEDAN", emoji: "🚙" },
                { key: "SUV" as const, label: "SUV", emoji: "🚐" },
              ] as const
            ).map((row) => (
              <div
                key={row.key}
                className="flex flex-col items-center rounded-md border border-border/60 bg-background py-2 px-1 text-center"
              >
                <span className="text-lg leading-none mb-1" aria-hidden>
                  {row.emoji}
                </span>
                <span className="text-[9px] font-medium text-muted-foreground uppercase">
                  {row.label}
                </span>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">
                  {formatCurrency(sp[row.key])}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" size="sm" className="text-emerald-700 border-emerald-200" asChild>
            <Link href={`/services/${service.id}/parts`} className="gap-1.5">
              <Boxes className="h-3.5 w-3.5" />
              Parts
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-emerald-700 border-emerald-200 gap-1.5"
            onClick={onEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/30 hover:bg-destructive/10 gap-1.5"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
