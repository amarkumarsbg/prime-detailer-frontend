"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SHOW_AFTER_PX = 280;

/** Pages with a sticky action bar above the bottom nav need a higher scroll button. */
const STICKY_ACTION_BAR_PATHS = new Set(["/referrals"]);

/** List pages where the scroll button sits on the left to avoid obscuring row actions. */
const SCROLL_BUTTON_LEFT_PREFIXES = ["/billing", "/parties", "/payroll", "/job-cards"];

export function ScrollToTopButton({
  scrollContainerRef,
}: {
  scrollContainerRef: React.RefObject<HTMLElement | null>;
}) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const hasStickyActionBar = STICKY_ACTION_BAR_PATHS.has(pathname);
  const useLeftPosition = SCROLL_BUTTON_LEFT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const onScroll = () => {
      setVisible(el.scrollTop > SHOW_AFTER_PX);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollContainerRef]);

  return (
    <Button
      type="button"
      variant="default"
      size="icon"
      className={cn(
        "fixed z-40 h-8 w-8 rounded-full shadow-md md:bottom-6 md:right-8 md:h-10 md:w-10",
        useLeftPosition ? "left-3 right-auto md:left-auto" : "right-3 md:right-8",
        hasStickyActionBar
          ? "bottom-[calc(8rem+env(safe-area-inset-bottom))]"
          : "bottom-[calc(6.25rem+env(safe-area-inset-bottom))]",
        "transition-opacity duration-200",
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      )}
      aria-label="Page up"
      title="Page up"
      onClick={() =>
        scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" })
      }
    >
      <ChevronUp className="h-4 w-4 md:h-5 md:w-5" />
    </Button>
  );
}
