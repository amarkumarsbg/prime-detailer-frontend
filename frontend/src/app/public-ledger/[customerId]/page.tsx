"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiGet } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

type PublicLedgerLine = {
  id: string;
  date: string;
  voucher: string;
  credit: number | null;
  debit: number | null;
  balance: number;
  isSummary: boolean;
  dueLabel: string | null;
};

type PublicLedgerData = {
  customer: { id: string; name: string };
  period: string;
  summary: {
    totalReceivableOrPayable: number;
    overdueAmount: number;
    totalSalesOrPurchases: number;
    totalReceivedOrPaid: number;
  };
  statement: PublicLedgerLine[];
  business: { businessName: string; businessLogo: string };
};

export default function PublicLedgerPage() {
  const params = useParams();
  const customerId = params.customerId as string;
  const [data, setData] = useState<PublicLedgerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!customerId) return;
    setLoading(true);
    setError(null);
    apiGet<PublicLedgerData>(
      `/api/public/ledgers/${encodeURIComponent(customerId)}?period=last365`
    )
      .then((payload) => {
        setData(payload);
        setLoading(false);
      })
      .catch(() => {
        setError("Ledger not found or failed to load");
        setLoading(false);
      });
  }, [customerId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center text-sm text-muted-foreground">
        Loading ledger…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center text-sm text-destructive">
        {error ?? "Ledger not found"}
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-background px-4 py-6">
      <div className="mb-4 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {data.business.businessName}
        </p>
        <h1 className="mt-1 text-xl font-bold tracking-tight">{data.customer.name}</h1>
        <p className="text-sm text-muted-foreground">Ledger statement</p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <Card className="border-border/80">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[11px] font-medium text-muted-foreground">Receivable</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 text-base font-bold tabular-nums">
            {formatCurrency(data.summary.totalReceivableOrPayable)}
          </CardContent>
        </Card>
        <Card className="border-border/80">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[11px] font-medium text-muted-foreground">Overdue</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 text-base font-bold tabular-nums">
            {formatCurrency(data.summary.overdueAmount)}
          </CardContent>
        </Card>
        <Card className="border-border/80">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[11px] font-medium text-muted-foreground">Total Sales</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 text-base font-bold tabular-nums">
            {formatCurrency(data.summary.totalSalesOrPurchases)}
          </CardContent>
        </Card>
        <Card className="border-border/80">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[11px] font-medium text-muted-foreground">Received</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 text-base font-bold tabular-nums">
            {formatCurrency(data.summary.totalReceivedOrPaid)}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        {data.statement.map((row) => (
          <div
            key={row.id}
            className={`rounded-lg border border-border p-3 text-sm ${
              row.isSummary ? "bg-muted/40 font-medium" : "bg-card"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">{row.date}</p>
                <p className="mt-0.5 font-medium leading-tight">{row.voucher}</p>
              </div>
              <p className="shrink-0 font-bold tabular-nums">{formatCurrency(row.balance)}</p>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
              <span>
                Credit:{" "}
                <span className="font-medium text-foreground">
                  {row.credit != null ? formatCurrency(row.credit) : "—"}
                </span>
              </span>
              <span>
                Debit:{" "}
                <span className="font-medium text-foreground">
                  {row.debit != null ? formatCurrency(row.debit) : "—"}
                </span>
              </span>
              {row.dueLabel ? (
                <span className="col-span-2 text-amber-700 dark:text-amber-400">{row.dueLabel}</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
