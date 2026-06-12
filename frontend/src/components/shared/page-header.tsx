"use client";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && (
        <div
          className={cn(
            "flex w-full flex-wrap items-center gap-2 sm:w-auto sm:min-w-0 sm:justify-end",
            "max-md:sticky max-md:top-0 max-md:z-10 max-md:-mx-4 max-md:mb-1 max-md:border-b max-md:border-border/60",
            "max-md:bg-background/95 max-md:px-4 max-md:py-2.5 max-md:backdrop-blur-sm max-md:supports-[backdrop-filter]:bg-background/80"
          )}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
