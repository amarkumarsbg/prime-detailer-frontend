import { apiGet } from "./api-client";
import type {
  ActivityLog,
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
  ProductPurchase,
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
import { useReminderStore } from "@/store/reminder-store";
import { useWalletStore } from "@/store/wallet-store";
import { useInventoryStore } from "@/store/inventory-store";
import { useServiceCatalogStore } from "@/store/service-catalog-store";
import { useDashboardStatsStore } from "@/store/dashboard-stats-store";
import { useFollowUpStore } from "@/store/follow-up-store";
import type { CashBankAccount, CashBankTransaction } from "@/store/cash-bank-store";
import { useCashBankStore } from "@/store/cash-bank-store";
import { usePayrollStore } from "@/store/payroll-store";
import { useMembershipStore } from "@/store/membership-store";
import { useServiceCategoryStore } from "@/store/service-category-store";
import type { Notification } from "@/store/notification-store";
import { useNotificationStore } from "@/store/notification-store";

export type BootstrapPayload = {
  customers: Customer[];
  branches: Branch[];
  users: User[];
  vehicles: Vehicle[];
  collections: Record<string, unknown>;
};

export async function bootstrapAppData(): Promise<void> {
  const data = await apiGet<BootstrapPayload>("/api/bootstrap");
  const c = data.collections;

  useBranchStore.setState({ branches: data.branches });
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
  useReminderStore.setState({ reminders: (c.serviceReminders as ServiceReminder[]) ?? [] });
  useWalletStore.setState({ transactions: (c.walletTransactions as WalletTransaction[]) ?? [] });
  useServiceCatalogStore.setState({ catalog: (c.serviceCatalog as ServiceCatalogItem[]) ?? [] });
  useInventoryStore.setState({
    parts: (c.parts as Part[]) ?? [],
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
    | { salaryStructures?: SalaryStructure[]; payrollRecords?: PayrollRecord[] }
    | null
    | undefined;
  usePayrollStore.setState({
    salaryStructures: Array.isArray(payroll?.salaryStructures) ? payroll.salaryStructures : [],
    payrollRecords: Array.isArray(payroll?.payrollRecords) ? payroll.payrollRecords : [],
  });

  const membership = c.membership as
    | { packages?: MembershipPackage[]; subscriptions?: CustomerMembership[] }
    | null
    | undefined;
  useMembershipStore.setState({
    packages: Array.isArray(membership?.packages) ? membership.packages : [],
    subscriptions: Array.isArray(membership?.subscriptions) ? membership.subscriptions : [],
  });

  useServiceCategoryStore.setState({
    categories: (c.serviceCategories as ServiceCategoryRecord[]) ?? [],
  });

  useNotificationStore.setState({
    notifications: (c.notifications as Notification[]) ?? [],
  });
}
