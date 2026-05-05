import { Suspense } from "react";
import { MembershipPageClient } from "@/components/membership/membership-page-client";

export default function MembershipPage() {
  return (
    <Suspense
      fallback={
        <div className="text-sm text-muted-foreground" aria-busy>
          Loading membership…
        </div>
      }
    >
      <MembershipPageClient />
    </Suspense>
  );
}
