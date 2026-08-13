"use client";

import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export interface JobCardNotesPanelProps {
  notes: string;
  newNote: string;
  onNewNoteChange: (value: string) => void;
  onAddNote: () => void;
}

export function JobCardNotesPanel({
  notes,
  newNote,
  onNewNoteChange,
  onAddNote,
}: JobCardNotesPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-muted-foreground" />
          Notes &amp; details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {notes && (
          <div className="p-3 rounded-lg bg-muted/50 text-sm whitespace-pre-wrap">
            {notes}
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Textarea
            placeholder="Add a note..."
            value={newNote}
            onChange={(e) => onNewNoteChange(e.target.value)}
            rows={2}
            className="flex-1"
          />
          <Button onClick={onAddNote} variant="secondary" className="shrink-0 sm:self-end">
            Add Note
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
