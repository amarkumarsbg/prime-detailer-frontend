"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatServiceDurationLabel } from "@/lib/service-duration";
import { formatCurrency } from "@/lib/utils";
import type { ServiceCatalogItem } from "@/types";
import { Globe, Building2, Clock, Pencil, Trash2, Sparkles } from "lucide-react";

export function ServiceAddonCard({
  service,
  onEdit,
  onDelete,
}: {
  service: ServiceCatalogItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const scope = service.scope ?? "GLOBAL";

  return (
    <Card className="overflow-hidden border-border/80 shadow-sm hover:shadow-md transition-shadow duration-500">
      <CardContent className="flex h-full flex-col p-3 sm:p-5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-sm leading-snug pr-2">{service.name}</h3>
          <Badge className="shrink-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300">
            {service.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {service.isHighEnd && (
            <Badge className="gap-1 border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/50 dark:text-amber-200">
              <Sparkles className="h-3 w-3 shrink-0" />
              High-end
            </Badge>
          )}
          {scope === "GLOBAL" ? (
            <Badge className="gap-1 border-0 bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300">
              <Globe className="h-3 w-3" />
              Global
            </Badge>
          ) : (
            <Badge className="gap-1 border-0 bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
              <Building2 className="h-3 w-3" />
              Branch
            </Badge>
          )}
        </div>
        <p className="text-sm">
          <span className="text-muted-foreground">Price (incl. GST): </span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {formatCurrency(service.defaultPrice)}
          </span>
        </p>
        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          Duration: {formatServiceDurationLabel(service)}
        </p>
        <div className="mt-auto flex flex-row gap-2 pt-3">
          <Button
            variant="outline"
            size="sm"
            className="h-8 min-w-0 flex-1 gap-1 border-emerald-300 px-2 text-emerald-700 hover:bg-emerald-50 sm:flex-none sm:px-3"
            onClick={onEdit}
          >
            <Pencil className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Edit</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 min-w-0 flex-1 gap-1 border-destructive/30 px-2 text-destructive hover:bg-destructive/10 sm:flex-none sm:px-3"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Delete</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
