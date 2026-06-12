"use client";

import type { ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogMobileSheetContentClasses,
  dialogMobileSheetHeaderClasses,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type MobileFilterSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: ReactNode;
  activeCount?: number;
  onApply?: () => void;
  onReset?: () => void;
};

export function MobileFilterSheet({
  open,
  onOpenChange,
  title = "Filters",
  children,
  activeCount = 0,
  onApply,
  onReset,
}: MobileFilterSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          dialogMobileSheetContentClasses,
          "max-h-[85vh] gap-0 overflow-hidden sm:max-w-md"
        )}
      >
        <DialogHeader className={dialogMobileSheetHeaderClasses}>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">{children}</div>
        <DialogFooter className="shrink-0 flex-col gap-2 border-t border-border/60 px-6 py-4 sm:flex-col">
          {onReset ? (
            <Button type="button" variant="outline" className="w-full" onClick={onReset}>
              Reset filters
            </Button>
          ) : null}
          <Button
            type="button"
            className="w-full"
            onClick={() => {
              onApply?.();
              onOpenChange(false);
            }}
          >
            Apply filters
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Opens the mobile filter sheet — hidden from `md` up. */
export function MobileFilterTrigger({
  onClick,
  activeCount = 0,
  className,
}: {
  onClick: () => void;
  activeCount?: number;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("relative w-full justify-center gap-2 md:hidden", className)}
      onClick={onClick}
    >
      <SlidersHorizontal className="size-4" aria-hidden />
      Filters
      {activeCount > 0 ? (
        <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
          {activeCount}
        </span>
      ) : null}
    </Button>
  );
}
