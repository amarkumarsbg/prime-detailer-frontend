import { apiGet } from "./api-client";
import { reconcileCurrentBranch } from "./branch-selection";
import { normalizePartUnits } from "@/lib/inventory/multi-unit";
import { useAuthStore } from "@/store/auth-store";
import type {
  ActivityLog,
  CustomerMessage,
  Appointment,
  Branch,
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
  PickupDropRequest,
  Quotation,
  SalaryStructure,
  ServiceCatalogItem,
  ServiceCategoryRecord,
  ServiceReminder,
  StockMovement,
  User,
  Vehicle,
  WalletTransaction,
} from "@/types";
import { useBranchStore } from "@/store/branch-store";
import { useStaffStore } from "@/store/staff-store";
import { useVehicleStore } from "@/store/vehicle-store";
import { useCustomerStore } from "@/store/customer-store";
import { useJobCardStore } from "@/store/job-card-store";
import { useInvoiceStore } from "@/store/invoice-store";
import { useQuotationStore } from "@/store/quotation-store";
import { useAppointmentStore } from "@/store/appointment-store";
import { useExpenseStore } from "@/store/expense-store";
import { useActivityLogStore } from "@/store/activity-log-store";
import { useCommunicationStore } from "@/store/communication-store";
import { useReminderStore } from "@/store/reminder-store";
import { useWalletStore } from "@/store/wallet-store";
import { useInventoryStore } from "@/store/inventory-store";
import { useServiceCatalogStore } from "@/store/service-catalog-store";
import { useDashboardStatsStore } from "@/store/dashboard-stats-store";
import { useFollowUpStore } from "@/store/follow-up-store";
import type { CashBankAccount, CashBankTransaction } from "@/store/cash-bank-store";
import { useCashBankStore } from "@/store/cash-bank-store";
import { usePayrollStore } from "@/store/payroll-store";
import {
  normalizeMembershipPackages,
  normalizeMembershipSubscriptions,
  useMembershipStore,
} from "@/store/membership-store";
import { useServiceCategoryStore } from "@/store/service-category-store";
import type { Notification } from "@/store/notification-store";
import { useNotificationStore } from "@/store/notification-store";
import { usePickupDropStore } from "@/store/pickup-drop-store";
import {
  mergeAppSettingsPayload,
  useSettingsStore,
} from "@/store/settings-store";
import {
  mergeReferralProgramPayload,
  useReferralSettingsStore,
} from "@/store/referral-settings-store";
import {
  mergeBalanceSheetManualPayload,
  useBalanceSheetLedgerStore,
} from "@/store/balance-sheet-ledger-store";
import {
  mergeHighEndServicesPayload,
  useHighEndServiceStore,
} from "@/store/high-end-service-store";
import {
  mergeReportSchedulesPayload,
  useAdvancedReportSchedulesStore,
} from "@/store/advanced-report-schedules-store";
import {
  mergeVehicleCatalogPayload,
  useVehicleCatalogStore,
} from "@/store/vehicle-catalog-store";
import {
  ensureHitechPartyProfile,
  mergeHitechPartyDemoBootstrap,
} from "@/lib/party/party-hitech-demo";
import { reconcilePickupWithJobCards } from "@/lib/sync-pickup-from-job-card";

export type BootstrapPayload = {
  customers: Customer[];
  branches: Branch[];
  users: User[];
  vehicles: Vehicle[];
  collections: Record<string, unknown>;
};

