"use client";

import { ArrowRightCircle, ClipboardList, ChevronRight, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/** Presentational conversion-flow banner shown above the quotations KPI row. */
export function QuotationWorkflowBanner() {
  return (
    <Card className="overflow-hidden border-border/80 shadow-sm">
      <div className="h-1 bg-linear-to-r from-primary via-primary/70 to-primary/40" aria-hidden />
      <CardContent className="py-4 sm:py-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center mb-4">
          Typical workflow
        </p>
        <div className="flex items-center justify-center gap-1 sm:gap-3 flex-wrap max-w-2xl mx-auto">
          <div className="flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 px-4 py-2.5 shadow-sm">
            <FileText className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-semibold text-foreground">Quotation</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/70 shrink-0 hidden sm:block" />
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-2.5">
            <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium text-muted-foreground">Job card</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/70 shrink-0 hidden sm:block" />
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-2.5">
            <ArrowRightCircle className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium text-muted-foreground">Invoice</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
