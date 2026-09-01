"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { QUICK_INTERNAL_NOTES, QUICK_CUSTOMER_NOTES } from "@/features/booking-wizard/constants";

type NotesStepProps = {
  internalNotes: string;
  customerNotes: string;
  onInternalNotesChange: (value: string) => void;
  onCustomerNotesChange: (value: string) => void;
  onAppendQuickInternalNote: (note: string) => void;
  onAppendQuickCustomerNote: (note: string) => void;
};

export function NotesStep({
  internalNotes,
  customerNotes,
  onInternalNotesChange,
  onCustomerNotesChange,
  onAppendQuickInternalNote,
  onAppendQuickCustomerNote,
}: NotesStepProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Internal Notes (Not visible to customer)</Label>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_INTERNAL_NOTES.map((note) => (
              <Button
                key={note}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onAppendQuickInternalNote(note)}
              >
                <Check className="h-3 w-3 mr-1 text-primary" />
                {note}
              </Button>
            ))}
          </div>
          <Textarea
            value={internalNotes}
            onChange={(e) => onInternalNotesChange(e.target.value)}
            placeholder="Add any internal notes for staff..."
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label>Customer Notes (Visible to customer)</Label>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_CUSTOMER_NOTES.map((note) => (
              <Button
                key={note}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onAppendQuickCustomerNote(note)}
              >
                <Check className="h-3 w-3 mr-1 text-primary" />
                {note}
              </Button>
            ))}
          </div>
          <Textarea
            value={customerNotes}
            onChange={(e) => onCustomerNotesChange(e.target.value)}
            placeholder="Add any notes for the customer..."
            rows={2}
          />
        </div>
      </CardContent>
    </Card>
  );
}

type JobDetailsStepProps = {
  reportedIssues: string;
  termsAndConditions: string;
  onReportedIssuesChange: (value: string) => void;
  onTermsAndConditionsChange: (value: string) => void;
};

export function JobDetailsStep({
  reportedIssues,
  termsAndConditions,
  onReportedIssuesChange,
  onTermsAndConditionsChange,
}: JobDetailsStepProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Job details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="reportedIssues">Reported issues</Label>
          <Textarea
            id="reportedIssues"
            placeholder="Describe issues reported by the customer"
            value={reportedIssues}
            onChange={(e) => onReportedIssuesChange(e.target.value)}
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="termsAndConditions">Terms &amp; conditions</Label>
          <Textarea
            id="termsAndConditions"
            value={termsAndConditions}
            onChange={(e) => onTermsAndConditionsChange(e.target.value)}
            rows={3}
          />
        </div>
      </CardContent>
    </Card>
  );
}