export async function bootstrapAppData(): Promise<void> {
  const raw = await apiGet<BootstrapPayload>("/api/bootstrap");
  const data = mergeHitechPartyDemoBootstrap(raw);
  const c = data.collections;

  useBranchStore.setState({ branches: data.branches });

  const auth = useAuthStore.getState();
  if (auth.user) {
    const nextBranch = reconcileCurrentBranch(
      auth.user,
      auth.user.branchId
        ? (data.branches.find((b) => b.id === auth.user!.branchId) ?? null)
        : null,
      auth.currentBranch,
      data.branches
    );
    if (
      nextBranch &&
      (nextBranch.id !== auth.currentBranch?.id ||
        nextBranch.name !== auth.currentBranch?.name)
    ) {
      auth.setBranch(nextBranch);
    }
  }

  useStaffStore.setState({ staff: data.users });
  useVehicleStore.setState({ vehicles: data.vehicles });
  useCustomerStore.setState({
    customers: data.customers,
    customersLoading: false,
    customersError: null,
  });

  useJobCardStore.setState({ jobCards: (c.jobCards as JobCard[]) ?? [] });
  useInvoiceStore.setState({ invoices: (c.invoices as Invoice[]) ?? [] });
  useQuotationStore.setState({ quotations: (c.quotations as Quotation[]) ?? [] });
  useAppointmentStore.setState({ appointments: (c.appointments as Appointment[]) ?? [] });
  useExpenseStore.setState({
    expenses: (c.expenses as Expense[]) ?? [],
    ...(c.expenseMeta && typeof c.expenseMeta === "object"
      ? (() => {
          const m = c.expenseMeta as {
            customCategories?: string[];
            categoryDescriptions?: Record<string, string>;
            vendorSuggestions?: string[];
            vendorDirectory?: ExpenseVendorProfile[];
          };
          return {
            customCategories: m.customCategories ?? [],
            categoryDescriptions: m.categoryDescriptions ?? {},
            vendorSuggestions: m.vendorSuggestions ?? [],
            vendorDirectory: m.vendorDirectory ?? [],
          };
        })()
      : {}),
  });
  useActivityLogStore.setState({ logs: (c.activityLogs as ActivityLog[]) ?? [] });
  useCommunicationStore.setState({ messages: (c.communications as CustomerMessage[]) ?? [] });
  useReminderStore.setState({ reminders: (c.serviceReminders as ServiceReminder[]) ?? [] });
  useWalletStore.setState({ transactions: (c.walletTransactions as WalletTransaction[]) ?? [] });
  useServiceCatalogStore.setState({ catalog: (c.serviceCatalog as ServiceCatalogItem[]) ?? [] });
  useInventoryStore.setState({
    parts: ((c.parts as Part[]) ?? []).map(normalizePartUnits),
    stockMovements: (c.stockMovements as StockMovement[]) ?? [],
    productPurchases: (c.productPurchases as ProductPurchase[]) ?? [],
  });
  useDashboardStatsStore.setState({
    stats: (c.dashboardStats as DashboardStats) ?? null,
  });
  useFollowUpStore.setState({ followUps: (c.followUps as FollowUp[]) ?? [] });

  const cashBank = c.cashBank as
    | { accounts?: CashBankAccount[]; transactions?: CashBankTransaction[] }
    | null
    | undefined;
  useCashBankStore.setState({
    accounts: Array.isArray(cashBank?.accounts) ? cashBank.accounts : [],
    transactions: Array.isArray(cashBank?.transactions) ? cashBank.transactions : [],
  });

  const payroll = c.payroll as
    | {
        salaryStructures?: SalaryStructure[];
        payrollRecords?: PayrollRecord[];
        salaryAdvances?: SalaryAdvance[];
        salaryAdvanceRecoveries?: SalaryAdvanceRecovery[];
      }
    | null
    | undefined;
  usePayrollStore.setState({
    salaryStructures: Array.isArray(payroll?.salaryStructures) ? payroll.salaryStructures : [],
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
            typeof r.advanceDeductionFinalized === "number" ? r.advanceDeductionFinalized : 0,
          advanceOutstandingBefore:
            typeof r.advanceOutstandingBefore === "number" ? r.advanceOutstandingBefore : 0,
          advanceOutstandingAfterPlanned:
            typeof r.advanceOutstandingAfterPlanned === "number"
              ? r.advanceOutstandingAfterPlanned
              : 0,
          advanceOutstandingAfterFinalized:
            typeof r.advanceOutstandingAfterFinalized === "number"
              ? r.advanceOutstandingAfterFinalized
              : 0,
          advanceRecoveryRefs: Array.isArray(r.advanceRecoveryRefs) ? r.advanceRecoveryRefs : [],
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

  const membership = c.membership as
    | { packages?: MembershipPackage[]; subscriptions?: CustomerMembership[] }
    | null
    | undefined;
  useMembershipStore.setState({
    packages: Array.isArray(membership?.packages)
      ? normalizeMembershipPackages(membership.packages)
      : [],
    subscriptions: Array.isArray(membership?.subscriptions)
      ? normalizeMembershipSubscriptions(membership.subscriptions)
      : [],
  });

  useServiceCategoryStore.setState({
    categories: (c.serviceCategories as ServiceCategoryRecord[]) ?? [],
  });

  useNotificationStore
    .getState()
    .hydrateFromBootstrap((c.notifications as Notification[]) ?? []);

  const pickupDrop = c.pickupDropRequests as PickupDropRequest[] | undefined;
  usePickupDropStore
    .getState()
    .setRequestsFromBootstrap(Array.isArray(pickupDrop) ? pickupDrop : []);

  const appPatch = mergeAppSettingsPayload(c.appSettings);
  if (Object.keys(appPatch).length > 0) {
    useSettingsStore.getState().patchFromBootstrap(appPatch);
  }

  const referralPatch = mergeReferralProgramPayload(c.referralProgram);
  if (Object.keys(referralPatch).length > 0) {
    useReferralSettingsStore.getState().patchFromBootstrap(referralPatch);
  }

  useBalanceSheetLedgerStore
    .getState()
    .hydrateFromBootstrap(mergeBalanceSheetManualPayload(c.balanceSheetManual));

  const hesServer = mergeHighEndServicesPayload(c.highEndServices);
  if (hesServer && hesServer.length > 0) {
    useHighEndServiceStore.getState().hydrateFromBootstrap(hesServer);
  }

  useAdvancedReportSchedulesStore
    .getState()
    .hydrateFromBootstrap(mergeReportSchedulesPayload(c.reportSchedules));

  const catalogBrands = mergeVehicleCatalogPayload(c.vehicleCatalog);
  if (catalogBrands && catalogBrands.length > 0) {
    useVehicleCatalogStore.getState().hydrateFromBootstrap(catalogBrands);
  }

  ensureHitechPartyProfile();
  reconcilePickupWithJobCards();
  void useAppointmentStore
    .getState()
    .reconcileStaleAppointments((c.jobCards as JobCard[]) ?? []);
}
