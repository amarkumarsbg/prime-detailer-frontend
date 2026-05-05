"use client";

import { notFound, useParams } from "next/navigation";
import {
  ItemReportByParty,
  ItemSalesPurchaseSummaryReport,
  LowStockSummaryReport,
  RateListReport,
  StockDetailReport,
  StockSummaryReport,
} from "@/components/reports/item-reports";

const SLUGS = new Set([
  "by-party",
  "sales-purchase-summary",
  "rate-list",
  "low-stock-summary",
  "stock-detail",
  "stock-summary",
]);

export default function ItemReportPage() {
  const params = useParams();
  const slug = typeof params.report === "string" ? params.report : "";

  if (!SLUGS.has(slug)) {
    notFound();
  }

  if (slug === "by-party") {
    return (
      <div className="space-y-6">
        <ItemReportByParty />
      </div>
    );
  }

  if (slug === "sales-purchase-summary") {
    return (
      <div className="space-y-6">
        <ItemSalesPurchaseSummaryReport />
      </div>
    );
  }

  if (slug === "rate-list") {
    return (
      <div className="space-y-6">
        <RateListReport />
      </div>
    );
  }

  if (slug === "low-stock-summary") {
    return (
      <div className="space-y-6">
        <LowStockSummaryReport />
      </div>
    );
  }

  if (slug === "stock-detail") {
    return (
      <div className="space-y-6">
        <StockDetailReport />
      </div>
    );
  }

  if (slug === "stock-summary") {
    return (
      <div className="space-y-6">
        <StockSummaryReport />
      </div>
    );
  }

  notFound();
}
