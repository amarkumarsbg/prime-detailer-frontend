"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isDuplicateNavTitle, navDescriptionForPath, navTitleForPath } from "@/lib/nav-items";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  /** Keep title and actions on one row below `sm` (e.g. single primary CTA). */
  inlineActionsOnMobile?: boolean;
  /** Hide description below `md` to save vertical space on phones. */
  hideDescriptionOnMobile?: boolean;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
  inlineActionsOnMobile = false,
  hideDescriptionOnMobile = false,
}: PageHeaderProps) {
  const pathname = usePathname();
  const showTitle = useMemo(
    () => !isDuplicateNavTitle(title, navTitleForPath(pathname)),
    [pathname, title]
  );
  const resolvedDescription = description ?? navDescriptionForPath(pathname);
  const showDescription = Boolean(resolvedDescription);
  const showLead = showTitle || showDescription;
  const mobileLeadEmpty = !showTitle && showDescription && hideDescriptionOnMobile;

  if (!showLead && !actions) {
    return null;
  }

  return (
    <div
      className={cn(
        "mb-6 flex gap-3",
        mobileLeadEmpty && !actions && "hidden md:flex",
        !showLead
          ? "flex-row items-center justify-end"
          : mobileLeadEmpty
            ? "flex-row items-center justify-end md:justify-between"
            : inlineActionsOnMobile || !showTitle
              ? "flex-row items-center justify-between"
              : "flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      {showLead ? (
        <div
          className={cn(
            "min-w-0 space-y-1",
            (inlineActionsOnMobile || !showTitle) && "flex-1",
            mobileLeadEmpty && "hidden md:block"
          )}
        >
          {showTitle ? (
            <h1
              className={cn(
                "font-bold tracking-tight text-foreground",
                inlineActionsOnMobile ? "text-xl sm:text-2xl" : "text-2xl"
              )}
            >
              {title}
            </h1>
          ) : null}
          {showDescription ? (
            <p
              className={cn(
                "max-w-3xl text-sm leading-relaxed text-muted-foreground",
                hideDescriptionOnMobile && "hidden md:block"
              )}
            >
              {resolvedDescription}
            </p>
          ) : null}
        </div>
      ) : null}
      {actions && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2",
            !showLead || inlineActionsOnMobile || !showTitle || mobileLeadEmpty
              ? "w-auto shrink-0 justify-end"
              : cn(
                  "w-full sm:w-auto sm:min-w-0 sm:justify-end",
                  "max-md:sticky max-md:top-0 max-md:z-10 max-md:-mx-4 max-md:mb-1 max-md:border-b max-md:border-border/60",
                  "max-md:bg-background/95 max-md:px-4 max-md:py-2.5 max-md:backdrop-blur-sm max-md:supports-[backdrop-filter]:bg-background/80"
                )
          )}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
