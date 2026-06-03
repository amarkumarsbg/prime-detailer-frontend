"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn, getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useSidebarStore } from "@/store/sidebar-store";
import { useAuthStore } from "@/store/auth-store";
import { useDashboardFilterStore } from "@/store/dashboard-filter-store";
import { useSettingsStore } from "@/store/settings-store";
import type { UserRole } from "@/types";
import { canAccessNavItem } from "@/lib/rbac";
import {
  LayoutDashboard,
  Users,
  Car,
  CarFront,
  ClipboardList,
  Wrench,
  X,
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
  LogOut,
  QrCode,
  Wallet,
  Store,
  TrendingUp,
  FileBarChart,
  ChevronDown,
  Gift,
  Building2,
  Landmark,
  Crown,
  BookMarked,
} from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: UserRole[];
};

function navSectionSlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Sidebar navigation clears dashboard drill-down filters (alerts use `setActiveFilter` before routing). */
const SIDEBAR_CLEAR_FILTER_HREFS = new Set([
  "/job-cards",
  "/bookings",
  "/inventory",
  "/customers",
  "/billing",
  "/reminders",
]);

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
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

/** Sidebar active state: Finance "Reports" links to `/reports` but must not stay lit on `/reports/analytics` (that page is the separate "Analytics" item). */
function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/reports") {
    if (pathname === "/reports") return true;
    if (pathname === "/reports/analytics" || pathname.startsWith("/reports/analytics/")) {
      return false;
    }
    return pathname.startsWith("/reports/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarContent({
  onNavClick,
  navOverflow = "hidden",
  className,
}: {
  onNavClick?: () => void;
  navOverflow?: "hidden" | "auto";
  className?: string;
}) {
  const pathname = usePathname();
  const userRole = useAuthStore((s) => s.user?.role);
  const clearDashboardFilter = useDashboardFilterStore((s) => s.setActiveFilter);

  const filteredGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canAccessNavItem(item.roles, userRole)),
  })).filter((group) => group.items.length > 0);

  const navRef = useRef<HTMLElement>(null);
  const navContentRef = useRef<HTMLDivElement>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);

  const updateScrollHint = useCallback(() => {
    queueMicrotask(() => {
      const el = navRef.current;
      if (!el || navOverflow !== "auto") {
        setShowScrollHint(false);
        return;
      }
      const { scrollTop, scrollHeight, clientHeight } = el;
      const canScroll = scrollHeight > clientHeight + 2;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 6;
      setShowScrollHint(canScroll && !atBottom);
    });
  }, [navOverflow]);

  const navContentSignature = filteredGroups.map((g) => g.items.length).join(",");

  const scrollNavDown = useCallback(() => {
    const el = navRef.current;
    if (!el) return;
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    const step = Math.min(Math.max(el.clientHeight * 0.75, 72), Math.max(remaining, 0));
    if (step <= 0) return;
    el.scrollBy({ top: step, behavior: "smooth" });
  }, []);

  useLayoutEffect(() => {
    updateScrollHint();
  }, [pathname, userRole, navContentSignature, updateScrollHint]);

  useEffect(() => {
    const el = navRef.current;
    const inner = navContentRef.current;
    if (!el || navOverflow !== "auto") return;

    updateScrollHint();
    el.addEventListener("scroll", updateScrollHint, { passive: true });
    const ro = new ResizeObserver(() => updateScrollHint());
    ro.observe(el);
    if (inner) ro.observe(inner);
    window.addEventListener("resize", updateScrollHint);

    return () => {
      el.removeEventListener("scroll", updateScrollHint);
      ro.disconnect();
      window.removeEventListener("resize", updateScrollHint);
    };
  }, [navOverflow, updateScrollHint, navContentSignature]);

  return (
    <div className={cn("relative flex min-h-0 flex-1 flex-col", className)}>
      <nav
        ref={navRef}
        className={cn(
          "min-h-0 flex-1 overflow-x-hidden py-3 px-2.5",
          navOverflow === "hidden" && "overflow-y-hidden overscroll-none",
          navOverflow === "auto" && "overflow-y-auto overscroll-y-contain scrollbar-none"
        )}
      >
        <div ref={navContentRef} className="space-y-3">
          {filteredGroups.map((group, groupIndex) => (
            <section
              key={group.label}
              className="space-y-1"
              aria-labelledby={`nav-section-${navSectionSlug(group.label)}`}
            >
              <h2
                id={`nav-section-${navSectionSlug(group.label)}`}
                className={cn(
                  "text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--sidebar-section-heading)] px-3 pb-1.5",
                  groupIndex === 0 ? "pt-0" : "pt-4"
                )}
              >
                {group.label}
              </h2>
              <div className="space-y-0.5 px-1.5">
                {group.items.map((item) => {
                  const isActive = isNavItemActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => {
                        if (SIDEBAR_CLEAR_FILTER_HREFS.has(item.href)) clearDashboardFilter(null);
                        onNavClick?.();
                      }}
                      className={cn(
                        "group flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium",
                        "translate-x-0 transform-gpu transition-[color,background-color,transform] duration-300 ease-in-out",
                        isActive
                          ? "bg-[var(--sidebar-active)] text-[var(--sidebar-active-foreground)] shadow-sm"
                          : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)] motion-safe:hover:translate-x-1"
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-transform duration-300 ease-in-out",
                          isActive ? "opacity-100" : "opacity-90 motion-safe:group-hover:scale-110"
                        )}
                      />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </nav>

      {navOverflow === "auto" && showScrollHint && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-[var(--sidebar)] from-40% via-[var(--sidebar)]/85 to-transparent pb-2.5 pt-10">
          <button
            type="button"
            onClick={scrollNavDown}
            className="pointer-events-auto inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/10 bg-[var(--sidebar-scroll-hint-bg)] px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-[transform,filter] hover:brightness-110 active:scale-[0.98]"
            aria-label="Scroll down for more navigation options"
          >
            Scroll for more options
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-95" strokeWidth={2.25} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const router = useRouter();
  const { mobileOpen, setMobileOpen } = useSidebarStore();
  const businessName = useSettingsStore((s) => s.businessName);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const handleMobileLogout = () => {
    logout();
    setMobileOpen(false);
    router.push("/login");
  };

  const brandHeader = (
    <div className="flex items-center gap-3 min-w-0">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--sidebar-active)] shadow-md shadow-black/25 ring-1 ring-white/15">
        <CarFront
          className="h-[22px] w-[22px] text-[var(--sidebar-active-foreground)]"
          strokeWidth={1.65}
          aria-hidden
        />
      </div>
      <div className="overflow-hidden min-w-0">
        <h1 className="text-base font-bold text-[var(--sidebar-accent-foreground)] leading-tight truncate">
          {businessName}
        </h1>
        <p className="text-[11px] text-[var(--sidebar-foreground)] truncate opacity-80">Service management</p>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden md:flex fixed left-0 top-0 z-40 h-[100dvh] max-h-screen w-[260px] flex-col transition-all duration-300 min-h-0 bg-[var(--sidebar)] text-sidebar-foreground border-r border-[var(--sidebar-border)]">
        <div className="flex items-center h-16 px-4 shrink-0 border-b border-[var(--sidebar-border)] bg-white/[0.03]">
          {brandHeader}
        </div>

        <div className="flex-1 flex flex-col overflow-hidden min-h-0 min-w-0 bg-transparent">
          <SidebarContent className="flex-1 min-h-0" navOverflow="auto" />
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-[100dvh] max-h-screen min-h-0 w-[288px] flex flex-col transition-transform duration-300 md:hidden bg-[var(--sidebar)] text-sidebar-foreground border-r border-[var(--sidebar-border)]",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-[var(--sidebar-border)] shrink-0 bg-white/[0.03]">
          {brandHeader}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)] transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <SidebarContent
            className="flex-1 min-h-0"
            onNavClick={() => setMobileOpen(false)}
            navOverflow="auto"
          />
        </div>

        {user && (
          <div className="shrink-0 border-t border-[var(--sidebar-border)] bg-white/[0.03] px-2.5 py-3 space-y-1">
            <button
              type="button"
              onClick={handleMobileLogout}
              className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center" aria-hidden>
                <LogOut className="w-4 h-4" />
              </span>
              <span className="truncate min-w-0">Log out</span>
            </button>
            <Link
              href="/profile"
              onClick={() => setMobileOpen(false)}
              className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)] transition-colors"
            >
              <Avatar className="h-9 w-9 shrink-0 border border-[var(--sidebar-border)]">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate min-w-0">{user.name}</span>
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
