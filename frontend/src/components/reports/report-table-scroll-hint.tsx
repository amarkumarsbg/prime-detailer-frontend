/** Shown below md only — tables stay horizontally scrollable on phone. */
export function ReportTableScrollHint() {
  return (
    <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground md:hidden">
      <span aria-hidden className="text-base leading-none">
        ↔
      </span>
      Swipe tables horizontally to view all columns
    </p>
  );
}
