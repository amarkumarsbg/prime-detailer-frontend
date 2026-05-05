"use client";

import { notFound, useParams } from "next/navigation";
import { BalanceSheetReport } from "@/components/reports/balance-sheet-report";
import { ProfitLossReport } from "@/components/reports/profit-loss-report";

const ALLOWED = new Set(["balance-sheet", "profit-loss"]);

export default function FinanceReportPage() {
  const params = useParams();
  const slug = typeof params.report === "string" ? params.report : "";

  if (!ALLOWED.has(slug)) {
    notFound();
  }

  if (slug === "balance-sheet") {
    return (
      <div className="space-y-6">
        <BalanceSheetReport />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ProfitLossReport />
    </div>
  );
}
