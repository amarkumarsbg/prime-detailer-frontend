"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { KPICard } from "@/components/shared/kpi-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  applyBranchFilters,
  resolveBranchScopeLabel,
  useBranchScope,
} from "@/lib/branch-scope";
import {
  availableLeaveDays,
  countLeaveDays,
} from "@/lib/leave/calculations";
import { pushActivityLog } from "@/lib/activity-log-helper";
import { canManageStaffUsers } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { useBranchStore } from "@/store/branch-store";
import { useLeaveStore } from "@/store/leave-store";
import { useStaffStore } from "@/store/staff-store";
import type { LeaveRequest, LeaveRequestStatus, LeaveType } from "@/types";
import { Ban, CalendarOff, Check, Clock, Plus, X } from "lucide-react";
import { toast } from "sonner";

const STATUS_CLASS: Record<LeaveRequestStatus, string> = {
  PENDING:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  APPROVED:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  REJECTED: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  CANCELLED: "bg-muted text-muted-foreground",
};

export default function LeavePage() {
  const authUser = useAuthStore((s) => s.user);
  const branches = useBranchStore((s) => s.branches);
  const staff = useStaffStore((s) => s.staff);
  const leaveTypes = useLeaveStore((s) => s.leaveTypes);
  const balances = useLeaveStore((s) => s.balances);
  const requests = useLeaveStore((s) => s.requests);
  const applyLeave = useLeaveStore((s) => s.applyLeave);
  const approveLeave = useLeaveStore((s) => s.approveLeave);
  const rejectLeave = useLeaveStore((s) => s.rejectLeave);
  const cancelLeave = useLeaveStore((s) => s.cancelLeave);
  const upsertLeaveType = useLeaveStore((s) => s.upsertLeaveType);
  const setLeaveTypeActive = useLeaveStore((s) => s.setLeaveTypeActive);
  const setEntitledDays = useLeaveStore((s) => s.setEntitledDays);

  const { selectedBranchId, showBranchPicker, viewingLabel } = useBranchScope();
  const [pageBranchFilter, setPageBranchFilter] = useState("all");
  const canDecide = canManageStaffUsers(authUser?.role);

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [applyOpen, setApplyOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [decisionMode, setDecisionMode] = useState<"APPROVE" | "REJECT">("APPROVE");
  const [activeRequest, setActiveRequest] = useState<LeaveRequest | null>(null);
  const [decisionComments, setDecisionComments] = useState("");

  const [applyStaffId, setApplyStaffId] = useState("");
  const [applyTypeId, setApplyTypeId] = useState("");
  const [applyFrom, setApplyFrom] = useState("");
  const [applyTo, setApplyTo] = useState("");
  const [applyReason, setApplyReason] = useState("");

  const [typeName, setTypeName] = useState("");
  const [typePaid, setTypePaid] = useState(true);
  const [typeTracks, setTypeTracks] = useState(true);
  const [typeDays, setTypeDays] = useState("12");
  const [editingTypeId, setEditingTypeId] = useState<string | undefined>();

  const branchScopeLabel = useMemo(
    () =>
      resolveBranchScopeLabel(
        showBranchPicker,
        viewingLabel,
        pageBranchFilter,
        branches
      ),
    [showBranchPicker, viewingLabel, pageBranchFilter, branches]
  );

  const scopedStaff = useMemo(
    () =>
      applyBranchFilters(
        staff,
        (u) => u.branchId,
        selectedBranchId,
        showBranchPicker,
        pageBranchFilter
      ),
    [staff, selectedBranchId, showBranchPicker, pageBranchFilter]
  );

  const scopedRequests = useMemo(() => {
    let list = applyBranchFilters(
      requests,
      (r) => r.branchId,
      selectedBranchId,
      showBranchPicker,
      pageBranchFilter
    );
    if (!canDecide && authUser) {
      list = list.filter((r) => r.staffId === authUser.id);
    }
    if (statusFilter !== "ALL") {
      list = list.filter((r) => r.status === statusFilter);
    }
    return list;
  }, [
    requests,
    selectedBranchId,
    showBranchPicker,
    pageBranchFilter,
    statusFilter,
    canDecide,
    authUser,
  ]);

  const scopedBalances = useMemo(() => {
    let list = applyBranchFilters(
      balances,
      (b) => b.branchId,
      selectedBranchId,
      showBranchPicker,
      pageBranchFilter
    );
    if (!canDecide && authUser) {
      list = list.filter((b) => b.staffId === authUser.id);
    }
    return list;
  }, [
    balances,
    selectedBranchId,
    showBranchPicker,
    pageBranchFilter,
    canDecide,
    authUser,
  ]);

  const kpis = useMemo(() => {
    const pending = scopedRequests.filter((r) => r.status === "PENDING").length;
    const approved = scopedRequests.filter((r) => r.status === "APPROVED").length;
    const rejected = scopedRequests.filter((r) => r.status === "REJECTED").length;
    return { pending, approved, rejected, total: scopedRequests.length };
  }, [scopedRequests]);

  const applyDaysPreview =
    applyFrom && applyTo ? countLeaveDays(applyFrom, applyTo) : 0;

  const selectableStaff = useMemo(() => {
    const active = scopedStaff.filter((s) => s.isActive);
    if (canDecide) return active;
    return active.filter((s) => s.id === authUser?.id);
  }, [scopedStaff, canDecide, authUser]);

  const openApply = () => {
    setApplyStaffId(
      canDecide
        ? (selectableStaff[0]?.id ?? authUser?.id ?? "")
        : (authUser?.id ?? "")
    );
    setApplyTypeId(leaveTypes.find((t) => t.isActive)?.id ?? "");
    setApplyFrom("");
    setApplyTo("");
    setApplyReason("");
    setApplyOpen(true);
  };

  const handleApply = () => {
    const member = staff.find((s) => s.id === applyStaffId);
    if (!member) {
      toast.error("Select a staff member.");
      return;
    }
    const result = applyLeave({
      staff: member,
      leaveTypeId: applyTypeId,
      fromDate: applyFrom,
      toDate: applyTo,
      reason: applyReason,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    pushActivityLog({
      action: "CREATED",
      entityType: "LEAVE",
      entityId: result.request?.id ?? member.id,
      entityLabel: `${member.name} leave`,
      details: `Leave applied ${applyFrom} → ${applyTo} (${applyDaysPreview} day(s))`,
    });
    toast.success("Leave request submitted.");
    setApplyOpen(false);
  };

  const openDecision = (req: LeaveRequest, mode: "APPROVE" | "REJECT") => {
    setActiveRequest(req);
    setDecisionMode(mode);
    setDecisionComments("");
    setDecisionOpen(true);
  };

  const handleDecision = () => {
    if (!activeRequest || !authUser) return;
    const fn = decisionMode === "APPROVE" ? approveLeave : rejectLeave;
    const result = fn({
      requestId: activeRequest.id,
      actorId: authUser.id,
      actorName: authUser.name,
      comments: decisionComments,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    pushActivityLog({
      action: "UPDATED",
      entityType: "LEAVE",
      entityId: activeRequest.id,
      entityLabel: `${activeRequest.staffName} leave`,
      details:
        decisionMode === "APPROVE"
          ? `Leave approved (${activeRequest.days} day(s))`
          : `Leave rejected (${activeRequest.days} day(s))`,
    });
    toast.success(
      decisionMode === "APPROVE" ? "Leave approved." : "Leave rejected."
    );
    setDecisionOpen(false);
  };

  const handleCancel = (req: LeaveRequest) => {
    if (!authUser) return;
    const isOwn = req.staffId === authUser.id;
    if (!canDecide && !isOwn) {
      toast.error("You can only cancel your own leave.");
      return;
    }
    if (!canDecide && req.status !== "PENDING") {
      toast.error("You can only cancel pending leave.");
      return;
    }
    const result = cancelLeave({
      requestId: req.id,
      actorId: authUser.id,
      actorName: authUser.name,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    pushActivityLog({
      action: "UPDATED",
      entityType: "LEAVE",
      entityId: req.id,
      entityLabel: `${req.staffName} leave`,
      details: `Leave cancelled (${req.days} day(s), was ${req.status})`,
    });
    toast.success("Leave cancelled.");
  };

  const openTypeDialog = (existing?: LeaveType) => {
    if (existing) {
      setEditingTypeId(existing.id);
      setTypeName(existing.name);
      setTypePaid(existing.paid);
      setTypeTracks(existing.tracksBalance);
      setTypeDays(String(existing.defaultDaysPerYear));
    } else {
      setEditingTypeId(undefined);
      setTypeName("");
      setTypePaid(true);
      setTypeTracks(true);
      setTypeDays("12");
    }
    setTypeOpen(true);
  };

  const handleSaveType = () => {
    const result = upsertLeaveType({
      id: editingTypeId,
      name: typeName,
      paid: typePaid,
      tracksBalance: typeTracks,
      defaultDaysPerYear: Number(typeDays) || 0,
      isActive: true,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(editingTypeId ? "Leave type updated." : "Leave type added.");
    setTypeOpen(false);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Leave"
        description={`Requests, balances, and leave types · ${branchScopeLabel}`}
        hideDescriptionOnMobile
        actions={
          <Button size="sm" onClick={openApply}>
            <Plus className="w-4 h-4 mr-1.5" />
            Apply Leave
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KPICard title="Pending" value={kpis.pending} icon={Clock} />
        <KPICard title="Approved" value={kpis.approved} icon={Check} />
        <KPICard title="Rejected" value={kpis.rejected} icon={X} />
        <KPICard title="Total" value={kpis.total} icon={CalendarOff} />
      </div>

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="balances">Balances</TabsTrigger>
          <TabsTrigger value="types">Types</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            {showBranchPicker && (
              <Select value={pageBranchFilter} onValueChange={setPageBranchFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All branches</SelectItem>
                  {branches
                    .filter((b) => b.isActive)
                    .map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="pt-4 overflow-x-auto">
              {scopedRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No leave requests yet.
                </p>
              ) : (
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Staff</th>
                      <th className="py-2 pr-3 font-medium">Dates</th>
                      <th className="py-2 pr-3 font-medium">Days</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2 pr-3 font-medium hidden lg:table-cell">Applied</th>
                      <th className="py-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scopedRequests.map((r) => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2.5 pr-3">
                          <p className="font-medium">{r.staffName}</p>
                          <p className="text-xs text-muted-foreground">{r.leaveTypeName}</p>
                        </td>
                        <td className="py-2.5 pr-3 tabular-nums">
                          {r.fromDate} → {r.toDate}
                        </td>
                        <td className="py-2.5 pr-3 tabular-nums font-medium">{r.days}</td>
                        <td className="py-2.5 pr-3">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_CLASS[r.status]}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-muted-foreground hidden lg:table-cell">
                          {formatDate(r.appliedAt)}
                        </td>
                        <td className="py-2.5 text-right">
                          <div className="flex flex-wrap gap-1 justify-end">
                            {canDecide && r.status === "PENDING" && (
                              <>
                                <Button size="sm" variant="outline" className="h-8" onClick={() => openDecision(r, "APPROVE")}>
                                  <Check className="w-3.5 h-3.5 mr-1" />
                                  Approve
                                </Button>
                                <Button size="sm" variant="outline" className="h-8" onClick={() => openDecision(r, "REJECT")}>
                                  <X className="w-3.5 h-3.5 mr-1" />
                                  Reject
                                </Button>
                              </>
                            )}
                            {(r.status === "PENDING" || (canDecide && r.status === "APPROVED")) &&
                              (canDecide || r.staffId === authUser?.id) && (
                                <Button size="sm" variant="ghost" className="h-8" onClick={() => handleCancel(r)}>
                                  <Ban className="w-3.5 h-3.5 mr-1" />
                                  Cancel
                                </Button>
                              )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balances" className="space-y-4">
          <Card>
            <CardContent className="pt-4 overflow-x-auto">
              {scopedBalances.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No balances yet. They are created when leave is applied for a tracking leave type.
                </p>
              ) : (
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Staff</th>
                      <th className="py-2 pr-3 font-medium">Type</th>
                      <th className="py-2 pr-3 font-medium">Year</th>
                      <th className="py-2 pr-3 font-medium">Entitled</th>
                      <th className="py-2 pr-3 font-medium">Used</th>
                      <th className="py-2 pr-3 font-medium">Pending</th>
                      <th className="py-2 font-medium">Available</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scopedBalances.map((b) => {
                      const member = staff.find((s) => s.id === b.staffId);
                      const type = leaveTypes.find((t) => t.id === b.leaveTypeId);
                      return (
                        <tr key={b.id} className="border-b last:border-0">
                          <td className="py-2.5 pr-3">{member?.name ?? b.staffId}</td>
                          <td className="py-2.5 pr-3">{type?.name ?? b.leaveTypeId}</td>
                          <td className="py-2.5 pr-3 tabular-nums">{b.year}</td>
                          <td className="py-2.5 pr-3">
                            {canDecide ? (
                              <Input
                                type="number"
                                className="h-8 w-20"
                                defaultValue={b.entitled}
                                onBlur={(e) => {
                                  const v = Number(e.target.value);
                                  if (!Number.isFinite(v) || v === b.entitled) return;
                                  const res = setEntitledDays(
                                    b.staffId,
                                    b.leaveTypeId,
                                    b.year,
                                    v,
                                    b.branchId
                                  );
                                  if (!res.ok) toast.error(res.error);
                                  else toast.success("Entitlement updated.");
                                }}
                              />
                            ) : (
                              <span className="tabular-nums">{b.entitled}</span>
                            )}
                          </td>
                          <td className="py-2.5 pr-3 tabular-nums">{b.used}</td>
                          <td className="py-2.5 pr-3 tabular-nums">{b.pending}</td>
                          <td className="py-2.5 tabular-nums font-medium">{availableLeaveDays(b)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="types" className="space-y-4">
          {canDecide && (
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => openTypeDialog()}>
                <Plus className="w-4 h-4 mr-1.5" />
                Add leave type
              </Button>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {leaveTypes.map((t) => (
              <Card key={t.id}>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.paid ? "Paid" : "Unpaid"}
                        {t.tracksBalance
                          ? ` · ${t.defaultDaysPerYear} days/year`
                          : " · no balance tracking"}
                      </p>
                    </div>
                    <Badge variant={t.isActive ? "default" : "secondary"}>
                      {t.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  {canDecide && (
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={() => openTypeDialog(t)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setLeaveTypeActive(t.id, !t.isActive);
                          toast.success(
                            t.isActive ? "Leave type deactivated." : "Leave type activated."
                          );
                        }}
                      >
                        {t.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Apply leave</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Staff</Label>
              <Select value={applyStaffId} onValueChange={setApplyStaffId} disabled={!canDecide}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff" />
                </SelectTrigger>
                <SelectContent>
                  {selectableStaff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Leave type</Label>
              <Select value={applyTypeId} onValueChange={setApplyTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes
                    .filter((t) => t.isActive)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>From</Label>
                <Input
                  type="date"
                  className="date-input-icon-end pr-9"
                  value={applyFrom}
                  onChange={(e) => setApplyFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>To</Label>
                <Input
                  type="date"
                  className="date-input-icon-end pr-9"
                  value={applyTo}
                  onChange={(e) => setApplyTo(e.target.value)}
                />
              </div>
            </div>
            {applyDaysPreview > 0 && (
              <p className="text-sm text-muted-foreground">{applyDaysPreview} day(s)</p>
            )}
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea value={applyReason} onChange={(e) => setApplyReason(e.target.value)} rows={3} />
            </div>
            <Button className="w-full" onClick={handleApply}>
              Submit request
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={decisionOpen} onOpenChange={setDecisionOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {decisionMode === "APPROVE" ? "Approve leave" : "Reject leave"}
            </DialogTitle>
          </DialogHeader>
          {activeRequest && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {activeRequest.staffName} · {activeRequest.leaveTypeName} ·{" "}
                {activeRequest.fromDate} → {activeRequest.toDate} ({activeRequest.days} day(s))
              </p>
              <div className="space-y-2">
                <Label>Comments</Label>
                <Textarea
                  value={decisionComments}
                  onChange={(e) => setDecisionComments(e.target.value)}
                  rows={3}
                  placeholder="Optional"
                />
              </div>
              <Button className="w-full" onClick={handleDecision}>
                {decisionMode === "APPROVE" ? "Approve" : "Reject"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={typeOpen} onOpenChange={setTypeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTypeId ? "Edit leave type" : "Add leave type"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={typeName} onChange={(e) => setTypeName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Default days / year</Label>
              <Input type="number" value={typeDays} onChange={(e) => setTypeDays(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={typePaid} onChange={(e) => setTypePaid(e.target.checked)} />
              Paid leave
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={typeTracks}
                onChange={(e) => setTypeTracks(e.target.checked)}
              />
              Track balance / entitlement
            </label>
            <Button className="w-full" onClick={handleSaveType}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
