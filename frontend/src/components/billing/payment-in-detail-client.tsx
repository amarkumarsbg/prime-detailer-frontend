"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, Printer, Share2 } from "lucide-react";
import { DetailBackButton } from "@/components/shared/detail-back-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useScopedInvoices } from "@/hooks/use-scoped-data";
import { useSettingsStore } from "@/store/settings-store";
import {
  findPaymentInInvoices,
  paymentDisplayNumber,
  salesInvoiceDetailPath,
} from "@/lib/billing/payment-helpers";
import { invoiceOutstanding, invoicePaidTotal } from "@/lib/party/ledger-math";
import { appendReturnTo } from "@/lib/navigation/return-to";
import { cn, formatInrTable } from "@/lib/utils";
import type { PaymentMethod } from "@/types";
import { toast } from "sonner";

function formatPaymentDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

function formatLedgerStyleDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function paymentMethodLabel(method: PaymentMethod): string {
  return method.replace(/_/g, " ");
}

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

type PaymentInDetailClientProps = {
  paymentId: string;
};

export function PaymentInDetailClient({ paymentId }: PaymentInDetailClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const invoices = useScopedInvoices();
  const { bankName, bankAccountNumber } = useSettingsStore();

  const match = findPaymentInInvoices(invoices, paymentId);

  if (!match) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Payment not found</p>
        <DetailBackButton fallbackHref="/billing" />
      </div>
    );
  }

  const { payment, invoice } = match;
  const displayNo = paymentDisplayNumber(payment.id);
  const partyHref = `/parties/c:${encodeURIComponent(invoice.customerId)}`;
  const invoiceHref = salesInvoiceDetailPath(invoice.id);
  const returnQuery = searchParams.toString();
  const currentReturnPath = returnQuery ? `${pathname}?${returnQuery}` : pathname;
  const invoiceNavHref = appendReturnTo(invoiceHref, currentReturnPath);
  const outstanding = invoiceOutstanding(invoice);
  const paidOnInvoice = invoicePaidTotal(invoice);
  const balanceAfterPayment = Math.max(
    0,
    Math.round((invoice.grandTotal - paidOnInvoice) * 100) / 100
  );

  const bankLabel =
    payment.method === "UPI" && payment.referenceNumber
      ? `${bankName || "Bank"} (${payment.referenceNumber})`
      : bankName && bankAccountNumber
        ? `${bankName} (${bankAccountNumber})`
        : payment.referenceNumber || "—";

  const handlePrint = () => window.print();

  return (
    <div className="space-y-4 print:space-y-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <DetailBackButton fallbackHref="/billing" />
          <h1 className="text-lg font-semibold truncate">Payment In #{displayNo}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Download className="mr-1.5 h-4 w-4" />
            Download PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="mr-1.5 h-4 w-4" />
            Print PDF
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Share2 className="mr-1.5 h-4 w-4" />
                Share
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() =>
                  toast.message("Share", { description: "Payment receipt link — coming soon." })
                }
              >
                Copy link
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Payment Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DetailField label="Party Name">
              <Link href={partyHref} className="text-foreground no-underline hover:no-underline">
                {invoice.customerName}
              </Link>
            </DetailField>
            <DetailField label="Payment Date">{formatPaymentDate(payment.paidAt)}</DetailField>
            <DetailField label="Amount Received">
              <span className="font-semibold tabular-nums">{formatInrTable(payment.amount)}</span>
            </DetailField>
            <DetailField label="Payment In Discount">{formatInrTable(0)}</DetailField>
            <DetailField label="Payment Mode">{paymentMethodLabel(payment.method)}</DetailField>
            <DetailField label="Bank">{bankLabel}</DetailField>
            <DetailField label="Notes">—</DetailField>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Invoices settled with this payment</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/60">
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Invoice Number</th>
                  <th className="px-4 py-3 text-right font-semibold">Invoice Amount</th>
                  <th className="px-4 py-3 text-right font-semibold">TDS</th>
                  <th className="px-4 py-3 text-right font-semibold">Discount</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount Received</th>
                  <th className="px-4 py-3 text-right font-semibold">Balance Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  className="border-b border-border cursor-pointer hover:bg-muted/30 focus-within:bg-muted/40"
                  tabIndex={0}
                  role="link"
                  onClick={() => router.push(invoiceNavHref)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(invoiceNavHref);
                    }
                  }}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatLedgerStyleDate(invoice.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-medium">{invoice.invoiceNumber}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatInrTable(invoice.grandTotal)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatInrTable(0)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatInrTable(0)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">
                    {formatInrTable(payment.amount)}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right tabular-nums font-medium",
                      balanceAfterPayment > 0.01 && "text-amber-700 dark:text-amber-500"
                    )}
                  >
                    {balanceAfterPayment.toFixed(1)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {outstanding > 0.01 && (
            <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
              Invoice still has {formatInrTable(outstanding)} outstanding after all payments.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
