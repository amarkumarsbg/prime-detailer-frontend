"use client";

import { notFound, useParams } from "next/navigation";
import {
  AgeingReport,
  PartyLedgerStatementReport,
  PartyReportByItem,
  PartyWiseOutstandingReport,
  SalesSummaryCategoryWiseReport,
} from "@/components/reports/party-reports";

const SLUGS = new Set([
  "receivable-ageing",
  "by-item",
  "ledger",
  "sales-summary-category",
  "party-wise-outstanding",
]);

export default function PartyReportPage() {
  const params = useParams();
  const slug = typeof params.report === "string" ? params.report : "";

  if (!SLUGS.has(slug)) {
    notFound();
  }

  if (slug === "receivable-ageing") {
    return (
      <div className="space-y-6">
        <AgeingReport />
      </div>
    );
  }

  if (slug === "by-item") {
    return (
      <div className="space-y-6">
        <PartyReportByItem />
      </div>
    );
  }

  if (slug === "ledger") {
    return (
      <div className="space-y-6">
        <PartyLedgerStatementReport />
      </div>
    );
  }

  if (slug === "party-wise-outstanding") {
    return (
      <div className="space-y-6">
        <PartyWiseOutstandingReport />
      </div>
    );
  }

  if (slug === "sales-summary-category") {
    return (
      <div className="space-y-6">
        <SalesSummaryCategoryWiseReport />
      </div>
    );
  }

  notFound();
}
