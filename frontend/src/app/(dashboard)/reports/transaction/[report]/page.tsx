"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BillWiseProfitReport,
  CashBankPaymentsReport,
  DaybookReport,
  ExpenseCategoryReport,
  ExpenseTransactionReport,
  PurchaseSummaryReport,
} from "@/components/reports/transaction-report-screens";
import { ArrowLeft } from "lucide-react";

const META: Record<string, { title: string; description: string }> = {
  "bill-wise-profit": {
    title: "Bill Wise Profit",
    description: "Per-invoice margin when cost lines are tracked against job cards.",
  },
  daybook: {
    title: "Daybook",
    description: "Chronological voucher view for the selected period.",
  },
  "purchase-summary": {
    title: "Purchase Summary",
    description: "Aggregated purchases when vendor bills are stored in the workspace.",
  },
  "cash-bank": {
    title: "Cash and Bank Report (All Payments)",
    description: "All payment vouchers by bank account and period.",
  },
  "expense-category": {
    title: "Expense Category Report",
    description: "Totals by expense category for the selected period.",
  },
  "expense-transaction": {
    title: "Expense Transaction Report",
    description: "Line-level expenses with category and payment mode.",
  },
};

export default function TransactionReportPage() {
  const params = useParams();
  const slug = typeof params.report === "string" ? params.report : "";
  const meta = META[slug];

  if (!meta) {
    notFound();
  }

  if (slug === "bill-wise-profit") {
    return (
      <div className="space-y-6">
        <BillWiseProfitReport />
      </div>
    );
  }

  if (slug === "daybook") {
    return (
      <div className="space-y-6">
        <DaybookReport />
      </div>
    );
  }

  if (slug === "purchase-summary") {
    return (
      <div className="space-y-6">
        <PurchaseSummaryReport />
      </div>
    );
  }

  if (slug === "cash-bank") {
    return (
      <div className="space-y-6">
        <CashBankPaymentsReport />
      </div>
    );
  }

  if (slug === "expense-category") {
    return (
      <div className="space-y-6">
        <ExpenseCategoryReport />
      </div>
    );
  }

  if (slug === "expense-transaction") {
    return (
      <div className="space-y-6">
        <ExpenseTransactionReport />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/reports">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Reports
        </Link>
      </Button>

      <PageHeader title={meta.title} description={meta.description} />

      <Card>
        <CardHeader>
          <CardTitle>Coming next</CardTitle>
          <CardDescription>
            Wire this screen to job costing and purchase data as those modules grow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Use Activity for audit-style logs and Cash &amp; Bank for payment flows today.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
