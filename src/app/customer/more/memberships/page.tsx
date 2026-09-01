"use client";

import { useCustomerDashboardStore } from "@/store/customer-dashboard-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, CheckCircle2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function MembershipsPage() {
  const { getActiveMemberships, memberships } = useCustomerDashboardStore();

  const active = getActiveMemberships();
  const expired = memberships.filter((m) => !active.find((a) => a.id === m.id));

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-2xl">

      {memberships.length === 0 ? (
        <Card>
          <CardContent className="pt-12 text-center pb-12">
            <CreditCard className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">No memberships yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Ask the workshop about available service plans
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {active.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">Active</p>
              {active.map((mem) => (
                <Card key={mem.id}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-semibold">{mem.packageName || "Service Plan"}</p>
                        {mem.startDate && (
                          <p className="text-xs text-muted-foreground">
                            Started: {formatDate(mem.startDate)}
                          </p>
                        )}
                        {mem.endDate && (
                          <p className="text-xs text-muted-foreground">
                            Expires: {formatDate(mem.endDate)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-green-600 shrink-0">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-xs font-semibold">Active</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {expired.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">Past</p>
              {expired.map((mem) => (
                <Card key={mem.id} className="opacity-60">
                  <CardContent className="pt-4 pb-4">
                    <p className="font-medium">{mem.packageName || "Service Plan"}</p>
                    {mem.endDate && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Expired: {formatDate(mem.endDate)}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
