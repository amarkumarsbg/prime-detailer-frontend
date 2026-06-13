"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { JobCardStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useJobCardStore } from "@/store/job-card-store";
import { useBranchStore } from "@/store/branch-store";
import { useDashboardFilterStore, DASHBOARD_FILTER } from "@/store/dashboard-filter-store";
import { filterByBranchId, useBranchScope } from "@/lib/branch-scope";
import {
  isOverdueJobCard,
  isTodaysBookingsJob,
  isReadyForDeliveryJob,
  jobCardDeliveryAt,
} from "@/lib/dashboard-filters";
import { FilterBanner } from "@/components/shared/filter-banner";
import { formatDate, formatDateTime, cn } from "@/lib/utils";
import { sortByNewest } from "@/lib/sort-by-date";
import { normalizeRegistrationNumber } from "@/lib/vehicle-registration";
import type { JobCard, JobCardStatus } from "@/types";
import { Plus, LayoutGrid, List, ChevronDown } from "lucide-react";

const TAB_STATUSES: (JobCardStatus | "ALL")[] = [
  "ALL",
  "RECEIVED",
  "INSPECTION",
  "AWAITING_SERVICE",
  "QUALITY_CHECK",
  "READY",
  "DELIVERED",
  "CANCELLED",
];

const TAB_LABELS: Record<JobCardStatus | "ALL", string> = {
  ALL: "All",
  RECEIVED: "Received",
  INSPECTION: "Inspection",
  AWAITING_SERVICE: "Awaiting Service",
  QUALITY_CHECK: "Quality Check",
  READY: "Ready",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

const KANBAN_COLUMNS: JobCardStatus[] = [
  "RECEIVED",
  "INSPECTION",
  "AWAITING_SERVICE",
  "QUALITY_CHECK",
  "READY",
  "DELIVERED",
];

function compactRegForSearch(s: string): string {
  return normalizeRegistrationNumber(s).replace(/-/g, "").toLowerCase();
}

function jobCardMatchesSearch(jc: JobCard, queryRaw: string): boolean {
  const q = queryRaw.trim().toLowerCase();
  if (!q) return true;
  const qDigits = queryRaw.replace(/\D/g, "");
  const phoneDigits = jc.customerPhone.replace(/\D/g, "");
  const regCompact = compactRegForSearch(jc.vehicleRegNumber);
  const qCompact = compactRegForSearch(queryRaw);
  return (
    jc.jobNumber.toLowerCase().includes(q) ||
    jc.customerName.toLowerCase().includes(q) ||
    (qDigits.length > 0 && phoneDigits.includes(qDigits)) ||
    (qCompact.length > 0 && regCompact.includes(qCompact)) ||
    jc.vehicleRegNumber.toLowerCase().includes(q) ||
    (jc.vehicleMakeModel?.toLowerCase().includes(q) ?? false) ||
    (jc.services ?? []).some((s) => s.name.toLowerCase().includes(q))
  );
}

const KANBAN_COLORS: Record<JobCardStatus, string> = {
  RECEIVED: "border-t-blue-500",
  INSPECTION: "border-t-violet-500",
  AWAITING_SERVICE: "border-t-amber-500",
  QUALITY_CHECK: "border-t-cyan-500",
  READY: "border-t-emerald-500",
  DELIVERED: "border-t-green-500",
  CANCELLED: "border-t-red-500",
};

export default function JobCardsPage() {
  const router = useRouter();
  const { jobCards } = useJobCardStore();
  const branches = useBranchStore((s) => s.branches);
  const { selectedBranchId } = useBranchScope();
  const showBranchColumn = !selectedBranchId;
  const activeFilter = useDashboardFilterStore((s) => s.activeFilter);
  const setActiveFilter = useDashboardFilterStore((s) => s.setActiveFilter);
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [collapsedKanbanSections, setCollapsedKanbanSections] = useState<Set<JobCardStatus>>(
    () => new Set(KANBAN_COLUMNS.slice(1))
  );
  const kanbanCollapseSeeded = useRef(false);

  const toggleKanbanSection = useCallback((status: JobCardStatus) => {
    kanbanCollapseSeeded.current = true;
    setCollapsedKanbanSections((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }, []);

  const branchNameById = useMemo(
    () => Object.fromEntries(branches.map((b) => [b.id, b.name])),
    [branches]
  );

  const renderBranchLabel = useCallback(
    (branchId: string) => branchNameById[branchId] ?? branchId,
    [branchNameById]
  );

  const branchScopedJobCards = useMemo(
    () => filterByBranchId(jobCards, (jc) => jc.branchId, selectedBranchId),
    [jobCards, selectedBranchId]
  );

  const jobCardsForView = useMemo(() => {
    let list = branchScopedJobCards;
    if (activeFilter === DASHBOARD_FILTER.OVERDUE) {
      list = list.filter(isOverdueJobCard);
    } else if (activeFilter === DASHBOARD_FILTER.TODAYS_BOOKINGS) {
      list = list.filter(isTodaysBookingsJob);
    } else if (activeFilter === DASHBOARD_FILTER.READY_FOR_DELIVERY) {
      list = list.filter(isReadyForDeliveryJob);
    }
    return sortByNewest(list, "createdAt");
  }, [branchScopedJobCards, activeFilter]);

  /** Newest delivery / expected date first so the Delivery column reads in order. */
  const jobCardsForList = useMemo(
    () =>
      [...jobCardsForView].sort((a, b) =>
        new Date(jobCardDeliveryAt(b)).getTime() - new Date(jobCardDeliveryAt(a)).getTime()
      ),
    [jobCardsForView]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: jobCardsForView.length };
    jobCardsForView.forEach((jc) => {
      c[jc.status] = (c[jc.status] ?? 0) + 1;
    });
    return c;
  }, [jobCardsForView]);

  const visibleStatuses = useMemo(
    () =>
      TAB_STATUSES.filter(
        (status) => status === "ALL" || (counts[status] ?? 0) > 0
      ),
    [counts]
  );

  const moreStatuses = useMemo(
    () =>
      TAB_STATUSES.filter(
        (status) => status !== "ALL" && (counts[status] ?? 0) === 0
      ),
    [counts]
  );

  const isMoreTabActive = moreStatuses.includes(activeTab as JobCardStatus);

  const viewToggle = (
    <div
      className="flex shrink-0 items-center rounded-lg border border-border overflow-hidden"
      role="group"
      aria-label="View mode"
    >
      <button
        type="button"
        onClick={() => setViewMode("list")}
        aria-pressed={viewMode === "list"}
        title="List view"
        className={`flex h-8 w-8 items-center justify-center transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
      >
        <List className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setViewMode("kanban")}
        aria-pressed={viewMode === "kanban"}
        title="Board view"
        className={`flex h-8 w-8 items-center justify-center transition-colors ${viewMode === "kanban" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
      >
        <LayoutGrid className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  const kanbanData = useMemo(() => {
    const map: Record<string, JobCard[]> = {};
    KANBAN_COLUMNS.forEach((s) => { map[s] = []; });
    jobCardsForView.forEach((jc) => {
      if (jc.status !== "CANCELLED" && map[jc.status]) map[jc.status].push(jc);
    });
    KANBAN_COLUMNS.forEach((s) => {
      map[s] = sortByNewest(map[s] ?? [], "createdAt");
    });
    return map;
  }, [jobCardsForView]);

  useEffect(() => {
    if (kanbanCollapseSeeded.current) return;

    const firstWithJobs = KANBAN_COLUMNS.find((status) => (kanbanData[status]?.length ?? 0) > 0);
    if (!firstWithJobs) return;

    setCollapsedKanbanSections(
      new Set(KANBAN_COLUMNS.filter((status) => status !== firstWithJobs))
    );
    kanbanCollapseSeeded.current = true;
  }, [kanbanData]);

  const filteredJobCardsForListTab = useMemo(() => {
    if (activeTab === "ALL") return jobCardsForList;
    return jobCardsForList.filter((jc) => jc.status === activeTab);
  }, [jobCardsForList, activeTab]);

  const columns = useMemo(
    () => [
      {
        key: "jobNumber",
        label: "Job number",
        className: "align-top whitespace-nowrap w-[1%]",
        render: (item: JobCard) => (
          <span className="font-mono text-xs font-semibold text-primary">{item.jobNumber}</span>
        ),
      },
      ...(showBranchColumn
        ? [
            {
              key: "branchId",
              label: "Branch",
              className: "align-top whitespace-nowrap max-w-[9rem]",
              render: (item: JobCard) => (
                <span
                  className="text-sm text-muted-foreground truncate block"
                  title={renderBranchLabel(item.branchId)}
                >
                  {renderBranchLabel(item.branchId)}
                </span>
              ),
            },
          ]
        : []),
      {
        key: "customerName",
        label: "Customer",
        className: "align-top min-w-[10rem] max-w-[14rem]",
        render: (item: JobCard) => (
          <div className="space-y-0.5">
            <div className="font-medium leading-snug">{item.customerName}</div>
            <div className="text-xs text-muted-foreground whitespace-nowrap">{item.customerPhone}</div>
          </div>
        ),
      },
      {
        key: "vehicleRegNumber",
        label: "Vehicle",
        className: "align-top min-w-[9rem] max-w-[16rem]",
        render: (item: JobCard) => (
          <div className="space-y-0.5">
            <div className="font-mono text-xs font-medium leading-snug">{item.vehicleRegNumber}</div>
            <div className="text-xs text-muted-foreground line-clamp-2">{item.vehicleMakeModel}</div>
          </div>
        ),
      },
      {
        key: "mechanicName",
        label: "Mechanic",
        className: "align-top whitespace-nowrap text-muted-foreground max-w-[8rem]",
        render: (item: JobCard) => (
          <span className="line-clamp-2">{item.mechanicName ?? "—"}</span>
        ),
      },
      {
        key: "status",
        label: "Status",
        className: "align-top whitespace-nowrap w-[1%]",
        render: (item: JobCard) => (
          <JobCardStatusBadge status={item.status} className="whitespace-nowrap" />
        ),
      },
      {
        key: "expectedDelivery",
        label: "Delivery",
        sortable: true,
        sortValue: (item: JobCard) => jobCardDeliveryAt(item),
        className: "align-top whitespace-nowrap text-muted-foreground",
        render: (item: JobCard) =>
          item.status === "DELIVERED" ? (
            <span title="Delivered">{formatDateTime(item.actualDelivery ?? item.updatedAt)}</span>
          ) : (
            <span title="Expected">{formatDate(item.expectedDelivery)}</span>
          ),
      },
      {
        key: "createdAt",
        label: "Created",
        sortable: true,
        className: "align-top whitespace-nowrap text-muted-foreground",
        render: (item: JobCard) => formatDate(item.createdAt),
      },
    ],
    [showBranchColumn, renderBranchLabel]
  );

  const searchMatchJobCard = useCallback((jc: JobCard, qLower: string) => jobCardMatchesSearch(jc, qLower), []);

  return (
    <div className="space-y-4 sm:space-y-6 max-md:pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      <PageHeader
        title="Job Cards"
        inlineActionsOnMobile
        actions={
          <div className="flex items-center gap-2 shrink-0">
            {viewToggle}
            <Link href="/job-cards/new">
              <Button size="sm" className="h-8 px-3">
                <Plus className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline">New Job Card</span>
                <span className="sm:hidden">New</span>
              </Button>
            </Link>
          </div>
        }
      />

      {activeFilter === DASHBOARD_FILTER.OVERDUE && (
        <FilterBanner
          message="⚠ Showing overdue job cards — delivery date has passed"
          onDismiss={() => setActiveFilter(null)}
        />
      )}
      {activeFilter === DASHBOARD_FILTER.TODAYS_BOOKINGS && (
        <FilterBanner
          message="Showing job cards created today (calendar date)."
          onDismiss={() => setActiveFilter(null)}
        />
      )}
      {activeFilter === DASHBOARD_FILTER.READY_FOR_DELIVERY && (
        <FilterBanner
          message="Showing jobs in Ready status — ready for handover."
          onDismiss={() => setActiveFilter(null)}
        />
      )}

      {viewMode === "list" ? (
        <Card className="border-border/80 shadow-sm overflow-hidden">
          <CardContent className="pt-4 min-w-0 sm:pt-5">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0">
              <div className="mb-3 -mx-1 overflow-x-auto px-1 sm:mx-0 sm:px-0">
                <TabsList className="inline-flex h-auto w-max min-w-full flex-nowrap justify-start gap-1 bg-muted/50 p-1">
                    {visibleStatuses.map((status) => (
                      <TabsTrigger
                        key={status}
                        value={status}
                        className="h-8 shrink-0 px-2.5 text-xs data-[state=active]:shadow-sm sm:h-9 sm:px-3 sm:text-sm"
                      >
                        {TAB_LABELS[status]} ({counts[status] ?? 0})
                      </TabsTrigger>
                    ))}
                    {moreStatuses.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2.5 text-xs font-medium transition-colors sm:h-9 sm:px-3 sm:text-sm ${
                              isMoreTabActive
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                            }`}
                          >
                            More
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {moreStatuses.map((status) => (
                            <DropdownMenuItem
                              key={status}
                              onClick={() => setActiveTab(status)}
                            >
                              {TAB_LABELS[status]} (0)
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TabsList>
              </div>

              <div className="min-w-0 space-y-4" aria-live="polite">
                <DataTable<JobCard>
                  key={activeTab}
                  data={filteredJobCardsForListTab}
                  columns={columns}
                  defaultSortKey="expectedDelivery"
                  defaultSortDir="desc"
                  searchPlaceholder="Search jobs, customers, vehicles..."
                  searchMatch={searchMatchJobCard}
                  pageSize={10}
                  mobileCardClassName="p-2.5"
                  onRowClick={(item) => router.push(`/job-cards/${item.id}`)}
                  renderMobileCard={(jc) => (
                    <div className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-0.5">
                      <span className="font-mono text-xs font-semibold text-primary">
                        {jc.jobNumber}
                      </span>
                      <JobCardStatusBadge
                        status={jc.status}
                        className="shrink-0 justify-self-end row-span-1"
                      />
                      {showBranchColumn && (
                        <span className="col-span-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground truncate">
                          {renderBranchLabel(jc.branchId)}
                        </span>
                      )}
                      <p className="col-span-2 text-sm font-medium leading-tight">
                        {jc.customerName}
                      </p>
                      <p className="col-span-2 text-xs text-muted-foreground">
                        {jc.customerPhone}
                      </p>
                      <p className="col-span-2 text-sm font-medium leading-tight mt-0.5">
                        {jc.vehicleRegNumber}
                      </p>
                      <p className="col-span-2 text-xs text-muted-foreground line-clamp-1">
                        {jc.vehicleMakeModel}
                      </p>
                      <div className="col-span-2 mt-1.5 pt-1.5 border-t border-border/80 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                        <span className="truncate min-w-0">
                          {jc.mechanicName ?? "Unassigned"}
                        </span>
                        <span className="shrink-0 tabular-nums">
                          {jc.status === "DELIVERED"
                            ? formatDateTime(jc.actualDelivery ?? jc.updatedAt)
                            : formatDate(jc.expectedDelivery)}
                        </span>
                      </div>
                    </div>
                  )}
                />
              </div>
            </Tabs>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: stacked full-width stage columns; md+: horizontal board */}
          <div className="flex flex-col gap-4 md:flex-row md:gap-3 md:overflow-x-auto pb-4 -mx-1 px-1">
          {KANBAN_COLUMNS.map((status) => {
            const sectionJobs = kanbanData[status] ?? [];
            const sectionCount = sectionJobs.length;
            const isCollapsed = collapsedKanbanSections.has(status);

            return (
            <div
              key={status}
              className={cn(
                "w-full md:shrink-0 md:w-[280px]",
                sectionCount === 0 && "max-md:hidden"
              )}
            >
              <div className={`rounded-xl border border-border/80 bg-card shadow-sm border-t-4 ${KANBAN_COLORS[status]}`}>
                <button
                  type="button"
                  onClick={() => toggleKanbanSection(status)}
                  aria-expanded={!isCollapsed}
                  className="md:hidden flex w-full items-center justify-between px-3 py-2.5 border-b border-border/80 bg-muted/20 text-left transition-colors hover:bg-muted/40"
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                        isCollapsed && "-rotate-90"
                      )}
                    />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground truncate">
                      {TAB_LABELS[status]}
                    </h3>
                  </div>
                  <span className="flex items-center justify-center min-w-6 h-6 px-1.5 rounded-full bg-background border border-border text-xs font-semibold tabular-nums shrink-0">
                    {sectionCount}
                  </span>
                </button>
                <div className="hidden md:flex items-center justify-between px-3 py-2.5 border-b border-border/80 bg-muted/20">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    {TAB_LABELS[status]}
                  </h3>
                  <span className="flex items-center justify-center min-w-6 h-6 px-1.5 rounded-full bg-background border border-border text-xs font-semibold tabular-nums">
                    {sectionCount}
                  </span>
                </div>
                <div
                  className={cn(
                    "p-2 space-y-2 md:max-h-[calc(100vh-260px)] md:overflow-y-auto",
                    isCollapsed && "max-md:hidden"
                  )}
                >
                  {sectionCount === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-1 py-10 text-xs text-muted-foreground">
                      <span>No jobs in this stage</span>
                    </div>
                  ) : (
                    sectionJobs.map((jc) => (
                      <div
                        key={jc.id}
                        onClick={() => router.push(`/job-cards/${jc.id}`)}
                        className="rounded-lg border border-border bg-card p-3 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all"
                      >
                        <div className="flex items-center justify-between mb-1.5 gap-2">
                          <span className="font-mono text-xs font-semibold text-primary">{jc.jobNumber}</span>
                          {showBranchColumn && (
                            <span className="text-[10px] text-muted-foreground truncate max-w-[48%]">
                              {renderBranchLabel(jc.branchId)}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium leading-tight">{jc.customerName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{jc.vehicleRegNumber} &middot; {jc.vehicleMakeModel}</p>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                          <span className="text-[10px] text-muted-foreground">
                            {jc.mechanicName ?? "Unassigned"}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDate(jc.expectedDelivery)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            );
          })}
          </div>
        </>
      )}
    </div>
  );
}
