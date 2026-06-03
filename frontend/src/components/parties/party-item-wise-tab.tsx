"use client";

import { PartyTransactionsEmptyIcon } from "@/components/parties/party-transactions-empty-icon";
import { cn, formatInrTable } from "@/lib/utils";
import type { PartyItemWiseRow } from "@/types/party";

type PartyItemWiseTabProps = {
  rows: PartyItemWiseRow[];
};

const thClass =
  "border-r border-border bg-muted px-4 py-3 text-left text-sm font-semibold text-foreground align-middle last:border-r-0 whitespace-nowrap";
const tdClass =
  "border-r border-t border-border px-4 py-3 text-sm text-foreground align-middle last:border-r-0 bg-background";
const tdNumClass = cn(tdClass, "tabular-nums text-right");

function formatQty(qty: number, unit: string): string {
  if (qty <= 0) return "—";
  const formatted = Number.isInteger(qty) ? String(qty) : qty.toFixed(1);
  return unit && unit !== "—" ? `${formatted} ${unit}` : formatted;
}

function formatAmount(amount: number): string {
  if (amount <= 0) return "—";
  return formatInrTable(amount);
}

export function PartyItemWiseTab({ rows }: PartyItemWiseTabProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] border-collapse text-sm">
          <thead>
            <tr>
              <th className={thClass}>Item Name</th>
              <th className={thClass}>Item Code</th>
              <th className={cn(thClass, "text-right")}>Sales Quantity</th>
              <th className={cn(thClass, "text-right")}>Sales Amount</th>
              <th className={cn(thClass, "text-right")}>Purchase Quantity</th>
              <th className={cn(thClass, "text-right")}>Purchase Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="border-t border-border bg-background p-0">
                  <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-16 text-center">
                    <PartyTransactionsEmptyIcon className="mb-4 h-[54px] w-[54px] shrink-0" />
                    <p className="text-sm text-[#858D9D]">
                      No transactions for the selected time period
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={`${r.itemName}-${r.itemCode}-${i}`} className="hover:bg-muted/30">
                  <td className={cn(tdClass, "font-medium")}>{r.itemName}</td>
                  <td className={cn(tdClass, "text-muted-foreground font-mono text-xs")}>
                    {r.itemCode}
                  </td>
                  <td className={tdNumClass}>
                    {formatQty(r.salesQuantity, r.salesUnit)}
                  </td>
                  <td className={cn(tdNumClass, "font-medium")}>
                    {formatAmount(r.salesAmount)}
                  </td>
                  <td className={tdNumClass}>
                    {formatQty(r.purchaseQuantity, r.purchaseUnit)}
                  </td>
                  <td className={cn(tdNumClass, "font-medium")}>
                    {formatAmount(r.purchaseAmount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
