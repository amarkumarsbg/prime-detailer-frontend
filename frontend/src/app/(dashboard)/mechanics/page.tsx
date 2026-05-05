"use client";

import { useMemo } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { JobCardStatusBadge } from "@/components/shared/status-badge";
import { useStaffStore } from "@/store/staff-store";
import { useJobCardStore } from "@/store/job-card-store";
import { getInitials } from "@/lib/utils";
import type { JobCard } from "@/types";
import {
  Wrench,
  Clock,
  CheckCircle2,
  AlertCircle,
  Timer,
  TrendingUp,
  ClipboardList,
} from "lucide-react";

interface MechanicStats {
  id: string;
  name: string;
  totalJobs: number;
  completedJobs: number;
  activeJobs: number;
  overdueJobs: number;
  avgCompletionDays: number;
  totalIncentiveEarned: number;
  currentLoad: JobCard[];
  completionRate: number;
}

export default function MechanicsPage() {
  const staff = useStaffStore((s) => s.staff);
  const jobCards = useJobCardStore((s) => s.jobCards);
  const mechanics = useMemo(
    () => staff.filter((s) => s.role === "MECHANIC"),
    [staff]
  );

  const mechanicStats = useMemo<MechanicStats[]>(() => {
    return mechanics.map((mech) => {
      const allJobs = jobCards.filter((jc) => jc.mechanicId === mech.id);
      const completed = allJobs.filter((jc) => jc.status === "DELIVERED");
      const active = allJobs.filter((jc) => !["DELIVERED", "CANCELLED"].includes(jc.status));
      const overdue = active.filter((jc) => new Date(jc.expectedDelivery) < new Date());

      const completionDays = completed.map((jc) => {
        const start = new Date(jc.createdAt).getTime();
        const end = jc.actualDelivery ? new Date(jc.actualDelivery).getTime() : new Date(jc.updatedAt).getTime();
        return (end - start) / (1000 * 60 * 60 * 24);
      });
      const avgDays = completionDays.length > 0 ? completionDays.reduce((a, b) => a + b, 0) / completionDays.length : 0;
      const totalIncentiveEarned = completed.reduce((sum, jc) => sum + (jc.incentiveAmount ?? 0), 0);

      return {
        id: mech.id,
        name: mech.name,
        totalJobs: allJobs.length,
        completedJobs: completed.length,
        activeJobs: active.length,
        overdueJobs: overdue.length,
        avgCompletionDays: Math.round(avgDays * 10) / 10,
        totalIncentiveEarned,
        currentLoad: active,
        completionRate: allJobs.length > 0 ? Math.round((completed.length / allJobs.length) * 100) : 0,
      };
    }).sort((a, b) => b.totalJobs - a.totalJobs);
  }, [mechanics, jobCards]);

  const totalActive = mechanicStats.reduce((s, m) => s + m.activeJobs, 0);
  const totalCompleted = mechanicStats.reduce((s, m) => s + m.completedJobs, 0);
  const totalOverdue = mechanicStats.reduce((s, m) => s + m.overdueJobs, 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="Mechanic Performance" />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="!flex !items-center gap-3 !px-4 !py-5 sm:!px-5 sm:!py-6">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <Wrench className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{mechanics.length}</p>
              <p className="text-xs text-muted-foreground">Mechanics</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="!flex !items-center gap-3 !px-4 !py-5 sm:!px-5 sm:!py-6">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalActive}</p>
              <p className="text-xs text-muted-foreground">Active Jobs</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="!flex !items-center gap-3 !px-4 !py-5 sm:!px-5 sm:!py-6">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalCompleted}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="!flex !items-center gap-3 !px-4 !py-5 sm:!px-5 sm:!py-6">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalOverdue}</p>
              <p className="text-xs text-muted-foreground">Overdue</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {mechanicStats.map((mech) => (
          <Card key={mech.id} className="hover:shadow-sm transition-all">
            <CardContent className="!px-5 !py-6 sm:!px-6 sm:!py-7">
              <div className="flex flex-col lg:flex-row lg:items-start gap-5">
                <div className="flex items-center gap-4 min-w-[200px]">
                  <Avatar className="w-12 h-12">
                    <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                      {getInitials(mech.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <Link href={`/staff/${mech.id}`} className="font-semibold hover:text-primary transition-colors">
                      {mech.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{mech.totalJobs} total jobs</p>
                  </div>
                </div>

                <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ClipboardList className="w-3 h-3" />Active
                    </div>
                    <p className="text-lg font-bold">{mech.activeJobs}</p>
                    {mech.overdueJobs > 0 && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        {mech.overdueJobs} overdue
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CheckCircle2 className="w-3 h-3" />Completed
                    </div>
                    <p className="text-lg font-bold">{mech.completedJobs}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Timer className="w-3 h-3" />Avg Time
                    </div>
                    <p className="text-lg font-bold">{mech.avgCompletionDays}d</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <TrendingUp className="w-3 h-3" />Completion
                    </div>
                    <p className="text-lg font-bold">{mech.completionRate}%</p>
                    <Progress value={mech.completionRate} className="h-1.5" />
                  </div>
                  {mech.totalIncentiveEarned > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        Incentive Earned
                      </div>
                      <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                        {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(mech.totalIncentiveEarned)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {mech.currentLoad.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Current Workload</p>
                  <div className="flex flex-wrap gap-2">
                    {mech.currentLoad.map((jc) => (
                      <Link key={jc.id} href={`/job-cards/${jc.id}`}>
                        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors text-xs">
                          <span className="font-mono font-medium">{jc.jobNumber}</span>
                          <JobCardStatusBadge status={jc.status} />
                          <span className="text-muted-foreground hidden sm:inline">{jc.vehicleRegNumber}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
