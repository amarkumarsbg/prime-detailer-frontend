"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Gstr1SalesReport } from "@/components/reports/gstr1-sales-report";
import { Gstr2PurchaseReport } from "@/components/reports/gstr2-purchase-report";
import { Gstr3bReport } from "@/components/reports/gstr3b-report";
import { GstPurchaseHsnReport } from "@/components/reports/gst-purchase-hsn-report";
import { GstSalesHsnReport } from "@/components/reports/gst-sales-hsn-report";
import { HsnWiseSalesSummaryReport } from "@/components/reports/hsn-wise-sales-summary-report";
import { PageHeader } from "@/components/shared/page-header";
import { TaxWithholdingReport } from "@/components/reports/tax-withholding-report";
import { ArrowLeft } from "lucide-react";

const GST_META: Record<
  string,
  { title: string; description: string; kind: "sales" | "purchase" | "summary" | "tax" }
> = {
  "gstr-1-sales": {
    title: "GSTR-1 (Sales)",
    description: "Outward supplies from saved invoices.",
    kind: "sales",
  },
  "gstr-2-purchase": {
    title: "GSTR-2 (Purchase)",
    description: "Inward supplies when purchase data is recorded against vendors.",
    kind: "purchase",
  },
  "gstr-3b": {
    title: "GSTR-3B",
    description: "Summary return figures derived from sales invoices in this app.",
    kind: "summary",
  },
  "gst-purchase-hsn": {
    title: "GST Purchase (With HSN)",
    description: "Purchase lines with HSN — populated when purchase bills are linked.",
    kind: "purchase",
  },
  "gst-sales-hsn": {
    title: "GST Sales (With HSN)",
    description: "Outward supplies grouped by HSN/SAC from invoice line items.",
    kind: "sales",
  },
  "hsn-wise-sales-summary": {
    title: "HSN Wise Sales Summary",
    description: "Taxable value and GST by HSN from saved invoices.",
    kind: "sales",
  },
  "tds-payable": {
    title: "TDS Payable",
    description: "TDS on expenses — extend when expense TDS fields are added.",
    kind: "tax",
  },
  "tds-receivable": {
    title: "TDS Receivable",
    description: "TDS deducted on receipts — extend when customer TDS is tracked.",
    kind: "tax",
  },
  "tcs-payable": {
    title: "TCS Payable",
    description: "TCS on purchases — placeholder until purchase TCS is modeled.",
    kind: "tax",
  },
  "tcs-receivable": {
    title: "TCS Receivable",
    description: "TCS on sales — placeholder until TCS is modeled.",
    kind: "tax",
  },
};

export default function GstReportPage() {
  const params = useParams();
  const slug = typeof params.report === "string" ? params.report : "";
  const meta = GST_META[slug];

  if (!meta) {
    notFound();
  }

  if (slug === "gstr-1-sales") {
    return (
      <div className="space-y-6">
        <Gstr1SalesReport />
      </div>
    );
  }

  if (slug === "gstr-2-purchase") {
    return (
      <div className="space-y-6">
        <Gstr2PurchaseReport />
      </div>
    );
  }

  if (slug === "gstr-3b") {
    return (
      <div className="space-y-6">
        <Gstr3bReport />
      </div>
    );
  }

  if (slug === "gst-sales-hsn") {
    return (
      <div className="space-y-6">
        <GstSalesHsnReport />
      </div>
    );
  }

  if (slug === "gst-purchase-hsn") {
    return (
      <div className="space-y-6">
        <GstPurchaseHsnReport />
      </div>
    );
  }

  if (slug === "hsn-wise-sales-summary") {
    return (
      <div className="space-y-6">
        <HsnWiseSalesSummaryReport />
      </div>
    );
  }

  if (
    slug === "tds-payable" ||
    slug === "tds-receivable" ||
    slug === "tcs-payable" ||
    slug === "tcs-receivable"
  ) {
    return (
      <div className="space-y-6">
        <TaxWithholdingReport variant={slug} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/reports">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Reports
          </Link>
        </Button>
      </div>

      <PageHeader title={meta.title} description={meta.description} />
    </div>
  );
}
