"use client";

import { use, useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStaffStore, generateRandomAttendancePin } from "@/store/staff-store";
import { useJobCardStore } from "@/store/job-card-store";
import { useAuthStore } from "@/store/auth-store";
import { useBranchStore } from "@/store/branch-store";
import {
  canManageStaffUsers,
  getAssignableStaffRoles,
  roleDisplayLabel,
} from "@/lib/rbac";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getInitials, formatDate, formatCurrency } from "@/lib/utils";
import { JobCardStatusBadge } from "@/components/shared/status-badge";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Shield,
  ClipboardList,
  CheckCircle2,
  Clock,
  IndianRupee,
  KeyRound,
  Pencil,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getStaffJobStats } from "@/lib/staff-job-stats";
import { PERMISSIONS_FOR_UI } from "@/lib/permission-keys";
import type { UpdatePinResult } from "@/store/staff-store";
import type { User, UserRole } from "@/types";

const ALL_PERMISSIONS = PERMISSIONS_FOR_UI;

function StaffAttendancePinCard({
  member,
  updateAttendancePin,
}: {
  member: User;
  updateAttendancePin: (
    staffId: string,
    pin: string
  ) => Promise<UpdatePinResult>;
}) {
  const [pinInput, setPinInput] = useState(member.attendancePin ?? "");

  const handleSaveAttendancePin = async () => {
    const result = await updateAttendancePin(member.id, pinInput);
    if (!result.ok) {
      if (result.error === "DUPLICATE") {
        toast.error("Another team member already uses this PIN.");
      } else {
        toast.error("Use 4–8 digits for the PIN.");
      }
      return;
    }
    toast.success("Attendance PIN saved.");
  };

  const handleGenerateAttendancePin = async () => {
    for (let i = 0; i < 60; i++) {
      const candidate = generateRandomAttendancePin();
      const result = await updateAttendancePin(member.id, candidate);
      if (result.ok) {
        setPinInput(candidate);
        toast.success("New PIN generated.");
        return;
      }
    }
    toast.error("Could not generate a unique PIN. Try again.");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="w-4 h-4" />
          Attendance PIN
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Used at the store QR punch terminal. Keep it private and share only with the staff member.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 max-w-sm">
          <Label htmlFor="attendance-pin">PIN (4–8 digits)</Label>
          <Input
            id="attendance-pin"
            inputMode="numeric"
            autoComplete="off"
            placeholder="e.g. 4521"
            value={pinInput}
            onChange={(e) =>
              setPinInput(e.target.value.replace(/\D/g, "").slice(0, 8))
            }
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void handleSaveAttendancePin()}>
            Save PIN
          </Button>
          <Button type="button" variant="outline" onClick={() => void handleGenerateAttendancePin()}>
            Generate random
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const branches = useBranchStore((s) => s.branches);
  const member = useStaffStore((s) => s.staff.find((row) => row.id === id));
  const updateAttendancePin = useStaffStore((s) => s.updateAttendancePin);
  const updateStaff = useStaffStore((s) => s.updateStaff);
  const jobCards = useJobCardStore((s) => s.jobCards);

  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("MECHANIC");
  const [editBranchId, setEditBranchId] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);

  const [permissions, setPermissions] = useState<string[]>([]);
  const [savingPermissions, setSavingPermissions] = useState(false);

  useEffect(() => {
    if (member) {
      setPermissions(member.permissions || []);
    }
  }, [member]);

  const isEditingSuperAdmin = member?.role === "SUPER_ADMIN";

  const handleTogglePermission = (key: string) => {
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSavePermissions = async () => {
    if (!member) return;
    setSavingPermissions(true);
    try {
      const result = await updateStaff(member.id, {
        permissions,
      });
      if (result.ok) {
        toast.success("Permissions updated successfully.");
      } else {
        toast.error("Failed to update permissions.");
      }
    } catch {
      toast.error("An error occurred while updating permissions.");
    } finally {
      setSavingPermissions(false);
    }
  };

  const syncEditFromMember = () => {
    if (!member) return;
    setEditName(member.name);
    setEditEmail(member.email);
    setEditPhone(member.phone);
    setEditRole(member.role);
    setEditBranchId(member.branchId);
    setEditIsActive(member.isActive);
  };

  const handleStartEditProfile = () => {
    syncEditFromMember();
    setEditingProfile(true);
  };

  const assignableRoles = useMemo(
    () => getAssignableStaffRoles(user?.role),
    [user?.role]
  );

  const roleOptionsForSelect = useMemo(() => {
    if (!member) return assignableRoles;
    if (assignableRoles.includes(member.role)) return assignableRoles;
    return [member.role, ...assignableRoles];
  }, [member, assignableRoles]);

  const branchOptionsForEdit = useMemo(() => {
    const active = branches.filter((b) => b.isActive);
    const cur = branches.find((b) => b.id === editBranchId);
    if (cur && !cur.isActive && !active.some((b) => b.id === cur.id)) {
      return [cur, ...active];
    }
    return active;
  }, [branches, editBranchId]);

  const canEditStaff = canManageStaffUsers(user?.role);

  const canEditAttendancePin = canEditStaff;

  const jobStats = useMemo(
    () => (member ? getStaffJobStats(jobCards, member.id) : null),
    [jobCards, member]
  );

  if (!member || !jobStats) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Staff member not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/staff")}>
          <ArrowLeft className="w-4 h-4 mr-2" />Back to Staff
        </Button>
      </div>
    );
  }

  const branch = branches.find((b) => b.id === member.branchId);

  const handleCancelEditProfile = () => {
    setEditingProfile(false);
    syncEditFromMember();
  };

  const handleSaveProfile = async () => {
    const name = editName.trim();
    const email = editEmail.trim();
    const phone = editPhone.trim();
    if (!name || !email || !phone) {
      toast.error("Name, email, and phone are required.");
      return;
    }
    const allowed = getAssignableStaffRoles(user?.role);
    if (editRole !== member.role && !allowed.includes(editRole)) {
      toast.error("You can't assign that role.");
      return;
    }
    const result = await updateStaff(member.id, {
      name,
      email,
      phone,
      role: editRole,
      branchId: editBranchId,
      isActive: editIsActive,
    });
    if (!result.ok) {
      if (result.error === "DUPLICATE_EMAIL") {
        toast.error("Another staff member already uses this email.");
      } else {
        toast.error("Could not save changes.");
      }
      return;
    }
    toast.success("Profile updated.");
    setEditingProfile(false);
  };

  const renderJobRow = (job: (typeof jobStats.activeJobs)[number]) => (
    <div
      key={job.id}
      className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={() => router.push(`/job-cards/${job.id}`)}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm">{job.jobNumber}</p>
        <p className="text-xs text-muted-foreground">
          {job.customerName} &middot; {job.vehicleRegNumber}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs text-muted-foreground hidden sm:inline">
          {formatDate(job.createdAt)}
        </span>
        <JobCardStatusBadge status={job.status} />
      </div>
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <Breadcrumbs items={[
        { label: "Staff", href: "/staff" },
        { label: member.name },
      ]} />

      <Card>
        <CardContent className="!p-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center items-start gap-6 flex-1 min-w-0">
                <Avatar className="w-20 h-20 shrink-0">
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                    {getInitials(editingProfile ? editName || member.name : member.name)}
                  </AvatarFallback>
                </Avatar>
                {!editingProfile ? (
                  <div className="flex-1 space-y-3 min-w-0">
                    <div>
                      <h2 className="text-xl font-bold">{member.name}</h2>
                      <span className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        <Shield className="w-3 h-3" />
                        {roleDisplayLabel(member.role)}
                      </span>
                      {!member.isActive && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                        <Mail className="w-4 h-4 shrink-0" />
                        <span className="truncate">{member.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-4 h-4 shrink-0" />
                        {member.phone}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                        <MapPin className="w-4 h-4 shrink-0" />
                        <span className="truncate">{branch?.name ?? "—"}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 w-full max-w-xl space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="staff-name">Name</Label>
                        <Input
                          id="staff-name"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          autoComplete="name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="staff-email">Email</Label>
                        <Input
                          id="staff-email"
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          autoComplete="email"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="staff-phone">Phone</Label>
                        <Input
                          id="staff-phone"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          inputMode="tel"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <Select
                          value={editRole}
                          onValueChange={(v) => setEditRole(v as UserRole)}
                          disabled={user?.role !== "SUPER_ADMIN"}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {roleOptionsForSelect.map((r) => (
                              <SelectItem key={r} value={r}>
                                {roleDisplayLabel(r)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Branch</Label>
                        <Select value={editBranchId} onValueChange={setEditBranchId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Branch" />
                          </SelectTrigger>
                          <SelectContent>
                            {branchOptionsForEdit.map((b) => (
                              <SelectItem key={b.id} value={b.id}>
                                {b.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2 sm:col-span-2 pt-2">
                        <Checkbox
                          id="staff-active"
                          checked={editIsActive}
                          onCheckedChange={(c) => setEditIsActive(c === true)}
                        />
                        <Label htmlFor="staff-active" className="text-sm font-normal cursor-pointer">
                          Active (can log in and appear on rosters)
                        </Label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {canEditStaff && (
                <div className="flex flex-wrap gap-2 shrink-0">
                  {!editingProfile ? (
                    <Button type="button" variant="outline" size="sm" onClick={handleStartEditProfile}>
                      <Pencil className="w-4 h-4 mr-2" />
                      Edit profile
                    </Button>
                  ) : (
                    <>
                      <Button type="button" variant="outline" size="sm" onClick={handleCancelEditProfile}>
                        Cancel
                      </Button>
                      <Button type="button" size="sm" onClick={handleSaveProfile}>
                        Save changes
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="!flex !items-center gap-4 !px-5 !py-6 sm:!px-6 sm:!py-7">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <ClipboardList className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{jobStats.total}</p>
              <p className="text-sm text-muted-foreground">Total assigned</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="!flex !items-center gap-4 !px-5 !py-6 sm:!px-6 sm:!py-7">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{jobStats.completed}</p>
              <p className="text-sm text-muted-foreground">Completed (delivered)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="!flex !items-center gap-4 !px-5 !py-6 sm:!px-6 sm:!py-7">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30">
              <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{jobStats.active}</p>
              <p className="text-sm text-muted-foreground">Ongoing</p>
            </div>
          </CardContent>
        </Card>
        {jobStats.totalIncentiveEarned > 0 && (
          <Card>
            <CardContent className="!flex !items-center gap-4 !px-5 !py-6 sm:!px-6 sm:!py-7">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-900/30">
                <IndianRupee className="w-6 h-6 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(jobStats.totalIncentiveEarned)}
                </p>
                <p className="text-sm text-muted-foreground">Incentive (delivered jobs)</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {canEditAttendancePin && (
        <StaffAttendancePinCard
          key={`${member.id}:${member.attendancePin ?? ""}`}
          member={member}
          updateAttendancePin={updateAttendancePin}
        />
      )}

      {user?.role === "SUPER_ADMIN" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Staff Permissions
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Select which modules this staff member can access. Super Admins always have full access.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {ALL_PERMISSIONS.map((perm) => {
                const isChecked = isEditingSuperAdmin || permissions.includes(perm.key);
                return (
                  <div key={perm.key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`perm-${perm.key}`}
                      checked={isChecked}
                      disabled={isEditingSuperAdmin || savingPermissions}
                      onCheckedChange={() => handleTogglePermission(perm.key)}
                    />
                    <label
                      htmlFor={`perm-${perm.key}`}
                      className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {perm.label}
                    </label>
                  </div>
                );
              })}
            </div>
            {!isEditingSuperAdmin && (
              <div className="flex justify-end">
                <Button
                  disabled={savingPermissions || JSON.stringify(permissions.sort()) === JSON.stringify((member.permissions || []).sort())}
                  onClick={() => void handleSavePermissions()}
                >
                  {savingPermissions ? "Saving..." : "Save Permissions"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {jobStats.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Job history</CardTitle>
            <p className="text-sm text-muted-foreground">
              {jobStats.completed} completed · {jobStats.active} ongoing
              {jobStats.cancelled > 0 ? ` · ${jobStats.cancelled} cancelled` : ""} — from assigned job cards
            </p>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="ongoing">
              <TabsList>
                <TabsTrigger value="ongoing">
                  Ongoing ({jobStats.active})
                </TabsTrigger>
                <TabsTrigger value="completed">
                  Completed ({jobStats.completed})
                </TabsTrigger>
                {jobStats.cancelled > 0 && (
                  <TabsTrigger value="cancelled">
                    Cancelled ({jobStats.cancelled})
                  </TabsTrigger>
                )}
              </TabsList>
              <TabsContent value="ongoing" className="mt-4">
                {jobStats.activeJobs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    No ongoing jobs assigned to this staff member.
                  </p>
                ) : (
                  <div className="space-y-3">{jobStats.activeJobs.map(renderJobRow)}</div>
                )}
              </TabsContent>
              <TabsContent value="completed" className="mt-4">
                {jobStats.completedJobs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    No delivered jobs yet.
                  </p>
                ) : (
                  <div className="space-y-3">{jobStats.completedJobs.map(renderJobRow)}</div>
                )}
              </TabsContent>
              {jobStats.cancelled > 0 && (
                <TabsContent value="cancelled" className="mt-4">
                  <div className="space-y-3">{jobStats.cancelledJobs.map(renderJobRow)}</div>
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
