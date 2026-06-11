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
};

export const NAV_GROUPS: { label: string; items: NavItemDef[] }[] = [
  {
    label: "Workspace",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Job Cards", href: "/job-cards", icon: ClipboardList },
      { label: "Bookings", href: "/bookings", icon: CalendarCheck },
      { label: "Pickup & Drop", href: "/pickup-drop", icon: Truck },
      { label: "Quotations", href: "/quotations", icon: FileText },
      { label: "Appointments", href: "/appointments", icon: Calendar },
    ],
  },
  {
    label: "Customers & fleet",
    items: [
      { label: "Customers", href: "/customers", icon: Users },
      { label: "Membership", href: "/membership", icon: Crown },
      { label: "Vehicles", href: "/vehicles", icon: Car },
      { label: "Reminders", href: "/reminders", icon: Bell, roles: ["ADMIN", "MANAGER", "RECEPTIONIST"] },
      { label: "Follow-ups", href: "/follow-ups", icon: PhoneCall, roles: ["ADMIN", "MANAGER", "RECEPTIONIST"] },
      { label: "Referrals", href: "/referrals", icon: Gift, roles: ["ADMIN", "MANAGER"] },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Invoices", href: "/billing", icon: Receipt },
      {
        label: "Reports",
        href: "/reports",
        icon: FileBarChart,
        roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "MANAGER", "RECEPTIONIST"],
      },
      {
        label: "Cash & Bank",
        href: "/cash-bank",
        icon: Landmark,
        roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "MANAGER", "RECEPTIONIST"],
      },
      {
        label: "Parties",
        href: "/parties",
        icon: Building2,
        roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "MANAGER", "RECEPTIONIST"],
      },
      {
        label: "Shared Ledger",
        href: "/shared-ledger",
        icon: BookMarked,
        roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "MANAGER", "RECEPTIONIST"],
      },
      {
        label: "Expenses",
        href: "/expenses",
        icon: Banknote,
        roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "MANAGER"],
      },
      {
        label: "Vendors",
        href: "/vendors",
        icon: Store,
        roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "MANAGER"],
      },
    ],
  },
  {
    label: "HR & staff",
    items: [
      { label: "Users & Staff", href: "/staff", icon: UserCog, roles: ["ADMIN", "MANAGER"] },
      { label: "Attendance", href: "/attendance", icon: QrCode, roles: ["ADMIN", "MANAGER"] },
      { label: "Salary & Payroll", href: "/payroll", icon: Wallet, roles: ["ADMIN", "MANAGER"] },
    ],
  },
  {
    label: "Workshop",
    items: [
      { label: "Services", href: "/services", icon: Wrench, roles: ["ADMIN", "MANAGER"] },
      { label: "Inventory", href: "/inventory", icon: Package, roles: ["ADMIN", "MANAGER"] },
    ],
  },
  {
    label: "Analytics & Reports",
    items: [
      {
        label: "Locations",
        href: "/branches",
        icon: Building2,
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "BRANCH_MANAGER"],
      },
      {
        label: "Performance",
        href: "/performance",
        icon: TrendingUp,
        roles: ["ADMIN", "MANAGER", "BRANCH_MANAGER"],
      },
      { label: "Mechanics", href: "/mechanics", icon: Gauge, roles: ["ADMIN", "MANAGER"] },
      { label: "Analytics", href: "/reports/analytics", icon: BarChart3, roles: ["ADMIN", "MANAGER"] },
      {
        label: "Advanced Reports",
        href: "/advanced-reports",
        icon: FileBarChart,
        roles: ["ADMIN", "MANAGER", "BRANCH_MANAGER"],
      },
      { label: "Activity Log", href: "/activity", icon: History, roles: ["ADMIN"] },
      { label: "Settings", href: "/settings", icon: Settings, roles: ["ADMIN"] },
    ],
  },
];

export function flattenNavItems(): NavItemDef[] {
  return NAV_GROUPS.flatMap((g) => g.items);
}
