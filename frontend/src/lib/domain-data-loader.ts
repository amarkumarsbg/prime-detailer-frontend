"use client";

import { apiGet, ApiError } from "@/lib/api-client";
import { normalizePartUnits } from "@/lib/inventory/multi-unit";
import type { DomainResource } from "@/lib/domain-data-map";
import { ensureHitechPartyProfile } from "@/lib/party/party-hitech-demo";
import { reconcilePickupWithJobCards } from "@/lib/sync-pickup-from-job-card";
import type {
  ActivityLog,
  CustomerMessage,
  Appointment,
  Customer,
  CustomerMembership,
  DashboardStats,
  Expense,
  ExpenseVendorProfile,
  FollowUp,
  Invoice,
  JobCard,
  MembershipPackage,
  Part,
  PayrollRecord,
  SalaryAdvance,
  SalaryAdvanceRecovery,
  ProductPurchase,
  BranchStock,
  PickupDropRequest,
  Quotation,
  SalaryStructure,
  ServiceCatalogItem,
  ServiceCategoryRecord,
  ServiceReminder,
  StockMovement,
  StockTransfer,
  PartCategoryRecord,
  User,
  Vehicle,
  WalletTransaction,
} from "@/types";
import { useActivityLogStore } from "@/store/activity-log-store";
import {
  mergeReportSchedulesPayload,
  useAdvancedReportSchedulesStore,
} from "@/store/advanced-report-schedules-store";
import { useAppointmentStore } from "@/store/appointment-store";
import {
  mergeBalanceSheetManualPayload,
  useBalanceSheetLedgerStore,
} from "@/store/balance-sheet-ledger-store";
import type { CashBankAccount, CashBankTransaction } from "@/store/cash-bank-store";
import { useCashBankStore } from "@/store/cash-bank-store";
import { useCommunicationStore } from "@/store/communication-store";
import { useCustomerStore } from "@/store/customer-store";
import { useDashboardStatsStore } from "@/store/dashboard-stats-store";
import { useExpenseStore } from "@/store/expense-store";
import { useFollowUpStore } from "@/store/follow-up-store";
import {
  mergeHighEndServicesPayload,
  useHighEndServiceStore,
} from "@/store/high-end-service-store";
import { useInventoryStore } from "@/store/inventory-store";
import { useInvoiceStore } from "@/store/invoice-store";
import { useJobCardStore } from "@/store/job-card-store";
import {
  normalizeMembershipPackages,
  normalizeMembershipSubscriptions,
  useMembershipStore,
} from "@/store/membership-store";
import type { Notification } from "@/store/notification-store";
import { useNotificationStore } from "@/store/notification-store";
import { usePayrollStore } from "@/store/payroll-store";
import { usePickupDropStore } from "@/store/pickup-drop-store";
import { useQuotationStore } from "@/store/quotation-store";
import {
  mergeReferralProgramPayload,
  useReferralSettingsStore,
} from "@/store/referral-settings-store";
import { useReminderStore } from "@/store/reminder-store";
import { useServiceCatalogStore } from "@/store/service-catalog-store";
import { useServiceCategoryStore } from "@/store/service-category-store";
import {
  mergeAppSettingsPayload,
  useSettingsStore,
} from "@/store/settings-store";
import { useStaffStore } from "@/store/staff-store";
import {
  mergeVehicleCatalogPayload,
  useVehicleCatalogStore,
} from "@/store/vehicle-catalog-store";
import { useVehicleStore } from "@/store/vehicle-store";
import { useWalletStore } from "@/store/wallet-store";

type LoadState = "idle" | "loading" | "ready" | "forbidden" | "error";

const stateByResource = new Map<DomainResource, LoadState>();
const inflight = new Map<DomainResource, Promise<void>>();

async function getCollectionItems<T>(collection: string): Promise<T[]> {
  const data = await apiGet<{ items: T[] }>(`/api/collections/${collection}`);
  return Array.isArray(data.items) ? data.items : [];
}

/** List document modules via dedicated alias when graduated (Phase 4). */
async function getDocumentItems<T>(collection: string): Promise<T[]> {
  const path =
    collection === "jobCards"
      ? "/api/job-cards"
      : collection === "invoices"
        ? "/api/invoices"
        : collection === "quotations"
          ? "/api/quotations"
          : `/api/collections/${collection}`;
  const data = await apiGet<{ items: T[] }>(path);
  return Array.isArray(data.items) ? data.items : [];
}

