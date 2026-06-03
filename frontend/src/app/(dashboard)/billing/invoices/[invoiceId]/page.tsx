import { Suspense } from "react";
import { SalesInvoiceDetailClient } from "@/components/billing/sales-invoice-detail-client";

type PageProps = {
  params: Promise<{ invoiceId: string }>;
};

export default async function SalesInvoiceDetailPage({ params }: PageProps) {
  const { invoiceId } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
          Loading invoice…
        </div>
      }
    >
      <SalesInvoiceDetailClient invoiceId={decodeURIComponent(invoiceId)} />
    </Suspense>
  );
}
