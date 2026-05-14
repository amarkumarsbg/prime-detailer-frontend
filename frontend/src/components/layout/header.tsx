"use client";

import { useAuthStore } from "@/store/auth-store";
import { useBranchStore } from "@/store/branch-store";
import { useSettingsStore } from "@/store/settings-store";
import { useSidebarStore } from "@/store/sidebar-store";
import { useNotificationStore } from "@/store/notification-store";
import { ALL_BRANCHES_BRANCH, isAllBranchesScope } from "@/lib/all-branches";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { resolveUploadsPublicUrl } from "@/lib/api-base";
import { getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationPanel } from "./notification-panel";
import {
  Bell,
  LogOut,
  Moon,
  Sun,
  User,
  Menu,
  Wrench,
  Building2,
} from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";

export function Header() {
  const { user, currentBranch, logout, setBranch } = useAuthStore();
  const branchesFromStore = useBranchStore((s) => s.branches);
  const businessName = useSettingsStore((s) => s.businessName);
  const toggleMobileOpen = useSidebarStore((s) => s.toggleMobileOpen);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    if (notifOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notifOpen]);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const canSelectOrgWide = useMemo(
    () =>
      !!user &&
      (user.role === "SUPER_ADMIN" ||
        user.role === "ADMIN" ||
        user.role === "MANAGER"),
    [user]
  );

  const selectableBranches = useMemo(() => {
    const active = branchesFromStore.filter((b) => b.isActive);
    if (!user) return active;
    if (canSelectOrgWide) return active;
    return active.filter((b) => b.id === user.branchId);
  }, [branchesFromStore, user, canSelectOrgWide]);

  useEffect(() => {
    if (!user) return;
    if (canSelectOrgWide) return;
    const mine =
      selectableBranches.find((b) => b.id === user.branchId) ?? selectableBranches[0];
    if (!mine) return;
    if (
      !currentBranch ||
      isAllBranchesScope(currentBranch) ||
      !selectableBranches.some((b) => b.id === currentBranch.id)
    ) {
      setBranch(mine);
    }
  }, [user, canSelectOrgWide, currentBranch, selectableBranches, setBranch]);

  if (!user) return null;

  const avatarSrc = resolveUploadsPublicUrl(user.avatar);
  const count = unreadCount();

  return (
    <header
      className="shrink-0 z-30 min-w-0 border-b border-border bg-background px-3 sm:px-4 md:px-6 py-2 md:py-0 md:h-16 max-md:grid max-md:grid-cols-[auto_minmax(0,1fr)_auto] max-md:gap-x-1.5 sm:max-md:gap-x-2 max-md:[grid-template-areas:'hdr_logo_hdr_branch_hdr_tools'] md:flex md:flex-nowrap md:items-center md:justify-between md:gap-3"
    >
      {/* Mobile only — company logo (desktop branding lives in the sidebar) */}
      <Link
        href="/dashboard"
        className="md:hidden max-md:[grid-area:hdr_logo] flex items-center gap-1.5 sm:gap-2 shrink-0 min-w-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-primary shrink-0">
          <Wrench className="w-[1.125rem] h-[1.125rem] sm:w-5 sm:h-5 text-primary-foreground" />
        </div>
        <div className="hidden min-[380px]:flex flex-col leading-tight min-w-0">
          <span className="text-xs sm:text-sm font-bold text-foreground truncate max-w-[5.5rem] min-[380px]:max-w-[7rem] sm:max-w-[120px]">
            {businessName}
          </span>
          <span className="text-[10px] text-muted-foreground hidden sm:block truncate">Service Management</span>
        </div>
      </Link>

      <div className="max-md:[grid-area:hdr_branch] max-md:min-w-0 max-md:w-full max-md:max-w-full max-md:self-center md:flex md:shrink-0 md:min-w-0 md:max-w-none">
        <Select
          value={currentBranch?.id ?? ALL_BRANCHES_BRANCH.id}
          onValueChange={(id) => {
            if (id === ALL_BRANCHES_BRANCH.id) {
              setBranch(ALL_BRANCHES_BRANCH);
              return;
            }
            const next = selectableBranches.find((b) => b.id === id);
            if (next) setBranch(next);
          }}
          disabled={!canSelectOrgWide && selectableBranches.length === 0}
        >
          <SelectTrigger className="h-9 min-h-9 w-full max-w-full md:w-max md:max-w-[min(100vw-5rem,17.5rem)] justify-start gap-1.5 sm:gap-2 px-2 sm:px-2.5 md:px-3 text-left text-sm ring-offset-background max-md:rounded-lg max-md:border-0 max-md:bg-transparent max-md:shadow-none max-md:ring-0 max-md:hover:bg-accent/80 max-md:focus:ring-0 max-md:focus-visible:ring-0 max-md:focus-visible:ring-offset-0 md:border md:border-border md:bg-muted/50 md:shadow-sm md:hover:bg-muted/50 [&>span]:min-w-0 max-md:[&>span]:truncate md:[&>span]:line-clamp-none md:[&>span]:break-words md:[&>span]:whitespace-normal">
            <Building2 className="w-4 h-4 text-muted-foreground shrink-0 self-center" />
            <SelectValue placeholder="Branch" />
          </SelectTrigger>
          <SelectContent align="start" className="max-h-[min(24rem,70vh)] min-w-[var(--radix-select-trigger-width)]">
            {canSelectOrgWide && (
              <SelectItem value={ALL_BRANCHES_BRANCH.id}>{ALL_BRANCHES_BRANCH.name}</SelectItem>
            )}
            {selectableBranches.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-end gap-0.5 sm:gap-1 shrink-0 max-md:[grid-area:hdr_tools] max-md:self-center md:ml-auto">
        {mounted && (
          <button
            type="button"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-foreground hover:bg-accent transition-colors"
            aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {resolvedTheme === "dark" ? (
              <Sun className="size-4 shrink-0" strokeWidth={2} aria-hidden />
            ) : (
              <Moon className="size-4 shrink-0" strokeWidth={2} aria-hidden />
            )}
          </button>
        )}

        <div className="relative shrink-0" ref={notifRef}>
          <button
            type="button"
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-accent transition-colors"
          >
            <Bell className="size-4 shrink-0" />
            {count > 0 && (
              <span className="absolute top-1 right-1 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </button>

          {notifOpen && (
            <>
              <div className="sm:hidden">
                <div
                  className="fixed inset-0 z-40 bg-black/30 cursor-pointer top-24 md:top-14"
                  onClick={() => setNotifOpen(false)}
                  aria-hidden
                />
                <div className="fixed inset-x-0 z-50 px-3 pt-2 top-24 md:top-14">
                  <div className="rounded-xl border border-border bg-card shadow-xl animate-in fade-in-0 slide-in-from-top-2">
                    <NotificationPanel onClose={() => setNotifOpen(false)} />
                  </div>
                </div>
              </div>
              <div className="hidden sm:block absolute right-0 top-full mt-2 z-50 rounded-xl border border-border bg-card shadow-xl animate-in fade-in-0 zoom-in-95 slide-in-from-top-2">
                <NotificationPanel onClose={() => setNotifOpen(false)} />
              </div>
            </>
          )}
        </div>

        <div className="hidden md:block">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 sm:gap-3 rounded-lg px-2 py-1.5 hover:bg-accent transition-colors ml-1">
                <Avatar className="w-8 h-8">
                  {avatarSrc ? (
                    <AvatarImage src={avatarSrc} alt="" className="object-cover" key={avatarSrc} />
                  ) : null}
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="text-left hidden sm:block">
                  <p className="text-sm font-medium leading-tight">{user.name}</p>
                  <p className="text-[11px] text-muted-foreground">{user.role}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile">
                  <User className="w-4 h-4 mr-2" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <button
          type="button"
          onClick={toggleMobileOpen}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-accent transition-colors md:hidden"
          aria-label="Open menu"
        >
          <Menu className="size-5 shrink-0" />
        </button>
      </div>
    </header>
  );
}
