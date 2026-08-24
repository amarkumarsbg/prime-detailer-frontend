import type { JobCard } from "@/types";

export type StaffJobStats = {
  /** All job cards assigned to this staff member (by mechanicId). */
  total: number;
  completed: number;
  active: number;
  cancelled: number;
  completedJobs: JobCard[];
  activeJobs: JobCard[];
  cancelledJobs: JobCard[];
  totalIncentiveEarned: number;
};

function sortJobsNewestFirst(jobs: JobCard[]): JobCard[] {
  return [...jobs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/** Live counts from job cards — do not use stale User.totalJobsCompleted from the database. */
export function getStaffJobStats(jobCards: JobCard[], staffId: string): StaffJobStats {
  const assigned = jobCards.filter((j) => j.mechanicId === staffId);
  const completedJobs = assigned.filter((j) => j.status === "DELIVERED");
  const cancelledJobs = assigned.filter((j) => j.status === "CANCELLED");
  const activeJobs = assigned.filter(
    (j) => !["DELIVERED", "CANCELLED"].includes(j.status)
  );
  const totalIncentiveEarned = completedJobs.reduce(
    (sum, j) => sum + (j.incentiveAmount ?? 0),
    0
  );

  return {
    total: assigned.length,
    completed: completedJobs.length,
    active: activeJobs.length,
    cancelled: cancelledJobs.length,
    completedJobs: sortJobsNewestFirst(completedJobs),
    activeJobs: sortJobsNewestFirst(activeJobs),
    cancelledJobs: sortJobsNewestFirst(cancelledJobs),
    totalIncentiveEarned,
  };
}