async function getSingleton<T>(collection: string): Promise<T | null> {
  const items = await getCollectionItems<T>(collection);
  return items[0] ?? null;
}

function isForbidden(e: unknown): boolean {
  return e instanceof ApiError && e.status === 403;
}

function directoryToUser(row: {
  id: string;
  name: string;
  role: User["role"];
  branchId: string;
  organizationId?: string;
  isActive: boolean;
  avatar?: string;
}): User {
  return {
    id: row.id,
    name: row.name,
    email: "",
    phone: "",
    role: row.role,
    branchId: row.branchId,
    avatar: row.avatar,
    isActive: row.isActive,
    permissions: [],
  };
}

async function loadOne(resource: DomainResource): Promise<void> {
  switch (resource) {
    case "customers": {
      const data = await apiGet<{ customers: Customer[] }>("/api/customers");
      useCustomerStore.setState({
        customers: data.customers ?? [],
        customersLoading: false,
        customersError: null,
      });
      return;
    }
    case "vehicles": {
      const data = await apiGet<{ vehicles: Vehicle[] }>("/api/vehicles");
      useVehicleStore.setState({ vehicles: data.vehicles ?? [] });
      return;
    }
    case "staff": {
      const data = await apiGet<{ users: User[] }>("/api/users");
      useStaffStore.setState({ staff: data.users ?? [] });
      return;
    }
    case "staffDirectory": {
      const data = await apiGet<{
        users: {
          id: string;
          name: string;
          role: User["role"];
          branchId: string;
          organizationId?: string;
          isActive: boolean;
          avatar?: string;
        }[];
      }>("/api/users/directory");
      const current = useStaffStore.getState().staff;
      const hasFullStaff =
        current.length > 0 && current.some((u) => u.email || (u.permissions?.length ?? 0) > 0);
      if (hasFullStaff) return;
      useStaffStore.setState({
        staff: (data.users ?? []).map(directoryToUser),
      });
      return;
    }
    case "jobCards": {
      const items = await getDocumentItems<JobCard>("jobCards");
      useJobCardStore.setState({ jobCards: items });
      void useAppointmentStore.getState().reconcileStaleAppointments(items);
      return;
    }
    case "invoices": {
      useInvoiceStore.setState({ invoices: await getDocumentItems<Invoice>("invoices") });
      return;
    }
    case "quotations": {
      useQuotationStore.setState({
        quotations: await getDocumentItems<Quotation>("quotations"),
      });
      return;
    }
    case "appointments": {
      useAppointmentStore.setState({
        appointments: await getCollectionItems<Appointment>("appointments"),
      });
      return;
    }
    case "expenses": {
      const expenses = await getCollectionItems<Expense>("expenses");
      useExpenseStore.setState({ expenses });
      return;
    }
    case "expenseMeta": {
      const meta = await getSingleton<{
        customCategories?: string[];
        categoryDescriptions?: Record<string, string>;
        vendorSuggestions?: string[];
        vendorDirectory?: ExpenseVendorProfile[];
      }>("expenseMeta");
      if (!meta) return;
      useExpenseStore.setState({
        customCategories: meta.customCategories ?? [],
        categoryDescriptions: meta.categoryDescriptions ?? {},
        vendorSuggestions: meta.vendorSuggestions ?? [],
        vendorDirectory: meta.vendorDirectory ?? [],
      });
      return;
    }
    case "activityLogs": {
      useActivityLogStore.setState({
        logs: await getCollectionItems<ActivityLog>("activityLogs"),
      });
      return;
    }
    case "communications": {
      useCommunicationStore.setState({
        messages: await getCollectionItems<CustomerMessage>("communications"),
      });
      return;
    }
    case "serviceReminders": {
      useReminderStore.setState({
        reminders: await getCollectionItems<ServiceReminder>("serviceReminders"),
      });
      return;
    }
    case "walletTransactions": {
      useWalletStore.setState({
        transactions: await getCollectionItems<WalletTransaction>("walletTransactions"),
      });
      return;
    }
    case "serviceCatalog": {
      useServiceCatalogStore.setState({
        catalog: await getCollectionItems<ServiceCatalogItem>("serviceCatalog"),
      });
      return;
    }
    case "parts": {
      const parts = await getCollectionItems<Part>("parts");
      useInventoryStore.setState({ parts: parts.map(normalizePartUnits) });
      return;
    }
    case "stockMovements": {
      const stockMovements = await getCollectionItems<StockMovement>("stockMovements");
      useInventoryStore.setState({ stockMovements });
      return;
    }
    case "productPurchases": {
      const productPurchases = await getCollectionItems<ProductPurchase>("productPurchases");
      useInventoryStore.setState({ productPurchases });
      return;
    }
    case "branchStocks": {
      const branchStocks = await getCollectionItems<BranchStock>("branchStocks");
      useInventoryStore.setState({ branchStocks });
      return;
    }
    case "stockTransfers": {
      const stockTransfers = await getCollectionItems<StockTransfer>("stockTransfers");
      useInventoryStore.setState({ stockTransfers });
      return;
    }
    case "partCategories": {
      const partCategories = await getCollectionItems<PartCategoryRecord>("partCategories");
      useInventoryStore.setState({ partCategories });
      return;
    }
    case "followUps": {
      useFollowUpStore.setState({
        followUps: await getCollectionItems<FollowUp>("followUps"),
      });
      return;
    }
    case "serviceCategories": {
      useServiceCategoryStore.setState({
        categories: await getCollectionItems<ServiceCategoryRecord>("serviceCategories"),
      });
      return;
    }
    case "notifications": {
      const items = await getCollectionItems<Notification>("notifications");
      useNotificationStore.getState().hydrateFromBootstrap(items);
      return;
    }
    case "pickupDropRequests": {
      const items = await getCollectionItems<PickupDropRequest>("pickupDropRequests");
      usePickupDropStore.getState().setRequestsFromBootstrap(items);
      reconcilePickupWithJobCards();
      return;
    }
    case "dashboardStats": {
      const stats = await getSingleton<DashboardStats>("dashboardStats");
      useDashboardStatsStore.setState({ stats });
      return;
    }
    case "cashBank": {
      const cashBank = await getSingleton<{
        accounts?: CashBankAccount[];
        transactions?: CashBankTransaction[];
      }>("cashBank");
      useCashBankStore.setState({
        accounts: Array.isArray(cashBank?.accounts) ? cashBank.accounts : [],
        transactions: Array.isArray(cashBank?.transactions) ? cashBank.transactions : [],
      });
      return;
    }
    case "payroll": {
      const payroll = await getSingleton<{
        salaryStructures?: SalaryStructure[];
        payrollRecords?: PayrollRecord[];
        salaryAdvances?: SalaryAdvance[];
        salaryAdvanceRecoveries?: SalaryAdvanceRecovery[];
      }>("payroll");
      usePayrollStore.setState({
        salaryStructures: Array.isArray(payroll?.salaryStructures)
          ? payroll.salaryStructures
          : [],
        payrollRecords: Array.isArray(payroll?.payrollRecords)
          ? payroll.payrollRecords.map((r) => ({
              ...r,
              netSalaryBeforeAdvance:
                typeof r.netSalaryBeforeAdvance === "number"
                  ? r.netSalaryBeforeAdvance
                  : r.grossEarnings - r.absenceDeduction,
              advanceDeductionPlanned:
                typeof r.advanceDeductionPlanned === "number" ? r.advanceDeductionPlanned : 0,
              advanceDeductionFinalized:
                typeof r.advanceDeductionFinalized === "number"
                  ? r.advanceDeductionFinalized
                  : 0,
              advanceOutstandingBefore:
                typeof r.advanceOutstandingBefore === "number"
                  ? r.advanceOutstandingBefore
                  : 0,
              advanceOutstandingAfterPlanned:
                typeof r.advanceOutstandingAfterPlanned === "number"
                  ? r.advanceOutstandingAfterPlanned
                  : 0,
              advanceOutstandingAfterFinalized:
                typeof r.advanceOutstandingAfterFinalized === "number"
                  ? r.advanceOutstandingAfterFinalized
                  : 0,
              advanceRecoveryRefs: Array.isArray(r.advanceRecoveryRefs)
                ? r.advanceRecoveryRefs
                : [],
            }))
          : [],
        salaryAdvances: Array.isArray(payroll?.salaryAdvances)
          ? payroll.salaryAdvances.map((a) => ({
              ...a,
              recoveredAmount: typeof a.recoveredAmount === "number" ? a.recoveredAmount : 0,
              remainingAmount:
                typeof a.remainingAmount === "number"
                  ? a.remainingAmount
                  : Math.max(0, (a.advanceAmount ?? 0) - (a.recoveredAmount ?? 0)),
              status: a.status ?? "OPEN",
            }))
          : [],
        salaryAdvanceRecoveries: Array.isArray(payroll?.salaryAdvanceRecoveries)
          ? payroll.salaryAdvanceRecoveries
          : [],
      });
      return;
    }
    case "membership": {
      const membership = await getSingleton<{
        packages?: MembershipPackage[];
        subscriptions?: CustomerMembership[];
      }>("membership");
      useMembershipStore.setState({
        packages: Array.isArray(membership?.packages)
          ? normalizeMembershipPackages(membership.packages)
          : [],
        subscriptions: Array.isArray(membership?.subscriptions)
          ? normalizeMembershipSubscriptions(membership.subscriptions)
          : [],
      });
      return;
    }
    case "appSettings": {
      const settings = await getSingleton<unknown>("appSettings");
      const patch = mergeAppSettingsPayload(settings);
      if (Object.keys(patch).length > 0) {
        useSettingsStore.getState().patchFromBootstrap(patch);
      }
      return;
    }
    case "referralProgram": {
      const raw = await getSingleton<unknown>("referralProgram");
      const patch = mergeReferralProgramPayload(raw);
      if (Object.keys(patch).length > 0) {
        useReferralSettingsStore.getState().patchFromBootstrap(patch);
      }
      return;
    }
    case "balanceSheetManual": {
      const raw = await getSingleton<unknown>("balanceSheetManual");
      useBalanceSheetLedgerStore
        .getState()
        .hydrateFromBootstrap(mergeBalanceSheetManualPayload(raw));
      return;
    }
    case "highEndServices": {
      const raw = await getSingleton<unknown>("highEndServices");
      const hes = mergeHighEndServicesPayload(raw);
      if (hes && hes.length > 0) {
        useHighEndServiceStore.getState().hydrateFromBootstrap(hes);
      }
      return;
    }
    case "reportSchedules": {
      const raw = await getSingleton<unknown>("reportSchedules");
      useAdvancedReportSchedulesStore
        .getState()
        .hydrateFromBootstrap(mergeReportSchedulesPayload(raw));
      return;
    }
    case "vehicleCatalog": {
      const raw = await getSingleton<unknown>("vehicleCatalog");
      const brands = mergeVehicleCatalogPayload(raw);
      if (brands && brands.length > 0) {
        useVehicleCatalogStore.getState().hydrateFromBootstrap(brands);
      }
      return;
    }
    default: {
      const _exhaustive: never = resource;
      void _exhaustive;
    }
  }
}

