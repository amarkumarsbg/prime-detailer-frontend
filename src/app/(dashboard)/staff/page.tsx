"use client";

import { useMemo, useState, useEffect } from "react";
import {
  applyBranchFilters,
  resolveBranchScopeLabel,
  useBranchScope,
} from "@/lib/branch-scope";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useStaffStore } from "@/store/staff-store";
import { useBranchStore } from "@/store/branch-store";
import { useAuthStore } from "@/store/auth-store";
import { useCustomerStore } from "@/store/customer-store";
import { useJobCardStore } from "@/store/job-card-store";
import { PageHeader } from "@/components/shared/page-header";
import { MobileFilterSheet } from "@/components/shared/mobile-filter-sheet";
import { KPICard } from "@/components/shared/kpi-card";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolveUploadsPublicUrl } from "@/lib/api-base";
import { ApiError } from "@/lib/api-client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getInitials } from "@/lib/utils";
import { getStaffJobStats } from "@/lib/staff-job-stats";
import { getAssignableStaffRoles, canManageStaffUsers, canCreateStaffAccounts, roleDisplayLabel } from "@/lib/rbac";
import { validateStrongPassword, PASSWORD_POLICY_HINT } from "@/lib/password-policy";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Shield,
  UserCog,
  Headset,
  WrenchIcon,
  ClipboardList,
  IndianRupee,
  Crown,
  Building2,
  UserCheck,
  Eye,
  EyeOff,
  Info,
  Pencil,
  Trash2,
  SlidersHorizontal,
  Users,
  UserX,
  MailCheck,
  Loader2,
} from "lucide-react";
import type { User, UserRole, Customer } from "@/types";
import { toast } from "sonner";
import { pushActivityLog } from "@/lib/activity-log-helper";
import { useDashboardStoresReady } from "@/hooks/use-dashboard-stores-ready";
import { PageSkeleton, RefreshingBar } from "@/components/shared/skeleton-loader";

const ROLE_BADGE_MAP: Record<
  UserRole,
  { label: string; className: string; icon: React.ElementType }
> = {
  PLATFORM_OWNER: {
    label: "Platform Owner",
    className:
      "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-300",
    icon: Crown,
  },
  SUPER_ADMIN: {
    label: "Super Admin",
    className:
      "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
    icon: Crown,
  },
  ADMIN: {
    label: "Admin",
    className: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
    icon: Shield,
  },
  BRANCH_MANAGER: {
    label: "Branch Manager",
    className: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
    icon: Building2,
  },
  MANAGER: {
    label: "Manager",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    icon: UserCog,
  },
  SUPERVISOR: {
    label: "Supervisor",
    className: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
    icon: UserCheck,
  },
  RECEPTIONIST: {
    label: "Receptionist",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    icon: Headset,
  },
  MECHANIC: {
    label: "Mechanic",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    icon: WrenchIcon,
  },
  CUSTOMER: {
    label: "Customer",
    className: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
    icon: Users,
  },
};

const FALLBACK_ROLE_BADGE = {
  label: "Unknown role",
  className: "bg-muted text-muted-foreground",
  icon: Users,
} as const;

function roleBadgeFor(role: string | undefined | null) {
  if (role && role in ROLE_BADGE_MAP) {
    return ROLE_BADGE_MAP[role as UserRole];
  }
  return {
    ...FALLBACK_ROLE_BADGE,
    label: role?.trim() ? role : FALLBACK_ROLE_BADGE.label,
  };
}

const ALL_ROLES_FILTER: (UserRole | "ALL")[] = [
  "ALL",
  "SUPER_ADMIN",
  "ADMIN",
  "BRANCH_MANAGER",
  "MANAGER",
  "SUPERVISOR",
  "RECEPTIONIST",
  "MECHANIC",
];

