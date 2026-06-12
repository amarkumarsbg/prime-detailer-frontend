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

function EmptyState() {
  return (
    <div className="flex min-h-[160px] flex-col items-center justify-center px-6 py-10 text-center md:min-h-[280px] md:py-16">
      <PartyTransactionsEmptyIcon className="mb-4 h-[54px] w-[54px] shrink-0" />
      <p className="text-sm text-[#858D9D]">No transactions for the selected time period</p>
    </div>
  );
}

export function PartyItemWiseTab({ rows }: PartyItemWiseTabProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="space-y-2 p-3 md:hidden">
        {rows.length === 0 ? (
          <EmptyState />
        ) : (
          rows.map((r, i) => (
            <div
              key={`${r.itemName}-${r.itemCode}-${i}`}
              className="rounded-lg border border-border bg-card p-3 text-sm shadow-sm"
            >
              <p className="font-medium leading-tight">{r.itemName}</p>
              {r.itemCode ? (
                <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{r.itemCode}</p>
              ) : null}
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-md bg-muted/40 px-2 py-1.5">
                  <p className="text-muted-foreground">Sales</p>
                  <p className="mt-0.5 font-medium tabular-nums">{formatQty(r.salesQuantity, r.salesUnit)}</p>
                  <p className="mt-0.5 font-semibold tabular-nums">{formatAmount(r.salesAmount)}</p>
                </div>
                <div className="rounded-md bg-muted/40 px-2 py-1.5">
                  <p className="text-muted-foreground">Purchase</p>
                  <p className="mt-0.5 font-medium tabular-nums">
                    {formatQty(r.purchaseQuantity, r.purchaseUnit)}
                  </p>
                  <p className="mt-0.5 font-semibold tabular-nums">{formatAmount(r.purchaseAmount)}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="hidden overflow-x-auto md:block">
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
                  <EmptyState />
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={`${r.itemName}-${r.itemCode}-${i}`} className="hover:bg-muted/30">
                  <td className={cn(tdClass, "font-medium")}>{r.itemName}</td>
                  <td className={cn(tdClass, "font-mono text-xs text-muted-foreground")}>
                    {r.itemCode}
                  </td>
                  <td className={tdNumClass}>{formatQty(r.salesQuantity, r.salesUnit)}</td>
                  <td className={cn(tdNumClass, "font-medium")}>{formatAmount(r.salesAmount)}</td>
                  <td className={tdNumClass}>{formatQty(r.purchaseQuantity, r.purchaseUnit)}</td>
                  <td className={cn(tdNumClass, "font-medium")}>{formatAmount(r.purchaseAmount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
