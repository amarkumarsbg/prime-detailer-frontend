"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { QuotationStatus } from "@/types";
import type { ReactNode } from "react";

export const QUOTATION_TAB_VALUES: (QuotationStatus | "ALL")[] = [
  "ALL",
  "DRAFT",
  "SENT",
  "APPROVED",
  "REJECTED",
  "CONVERTED",
];

export const QUOTATION_TAB_LABELS: Record<QuotationStatus | "ALL", string> = {
  ALL: "All",
  DRAFT: "Draft",
  SENT: "Sent",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CONVERTED: "Converted",
};

export function quotationCanConvertToJob(status: QuotationStatus): boolean {
  return status !== "CONVERTED" && status !== "REJECTED";
}

export interface QuotationStatusFiltersProps {
  activeTab: string;
  onTabChange: (value: string) => void;
  tabCounts: Partial<Record<QuotationStatus | "ALL", number>>;
  /** Renders each tab’s list/table body. */
  renderTabContent: (tab: QuotationStatus | "ALL") => ReactNode;
}

/** Status filter tabs bar + per-tab content slots for the quotations list. */
export function QuotationStatusFilters({
  activeTab,
  onTabChange,
  tabCounts,
  renderTabContent,
}: QuotationStatusFiltersProps) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto bg-muted/50 p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {QUOTATION_TAB_VALUES.map((tab) => (
          <TabsTrigger key={tab} value={tab} className="data-[state=active]:shadow-sm">
            {QUOTATION_TAB_LABELS[tab]} ({tabCounts[tab] ?? 0})
          </TabsTrigger>
        ))}
      </TabsList>

      {QUOTATION_TAB_VALUES.map((tab) => (
        <TabsContent key={tab} value={tab} className="mt-6 focus-visible:outline-none">
          {renderTabContent(tab)}
        </TabsContent>
      ))}
    </Tabs>
  );
}
