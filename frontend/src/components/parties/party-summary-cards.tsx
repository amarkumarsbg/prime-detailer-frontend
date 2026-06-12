"use client";

import { KPICard } from "@/components/shared/kpi-card";
import { formatInrTable } from "@/lib/utils";
import type { PartyKind, PartyLedgerSummary } from "@/types/party";
import {
  AlertCircle,
  CircleDollarSign,
  FilePlus2,
  IndianRupee,
  RotateCcw,
} from "lucide-react";

type PartySummaryCardsProps = {
  kind: PartyKind;
  summary: PartyLedgerSummary;
};

export function PartySummaryCards({ kind, summary }: PartySummaryCardsProps) {
  const isCustomer = kind === "customer";

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
      <KPICard
        size="compact"
        decorativeHover
        title={isCustomer ? "Receivable" : "Payable"}
        titleClassName="text-[11px] leading-tight sm:text-xs"
        valueClassName="text-sm tabular-nums sm:text-xl"
        value={formatInrTable(summary.totalReceivableOrPayable)}
        icon={IndianRupee}
        tone="slate"
      />
      <KPICard
        size="compact"
        decorativeHover
        title="Overdue"
        titleClassName="text-[11px] leading-tight sm:text-xs"
        valueClassName="text-sm tabular-nums sm:text-xl"
        value={formatInrTable(summary.overdueAmount)}
        icon={AlertCircle}
        tone="amber"
      />
      <KPICard
        size="compact"
        decorativeHover
        title={isCustomer ? "Total Sales" : "Total Purchases"}
        titleClassName="text-[11px] leading-tight sm:text-xs"
        valueClassName="text-sm tabular-nums sm:text-xl"
        value={formatInrTable(summary.totalSalesOrPurchases)}
        icon={FilePlus2}
        tone="blue"
      />
      <KPICard
        size="compact"
        decorativeHover
        title={isCustomer ? "Received" : "Paid"}
        titleClassName="text-[11px] leading-tight sm:text-xs"
        valueClassName="text-sm tabular-nums sm:text-xl"
        value={formatInrTable(summary.totalReceivedOrPaid)}
        icon={isCustomer ? RotateCcw : CircleDollarSign}
        tone="blue"
      />
    </div>
  );
}
