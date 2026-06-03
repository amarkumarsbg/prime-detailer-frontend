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

const ledgerTitleClass = "whitespace-nowrap";

export function PartySummaryCards({ kind, summary }: PartySummaryCardsProps) {
  const isCustomer = kind === "customer";

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KPICard
        size="compact"
        decorativeHover
        title={isCustomer ? "Total Receivable Amount" : "Total Payable Amount"}
        titleClassName={ledgerTitleClass}
        value={formatInrTable(summary.totalReceivableOrPayable)}
        icon={IndianRupee}
        tone="slate"
      />
      <KPICard
        size="compact"
        decorativeHover
        title="Overdue Amount"
        titleClassName={ledgerTitleClass}
        value={formatInrTable(summary.overdueAmount)}
        icon={AlertCircle}
        tone="amber"
      />
      <KPICard
        size="compact"
        decorativeHover
        title={isCustomer ? "Total Sales Amount" : "Total Purchases Amount"}
        titleClassName={ledgerTitleClass}
        value={formatInrTable(summary.totalSalesOrPurchases)}
        icon={FilePlus2}
        tone="blue"
      />
      <KPICard
        size="compact"
        decorativeHover
        title={isCustomer ? "Total Received Amount" : "Total Paid Amount"}
        titleClassName={ledgerTitleClass}
        value={formatInrTable(summary.totalReceivedOrPaid)}
        icon={isCustomer ? RotateCcw : CircleDollarSign}
        tone="blue"
      />
    </div>
  );
}
