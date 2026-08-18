"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Download } from "lucide-react";
import { apiGet } from "@/lib/api-client";
import { resolveUploadsPublicUrl } from "@/lib/api-base";
import { cn } from "@/lib/utils";

type PublicLedgerLine = {
  id: string;
  date: string;
  voucher: string;
  serialNo: string;
  paymentMode: string;
  credit: number | null;
  debit: number | null;
  balance: number;
  isSummary: boolean;
  dueLabel: string | null;
};

type PublicLedgerData = {
  customer: { id: string; name: string; phone: string };
  period: string;
  dateRangeLabel: string;
  summary: {
    totalReceivableOrPayable: number;
    overdueAmount: number;
    totalSalesOrPurchases: number;
    totalReceivedOrPaid: number;
    totalOutstanding: number;
  };
  statement: PublicLedgerLine[];
  business: {
    businessName: string;
    businessLogo: string;
    businessPhone: string;
    businessAddress: string;
  };
};

function formatAmt(n: number | null | undefined): string {
  if (n == null) return "";
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function formatRupee(n: number): string {
  return `₹ ${formatAmt(n)}`;
}

function dash(v: string | null | undefined): string {
  const t = (v ?? "").trim();
  if (!t || t === "—") return "—";
  return t;
}

function dueClass(label: string | null): string {
  if (!label) return "text-neutral-500";
  if (label === "Paid") return "font-medium text-emerald-600";
  if (label.includes("Partially")) return "font-medium text-amber-700";
  return "font-medium text-red-600";
}

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

  const logoUrl = useMemo(
    () => resolveUploadsPublicUrl(data?.business.businessLogo),
    [data?.business.businessLogo]
  );

  const creditTotal = useMemo(() => {
    if (!data) return 0;
    return data.statement.reduce((s, r) => s + (r.isSummary ? 0 : r.credit ?? 0), 0);
  }, [data]);

  const debitTotal = useMemo(() => {
    if (!data) return 0;
    return data.statement.reduce((s, r) => s + (r.isSummary ? 0 : r.debit ?? 0), 0);
  }, [data]);

  const handleDownload = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-sm text-neutral-500">
        Loading ledger…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6 text-center text-sm text-red-600">
        {error ?? "Ledger not found"}
      </div>
    );
  }

  const outstanding = data.summary.totalOutstanding;
  const initials = (data.business.businessName || "P")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
          body {
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .ledger-sheet {
            padding: 0 !important;
            max-width: none !important;
          }
        }
      `}</style>

      <div className="ledger-sheet mx-auto max-w-5xl px-4 pb-28 pt-5 sm:px-6 sm:pt-8">
        <header className="mb-5 border-b border-neutral-300 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="h-12 w-12 rounded object-contain" />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-sky-700 text-xs font-bold text-white">
                  {initials || "P"}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-base font-bold uppercase text-neutral-900">
                  {data.business.businessName}
                </p>
                {data.business.businessAddress ? (
                  <p className="mt-0.5 text-xs leading-snug text-neutral-600">
                    {data.business.businessAddress}
                  </p>
                ) : null}
                {data.business.businessPhone ? (
                  <p className="mt-0.5 text-xs text-neutral-600">
                    Phone No: {data.business.businessPhone}
                  </p>
                ) : null}
              </div>
            </div>
            <p className="shrink-0 text-sm font-semibold text-neutral-800">Party Ledger Report</p>
          </div>
        </header>

        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-neutral-600">
              To, <span className="font-semibold text-neutral-900">{data.customer.name}</span>
            </p>
            {data.customer.phone ? (
              <p className="mt-0.5 text-sm text-neutral-600">Phone No: {data.customer.phone}</p>
            ) : null}
          </div>

          <div className="w-full shrink-0 border border-neutral-400 text-xs sm:w-64">
            <div className="border-b border-neutral-300 px-2 py-1.5 text-neutral-700">
              {data.dateRangeLabel}
            </div>
            {(
              [
                ["Total Receivable Amount", data.summary.totalReceivableOrPayable],
                ["Overdue Amount", data.summary.overdueAmount],
                ["Total Sales Amount", data.summary.totalSalesOrPurchases],
                ["Total Received Amount", data.summary.totalReceivedOrPaid],
              ] as const
            ).map(([label, amount]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-2 border-b border-neutral-200 px-2 py-1 last:border-b-0"
              >
                <span className="text-neutral-600">{label}</span>
                <span className="font-medium tabular-nums">{formatRupee(amount)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="bg-neutral-100 text-neutral-800">
                <th className="border border-neutral-300 px-2 py-2 font-semibold whitespace-nowrap">
                  Date
                </th>
                <th className="border border-neutral-300 px-2 py-2 font-semibold whitespace-nowrap">
                  Voucher
                </th>
                <th className="border border-neutral-300 px-2 py-2 font-semibold whitespace-nowrap">
                  Sr No
                </th>
                <th className="border border-neutral-300 px-2 py-2 font-semibold whitespace-nowrap">
                  Payment Mode
                </th>
                <th className="border border-neutral-300 px-2 py-2 text-right font-semibold whitespace-nowrap">
                  Credit
                </th>
                <th className="border border-neutral-300 px-2 py-2 text-right font-semibold whitespace-nowrap">
                  Debit
                </th>
                <th className="border border-neutral-300 px-2 py-2 text-right font-semibold whitespace-nowrap">
                  Balance
                </th>
                <th className="border border-neutral-300 px-2 py-2 font-semibold whitespace-nowrap">
                  Due Date (overdue by)
                </th>
              </tr>
            </thead>
            <tbody>
              {data.statement.map((row) => {
                const closing = row.id === "closing";
                const opening = row.id === "opening";
                return (
                  <tr
                    key={row.id}
                    className={cn(closing && "bg-neutral-100 font-medium", opening && "bg-white")}
                  >
                    <td className="border border-neutral-300 px-2 py-2 whitespace-nowrap tabular-nums">
                      {dash(row.date)}
                    </td>
                    <td className="border border-neutral-300 px-2 py-2 whitespace-nowrap">
                      {row.voucher}
                    </td>
                    <td className="border border-neutral-300 px-2 py-2 whitespace-nowrap">
                      {dash(row.serialNo)}
                    </td>
                    <td className="border border-neutral-300 px-2 py-2 whitespace-nowrap">
                      {dash(row.paymentMode)}
                    </td>
                    <td className="border border-neutral-300 px-2 py-2 text-right tabular-nums">
                      {row.credit != null ? formatAmt(row.credit) : ""}
                    </td>
                    <td className="border border-neutral-300 px-2 py-2 text-right tabular-nums">
                      {row.debit != null ? formatAmt(row.debit) : ""}
                    </td>
                    <td className="border border-neutral-300 px-2 py-2 text-right font-medium tabular-nums">
                      {formatAmt(row.balance)}
                    </td>
                    <td className={cn("border border-neutral-300 px-2 py-2", dueClass(row.dueLabel))}>
                      {row.dueLabel ?? (opening || closing ? "—" : "")}
                    </td>
                  </tr>
                );
              })}
              <tr className="font-medium">
                <td className="border border-neutral-300 px-2 py-2" colSpan={4}>
                  Total
                </td>
                <td className="border border-neutral-300 px-2 py-2 text-right tabular-nums">
                  {formatAmt(creditTotal)}
                </td>
                <td className="border border-neutral-300 px-2 py-2 text-right tabular-nums">
                  {formatAmt(debitTotal)}
                </td>
                <td className="border border-neutral-300 px-2 py-2" colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="no-print fixed inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div>
            <p className="text-xs text-neutral-500">Total Outstanding</p>
            <p className="text-xl font-bold tabular-nums tracking-tight text-neutral-900">
              {formatRupee(outstanding)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownload}
            aria-label="Download ledger"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg shadow-violet-600/30 transition hover:bg-violet-700 active:scale-95"
          >
            <Download className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
