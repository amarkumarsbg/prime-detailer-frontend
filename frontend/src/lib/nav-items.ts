import type { UserRole } from "@/types";
import {
  LayoutDashboard,
  Users,
  Car,
  ClipboardList,
  Wrench,
  UserCog,
  Package,
  Calendar,
  CalendarCheck,
  Truck,
  BarChart3,
  Banknote,
  Receipt,
  History,
  MessageSquare,
  Bell,
  Settings,
  Gauge,
  FileText,
  PhoneCall,
  Wallet,
  Store,
  TrendingUp,
  FileBarChart,
  Gift,
  Building2,
  Landmark,
  Crown,
  BookMarked,
  QrCode,
} from "lucide-react";

export type NavItemDef = {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: UserRole[];
  permissionKey?: string;
};

export const NAV_GROUPS: { label: string; items: NavItemDef[] }[] = [
  {
    label: "Workspace",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permissionKey: "DASHBOARD" },
      { label: "Job Cards", href: "/job-cards", icon: ClipboardList, permissionKey: "JOB_CARDS" },
      { label: "Bookings", href: "/bookings", icon: CalendarCheck, permissionKey: "BOOKINGS" },
      { label: "Pickup & Drop", href: "/pickup-drop", icon: Truck, permissionKey: "PICKUP_DROP" },
      { label: "Quotations", href: "/quotations", icon: FileText, permissionKey: "QUOTATIONS" },
      { label: "Appointments", href: "/appointments", icon: Calendar, permissionKey: "APPOINTMENTS" },
    ],
  },
  {
    label: "Customers & fleet",
    items: [
      { label: "Customers", href: "/customers", icon: Users, permissionKey: "CUSTOMERS" },
      { label: "Membership", href: "/membership", icon: Crown, permissionKey: "MEMBERSHIP" },
      { label: "Vehicles", href: "/vehicles", icon: Car, permissionKey: "VEHICLES" },
      { label: "Reminders", href: "/reminders", icon: Bell, roles: ["ADMIN", "MANAGER", "RECEPTIONIST"], permissionKey: "REMINDERS" },
      { label: "Follow-ups", href: "/follow-ups", icon: PhoneCall, roles: ["ADMIN", "MANAGER", "RECEPTIONIST"], permissionKey: "FOLLOW_UPS" },
      { label: "Referrals", href: "/referrals", icon: Gift, roles: ["ADMIN", "MANAGER"], permissionKey: "REFERRALS" },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Invoices", href: "/billing", icon: Receipt, permissionKey: "BILLING" },
      {
        label: "Reports",
        href: "/reports",
        icon: FileBarChart,
        roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "MANAGER", "RECEPTIONIST"],
        permissionKey: "REPORTS",
      },
      {
        label: "Cash & Bank",
        href: "/cash-bank",
        icon: Landmark,
        roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "MANAGER", "RECEPTIONIST"],
        permissionKey: "CASH_BANK",
      },
      {
        label: "Parties",
        href: "/parties",
        icon: Building2,
        roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "MANAGER", "RECEPTIONIST"],
        permissionKey: "PARTIES",
      },
      {
        label: "Shared Ledger",
        href: "/shared-ledger",
        icon: BookMarked,
        roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "MANAGER", "RECEPTIONIST"],
        permissionKey: "SHARED_LEDGER",
      },
      {
        label: "Expenses",
        href: "/expenses",
        icon: Banknote,
        roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "MANAGER"],
        permissionKey: "EXPENSES",
      },
      {
        label: "Vendors",
        href: "/vendors",
        icon: Store,
        roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "MANAGER"],
        permissionKey: "VENDORS",
      },
    ],
  },
  {
    label: "HR & staff",
    items: [
      { label: "Users & Staff", href: "/staff", icon: UserCog, roles: ["ADMIN", "MANAGER"], permissionKey: "STAFF" },
      { label: "Attendance", href: "/attendance", icon: QrCode, roles: ["ADMIN", "MANAGER"], permissionKey: "ATTENDANCE" },
      { label: "Salary & Payroll", href: "/payroll", icon: Wallet, roles: ["ADMIN", "MANAGER"], permissionKey: "PAYROLL" },
    ],
  },
  {
    label: "Workshop",
    items: [
      { label: "Services", href: "/services", icon: Wrench, roles: ["ADMIN", "MANAGER"], permissionKey: "SERVICES" },
      { label: "Inventory", href: "/inventory", icon: Package, roles: ["ADMIN", "MANAGER"], permissionKey: "INVENTORY" },
    ],
  },
  {
    label: "Workshop Analytics & Tools",
    items: [
      {
        label: "Locations",
        href: "/branches",
        icon: Building2,
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "BRANCH_MANAGER"],
        permissionKey: "BRANCHES",
      },
      {
        label: "Performance",
        href: "/performance",
        icon: TrendingUp,
        roles: ["ADMIN", "MANAGER", "BRANCH_MANAGER"],
        permissionKey: "PERFORMANCE",
      },
      { label: "Mechanics", href: "/mechanics", icon: Gauge, roles: ["ADMIN", "MANAGER"], permissionKey: "MECHANICS" },
      { label: "Analytics", href: "/reports/analytics", icon: BarChart3, roles: ["ADMIN", "MANAGER"], permissionKey: "ANALYTICS" },
      {
        label: "Advanced Reports",
        href: "/advanced-reports",
        icon: FileBarChart,
        roles: ["ADMIN", "MANAGER", "BRANCH_MANAGER"],
        permissionKey: "ADVANCED_REPORTS",
      },
      { label: "Activity Log", href: "/activity", icon: History, roles: ["ADMIN"], permissionKey: "ACTIVITY" },
      { label: "Messages Log", href: "/messages", icon: MessageSquare, roles: ["ADMIN"], permissionKey: "MESSAGES" },
      { label: "Settings", href: "/settings", icon: Settings, roles: ["ADMIN"], permissionKey: "SETTINGS" },
    ],
  },
];
