"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { formatDate } from "@/lib/utils";
import { useFollowUpStore } from "@/store/follow-up-store";
import { UserX, Phone } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "success" | "warning"> = {
  PENDING: "warning",
  CALLED: "secondary",
  SCHEDULED: "default",
  NOT_INTERESTED: "outline",
  REENGAGED: "success",
};

export default function FollowUpsPage() {
  const followUps = useFollowUpStore((s) => s.followUps);

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Follow-ups"
        description="Inactive customers and follow-up tasks"
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <UserX className="w-4 h-4 text-muted-foreground" />
            Inactive Customers ({followUps.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {followUps.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No follow-ups pending
            </p>
          ) : (
            <div className="space-y-3">
              {followUps.map((fu) => (
                <Link
                  key={fu.id}
                  href={`/customers/${fu.customerId}`}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{fu.customerName}</span>
                      <Badge variant={STATUS_VARIANTS[fu.status] ?? "secondary"}>
                        {fu.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <Phone className="w-3 h-3" />
                      {fu.customerPhone}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Last visit: {formatDate(fu.lastVisitDate)} &middot; {fu.daysSinceLastVisit} days ago
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
