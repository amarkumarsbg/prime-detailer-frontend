"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogMobileSheetContentClasses,
  dialogMobileSheetHeaderClasses,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getReportHrefForFavouriteKey } from "@/lib/reports/report-favourites";
import { useReportFavouritesStore } from "@/store/report-favourites-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  REPORT_PERIOD_OPTIONS,
  reportSelectItemClass,
} from "@/lib/reports/report-period-presets";
import { ReportPeriodSelect } from "./report-period-select";
import {
  reportMobileActionButtonClass,
  reportMobileActionsClass,
  reportMobileBackLinkClass,
  reportMobileContentClass,
  reportMobileFavButtonClass,
  reportMobileFilterSlotClass,
  reportMobileFiltersRowClass,
  reportMobileTitleClass,
  reportMobileTitleRowClass,
} from "@/lib/reports/report-mobile-ui";
import { ReportTableScrollHint } from "@/components/reports/report-table-scroll-hint";
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  Download,
  Mail,
  Printer,
  Star,
} from "lucide-react";
import { toast } from "sonner";

type ReportPageChromeProps = {
  title: string;
  favouriteStorageKey: string;
  emailReportName: string;
  period: string;
  onPeriodChange: (v: string) => void;
  showPeriod?: boolean;
  filterSlot?: ReactNode;
  titleAccessory?: ReactNode;
  onDownloadCsv?: () => void;
  onPrintPdf?: () => void;
  children: ReactNode;
};

export function ReportPageChrome({
  title,
  favouriteStorageKey,
  emailReportName,
  period,
  onPeriodChange,
  filterSlot,
  titleAccessory,
  showPeriod = true,
  onDownloadCsv,
  onPrintPdf,
  children,
}: ReportPageChromeProps) {
  const reportHref = getReportHrefForFavouriteKey(favouriteStorageKey);
  const favourite = useReportFavouritesStore((s) =>
    reportHref ? s.hrefs.includes(reportHref) : false
  );
  const setFavourited = useReportFavouritesStore((s) => s.setFavourited);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailYour, setEmailYour] = useState("agenciessamriddhi@gmail.com");
  const [emailCa, setEmailCa] = useState("nka.clients@gmail.com");

  const toggleFavourite = () => {
    if (!reportHref) return;
    void setFavourited(reportHref, !favourite).catch(() => {
      toast.error("Could not update favourite");
    });
  };

  const printPdf = () => {
    if (onPrintPdf) onPrintPdf();
    else {
      toast.message("Print PDF", {
        description: "Use your browser print dialog to save as PDF.",
      });
      window.print();
    }
  };

  const sendEmail = () => {
    if (!emailYour.trim()) {
      toast.error("Enter your email.");
      return;
    }
    toast.success("Report queued", { description: `Sending to ${emailYour.trim()}` });
    setEmailOpen(false);
  };

  const downloadExcel = () => {
    if (onDownloadCsv) onDownloadCsv();
    else toast.message("Nothing to export");
  };

  return (
    <div className="space-y-4 print:space-y-3 max-md:space-y-3">
      <div className="flex flex-col gap-4 print:hidden max-md:gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between max-md:gap-2.5">
          <div className={reportMobileTitleRowClass}>
            <Button
              variant="ghost"
              size="sm"
              className={cn("-ml-2 shrink-0", reportMobileBackLinkClass)}
              asChild
            >
              <Link href="/reports" aria-label="Back to Reports">
                <ArrowLeft className="mr-2 h-4 w-4" />
                <span>Reports</span>
              </Link>
            </Button>
            <h1 className={reportMobileTitleClass}>{title}</h1>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "gap-1.5 border-amber-300/80 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100",
                reportMobileFavButtonClass
              )}
              onClick={toggleFavourite}
              aria-label={favourite ? "Remove from favourites" : "Add to favourites"}
            >
              <Star
                className={`h-4 w-4 ${favourite ? "fill-amber-400 text-amber-500" : "text-muted-foreground"}`}
              />
              <span>Favourite</span>
            </Button>
            {titleAccessory}
          </div>

          <div className={reportMobileActionsClass}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn("gap-2 border-sky-200/80", reportMobileActionButtonClass)}
              onClick={() => setEmailOpen(true)}
            >
              <Mail className="h-4 w-4 shrink-0" />
              <span>Email</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "gap-1 border-sky-200/80 bg-background",
                    reportMobileActionButtonClass
                  )}
                >
                  <Download className="h-4 w-4 shrink-0" />
                  <span>Export</span>
                  <ChevronDown className="hidden h-3.5 w-3.5 opacity-60 md:inline" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={downloadExcel}>Download Excel</DropdownMenuItem>
                <DropdownMenuItem onClick={printPdf}>Download Pdf</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn("gap-2 border-sky-200/80", reportMobileActionButtonClass)}
              onClick={printPdf}
            >
              <Printer className="h-4 w-4 shrink-0" />
              <span>Print</span>
            </Button>
          </div>
        </div>

        <div className={reportMobileFiltersRowClass}>
          {showPeriod && (
            <ReportPeriodSelect value={period} onChange={onPeriodChange} />
          )}
          {filterSlot ? <div className={reportMobileFilterSlotClass}>{filterSlot}</div> : null}
        </div>
      </div>

      <div className={reportMobileContentClass}>
        <ReportTableScrollHint />
        {children}
      </div>

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className={cn(dialogMobileSheetContentClasses, "sm:max-w-md")}>
          <DialogHeader className={dialogMobileSheetHeaderClasses}>
            <DialogTitle>Email Excel Report</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            We will send you the {emailReportName} report to the email below
          </p>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="report-email-you">
                Your Email ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="report-email-you"
                type="email"
                value={emailYour}
                onChange={(e) => setEmailYour(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="report-email-ca">CA Email ID (Optional)</Label>
              <Input
                id="report-email-ca"
                type="email"
                value={emailCa}
                onChange={(e) => setEmailCa(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setEmailOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-violet-600 hover:bg-violet-700"
              onClick={sendEmail}
            >
              Send Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
