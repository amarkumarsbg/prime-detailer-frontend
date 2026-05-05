"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  /** localStorage key for favourite toggle */
  favouriteStorageKey: string;
  /** Shown in email modal body, e.g. "GSTR-3B" */
  emailReportName: string;
  period: string;
  onPeriodChange: (v: string) => void;
  /** Hide the period dropdown (e.g. Rate List). */
  showPeriod?: boolean;
  /** Optional row below period (filters). */
  filterSlot?: ReactNode;
  /** e.g. help icon next to the title */
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
  const [favourite, setFavourite] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailYour, setEmailYour] = useState("agenciessamriddhi@gmail.com");
  const [emailCa, setEmailCa] = useState("nka.clients@gmail.com");

  useEffect(() => {
    try {
      setFavourite(localStorage.getItem(favouriteStorageKey) === "1");
    } catch {
      /* ignore */
    }
  }, [favouriteStorageKey]);

  const toggleFavourite = () => {
    const next = !favourite;
    setFavourite(next);
    try {
      localStorage.setItem(favouriteStorageKey, next ? "1" : "0");
    } catch {
      /* ignore */
    }
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
    toast.success("Report queued (demo)", { description: `Would email ${emailYour.trim()}` });
    setEmailOpen(false);
  };

  return (
    <div className="space-y-4 print:space-y-3">
      <div className="flex flex-col gap-4 print:hidden">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" className="-ml-2 shrink-0" asChild>
              <Link href="/reports">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Reports
              </Link>
            </Button>
            <h1 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
              {title}
            </h1>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 border-amber-300/80 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
              onClick={toggleFavourite}
            >
              <Star
                className={`h-4 w-4 ${favourite ? "fill-amber-400 text-amber-500" : "text-muted-foreground"}`}
              />
              Favourite
            </Button>
            {titleAccessory}
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 border-sky-200/80"
              onClick={() => setEmailOpen(true)}
            >
              <Mail className="h-4 w-4" />
              Email Excel
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1 border-sky-200/80 bg-background">
                  <Download className="h-4 w-4" />
                  Download Excel
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    if (onDownloadCsv) onDownloadCsv();
                    else toast.message("Nothing to export");
                  }}
                >
                  Download Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={printPdf}>Download Pdf</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 border-sky-200/80"
              onClick={printPdf}
            >
              <Printer className="h-4 w-4" />
              Print PDF
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {showPeriod && (
            <Select value={period} onValueChange={onPeriodChange}>
              <SelectTrigger className="h-9 w-[200px] border-violet-300/60 bg-background">
                <CalendarDays className="mr-2 h-4 w-4 shrink-0 text-primary" />
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent position="popper" className="min-w-[var(--radix-select-trigger-width)]">
                {REPORT_PERIOD_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className={reportSelectItemClass}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {filterSlot}
        </div>
      </div>

      {children}

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
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
