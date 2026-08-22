"use client";

import { use, useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useStaffStore, generateRandomAttendancePin } from "@/store/staff-store";
import { useJobCardStore } from "@/store/job-card-store";
import { useInvoiceStore } from "@/store/invoice-store";
import { useAuthStore } from "@/store/auth-store";
import { useBranchStore } from "@/store/branch-store";
import { useStaffRewardStore } from "@/store/staff-reward-store";
import { getCompanyTargetResults } from "@/lib/staff-rewards/calculate-job-reward";
import {
  canManageStaffUsers,
  getAssignableStaffRoles,
  roleDisplayLabel,
} from "@/lib/rbac";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getInitials, formatDate, formatCurrency } from "@/lib/utils";
import { resolveUploadsPublicUrl } from "@/lib/api-base";
import {
  STAFF_AVATAR_MAX_BYTES,
  fileToStaffAvatarDataUrl,
} from "@/lib/staff-avatar-file";
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
  Briefcase,
  Building2,
  CalendarDays,
  Hash,
  Camera,
  Copy,
  Target,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { pushActivityLog } from "@/lib/activity-log-helper";
import { apiPostForm, ApiError } from "@/lib/api-client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getStaffJobStats } from "@/lib/staff-job-stats";
import { PERMISSIONS_FOR_UI } from "@/lib/permission-keys";
import type { UpdatePinResult } from "@/store/staff-store";
import type { Branch, User, UserRole } from "@/types";

