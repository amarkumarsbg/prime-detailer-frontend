"use client";

import { useCustomerAuthStore } from "@/store/customer-auth-store";
import { useCustomerDashboardStore } from "@/store/customer-dashboard-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

export default function WalletPage() {
  const { user } = useCustomerAuthStore();
  const { customer, walletTransactions } = useCustomerDashboardStore();

  const balance = customer?.walletBalance ?? user?.walletBalance ?? 0;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-2xl">

      {/* Balance card */}
      <Card>
        <CardContent className="pt-6 pb-6 text-center space-y-1">
          <Wallet className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-4xl font-bold">{formatCurrency(balance)}</p>
          <p className="text-sm text-muted-foreground">Available balance</p>
        </CardContent>
      </Card>

      {/* Transactions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {(!walletTransactions || walletTransactions.length === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-6">No transactions yet</p>
          ) : (
            <div className="space-y-1">
              {[...walletTransactions]
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 py-3 border-b last:border-0">
                    <div className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                      tx.type === "CREDIT" ? "bg-green-50" : "bg-red-50"
                    )}>
                      {tx.type === "CREDIT"
                        ? <TrendingUp className="h-4 w-4 text-green-600" />
                        : <TrendingDown className="h-4 w-4 text-red-500" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(tx.createdAt)}</p>
                    </div>
                    <p className={cn(
                      "text-sm font-semibold shrink-0",
                      tx.type === "CREDIT" ? "text-green-600" : "text-red-600"
                    )}>
                      {tx.type === "CREDIT" ? "+" : "−"}{formatCurrency(tx.amount)}
                    </p>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-center text-muted-foreground">
        Wallet balance is applied automatically during service payments.
      </p>
    </div>
  );
}
