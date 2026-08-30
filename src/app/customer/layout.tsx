"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useCustomerAuthStore } from "@/store/customer-auth-store";
import { useCustomerDashboardStore } from "@/store/customer-dashboard-store";
import { Button } from "@/components/ui/button";
import { LogOut, Home, FileText, Car, MoreHorizontal, ClipboardList, User, Trophy, Wallet, Share2, CreditCard, KeyRound } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  const { isAuthenticated, user, logout, ensureValidSession } = useCustomerAuthStore();
  const { bootstrap } = useCustomerDashboardStore();
  const sessionValidatedRef = useRef(false);

  // Initialize session - wait for Zustand persist to hydrate from localStorage
  useEffect(() => {
    // Immediately check if already hydrated
    if (useCustomerAuthStore.persist.hasHydrated?.()) {
      setReady(true);
      return;
    }

    // Subscribe to hydration completion
    const unsub = useCustomerAuthStore.persist.onFinishHydration?.(() => setReady(true));
    
    // Fallback: force ready after 2s to avoid infinite loading
    const fallback = setTimeout(() => setReady(true), 2000);
    
    return () => {
      unsub?.();
      clearTimeout(fallback);
    };
  }, []);

  // Check if we're on the login page (no auth required)
  const isLoginPage = pathname === "/customer/login";
  const isChangePasswordPage = pathname === "/customer/more/change-password";

  // Check session and bootstrap data
  useEffect(() => {
    if (!ready) return;

    // Skip auth checks for login page
    if (isLoginPage) return;

    if (!isAuthenticated) {
      router.replace("/customer/login");
      return;
    }

    // Force password change before accessing any other page
    if (user?.mustChangePassword && !isChangePasswordPage) {
      router.replace("/customer/more/change-password");
      return;
    }

    // Validate session only once per mount (not on every isAuthenticated change)
    if (!sessionValidatedRef.current) {
      sessionValidatedRef.current = true;
      void ensureValidSession();
    }

    // Bootstrap dashboard data
    void bootstrap();
  }, [ready, isAuthenticated, user, router, ensureValidSession, bootstrap, isLoginPage, isChangePasswordPage, sessionValidatedRef]);

  if (!isLoginPage && (!ready || !isAuthenticated)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="h-10 w-10 mx-auto animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    router.replace("/customer/login");
  };

  // Mobile bottom nav (5 items only)
  const mobileNavItems = [
    { label: "Home", icon: Home, href: "/customer/dashboard", testId: "nav-home" },
    { label: "Jobs", icon: ClipboardList, href: "/customer/jobs", testId: "nav-jobs" },
    { label: "Invoices", icon: FileText, href: "/customer/invoices", testId: "nav-invoices" },
    { label: "Vehicles", icon: Car, href: "/customer/vehicles", testId: "nav-vehicles" },
    { label: "More", icon: MoreHorizontal, href: "/customer/more", testId: "nav-more" },
  ];

  // Desktop sidebar — grouped sections
  const sidebarSections = [
    {
      title: "Main",
      items: [
        { label: "Home", icon: Home, href: "/customer/dashboard" },
        { label: "My Jobs", icon: ClipboardList, href: "/customer/jobs" },
        { label: "Invoices", icon: FileText, href: "/customer/invoices" },
        { label: "Vehicles", icon: Car, href: "/customer/vehicles" },
      ],
    },
    {
      title: "Account",
      items: [
        { label: "My Profile", icon: User, href: "/customer/more/profile" },
        { label: "Memberships", icon: CreditCard, href: "/customer/more/memberships" },
        { label: "Change Password", icon: KeyRound, href: "/customer/more/change-password" },
      ],
    },
    {
      title: "Rewards & Wallet",
      items: [
        { label: "Reward Points", icon: Trophy, href: "/customer/more/rewards" },
        { label: "Wallet", icon: Wallet, href: "/customer/more/wallet" },
        { label: "Referral Code", icon: Share2, href: "/customer/more/referral" },
      ],
    },
  ];

  // For login page, render without header/nav
  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header — matches staff dashboard header pattern */}
      <header className="shrink-0 z-30 border-b border-border bg-background h-16 flex items-center px-4 md:pl-68 md:pr-6">
        <div className="flex flex-1 items-center justify-between min-w-0">
          {/* Left: current page title */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center md:hidden shrink-0">
              <Car className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground truncate">
              {(() => {
                if (pathname === "/customer/dashboard") return "Dashboard";
                if (pathname === "/customer/jobs") return "My Jobs";
                if (pathname.startsWith("/customer/jobs/")) return "Job Details";
                if (pathname === "/customer/invoices") return "Billing";
                if (pathname.startsWith("/customer/invoices/")) return "Invoice";
                if (pathname === "/customer/vehicles") return "My Vehicles";
                if (pathname === "/customer/more") return "More";
                if (pathname === "/customer/more/profile") return "My Profile";
                if (pathname === "/customer/more/change-password") return "Change Password";
                if (pathname === "/customer/more/rewards") return "Reward Points";
                if (pathname === "/customer/more/wallet") return "Wallet";
                if (pathname === "/customer/more/referral") return "Referral Code";
                if (pathname === "/customer/more/memberships") return "Memberships";
                return "Customer Portal";
              })()}
            </h1>
          </div>

          {/* Right: user avatar + name + logout */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden md:flex items-center gap-2 mr-1">
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">
                {user?.name?.charAt(0)?.toUpperCase() || "C"}
              </div>
              <div className="text-right hidden lg:block">
                <p className="text-sm font-semibold leading-tight">{user?.name || "Customer"}</p>
                <p className="text-[10px] text-muted-foreground">Customer</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="h-9 px-2" title="Logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content — offset on desktop to clear the fixed sidebar */}
      <main className="flex-1 overflow-auto pb-20 md:pb-0 md:ml-64">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-background border-t border-border/80">
        <div className="flex items-center justify-around h-16">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-4 py-2 text-xs font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
                data-testid={item.testId}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-64 bg-sidebar border-r border-sidebar-border flex-col z-40">
        {/* User profile header */}
        <div className="flex items-center gap-3 h-16 px-4 shrink-0 border-b border-sidebar-border">
          <div className="h-9 w-9 rounded-full bg-sidebar-active flex items-center justify-center shrink-0 text-sidebar-active-foreground text-sm font-bold">
            {user?.name?.charAt(0)?.toUpperCase() || "C"}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-sidebar-accent-foreground truncate leading-tight">{user?.name || "Customer"}</p>
            <p className="text-[11px] text-sidebar-foreground opacity-80">Customer Portal</p>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5 p-2.5 flex-1 overflow-y-auto">
          {sidebarSections.map((section, si) => (
            <div key={section.title} className={si > 0 ? "mt-4" : ""}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground opacity-60 px-3 pb-1.5">
                {section.title}
              </p>
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium origin-left",
                      "translate-x-0 scale-100 transform-gpu transition-[color,background-color,transform,box-shadow] duration-200 ease-out",
                      isActive
                        ? "bg-sidebar-active text-sidebar-active-foreground shadow-sm"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-sm motion-safe:hover:scale-[1.03] motion-safe:hover:translate-x-0.5"
                    )}
                  >
                    <Icon className={cn(
                      "h-4 w-4 shrink-0 transition-transform duration-200 ease-out",
                      isActive ? "opacity-100" : "opacity-90 motion-safe:group-hover:scale-125"
                    )} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-2.5 border-t border-sidebar-border">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors dark:text-rose-400 dark:hover:bg-rose-500/15"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Log out</span>
          </button>
        </div>
      </aside>

    </div>
  );
}
