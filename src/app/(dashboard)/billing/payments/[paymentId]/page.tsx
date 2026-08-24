import { Suspense } from "react";
import { PaymentInDetailClient } from "@/components/billing/payment-in-detail-client";

type PageProps = {
  params: Promise<{ paymentId: string }>;
};

export default async function PaymentInDetailPage({ params }: PageProps) {
  const { paymentId } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
          Loading payment…
        </div>
      }
    >
      <PaymentInDetailClient paymentId={decodeURIComponent(paymentId)} />
    </Suspense>
  );
}