export function isDomainResourceReady(resource: DomainResource): boolean {
  const s = stateByResource.get(resource);
  return s === "ready" || s === "forbidden";
}

export function areDomainResourcesReady(resources: DomainResource[]): boolean {
  return resources.every(isDomainResourceReady);
}

export async function ensureDomainResources(resources: DomainResource[]): Promise<void> {
  const unique = [...new Set(resources)];
  await Promise.all(
    unique.map(async (resource) => {
      const existing = stateByResource.get(resource);
      if (existing === "ready" || existing === "forbidden") return;
      const pending = inflight.get(resource);
      if (pending) {
        await pending;
        return;
      }
      const run = (async () => {
        stateByResource.set(resource, "loading");
        try {
          await loadOne(resource);
          stateByResource.set(resource, "ready");
        } catch (e) {
          if (isForbidden(e)) {
            stateByResource.set(resource, "forbidden");
            return;
          }
          stateByResource.set(resource, "error");
          console.warn(`[domain-data] Failed to load ${resource}:`, e);
        } finally {
          inflight.delete(resource);
        }
      })();
      inflight.set(resource, run);
      await run;
    })
  );

  ensureHitechPartyProfile();
}

/** Force re-fetch (e.g. after mutations that need a full collection refresh). */
export function invalidateDomainResources(resources?: DomainResource[]): void {
  if (!resources) {
    stateByResource.clear();
    return;
  }
  for (const r of resources) {
    stateByResource.delete(r);
    inflight.delete(r);
  }
}