type AuthSessionResponse = { accessToken: string; user: User; branch: Branch | null };

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
  const invoices = useInvoiceStore((s) => s.invoices);

  const settings = useStaffRewardStore((s) => s.settings);
  const staff = useStaffStore((s) => s.staff);

  const today = new Date();
  const [targetYear, setTargetYear] = useState(today.getFullYear());
  const years = useMemo(() => {
    const y = today.getFullYear();
    return [y - 1, y, y + 1];
  }, [today]);

  const activeStaffCount = useMemo(() => staff.filter((s) => s.isActive).length, [staff]);
  const companyTargetResults = useMemo(() => {
    const allResults = getCompanyTargetResults({
      jobCards,
      invoices,
      activeStaffCount,
      settings,
      year: targetYear,
      joiningDate: member?.joiningDate || undefined,
    });
    return allResults.filter((r) => r.periodLabel.startsWith("Monthly"));
  }, [jobCards, invoices, activeStaffCount, settings, targetYear, member?.joiningDate]);

  const totalCompanyTargetIncentive = useMemo(() => {
    return companyTargetResults.reduce((sum, r) => sum + r.sharePerStaff, 0);
  }, [companyTargetResults]);

  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("MECHANIC");
  const [editBranchId, setEditBranchId] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editEmployeeCode, setEditEmployeeCode] = useState("");
  const [editDesignation, setEditDesignation] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editJoiningDate, setEditJoiningDate] = useState("");
  const [editBirthday, setEditBirthday] = useState("");
  const [editAnniversary, setEditAnniversary] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editIsAttendanceTracked, setEditIsAttendanceTracked] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  const [permissions, setPermissions] = useState<string[]>([]);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const applyAuthPayload = useAuthStore((s) => s.applyAuthPayload);

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
    setEditEmployeeCode(member.employeeCode ?? "");
    setEditDesignation(member.designation ?? "");
    setEditDepartment(member.department ?? "");
    setEditJoiningDate(member.joiningDate ?? "");
    setEditBirthday(member.birthday ?? "");
    setEditAnniversary(member.anniversary ?? "");
    setEditNotes(member.notes ?? "");
    setEditIsAttendanceTracked(member.isAttendanceTracked ?? true);
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
  const avatarSrc = resolveUploadsPublicUrl(member.avatar);
  const displayName = editingProfile ? editName || member.name : member.name;

  const handleCancelEditProfile = () => {
    setEditingProfile(false);
    syncEditFromMember();
  };


  const copyToClipboard = async (value: string, label: string) => {
    const textToCopy = value.trim();
    if (!textToCopy) {
      toast.error(`No ${label.toLowerCase()} to copy.`);
      return;
    }
    try {
      await navigator.clipboard.writeText(textToCopy);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Could not copy ${label.toLowerCase()}.`);
    }
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !member) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file (JPEG, PNG, WebP, or GIF).");
      return;
    }
    if (file.size > STAFF_AVATAR_MAX_BYTES) {
      toast.error("Photo must be 5 MB or smaller.");
      return;
    }
    setAvatarUploading(true);
    try {
      if (user?.id === member.id) {
        const fd = new FormData();
        fd.append("avatar", file);
        const payload = await apiPostForm<AuthSessionResponse>("/api/auth/me/avatar", fd);
        applyAuthPayload(payload);
        useStaffStore.setState((s) => ({
          staff: s.staff.map((row) =>
            row.id === member.id ? { ...row, avatar: payload.user.avatar } : row
          ),
        }));
        toast.success("Profile photo updated.");
        return;
      }

      const dataUrl = await fileToStaffAvatarDataUrl(file);
      const result = await updateStaff(member.id, { avatar: dataUrl });
      if (!result.ok) {
        toast.error("Could not update profile photo.");
        return;
      }
      toast.success("Profile photo updated.");
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not upload photo."
      );
    } finally {
      setAvatarUploading(false);
    }
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
      employeeCode: editEmployeeCode.trim() || null,
      designation: editDesignation.trim() || null,
      department: editDepartment.trim() || null,
      joiningDate: editJoiningDate.trim() || null,
      birthday: editBirthday.trim() || null,
      anniversary: editAnniversary.trim() || null,
      notes: editNotes.trim() || null,
      isAttendanceTracked: editIsAttendanceTracked,
    });
    if (result.ok) {
      pushActivityLog({
        action: "UPDATED",
        entityType: "STAFF",
        entityId: member.id,
        entityLabel: name,
        details: "Staff profile updated",
      });
    }
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
        <CardContent className="!p-4 sm:!p-6">
          <div className="flex flex-col gap-4 sm:gap-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <input
                  ref={avatarFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  aria-hidden
                  tabIndex={-1}
                  onChange={(e) => void handleAvatarFileChange(e)}
                />
                {editingProfile && canEditStaff ? (
                  <div className="relative group shrink-0">
                    <button
                      type="button"
                      disabled={avatarUploading}
                      onClick={() => avatarFileInputRef.current?.click()}
                      className="relative rounded-full border-0 bg-transparent p-0 cursor-pointer disabled:opacity-60 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      aria-label={avatarUploading ? "Uploading photo" : "Change profile photo"}
                    >
                      <Avatar className="h-12 w-12 sm:h-14 sm:w-14 pointer-events-none">
                        {avatarSrc ? (
                          <AvatarImage src={avatarSrc} alt="" className="object-cover" key={avatarSrc} />
                        ) : null}
                        <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                          {getInitials(displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                        aria-hidden
                      >
                        {avatarUploading ? (
                          <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <Camera className="h-4 w-4 text-white" />
                        )}
                      </span>
                    </button>
                  </div>
                ) : (
                  <Avatar className="h-12 w-12 sm:h-14 sm:w-14 shrink-0">
                    {avatarSrc ? (
                      <AvatarImage src={avatarSrc} alt="" className="object-cover" key={avatarSrc} />
                    ) : null}
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                      {getInitials(displayName)}
                    </AvatarFallback>
                  </Avatar>
                )}
                {!editingProfile ? (
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold truncate">{member.name}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        <Shield className="w-3 h-3" />
                        {roleDisplayLabel(member.role)}
                      </span>
                      {!member.isActive && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">Profile photo</p>
                    <p className="text-xs text-muted-foreground">
                      Click to upload · JPEG, PNG, WebP or GIF · max 5 MB
                    </p>
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
                      <Button type="button" size="sm" onClick={() => void handleSaveProfile()}>
                        Save changes
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>

            {!editingProfile ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                    <Mail className="w-4 h-4 shrink-0" />
                    <span className="truncate">{member.email}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      aria-label="Copy email"
                      onClick={() => void copyToClipboard(member.email, "Email")}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                    <Phone className="w-4 h-4 shrink-0" />
                    <span className="truncate">{member.phone}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      aria-label="Copy phone number"
                      onClick={() => void copyToClipboard(member.phone, "Phone")}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                    <MapPin className="w-4 h-4 shrink-0" />
                    <span className="truncate">{branch?.name ?? "—"}</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                    <Hash className="w-4 h-4 shrink-0" />
                    <span className="truncate">Code: {member.employeeCode?.trim() || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                    <Briefcase className="w-4 h-4 shrink-0" />
                    <span className="truncate">{member.designation?.trim() || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                    <Building2 className="w-4 h-4 shrink-0" />
                    <span className="truncate">{member.department?.trim() || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CalendarDays className="w-4 h-4 shrink-0" />
                    Joined: {member.joiningDate?.trim() || "—"}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CalendarDays className="w-4 h-4 shrink-0" />
                    DOB: {member.birthday?.trim() || "—"}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CalendarDays className="w-4 h-4 shrink-0" />
                    Anniversary: {member.anniversary?.trim() || "—"}
                  </div>
                  {member.notes?.trim() ? (
                    <div className="sm:col-span-2 lg:col-span-3 text-muted-foreground">
                      Notes: {member.notes.trim()}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 w-full">
                <div className="space-y-2 sm:col-span-2 xl:col-span-3">
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
                  <Label htmlFor="staff-employee-code">Employee Code</Label>
                  <Input
                    id="staff-employee-code"
                    value={editEmployeeCode}
                    onChange={(e) => setEditEmployeeCode(e.target.value)}
                    placeholder="e.g. EMP-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staff-designation">Designation</Label>
                  <Input
                    id="staff-designation"
                    value={editDesignation}
                    onChange={(e) => setEditDesignation(e.target.value)}
                    placeholder="e.g. Lead Detailer"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staff-department">Department</Label>
                  <Input
                    id="staff-department"
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value)}
                    placeholder="e.g. Workshop"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staff-joining-date">Joining Date</Label>
                  <Input
                    id="staff-joining-date"
                    type="date"
                    className="date-input-icon-end pr-9"
                    value={editJoiningDate}
                    onChange={(e) => setEditJoiningDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staff-birthday">Date of Birth</Label>
                  <Input
                    id="staff-birthday"
                    type="date"
                    className="date-input-icon-end pr-9"
                    value={editBirthday}
                    onChange={(e) => setEditBirthday(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staff-anniversary">Anniversary</Label>
                  <Input
                    id="staff-anniversary"
                    type="date"
                    className="date-input-icon-end pr-9"
                    value={editAnniversary}
                    onChange={(e) => setEditAnniversary(e.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2 xl:col-span-3">
                  <Label htmlFor="staff-notes">Notes</Label>
                  <Textarea
                    id="staff-notes"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Optional notes"
                    rows={3}
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
                <div className="flex items-center gap-2 sm:col-span-2 xl:col-span-3 pt-1">
                  <Checkbox
                    id="staff-active"
                    checked={editIsActive}
                    onCheckedChange={(c) => setEditIsActive(c === true)}
                  />
                  <Label htmlFor="staff-active" className="text-sm font-normal cursor-pointer">
                    Active (can log in and appear on rosters)
                  </Label>
                </div>
                <div className="flex items-center gap-2 sm:col-span-2 xl:col-span-3 pt-1">
                  <Checkbox
                    id="staff-track-attendance"
                    checked={editIsAttendanceTracked}
                    onCheckedChange={(c) => setEditIsAttendanceTracked(c === true)}
                  />
                  <Label htmlFor="staff-track-attendance" className="text-sm font-normal cursor-pointer">
                    Track Attendance for Payroll
                  </Label>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
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
        <Card>
          <CardContent className="!flex !items-center gap-4 !px-5 !py-6 sm:!px-6 sm:!py-7">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-900/30">
              <Target className="w-6 h-6 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(totalCompanyTargetIncentive)}
              </p>
              <p className="text-sm text-muted-foreground">Company Target ({targetYear})</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {settings.companyTargetEnabled && (
        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                Company Target Achieved Incentive
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                Incentives earned when the company achieves its tier-wise targets. Shared equally among active staff.
              </p>
            </div>
            <div className="w-32">
              <Select value={String(targetYear)} onValueChange={(v) => setTargetYear(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {companyTargetResults.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No company target results available.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                      <th className="py-2.5 px-4 font-medium">Period</th>
                      <th className="py-2.5 px-4 font-medium text-right">Company Revenue</th>
                      <th className="py-2.5 px-4 font-medium px-6 text-center">Target Achieved</th>
                      <th className="py-2.5 px-4 font-medium text-right">Reward %</th>
                      <th className="py-2.5 px-4 font-medium text-right">Total Incentive</th>
                      <th className="py-2.5 px-4 font-medium text-right text-emerald-600 dark:text-emerald-400">Your Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companyTargetResults.map((r, idx) => {
                      const isNotEligible = r.notEligible;
                      return (
                        <tr key={idx} className="border-b border-border/70 hover:bg-muted/10 transition-colors">
                          <td className="py-2.5 px-4 font-medium">{r.periodLabel}</td>
                          <td className="py-2.5 px-4 text-right tabular-nums">
                            {isNotEligible ? "—" : formatCurrency(r.revenue)}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            {!isNotEligible && r.achievedTierIndex !== -1 ? (
                              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-none font-semibold">
                                Tier {r.achievedTierIndex + 1}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums">
                            {!isNotEligible && r.rewardPercent > 0 ? `${r.rewardPercent}%` : "—"}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums">
                            {!isNotEligible && r.totalReward > 0 ? formatCurrency(r.totalReward) : "—"}
                          </td>
                          <td className={`py-2.5 px-4 text-right tabular-nums font-semibold ${!isNotEligible && r.sharePerStaff > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                            {!isNotEligible && r.sharePerStaff > 0 ? formatCurrency(r.sharePerStaff) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