export default function StaffPage() {
  const storesReady = useDashboardStoresReady();
  const router = useRouter();
  const authRole = useAuthStore((s) => s.user?.role);
  const authUser = useAuthStore((s) => s.user);
  const branches = useBranchStore((s) => s.branches);
  const { selectedBranchId, showBranchPicker, viewingLabel } = useBranchScope();
  const defaultBranchId = branches.find((b) => b.isActive)?.id ?? branches[0]?.id ?? "br-main";
  const branchLocked =
    authRole === "BRANCH_MANAGER" || authRole === "MANAGER";

  const [dialogOpen, setDialogOpen] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [deletingUserBusy, setDeletingUserBusy] = useState(false);
  const staff = useStaffStore((s) => s.staff);
  const addStaff = useStaffStore((s) => s.addStaff);
  const deleteStaff = useStaffStore((s) => s.deleteStaff);
  const customers = useCustomerStore((s) => s.customers);
  const jobCards = useJobCardStore((s) => s.jobCards);

  const [mainTab, setMainTab] = useState<"staff" | "customers">("staff");
  const [filterBranch, setFilterBranch] = useState<string>("all");
  const [filterRole, setFilterRole] = useState<UserRole | "ALL">("ALL");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [tablePageSize, setTablePageSize] = useState(20);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const activeStaffFilterCount =
    (filterRole !== "ALL" ? 1 : 0) +
    (filterStatus !== "ALL" ? 1 : 0) +
    (showBranchPicker && filterBranch !== "all" ? 1 : 0);

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [showAddUserPassword, setShowAddUserPassword] = useState(false);
  const [newRole, setNewRole] = useState<UserRole>("MECHANIC");
  const [newBranchId, setNewBranchId] = useState(defaultBranchId);
  const [newBirthday, setNewBirthday] = useState("");
  const [newAnniversary, setNewAnniversary] = useState("");
  const [newEmployeeCode, setNewEmployeeCode] = useState("");
  const [newDesignation, setNewDesignation] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
  const [newJoiningDate, setNewJoiningDate] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newIsActive, setNewIsActive] = useState(true);
  const [newIsAttendanceTracked, setNewIsAttendanceTracked] = useState(true);
  const [newBaseSalary, setNewBaseSalary] = useState("");

  const assignableRoles = useMemo(() => getAssignableStaffRoles(authRole), [authRole]);
  const canManageUsers = canManageStaffUsers(authRole);

  useEffect(() => {
    if (assignableRoles.length && !assignableRoles.includes(newRole)) {
      queueMicrotask(() => setNewRole(assignableRoles[0]!));
    }
  }, [assignableRoles, newRole]);

  useEffect(() => {
    if (branchLocked && authUser?.branchId) {
      queueMicrotask(() => setNewBranchId(authUser.branchId));
      return;
    }
    queueMicrotask(() => {
      setNewBranchId((prev) => {
        if (branches.some((b) => b.id === prev)) return prev;
        return defaultBranchId;
      });
    });
  }, [branches, defaultBranchId, branchLocked, authUser?.branchId]);

  useEffect(() => {
    if (!showBranchPicker) {
      queueMicrotask(() => setFilterBranch("all"));
    }
  }, [showBranchPicker, selectedBranchId]);

  const branchScopedStaff = useMemo(
    () =>
      applyBranchFilters(
        staff,
        (s) => s.branchId,
        selectedBranchId,
        showBranchPicker,
        filterBranch
      ),
    [staff, selectedBranchId, showBranchPicker, filterBranch]
  );

  const branchScopeLabel = useMemo(
    () => resolveBranchScopeLabel(showBranchPicker, viewingLabel, filterBranch, branches),
    [showBranchPicker, viewingLabel, filterBranch, branches]
  );

  const staffJobStatsById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getStaffJobStats>>();
    for (const s of staff) {
      map.set(s.id, getStaffJobStats(jobCards, s.id));
    }
    return map;
  }, [staff, jobCards]);

  const resetAddForm = () => {
    setNewName("");
    setNewEmail("");
    setNewPhone("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setShowAddUserPassword(false);
    setNewRole(assignableRoles[0] ?? "MECHANIC");
    setNewBranchId(branchLocked && authUser?.branchId ? authUser.branchId : defaultBranchId);
    setNewBirthday("");
    setNewAnniversary("");
    setNewEmployeeCode("");
    setNewDesignation("");
    setNewDepartment("");
    setNewJoiningDate("");
    setNewNotes("");
    setNewIsActive(true);
    setNewIsAttendanceTracked(true);
    setNewBaseSalary("");
  };

  const filteredStaff = useMemo(() => {
    return branchScopedStaff.filter((s) => {
      if (filterRole !== "ALL" && s.role !== filterRole) return false;
      if (filterStatus === "ACTIVE" && !s.isActive) return false;
      if (filterStatus === "INACTIVE" && s.isActive) return false;
      return true;
    });
  }, [branchScopedStaff, filterRole, filterStatus]);

  const staffStats = useMemo(() => {
    const total = branchScopedStaff.length;
    const active = branchScopedStaff.filter((s) => s.isActive).length;
    const verified = branchScopedStaff.filter((s) => s.emailVerified).length;
    return { total, active, inactive: total - active, verified };
  }, [branchScopedStaff]);

  const branchScopedCustomers = useMemo(() => {
    if (!selectedBranchId && (!showBranchPicker || filterBranch === "all")) {
      return customers;
    }
    const branchId =
      selectedBranchId ?? (filterBranch !== "all" ? filterBranch : null);
    if (!branchId) return customers;
    const customerIds = new Set(
      jobCards.filter((jc) => jc.branchId === branchId).map((jc) => jc.customerId)
    );
    return customers.filter((c) => customerIds.has(c.id));
  }, [customers, jobCards, selectedBranchId, showBranchPicker, filterBranch]);

  const customerStats = useMemo(() => {
    const total = branchScopedCustomers.length;
    const inactive = branchScopedCustomers.filter((c) => c.isInactive).length;
    const verified = branchScopedCustomers.filter((c) => c.emailVerified).length;
    return { total, active: total - inactive, inactive, verified };
  }, [branchScopedCustomers]);

  const columns = useMemo(
    () => [
      {
        key: "employeeCode",
        label: "Emp. Code",
        render: (item: User) => (
          <span className="font-mono text-xs text-muted-foreground">
            {item.employeeCode?.trim() || "—"}
          </span>
        ),
      },
      {
        key: "name",
        label: "Name",
        render: (item: User) => (
          <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8">
              {resolveUploadsPublicUrl(item.avatar) ? (
                <AvatarImage src={resolveUploadsPublicUrl(item.avatar)!} alt="" className="object-cover" />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {getInitials(item.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-xs text-muted-foreground">{item.email}</p>
            </div>
          </div>
        ),
      },
      {
        key: "phone",
        label: "Phone",
        render: (item: User) =>
          item.phone?.trim() ? (
            <span>{item.phone}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: "role",
        label: "Role",
        render: (item: User) => {
          const badge = roleBadgeFor(item.role);
          const Icon = badge.icon;
          return (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${badge.className}`}
            >
              <Icon className="w-3 h-3 shrink-0" />
              {badge.label}
            </span>
          );
        },
      },
      {
        key: "designation",
        label: "Designation",
        className: "hidden lg:table-cell",
        render: (item: User) => (
          <span className="text-sm">{item.designation?.trim() || "—"}</span>
        ),
      },
      {
        key: "department",
        label: "Department",
        className: "hidden xl:table-cell",
        render: (item: User) => (
          <span className="text-sm">{item.department?.trim() || "—"}</span>
        ),
      },
      {
        key: "joiningDate",
        label: "Joined",
        className: "hidden xl:table-cell",
        render: (item: User) => (
          <span className="text-sm tabular-nums">{item.joiningDate?.trim() || "—"}</span>
        ),
      },
      {
        key: "branchId",
        label: "Branch",
        render: (item: User) => {
          const branch = branches.find((b) => b.id === item.branchId);
          return <span className="text-sm">{branch?.name ?? "—"}</span>;
        },
      },
      {
        key: "isActive",
        label: "Status",
        render: (item: User) => (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${item.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${item.isActive ? "bg-emerald-500" : "bg-gray-400"}`}
            />
            {item.isActive ? "Active" : "Inactive"}
          </span>
        ),
      },
      {
        key: "jobs",
        label: "Jobs",
        className: "hidden lg:table-cell",
        render: (item: User) => {
          const stats = staffJobStatsById.get(item.id);
          if (!stats || stats.total === 0) {
            return <span className="text-muted-foreground">—</span>;
          }
          return (
            <span className="text-sm tabular-nums">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                {stats.completed}
              </span>
              <span className="text-muted-foreground"> done · </span>
              <span className="text-amber-700 dark:text-amber-400 font-medium">
                {stats.active}
              </span>
              <span className="text-muted-foreground"> ongoing</span>
            </span>
          );
        },
      },
      {
        key: "incentive",
        label: "Incentive",
        className: "hidden xl:table-cell",
        render: (item: User) => {
          const earned = staffJobStatsById.get(item.id)?.totalIncentiveEarned ?? 0;
          if (earned <= 0) {
            return <span className="text-muted-foreground">—</span>;
          }
          return (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <IndianRupee className="w-3.5 h-3.5" />
              {earned.toLocaleString("en-IN")}
            </span>
          );
        },
      },
      {
        key: "actions",
        label: "Actions",
        render: (item: User) => (
          <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link href={`/staff/${item.id}`} aria-label="View">
                <Eye className="w-4 h-4 text-blue-600" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link href={`/staff/${item.id}`} aria-label="Edit">
                <Pencil className="w-4 h-4 text-violet-600" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              disabled={!canManageUsers || deletingUserBusy}
              aria-label="Delete"
              onClick={() => setDeletingUser(item)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ),
      },
    ],
    [staff, branches, staffJobStatsById, canManageUsers, deletingUserBusy]
  );

  const customerColumns = useMemo(
    () => [
      {
        key: "id",
        label: "ID",
        render: (c: Customer) => (
          <span className="font-mono text-xs text-muted-foreground">
            #{c.id.replace(/\D/g, "").slice(-4) || c.id}
          </span>
        ),
      },
      {
        key: "name",
        label: "Name",
        render: (c: Customer) => (
          <div>
            <p className="font-medium">{c.name}</p>
            <p className="text-xs text-muted-foreground">{c.email}</p>
          </div>
        ),
      },
      { key: "phone", label: "Phone" },
      {
        key: "totalVisits",
        label: "Visits",
        render: (c: Customer) => <span className="tabular-nums">{c.totalVisits}</span>,
      },
      {
        key: "isInactive",
        label: "Status",
        render: (c: Customer) => (
          <span
            className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${c.isInactive ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}
          >
            {c.isInactive ? "Inactive" : "Active"}
          </span>
        ),
      },
      {
        key: "actions",
        label: "Actions",
        render: (c: Customer) => (
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/customers/${c.id}`}>View</Link>
          </Button>
        ),
      },
    ],
    []
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canCreateStaffAccounts(authRole)) {
      toast.error("Only Super Admin or Admin can create user accounts.");
      return;
    }
    const name = newName.trim();
    const email = newEmail.trim();
    const phone = newPhone.trim();
    if (!name || !email || !phone) {
      toast.error("Please enter name, email, and mobile.");
      return;
    }
    // Accept formats like 9876543210, +919876543210, +91-98765-43210, etc.
    const digits = phone.replace(/[\s\-()]/g, "");
    const phoneDigits = digits.startsWith("+91") ? digits.slice(3) : digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;
    if (!/^\d{10}$/.test(phoneDigits)) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }
    const pwd = newPassword.trim();
    const pwdConfirm = newPasswordConfirm.trim();
    if (pwd !== pwdConfirm) {
      toast.error("Passwords do not match.");
      return;
    }
    if (pwd) {
      const strength = validateStrongPassword(pwd);
      if (strength) {
        toast.error(strength);
        return;
      }
    }
    if (!assignableRoles.includes(newRole)) {
      toast.error("You cannot assign that role.");
      return;
    }
    const dup = staff.some((s) => s.email.toLowerCase() === email.toLowerCase());
    if (dup) {
      toast.error("A staff member with this email already exists.");
      return;
    }
    let finalEmployeeCode = newEmployeeCode.trim();
    if (!finalEmployeeCode) {
      let maxNumber = 0;
      for (const s of staff) {
        if (s.employeeCode && s.employeeCode.startsWith("EMP-")) {
          const numStr = s.employeeCode.replace("EMP-", "");
          const num = parseInt(numStr, 10);
          if (!Number.isNaN(num) && num > maxNumber) {
            maxNumber = num;
          }
        }
      }
      finalEmployeeCode = `EMP-${String(maxNumber + 1).padStart(3, "0")}`;
    }

    const branchId = branchLocked && authUser?.branchId ? authUser.branchId : newBranchId;
    setCreatingUser(true);
    try {
      const { temporaryPassword, credentialsEmailSent } = await addStaff({
        name,
        email,
        phone,
        role: newRole,
        branchId,
        isActive: newIsActive,
        ...(pwd ? { password: pwd } : {}),
        ...(newBirthday.trim() ? { birthday: newBirthday.trim() } : {}),
        ...(newAnniversary.trim() ? { anniversary: newAnniversary.trim() } : {}),
        employeeCode: finalEmployeeCode,
        ...(newDesignation.trim() ? { designation: newDesignation.trim() } : {}),
        ...(newDepartment.trim() ? { department: newDepartment.trim() } : {}),
        ...(newJoiningDate.trim() ? { joiningDate: newJoiningDate.trim() } : {}),
        ...(newNotes.trim() ? { notes: newNotes.trim() } : {}),
        isAttendanceTracked: newIsAttendanceTracked,
        ...(newBaseSalary.trim() && !Number.isNaN(Number(newBaseSalary)) ? { baseSalary: Number(newBaseSalary) } : {}),
      });
      pushActivityLog({
        action: "CREATED",
        entityType: "STAFF",
        entityId: email,
        entityLabel: name,
        details: `Staff created${newEmployeeCode.trim() ? ` (${newEmployeeCode.trim()})` : ""}`,
      });
      if (temporaryPassword) {
        toast.success("User created.", {
          description: `${credentialsEmailSent ? "Credentials emailed. " : ""}Temporary password (copy now — not stored): ${temporaryPassword}`,
          duration: credentialsEmailSent ? 20_000 : 45_000,
        });
      } else {
        toast.success("User created successfully.");
      }
      resetAddForm();
      setDialogOpen(false);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === "USER_LIMIT_REACHED") {
          const currentUsers =
            typeof e.details?.currentUsers === "number" ? e.details.currentUsers : null;
          const maxUsers = typeof e.details?.maxUsers === "number" ? e.details.maxUsers : null;
          const planName =
            typeof e.details?.planName === "string" ? e.details.planName : "your current";
          toast.error(e.message, {
            description:
              currentUsers !== null && maxUsers !== null
                ? `${currentUsers}/${maxUsers} users used on ${planName} plan.`
                : undefined,
          });
          return;
        }
        toast.error(e.message);
        return;
      }
      toast.error(e instanceof Error ? e.message : "Could not create user. Check API server and try again.");
    } finally {
      setCreatingUser(false);
    }
  };

  if (!storesReady && staff.length === 0) return <PageSkeleton />;

  return (
    <div className="space-y-4 sm:space-y-6">
      <RefreshingBar show={!storesReady} />
      <PageHeader
        title="Users Management"
        description="Directory and attendance PINs for staff. Super Admin and Admin can create accounts (no public signup)."
        hideDescriptionOnMobile
        inlineActionsOnMobile
        actions={
          <div className="flex flex-wrap gap-2">
            {mainTab === "customers" ? (
              <Button size="sm" className="shrink-0 whitespace-nowrap" asChild>
                <Link href="/customers">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add customer
                </Link>
              </Button>
            ) : (
              canCreateStaffAccounts(authRole) && (
                <Dialog
                  open={dialogOpen}
                  onOpenChange={(open) => {
                    setDialogOpen(open);
                    if (!open) resetAddForm();
                  }}
                >
                  <DialogTrigger asChild>
                    <Button size="sm" className="shrink-0 whitespace-nowrap">
                      <Plus className="w-4 h-4 mr-1.5" />
                      Add Staff
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg max-h-[min(90vh,720px)] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Add New User</DialogTitle>
                      <DialogDescription>
                        Assign role and branch. Leave password blank for an auto-generated temporary password (also emailed when Resend is configured).
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="name">Full Name</Label>
                          <Input
                            id="name"
                            placeholder="Enter full name"
                            required
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            autoComplete="name"
                          />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="email@primecarwash.com"
                            required
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            autoComplete="email"
                          />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="phone">Mobile</Label>
                          <Input
                            id="phone"
                            placeholder="+91-9876543210"
                            value={newPhone}
                            onChange={(e) => setNewPhone(e.target.value)}
                            inputMode="tel"
                            autoComplete="tel"
                            required
                          />
                          {(() => {
                            const raw = newPhone.trim();
                            if (!raw) return null;
                            const digits = raw.replace(/[\s\-()]/g, "");
                            const core = digits.startsWith("+91") ? digits.slice(3) : digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;
                            if (!/^\d{10}$/.test(core)) {
                              return <p className="text-xs text-destructive">Enter a valid 10-digit mobile number.</p>;
                            }
                            return null;
                          })()}
                        </div>
                        <p className="text-xs text-muted-foreground sm:col-span-2">
                          Optional manual password — {PASSWORD_POLICY_HINT} Leave both fields blank to generate a compliant temporary password automatically.
                        </p>
                        <div className="space-y-2">
                          <Label htmlFor="new-password">Password</Label>
                          <div className="relative">
                            <Input
                              id="new-password"
                              type={showAddUserPassword ? "text" : "password"}
                              placeholder="Leave blank to auto-generate"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="pr-10"
                              autoComplete="new-password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowAddUserPassword((v) => !v)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              aria-label={showAddUserPassword ? "Hide password" : "Show password"}
                            >
                              {showAddUserPassword ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="new-password-confirm">Confirm password</Label>
                          <div className="relative">
                            <Input
                              id="new-password-confirm"
                              type={showAddUserPassword ? "text" : "password"}
                              placeholder="Repeat if setting manually"
                              value={newPasswordConfirm}
                              onChange={(e) => setNewPasswordConfirm(e.target.value)}
                              className="pr-10"
                              autoComplete="new-password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowAddUserPassword((v) => !v)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              aria-label={showAddUserPassword ? "Hide password" : "Show password"}
                            >
                              {showAddUserPassword ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="role">Role</Label>
                          <Select
                            required
                            disabled={authRole !== "SUPER_ADMIN"}
                            value={newRole}
                            onValueChange={(v) => setNewRole(v as UserRole)}
                          >
                            <SelectTrigger id="role">
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              {assignableRoles.map((r) => (
                                <SelectItem key={r} value={r}>
                                  {roleDisplayLabel(r)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="branch">Branch</Label>
                          <Select
                            required
                            value={newBranchId}
                            onValueChange={setNewBranchId}
                            disabled={branchLocked}
                          >
                            <SelectTrigger id="branch">
                              <SelectValue placeholder="Select branch" />
                            </SelectTrigger>
                            <SelectContent>
                              {branches.filter((b) => b.isActive).map((b) => (
                                <SelectItem key={b.id} value={b.id}>
                                  {b.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {branchLocked && authUser && (
                            <div className="flex gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
                              <Info className="w-4 h-4 shrink-0 mt-0.5" />
                              <p>
                                <span className="font-medium">Your branch.</span> New users are assigned to{" "}
                                <span className="font-medium">
                                  {branches.find((b) => b.id === authUser.branchId)?.name ?? "your branch"}
                                </span>{" "}
                                automatically.
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="employeeCode">Employee Code</Label>
                          <Input
                            id="employeeCode"
                            placeholder="e.g. EMP-001"
                            value={newEmployeeCode}
                            onChange={(e) => setNewEmployeeCode(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="designation">Designation</Label>
                          <Input
                            id="designation"
                            placeholder="e.g. Lead Detailer"
                            value={newDesignation}
                            onChange={(e) => setNewDesignation(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="department">Department</Label>
                          <Input
                            id="department"
                            placeholder="e.g. Workshop"
                            value={newDepartment}
                            onChange={(e) => setNewDepartment(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="joiningDate">Joining Date</Label>
                          <Input
                            id="joiningDate"
                            type="date"
                            className="date-input-icon-end pr-9"
                            value={newJoiningDate}
                            onChange={(e) => setNewJoiningDate(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="baseSalary">Basic Salary (₹)</Label>
                          <Input
                            id="baseSalary"
                            inputMode="numeric"
                            placeholder="e.g. 15000"
                            value={newBaseSalary}
                            onChange={(e) => setNewBaseSalary(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="birthday">Date of Birth</Label>
                          <Input
                            id="birthday"
                            type="date"
                            className="date-input-icon-end pr-9"
                            value={newBirthday}
                            onChange={(e) => setNewBirthday(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="anniversary">Anniversary</Label>
                          <Input
                            id="anniversary"
                            type="date"
                            className="date-input-icon-end pr-9"
                            value={newAnniversary}
                            onChange={(e) => setNewAnniversary(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="staffNotes">Notes</Label>
                          <Input
                            id="staffNotes"
                            placeholder="Optional notes"
                            value={newNotes}
                            onChange={(e) => setNewNotes(e.target.value)}
                          />
                        </div>
                        <div className="flex items-center gap-2 sm:col-span-2 pt-1">
                          <Checkbox
                            id="new-active"
                            checked={newIsActive}
                            onCheckedChange={(c) => setNewIsActive(c === true)}
                          />
                          <Label htmlFor="new-active" className="text-sm font-normal cursor-pointer">
                            Active account
                          </Label>
                        </div>
                        <div className="flex items-center gap-2 sm:col-span-2 pt-1">
                          <Checkbox
                            id="new-track-attendance"
                            checked={newIsAttendanceTracked}
                            onCheckedChange={(c) => setNewIsAttendanceTracked(c === true)}
                          />
                          <Label htmlFor="new-track-attendance" className="text-sm font-normal cursor-pointer">
                            Track Attendance for Payroll
                          </Label>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={creatingUser}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={creatingUser}>
                          {creatingUser && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {creatingUser ? "Creating..." : "Create User"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              )
            )}
          </div>
        }
      />

      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "staff" | "customers")}>
        <TabsList>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
        </TabsList>

        <TabsContent value="staff" className="mt-4 flex flex-col gap-3 md:gap-4">
          <div className="order-1 md:order-3">
            <h2 className="mb-2 text-sm font-semibold">Staff list</h2>
            <DataTable
              data={filteredStaff}
              columns={columns}
              searchPlaceholder="Search staff…"
              searchKeys={["name", "email", "phone", "role", "id"]}
              pageSize={tablePageSize}
              onRowClick={(item) => router.push(`/staff/${item.id}`)}
              actions={
                <Button
                  type="button"
                  variant={activeStaffFilterCount > 0 ? "default" : "outline"}
                  size="sm"
                  className="h-7 gap-1 rounded-full px-2.5 text-xs md:hidden"
                  onClick={() => setFilterSheetOpen(true)}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
                  Filters
                  {activeStaffFilterCount > 0 ? (
                    <span className="rounded-full bg-primary-foreground/20 px-1.5 text-[10px] font-semibold leading-none">
                      {activeStaffFilterCount}
                    </span>
                  ) : null}
                </Button>
              }
              renderMobileCard={(item) => {
                const u = item as User;
                const badge = roleBadgeFor(u.role);
                const Icon = badge.icon;
                const branch = branches.find((b) => b.id === u.branchId);
                return (
                  <>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-8 shrink-0">
                        {resolveUploadsPublicUrl(u.avatar) ? (
                          <AvatarImage src={resolveUploadsPublicUrl(u.avatar)!} alt="" className="object-cover" />
                        ) : null}
                        <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                          {getInitials(u.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-tight text-foreground">
                          {u.name}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">{u.email}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${u.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}
                      >
                        {u.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.className}`}
                      >
                        <Icon className="size-2.5 shrink-0" />
                        {badge.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {u.phone?.trim() || "No phone"}
                        {showBranchPicker ? ` · ${branch?.name ?? "—"}` : ""}
                      </span>
                    </div>
                  </>
                );
              }}
            />
          </div>

          <div className="order-2 grid grid-cols-2 gap-2 md:order-1 lg:grid-cols-4 md:gap-3">
            <KPICard
              size="compact"
              title="Total users"
              value={staffStats.total}
              icon={Users}
              tone="violet"
              titleClassName="text-[11px] leading-tight sm:text-xs"
              valueClassName="text-lg sm:text-xl"
            />
            <KPICard
              size="compact"
              title="Active"
              value={staffStats.active}
              icon={UserCheck}
              tone="emerald"
              titleClassName="text-[11px] leading-tight sm:text-xs"
              valueClassName="text-lg sm:text-xl"
            />
            <KPICard
              size="compact"
              title="Inactive"
              value={staffStats.inactive}
              icon={UserX}
              tone="rose"
              titleClassName="text-[11px] leading-tight sm:text-xs"
              valueClassName="text-lg sm:text-xl"
            />
            <KPICard
              size="compact"
              title="Verified email"
              value={staffStats.verified}
              icon={MailCheck}
              tone="blue"
              titleClassName="text-[11px] leading-tight sm:text-xs"
              valueClassName="text-lg sm:text-xl"
            />
          </div>

          <Card className="order-3 hidden md:order-2 md:block">
            <CardContent className="flex flex-col gap-3 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {showBranchPicker ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Filter by branch</Label>
                    <Select value={filterBranch} onValueChange={setFilterBranch}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All branches</SelectItem>
                        {branches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                <div className="space-y-1.5">
                  <Label className="text-xs">Filter by role</Label>
                  <Select
                    value={filterRole}
                    onValueChange={(v) => setFilterRole(v as UserRole | "ALL")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_ROLES_FILTER.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r === "ALL" ? "All roles" : roleDisplayLabel(r)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Filter by status</Label>
                  <Select
                    value={filterStatus}
                    onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All status</SelectItem>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Items per page</Label>
                  <Select
                    value={String(tablePageSize)}
                    onValueChange={(v) => setTablePageSize(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 20, 50].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {showBranchPicker ? (
                <p className="text-xs text-muted-foreground">
                  Showing staff for:{" "}
                  <span className="font-medium text-foreground">{branchScopeLabel}</span>
                  {filterBranch === "all" ? (
                    <span>
                      {" "}
                      — pick a branch in this filter or use the header switcher to narrow the list.
                    </span>
                  ) : null}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <MobileFilterSheet
            open={filterSheetOpen}
            onOpenChange={setFilterSheetOpen}
            title="Staff filters"
            activeCount={activeStaffFilterCount}
            onReset={() => {
              setFilterBranch("all");
              setFilterRole("ALL");
              setFilterStatus("ALL");
              setTablePageSize(20);
            }}
          >
            {showBranchPicker ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Branch</p>
                <Select value={filterBranch} onValueChange={setFilterBranch}>
                  <SelectTrigger className="h-10 w-full bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All branches</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-2">
              <p className="text-sm font-medium">Role</p>
              <Select
                value={filterRole}
                onValueChange={(v) => setFilterRole(v as UserRole | "ALL")}
              >
                <SelectTrigger className="h-10 w-full bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_ROLES_FILTER.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r === "ALL" ? "All roles" : roleDisplayLabel(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Status</p>
              <Select
                value={filterStatus}
                onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}
              >
                <SelectTrigger className="h-10 w-full bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All status</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Items per page</p>
              <Select
                value={String(tablePageSize)}
                onValueChange={(v) => setTablePageSize(Number(v))}
              >
                <SelectTrigger className="h-10 w-full bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 50].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </MobileFilterSheet>
        </TabsContent>

        <TabsContent value="customers" className="mt-4 flex flex-col gap-3 md:gap-4">
          <div className="order-1 md:order-2">
          <DataTable
            data={branchScopedCustomers}
            columns={customerColumns}
            searchPlaceholder="Search customers…"
            searchKeys={["name", "email", "phone", "id"]}
            pageSize={tablePageSize}
            onRowClick={(c) => router.push(`/customers/${c.id}`)}
            renderMobileCard={(item) => {
              const c = item as Customer;
              return (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold leading-tight text-foreground">{c.name}</p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${c.isInactive ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}
                    >
                      {c.isInactive ? "Inactive" : "Active"}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{c.email}</p>
                  <p className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{c.phone}</span>
                    <span className="tabular-nums">{c.totalVisits} visits</span>
                  </p>
                </>
              );
            }}
          />
          </div>
          <div className="order-2 grid grid-cols-2 gap-2 md:order-1 lg:grid-cols-4 md:gap-3">
            <KPICard
              size="compact"
              title="Total customers"
              value={customerStats.total}
              icon={Users}
              tone="violet"
              titleClassName="text-[11px] leading-tight sm:text-xs"
              valueClassName="text-lg sm:text-xl"
            />
            <KPICard
              size="compact"
              title="Active"
              value={customerStats.active}
              icon={UserCheck}
              tone="emerald"
              titleClassName="text-[11px] leading-tight sm:text-xs"
              valueClassName="text-lg sm:text-xl"
            />
            <KPICard
              size="compact"
              title="Inactive"
              value={customerStats.inactive}
              icon={UserX}
              tone="rose"
              titleClassName="text-[11px] leading-tight sm:text-xs"
              valueClassName="text-lg sm:text-xl"
            />
            <KPICard
              size="compact"
              title="Verified email"
              value={customerStats.verified}
              icon={MailCheck}
              tone="blue"
              titleClassName="text-[11px] leading-tight sm:text-xs"
              valueClassName="text-lg sm:text-xl"
            />
          </div>
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!deletingUser}
        onOpenChange={(open) => {
          if (!open && !deletingUserBusy) setDeletingUser(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete staff user?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {" "}
              <span className="font-semibold text-foreground">{deletingUser?.name}</span>? This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={deletingUserBusy}
              onClick={() => setDeletingUser(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deletingUserBusy}
              onClick={async () => {
                if (!deletingUser) return;
                setDeletingUserBusy(true);
                try {
                  await deleteStaff(deletingUser.id);
                  pushActivityLog({
                    action: "STATUS_CHANGED",
                    entityType: "STAFF",
                    entityId: deletingUser.id,
                    entityLabel: deletingUser.name,
                    details: "Staff user deleted",
                  });
                  toast.success("Staff user deleted");
                  setDeletingUser(null);
                } catch (e) {
                  if (e instanceof ApiError) {
                    if (e.status === 403 || e.status === 404) {
                      toast.error(e.message);
                    } else {
                      toast.error(e.message || "Could not delete staff user.");
                    }
                  } else {
                    toast.error(
                      e instanceof Error ? e.message : "Could not delete staff user."
                    );
                  }
                } finally {
                  setDeletingUserBusy(false);
                }
              }}
            >
              {deletingUserBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
