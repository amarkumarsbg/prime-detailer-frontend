"use client";

import { useCustomerDashboardStore } from "@/store/customer-dashboard-store";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Car } from "lucide-react";

export default function CustomerVehiclesPage() {
  const { vehicles, isLoading, error } = useCustomerDashboardStore();

  if (isLoading) {
    return (
      <div className="p-4 space-y-3 max-w-4xl mx-auto">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-24 bg-muted/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 max-w-4xl mx-auto">
        <Card className="border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl">
      <p className="text-sm text-muted-foreground">
        {vehicles.length} vehicle{vehicles.length !== 1 ? "s" : ""} linked
      </p>

      <div>
        {vehicles.length === 0 ? (
          <Card>
            <CardContent className="pt-12 text-center">
              <Car className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="font-medium">No vehicles linked yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your vehicles will appear here once you create a service booking
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {vehicles.map((vehicle) => (
              <Card key={vehicle.id}>
                <CardContent className="pt-4">
                  <div className="flex gap-4">
                    <div className="shrink-0">
                      <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-muted">
                        <Car className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-lg">
                        {vehicle.make} {vehicle.model}
                      </p>

                      <div className="grid grid-cols-2 gap-3 mt-2 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Registration</p>
                          <p className="font-medium">{vehicle.registrationNumber}</p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">Category</p>
                          <p className="font-medium">{vehicle.segment || "—"}</p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">Year</p>
                          <p className="font-medium">{vehicle.year || "—"}</p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">Fuel Type</p>
                          <p className="font-medium">{vehicle.fuelType || "—"}</p>
                        </div>
                      </div>

                      {vehicle.color && vehicle.color !== "—" && (
                        <div className="mt-2 text-sm">
                          <p className="text-xs text-muted-foreground">Color</p>
                          <p className="font-medium">{vehicle.color}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
