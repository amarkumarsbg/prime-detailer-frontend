import type { LucideIcon } from "lucide-react";
import { FileSpreadsheet } from "lucide-react";

type ReportTableEmptyProps = {
  colSpan: number;
  message?: string;
  icon?: LucideIcon;
};

export function ReportTableEmpty({
  colSpan,
  message = "No transactions available to generate report",
  icon: Icon = FileSpreadsheet,
}: ReportTableEmptyProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-20 text-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Icon className="h-14 w-14 opacity-25 text-sky-500/80" aria-hidden />
          <p className="text-sm">{message}</p>
        </div>
      </td>
    </tr>
  );
}