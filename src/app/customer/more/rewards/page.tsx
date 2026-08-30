"use client";

import { useCustomerAuthStore } from "@/store/customer-auth-store";
import { useCustomerDashboardStore } from "@/store/customer-dashboard-store";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function RewardsPage() {
  const { user } = useCustomerAuthStore();
  const { customer, rewardConfig } = useCustomerDashboardStore();

  const points = customer?.rewardPoints ?? user?.rewardPoints ?? 0;
  const worth = points * rewardConfig.pointValue;
  const canRedeem = points >= rewardConfig.minRedeem;

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-2xl">

      {/* Balance */}
      <Card>
        <CardContent className="pt-6 pb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Reward Points</p>
              <p className="text-4xl font-bold mt-1">{points.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Worth {formatCurrency(worth)}
              </p>
            </div>
            <Trophy className="h-12 w-12 text-muted-foreground/20" />
          </div>

          {!canRedeem && (
            <div className="mt-4 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Earn {rewardConfig.minRedeem - points} more points to start redeeming
            </div>
          )}
          {canRedeem && (
            <div className="mt-4 rounded-lg bg-green-50 dark:bg-green-950/20 px-3 py-2 text-xs text-green-700 dark:text-green-300">
              ✓ You can redeem your points — mention this at the workshop counter
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rules */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-0 divide-y divide-border">
          <div className="flex justify-between py-3">
            <p className="text-sm text-muted-foreground">Earning rate</p>
            <p className="text-sm font-medium">{rewardConfig.pointsPer100} pt per ₹100 spent</p>
          </div>
          <div className="flex justify-between py-3">
            <p className="text-sm text-muted-foreground">Point value</p>
            <p className="text-sm font-medium">1 pt = ₹{rewardConfig.pointValue.toFixed(2)}</p>
          </div>
          <div className="flex justify-between py-3">
            <p className="text-sm text-muted-foreground">Referral bonus</p>
            <p className="text-sm font-medium">{rewardConfig.referralBonus} pts each</p>
          </div>
          <div className="flex justify-between py-3">
            <p className="text-sm text-muted-foreground">Minimum to redeem</p>
            <p className="text-sm font-medium">{rewardConfig.minRedeem} pts</p>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
