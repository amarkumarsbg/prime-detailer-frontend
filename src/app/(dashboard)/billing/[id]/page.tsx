"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { salesInvoiceDetailPath } from "@/lib/billing/payment-helpers";

/** Legacy URL `/billing/:id` → MyBillBook-style `/billing/invoices/:id` */
export default function LegacyBillingInvoiceRedirect() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;

  useEffect(() => {
    if (!id || id === "payments" || id === "invoices") return;
    const q = searchParams.toString();
    const target = salesInvoiceDetailPath(id);
    router.replace(q ? `${target}?${q}` : target);
  }, [id, router, searchParams]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
      Opening invoice…
    </div>
  );
}
