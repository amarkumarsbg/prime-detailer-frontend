"use client";

import { useMemo } from "react";
import { useJobCardStore } from "@/store/job-card-store";
import { useInvoiceStore } from "@/store/invoice-store";
import { useExpenseStore } from "@/store/expense-store";
import { useStaffStore } from "@/store/staff-store";
import { usePickupDropStore } from "@/store/pickup-drop-store";
import { useReminderStore } from "@/store/reminder-store";
import { useActivityLogStore } from "@/store/activity-log-store";
import { useAppointmentStore } from "@/store/appointment-store";
import { useFollowUpStore } from "@/store/follow-up-store";
import { useNotificationStore } from "@/store/notification-store";
import {
  applyInvoiceBranchFilters,
  buildJobBranchMap,
  filterAppointmentsByBranch,
  filterByBranchId,
  filterFollowUpsByBranch,
  filterInvoicesByBranch,
  filterRemindersByBranch,
  filterActivityByBranch,
  useBranchScope,
} from "@/lib/branch-scope";
import {
  buildNotificationBranchContext,
  filterNotificationsByBranch,
} from "@/lib/notification-branch-scope";

/** Job cards scoped to the header branch (or all when org-wide). */
export function useScopedJobCards() {
  const jobCards = useJobCardStore((s) => s.jobCards);
  const { selectedBranchId } = useBranchScope();
  return useMemo(
    () => filterByBranchId(jobCards, (j) => j.branchId, selectedBranchId),
    [jobCards, selectedBranchId]
  );
}

export function useScopedInvoices() {
  const invoices = useInvoiceStore((s) => s.invoices);
  const jobCards = useJobCardStore((s) => s.jobCards);
  const { selectedBranchId } = useBranchScope();
  return useMemo(
    () => filterInvoicesByBranch(invoices, jobCards, selectedBranchId),
    [invoices, jobCards, selectedBranchId]
  );
}

export function useScopedExpenses() {
  const expenses = useExpenseStore((s) => s.expenses);
  const { selectedBranchId } = useBranchScope();
  return useMemo(
    () => filterByBranchId(expenses, (e) => e.branchId, selectedBranchId),
    [expenses, selectedBranchId]
  );
}

export function useScopedStaff() {
  const staff = useStaffStore((s) => s.staff);
  const { selectedBranchId } = useBranchScope();
  return useMemo(
    () => filterByBranchId(staff, (s) => s.branchId, selectedBranchId),
    [staff, selectedBranchId]
  );
}

export function useScopedPickupRequests() {
  const requests = usePickupDropStore((s) => s.requests);
  const { selectedBranchId } = useBranchScope();
  return useMemo(
    () => filterByBranchId(requests, (r) => r.branchId, selectedBranchId),
    [requests, selectedBranchId]
  );
}

export function useScopedReminders() {
  const reminders = useReminderStore((s) => s.reminders);
  const jobCards = useJobCardStore((s) => s.jobCards);
  const { selectedBranchId } = useBranchScope();
  return useMemo(
    () => filterRemindersByBranch(reminders, jobCards, selectedBranchId),
    [reminders, jobCards, selectedBranchId]
  );
}

export function useScopedActivityLogs() {
  const logs = useActivityLogStore((s) => s.logs);
  const jobCards = useJobCardStore((s) => s.jobCards);
  const invoices = useInvoiceStore((s) => s.invoices);
  const expenses = useExpenseStore((s) => s.expenses);
  const { selectedBranchId } = useBranchScope();
  return useMemo(
    () => filterActivityByBranch(logs, jobCards, invoices, expenses, selectedBranchId),
    [logs, jobCards, invoices, expenses, selectedBranchId]
  );
}

export function useJobBranchMap() {
  const jobCards = useJobCardStore((s) => s.jobCards);
  return useMemo(() => buildJobBranchMap(jobCards), [jobCards]);
}

export function useScopedAppointments() {
  const appointments = useAppointmentStore((s) => s.appointments);
  const jobCards = useJobCardStore((s) => s.jobCards);
  const { selectedBranchId } = useBranchScope();
  return useMemo(
    () => filterAppointmentsByBranch(appointments, jobCards, selectedBranchId),
    [appointments, jobCards, selectedBranchId]
  );
}

export function useScopedFollowUps() {
  const followUps = useFollowUpStore((s) => s.followUps);
  const jobCards = useJobCardStore((s) => s.jobCards);
  const { selectedBranchId } = useBranchScope();
  return useMemo(
    () => filterFollowUpsByBranch(followUps, jobCards, selectedBranchId),
    [followUps, jobCards, selectedBranchId]
  );
}

/** Notifications filtered by header branch (All branches = full list). */
export function useScopedNotifications() {
  const notifications = useNotificationStore((s) => s.notifications);
  const jobCards = useJobCardStore((s) => s.jobCards);
  const invoices = useInvoiceStore((s) => s.invoices);
  const expenses = useExpenseStore((s) => s.expenses);
  const pickupRequests = usePickupDropStore((s) => s.requests);
  const { selectedBranchId } = useBranchScope();

  const ctx = useMemo(
    () => buildNotificationBranchContext(jobCards, invoices, expenses, pickupRequests),
    [jobCards, invoices, expenses, pickupRequests]
  );

  return useMemo(
    () => filterNotificationsByBranch(notifications, selectedBranchId, ctx),
    [notifications, selectedBranchId, ctx]
  );
}

export function useScopedInvoicesWithPageFilter(
  pageBranchFilter: string,
  showBranchPicker: boolean,
  selectedBranchId: string | null
) {
  const invoices = useInvoiceStore((s) => s.invoices);
  const jobCards = useJobCardStore((s) => s.jobCards);
  return useMemo(
    () =>
      applyInvoiceBranchFilters(
        invoices,
        jobCards,
        selectedBranchId,
        showBranchPicker,
        pageBranchFilter
      ),
    [invoices, jobCards, selectedBranchId, showBranchPicker, pageBranchFilter]
  );
}
