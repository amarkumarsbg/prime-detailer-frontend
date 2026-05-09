"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useStaffStore } from "@/store/staff-store";
import { useBranchStore } from "@/store/branch-store";
import { useAuthStore } from "@/store/auth-store";
import { useCustomerStore } from "@/store/customer-store";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getInitials } from "@/lib/utils";
import { getAssignableStaffRoles, canManageStaffUsers, roleDisplayLabel } from "@/lib/rbac";
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
} from "lucide-react";
import type { User, UserRole, Customer } from "@/types";
import { toast } from "sonner";

const ROLE_BADGE_MAP: Record<
  UserRole,
  { label: string; className: string; icon: React.ElementType }
> = {
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
};

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
  const router = useRouter();
  const authRole = useAuthStore((s) => s.user?.role);
  const authUser = useAuthStore((s) => s.user);
  const branches = useBranchStore((s) => s.branches);
  const defaultBranchId = branches.find((b) => b.isActive)?.id ?? branches[0]?.id ?? "br-main";
  const branchLocked =
    authRole === "BRANCH_MANAGER" || authRole === "MANAGER";

  const [dialogOpen, setDialogOpen] = useState(false);
  const staff = useStaffStore((s) => s.staff);
  const addStaff = useStaffStore((s) => s.addStaff);
  const customers = useCustomerStore((s) => s.customers);

  const [mainTab, setMainTab] = useState<"staff" | "customers">("staff");
  const [filterBranch, setFilterBranch] = useState<string>("all");
  const [filterRole, setFilterRole] = useState<UserRole | "ALL">("ALL");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [tablePageSize, setTablePageSize] = useState(20);

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
  const [newIsActive, setNewIsActive] = useState(true);

  const assignableRoles = useMemo(() => getAssignableStaffRoles(authRole), [authRole]);

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
    setNewIsActive(true);
  };

  const filteredStaff = useMemo(() => {
    return staff.filter((s) => {
      if (filterBranch !== "all" && s.branchId !== filterBranch) return false;
      if (filterRole !== "ALL" && s.role !== filterRole) return false;
      if (filterStatus === "ACTIVE" && !s.isActive) return false;
      if (filterStatus === "INACTIVE" && s.isActive) return false;
      return true;
    });
  }, [staff, filterBranch, filterRole, filterStatus]);

  const staffStats = useMemo(() => {
    const total = staff.length;
    const active = staff.filter((s) => s.isActive).length;
    const verified = staff.filter((s) => s.emailVerified).length;
    return { total, active, inactive: total - active, verified };
  }, [staff]);

  const customerStats = useMemo(() => {
    const total = customers.length;
    const inactive = customers.filter((c) => c.isInactive).length;
    const verified = customers.filter((c) => c.emailVerified).length;
    return { total, active: total - inactive, inactive, verified };
  }, [customers]);

  const columns = useMemo(
    () => [
      {
        key: "id",
        label: "ID",
        render: (item: User) => (
          <span className="font-mono text-xs text-muted-foreground">
            #{item.id.replace(/\D/g, "").slice(-3) || item.id}
          </span>
        ),
      },
      {
        key: "name",
        label: "Name",
        render: (item: User) => (
          <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8">
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
          const badge = ROLE_BADGE_MAP[item.role];
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
      ...(staff.some((s) => s.totalJobsCompleted != null || s.totalIncentiveEarned != null)
        ? [
            {
              key: "totalJobsCompleted",
              label: "Jobs",
              className: "hidden lg:table-cell",
              render: (item: User) =>
                item.totalJobsCompleted != null ? (
                  <span className="inline-flex items-center gap-1 text-sm">
                    <ClipboardList className="w-3.5 h-3.5 text-muted-foreground" />
                    {item.totalJobsCompleted}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                ),
            },
            {
              key: "totalIncentiveEarned",
              label: "Incentive",
              className: "hidden xl:table-cell",
              render: (item: User) =>
                item.totalIncentiveEarned != null ? (
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    <IndianRupee className="w-3.5 h-3.5" />
                    {item.totalIncentiveEarned.toLocaleString("en-IN")}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                ),
            },
          ]
        : []),
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
              disabled
              aria-label="Delete (demo)"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ),
      },
    ],
    [staff, branches]
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
    if (!canManageStaffUsers(authRole)) {
      toast.error("You don't have permission to add staff.");
      return;
    }
    const name = newName.trim();
    const email = newEmail.trim();
    const phone = newPhone.trim();
    if (!name || !email) {
      toast.error("Please enter name and email.");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      toast.error("Passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
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
    const branchId = branchLocked && authUser?.branchId ? authUser.branchId : newBranchId;
    try {
      await addStaff({
        name,
        email,
        phone,
        role: newRole,
        branchId,
        isActive: newIsActive,
        ...(newBirthday.trim() ? { birthday: newBirthday.trim() } : {}),
        ...(newAnniversary.trim() ? { anniversary: newAnniversary.trim() } : {}),
      });
      toast.success("User created successfully.");
      resetAddForm();
      setDialogOpen(false);
    } catch {
      toast.error("Could not create user. Check API server and try again.");
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Users Management"
        description="Manage staff, customers, and role-based access. Super admins and admins can manage branches in Settings."
        actions={
          <div className="flex flex-wrap gap-2">
            {mainTab === "customers" ? (
              <Button asChild>
                <Link href="/customers">
                  <Plus className="w-4 h-4 mr-2" />
                  Add customer
                </Link>
              </Button>
            ) : (
              canManageStaffUsers(authRole) && (
                <Dialog
                  open={dialogOpen}
                  onOpenChange={(open) => {
                    setDialogOpen(open);
                    if (!open) resetAddForm();
                  }}
                >
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Staff
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg max-h-[min(90vh,720px)] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Add New User</DialogTitle>
                      <DialogDescription>
                        Create credentials and assign a role. Branch managers can only add users to their own branch.
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
                          <Label htmlFor="phone">Phone (optional)</Label>
                          <Input
                            id="phone"
                            placeholder="+91-9876543210"
                            value={newPhone}
                            onChange={(e) => setNewPhone(e.target.value)}
                            inputMode="tel"
                            autoComplete="tel"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="new-password">Password</Label>
                          <div className="relative">
                            <Input
                              id="new-password"
                              type={showAddUserPassword ? "text" : "password"}
                              placeholder="Create a password"
                              required
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
                              placeholder="Repeat password"
                              required
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
                          <Label htmlFor="birthday">Birthday</Label>
                          <Input
                            id="birthday"
                            type="date"
                            value={newBirthday}
                            onChange={(e) => setNewBirthday(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="anniversary">Anniversary</Label>
                          <Input
                            id="anniversary"
                            type="date"
                            value={newAnniversary}
                            onChange={(e) => setNewAnniversary(e.target.value)}
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
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit">
                          Create User
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              )
            )}
            <Button variant="outline" type="button" asChild>
              <Link href="/settings">Branches &amp; org settings</Link>
            </Button>
          </div>
        }
      />

      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "staff" | "customers")}>
        <TabsList>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
        </TabsList>

        <TabsContent value="staff" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium">Total users</p>
                <p className="text-2xl font-bold tabular-nums mt-1">{staffStats.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium">Active</p>
                <p className="text-2xl font-bold tabular-nums mt-1 text-emerald-600">
                  {staffStats.active}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium">Inactive</p>
                <p className="text-2xl font-bold tabular-nums mt-1 text-red-600">
                  {staffStats.inactive}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium">Verified email</p>
                <p className="text-2xl font-bold tabular-nums mt-1 text-blue-600">
                  {staffStats.verified}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4 flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
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
            </CardContent>
          </Card>

          <div>
            <h2 className="text-sm font-semibold mb-2">Staff list</h2>
            <DataTable
              data={filteredStaff}
              columns={columns}
              searchPlaceholder="Search staff…"
              searchKeys={["name", "email", "phone", "role", "id"]}
              pageSize={tablePageSize}
              onRowClick={(item) => router.push(`/staff/${item.id}`)}
            />
          </div>
        </TabsContent>

        <TabsContent value="customers" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium">Total customers</p>
                <p className="text-2xl font-bold tabular-nums mt-1">{customerStats.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium">Active</p>
                <p className="text-2xl font-bold tabular-nums mt-1 text-emerald-600">
                  {customerStats.active}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium">Inactive</p>
                <p className="text-2xl font-bold tabular-nums mt-1 text-red-600">
                  {customerStats.inactive}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium">Verified email</p>
                <p className="text-2xl font-bold tabular-nums mt-1 text-blue-600">
                  {customerStats.verified}
                </p>
              </CardContent>
            </Card>
          </div>
          <DataTable
            data={customers}
            columns={customerColumns}
            searchPlaceholder="Search customers…"
            searchKeys={["name", "email", "phone", "id"]}
            pageSize={tablePageSize}
            onRowClick={(c) => router.push(`/customers/${c.id}`)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
