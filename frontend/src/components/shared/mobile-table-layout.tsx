"use client";

import { cn } from "@/lib/utils";

/** Vertical card list — visible below `md` only. */
export function MobileCardList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-3 md:hidden", className)}>{children}</div>;
}

/** Table wrapper — hidden on phone, scrollable from `md` up. */
export function DesktopTableWrap({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("hidden md:block overflow-x-auto", className)}>{children}</div>;
}

/** Standard finance / ledger row card for mobile. */
export function MobileRowCard({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        "rounded-lg border border-border bg-card p-4 text-sm shadow-sm",
        onClick && "cursor-pointer transition-colors hover:bg-muted/40 hover:border-primary/30",
        className
      )}
    >
      {children}
    </div>
  );
}
