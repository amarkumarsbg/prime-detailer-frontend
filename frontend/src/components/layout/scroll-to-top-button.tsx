"use client";

import { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SHOW_AFTER_PX = 280;

export function ScrollToTopButton({
  scrollContainerRef,
}: {
  scrollContainerRef: React.RefObject<HTMLElement | null>;
}) {
  const [visible, setVisible] = useState(false);

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
        "fixed bottom-6 right-6 z-40 h-11 w-11 rounded-full shadow-lg md:right-8",
        "transition-opacity duration-200",
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      )}
      aria-label="Page up"
      title="Page up"
      onClick={() =>
        scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" })
      }
    >
      <ChevronUp className="h-5 w-5" />
    </Button>
  );
}
