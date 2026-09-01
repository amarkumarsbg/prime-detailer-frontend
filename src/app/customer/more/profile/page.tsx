"use client";

import { useCustomerAuthStore } from "@/store/customer-auth-store";
import { useCustomerDashboardStore } from "@/store/customer-dashboard-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Mail, Phone, MapPin, Calendar } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function ProfilePage() {
  const { user } = useCustomerAuthStore();
  const { customer } = useCustomerDashboardStore();

  const name = customer?.name || user?.name || "—";
  const phone = customer?.phone || user?.phone || "—";
  const email = customer?.email || user?.email || "—";
  const address = customer?.address || user?.address || "—";
  const memberSince = customer?.createdAt ? formatDate(customer.createdAt) : "—";

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-2xl">

      <Card>
        <CardContent className="pt-6 space-y-5">
          <div className="flex items-start gap-3">
            <User className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Full Name</p>
              <p className="text-sm font-medium">{name}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Phone className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Mobile Number</p>
              <p className="text-sm font-medium">{phone}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium">{email}</p>
            </div>
          </div>

          {address !== "—" && (
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Address</p>
                <p className="text-sm font-medium">{address}</p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Member Since</p>
              <p className="text-sm font-medium">{memberSince}</p>
            </div>
          </div>

          {customer?.notes && (
            <div className="flex items-start gap-3 pt-2 border-t border-border/50">
              <div className="w-4 h-4 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Workshop Notes</p>
                <p className="text-sm text-muted-foreground italic whitespace-pre-wrap">{customer.notes}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-center text-muted-foreground">
        To update your profile details, please contact the workshop.
      </p>
    </div>
  );
}
