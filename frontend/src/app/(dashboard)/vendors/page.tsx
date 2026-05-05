"use client";

import { useMemo } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useInventoryStore } from "@/store/inventory-store";
import { Store } from "lucide-react";

export default function VendorsPage() {
  const purchases = useInventoryStore((s) => s.productPurchases);
  const parts = useInventoryStore((s) => s.parts);

  const rows = useMemo(() => {
    const byVendor = new Map<
      string,
      { count: number; totalCost: number; lastAt: string }
    >();
    for (const p of purchases) {
      const name = p.vendorName.trim() || "Unknown";
      const lineCost = (p.unitCost ?? 0) * (p.quantityMl / 1000);
      const prev = byVendor.get(name) ?? { count: 0, totalCost: 0, lastAt: p.purchasedAt };
      const totalCost = prev.totalCost + lineCost;
      const lastAt =
        new Date(p.purchasedAt) > new Date(prev.lastAt) ? p.purchasedAt : prev.lastAt;
      byVendor.set(name, {
        count: prev.count + 1,
        totalCost,
        lastAt,
      });
    }
    return [...byVendor.entries()]
      .map(([vendorName, agg]) => ({ vendorName, ...agg }))
      .sort((a, b) => b.totalCost - a.totalCost);
  }, [purchases]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendors"
        description="Suppliers from stock purchases. Costs use unit price × quantity (litres) where recorded."
      />

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <Store className="w-5 h-5 text-muted-foreground" />
          <CardTitle className="text-base">Vendor directory</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">No purchase records yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Vendor</th>
                  <th className="px-3 py-2 font-medium text-right">Purchases</th>
                  <th className="px-3 py-2 font-medium text-right">Est. spend</th>
                  <th className="px-3 py-2 font-medium text-right">Last purchase</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.vendorName} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2.5 font-medium">{r.vendorName}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.count}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatCurrency(r.totalCost)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">
                      {formatDate(r.lastAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            Part labels:{" "}
            {parts.length ? `${parts.length} parts in catalog` : "Load inventory for more context."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
