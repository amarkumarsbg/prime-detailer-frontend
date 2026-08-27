"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { isMembershipPricedLine } from "@/lib/service-line-price";
import type { ServiceItem } from "@/types";

export type MembershipUsageInfo = {
  included: number;
  used: number;
  remaining: number;
  isIncluded: boolean;
};

export interface JobCardServiceChecklistProps {
  serviceItems: ServiceItem[];
  progressPercent: number;
  completedCount: number;
  totalCount: number;
  canEdit: boolean;
  membershipUsageByCatalogId: Map<string, MembershipUsageInfo>;
  onToggleComplete: (serviceId: string) => void;
}

export function JobCardServiceChecklist({
  serviceItems,
  progressPercent,
  completedCount,
  totalCount,
  canEdit,
  membershipUsageByCatalogId,
  onToggleComplete,
}: JobCardServiceChecklistProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Service Checklist</CardTitle>
        <div className="flex items-center gap-4 mt-2">
          <Progress value={progressPercent} className="w-32 h-2" />
          <span className="text-sm text-muted-foreground">
            {completedCount} of {totalCount} completed
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {serviceItems.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No services on this job card yet. Add services from the job setup flow or create the job with at least one service.
            </p>
          )}
          {serviceItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
            >
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={item.isCompleted}
                  disabled={!canEdit}
                  onCheckedChange={() => onToggleComplete(item.id)}
                />
                <div>
                  <p
                    className={`font-medium ${
                      item.isCompleted ? "line-through text-muted-foreground" : ""
                    }`}
                  >
                    {item.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {new Intl.NumberFormat("en-IN", {
                      style: "currency",
                      currency: "INR",
                    }).format(item.price)}
                  </p>
                  {isMembershipPricedLine(item) && membershipUsageByCatalogId.get(item.serviceCatalogId)?.isIncluded ? (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Included: {membershipUsageByCatalogId.get(item.serviceCatalogId)!.included} · Used:{" "}
                      {membershipUsageByCatalogId.get(item.serviceCatalogId)!.used} · Remaining:{" "}
                      {membershipUsageByCatalogId.get(item.serviceCatalogId)!.remaining}
                    </p>
                  ) : null}
                  {item.durationMinutes != null && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Est. {item.durationMinutes} min
                    </p>
                  )}
                </div>
              </div>
              {item.isCompleted && (
                <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                  Done
                </span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
