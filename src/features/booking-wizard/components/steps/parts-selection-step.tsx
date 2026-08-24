"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  JobCardPartsPicker,
  type SelectedPartLine,
} from "@/components/job-cards/job-card-parts-picker";
import { cn } from "@/lib/utils";

type PartsSelectionStepProps = {
  useBookingWizard: boolean;
  selectedPartLines: SelectedPartLine[];
  onSelectedLinesChange: (lines: SelectedPartLine[]) => void;
};

/** Job-card-only parts step for the create booking / job wizard. */
export function PartsSelectionStep({
  useBookingWizard,
  selectedPartLines,
  onSelectedLinesChange,
}: PartsSelectionStepProps) {
  return (
    <Card>
      {!useBookingWizard && (
        <CardHeader>
          <CardTitle className="text-lg">Parts Selection</CardTitle>
        </CardHeader>
      )}
      <CardContent className={cn(useBookingWizard && "pt-4 sm:pt-6")}>
        <JobCardPartsPicker
          hideIntro={useBookingWizard}
          collapseSelected={useBookingWizard}
          selectedLines={selectedPartLines}
          onSelectedLinesChange={onSelectedLinesChange}
        />
      </CardContent>
    </Card>
  );
}
