"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { safeReturnTo } from "@/lib/navigation/return-to";
import { cn } from "@/lib/utils";

type DetailBackButtonProps = {
  fallbackHref?: string;
  className?: string;
  /** When true, uses router.back() if there is no `from` query param. */
  preferHistoryBack?: boolean;
};

export function DetailBackButton({
  fallbackHref = "/billing",
  className,
  preferHistoryBack = true,
}: DetailBackButtonProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = safeReturnTo(searchParams.get("from"));

  const handleBack = () => {
    if (from) {
      router.push(from);
      return;
    }
    if (preferHistoryBack && typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("shrink-0", className)}
      onClick={handleBack}
      aria-label="Go back"
    >
      <ArrowLeft className="h-4 w-4" />
    </Button>
  );
}
