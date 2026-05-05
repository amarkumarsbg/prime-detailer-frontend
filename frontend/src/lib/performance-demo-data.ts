import type { Branch } from "@/types";
import {
  shortBranchChartLabel,
  type BranchPerformanceMetrics,
} from "@/lib/performance-branch-metrics";

/**
 * Placeholder metrics for demos when there is no backend and no jobs fall in the selected period.
 * Branch ids align with seed branches (`br-main` Delhi, `br-002` Noida).
 */
export function getDemoBranchPerformance(
  branches: Branch[],
  selectedBranchId: string | null
): BranchPerformanceMetrics[] {
  const resolveName = (id: string, fallback: string) =>
    branches.find((b) => b.id === id)?.name?.trim() || fallback;

  const activeIds = new Set(
    branches.filter((b) => b.isActive !== false).map((b) => b.id)
  );

  const delhiName = resolveName("br-main", "Delhi");
  const noidaName = resolveName("br-002", "Noida");

  const all: BranchPerformanceMetrics[] = [
    {
      branchId: "br-main",
      branchName: delhiName,
      chartLabel: shortBranchChartLabel(delhiName),
      jobCount: 46,
      deliveredCount: 41,
      totalJobValue: 1_968_000,
      totalRewards: 31_240,
      onTimeAmongDelivered: 37,
      onTimeRatePct: 90.2,
      efficiencyPct: 89.1,
    },
    {
      branchId: "br-002",
      branchName: noidaName,
      chartLabel: shortBranchChartLabel(noidaName),
      jobCount: 33,
      deliveredCount: 29,
      totalJobValue: 1_412_500,
      totalRewards: 21_880,
      onTimeAmongDelivered: 27,
      onTimeRatePct: 93.1,
      efficiencyPct: 87.9,
    },
  ];

  if (selectedBranchId) {
    const match = all.find((r) => r.branchId === selectedBranchId);
    if (match) return [match];
    const label = resolveName(selectedBranchId, "Branch");
    return [
      {
        branchId: selectedBranchId,
        branchName: label,
        chartLabel: shortBranchChartLabel(label),
        jobCount: 24,
        deliveredCount: 21,
        totalJobValue: 892_000,
        totalRewards: 13_600,
        onTimeAmongDelivered: 19,
        onTimeRatePct: 90.5,
        efficiencyPct: 87.5,
      },
    ];
  }

  let list =
    activeIds.size === 0 ? [...all] : all.filter((r) => activeIds.has(r.branchId));
  if (list.length === 0) list = [...all];
  return list.sort((a, b) => b.totalJobValue - a.totalJobValue);
}
