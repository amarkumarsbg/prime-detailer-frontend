"use client";

import Link from "next/link";
import { AnalyticsReportsDashboard } from "@/components/analytics";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function ReportsAnalyticsPage() {
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/reports">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Reports hub
        </Link>
      </Button>
      <AnalyticsReportsDashboard />
    </div>
  );
}
