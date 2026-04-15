"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBranchStore } from "@/store/branch-store";
import { useStaffStore } from "@/store/staff-store";
import { useAuthStore } from "@/store/auth-store";
import { canManageOrgBranches } from "@/lib/rbac";
import type { Branch } from "@/types";
import {
  BranchFormDialog,
  type BranchFormValues,
} from "@/components/branches/branch-form-dialog";
import {
  Building2,
  Eye,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function BranchesPage() {
  const userRole = useAuthStore((s) => s.user?.role);
  const canEdit = canManageOrgBranches(userRole);
  const branches = useBranchStore((s) => s.branches);
  const addBranch = useBranchStore((s) => s.addBranch);
  const updateBranch = useBranchStore((s) => s.updateBranch);
  const deactivateBranch = useBranchStore((s) => s.deactivateBranch);
  const staff = useStaffStore((s) => s.staff);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [editing, setEditing] = useState<Branch | null>(null);
  const [viewing, setViewing] = useState<Branch | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Branch | null>(null);

  const staffCountByBranch = useMemo(() => {
    const m = new Map<string, number>();
    for (const u of staff) {
      if (!u.isActive) continue;
      m.set(u.branchId, (m.get(u.branchId) ?? 0) + 1);
    }
    return m;
  }, [staff]);

  const applyForm = async (values: BranchFormValues, id?: string) => {
    const payload = {
      name: values.name,
      code: values.code,
      address: values.address,
      city: values.city,
      state: values.state,
      pincode: values.pincode,
      phone: values.phone,
      email: values.email || undefined,
      managerName: values.managerName || undefined,
      managerPhone: values.managerPhone || undefined,
      isActive: values.isActive,
    };
    try {
      if (id) {
        await updateBranch(id, payload);
        toast.success("Location updated");
      } else {
        await addBranch(payload);
        toast.success("Location created");
      }
    } catch {
      toast.error("Could not save location. Is the API running?");
    }
  };

  const columns = [
    {
      key: "name",
      label: "Site",
      sortable: true,
      render: (b: Branch) => (
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/35">
            <Building2 className="h-5 w-5 text-teal-700 dark:text-teal-300" />
          </div>
          <div className="min-w-0">
            <p className="font-medium leading-tight">{b.name}</p>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">
              {b.code ?? b.id}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "city",
      label: "Location",
      sortable: true,
      render: (b: Branch) => (
        <div className="flex items-start gap-2 text-sm">
          <MapPin className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
          <div>
            <p className="font-medium">{b.city || "—"}</p>
            <p className="text-xs text-muted-foreground">
              {[b.state, b.pincode].filter(Boolean).join(", ") || "—"}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "phone",
      label: "Contact",
      sortable: true,
      render: (b: Branch) => (
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{b.phone}</span>
          </div>
          {b.email && (
            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{b.email}</p>
          )}
        </div>
      ),
    },
    {
      key: "staff",
      label: "Team",
      render: (b: Branch) => (
        <div className="flex items-center gap-1.5 text-sm">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium tabular-nums">{staffCountByBranch.get(b.id) ?? 0}</span>
        </div>
      ),
    },
    {
      key: "isActive",
      label: "Status",
      render: (b: Branch) => (
        <Badge
          className={cn(
            "font-normal",
            b.isActive
              ? "bg-teal-100 text-teal-900 hover:bg-teal-100 dark:bg-teal-900/40 dark:text-teal-100"
              : "text-muted-foreground"
          )}
          variant={b.isActive ? "secondary" : "outline"}
        >
          {b.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      className: "text-right w-[140px]",
      render: (b: Branch) => (
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="View"
            onClick={() => setViewing(b)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {canEdit && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Edit"
                onClick={() => {
                  setEditing(b);
                  setFormMode("edit");
                  setFormOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              {b.isActive && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  aria-label="Deactivate"
                  onClick={() => setDeactivateTarget(b)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workshop locations"
        description="Directory of sites, contacts, and operating status"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => toast.message("List refreshed")}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            {canEdit && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setFormMode("add");
                  setFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Add site
              </Button>
            )}
          </div>
        }
      />

      {!canEdit && (
        <p className="text-sm text-muted-foreground">
          View-only. To add or change sites, sign in as an org admin — quick edits also live under{" "}
          <Link href="/settings" className="text-primary underline-offset-4 hover:underline">
            Settings → Branches
          </Link>
          .
        </p>
      )}

      <div className="flex items-center gap-2">
        <span className="h-7 w-1 shrink-0 rounded-full bg-primary" aria-hidden />
        <h2 className="text-base font-semibold tracking-tight">Location directory</h2>
      </div>

      <Card className="border-border/80 p-0 shadow-sm overflow-hidden">
        <DataTable
          data={branches}
          columns={columns}
          searchPlaceholder="Search by name, code, city, or phone…"
          searchMatch={(b, q) => {
            const hay = [
              b.name,
              b.code,
              b.city,
              b.state,
              b.pincode,
              b.phone,
              b.address,
              b.email,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();
            return hay.includes(q);
          }}
        />
      </Card>

      <BranchFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        branch={editing}
        onSubmit={async (values) => {
          if (formMode === "edit" && editing) await applyForm(values, editing.id);
          else await applyForm(values);
        }}
      />

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Site details</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-3 text-sm pt-2">
              <p className="font-semibold text-base">{viewing.name}</p>
              <p className="font-mono text-xs text-muted-foreground">{viewing.code ?? viewing.id}</p>
              <p className="text-muted-foreground whitespace-pre-wrap">{viewing.address}</p>
              <p>
                {viewing.city}, {viewing.state} {viewing.pincode}
              </p>
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0" />
                {viewing.phone}
              </p>
              {viewing.email && <p>{viewing.email}</p>}
              {(viewing.managerName || viewing.managerPhone) && (
                <div className="border-t pt-3 mt-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Site lead
                  </p>
                  {viewing.managerName && <p>{viewing.managerName}</p>}
                  {viewing.managerPhone && <p className="text-muted-foreground">{viewing.managerPhone}</p>}
                </div>
              )}
              <Badge
                variant="secondary"
                className={
                  viewing.isActive
                    ? "bg-teal-100 text-teal-900 dark:bg-teal-900/40 dark:text-teal-100"
                    : ""
                }
              >
                {viewing.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deactivateTarget} onOpenChange={(o) => !o && setDeactivateTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Deactivate site?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {deactivateTarget?.name} will be marked inactive. Staff assignments are unchanged; you can
            re-enable later by editing the site.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDeactivateTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={async () => {
                if (deactivateTarget) {
                  try {
                    await deactivateBranch(deactivateTarget.id);
                    toast.success("Site deactivated");
                  } catch {
                    toast.error("Could not deactivate. Is the API running?");
                  }
                }
                setDeactivateTarget(null);
              }}
            >
              Deactivate
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
