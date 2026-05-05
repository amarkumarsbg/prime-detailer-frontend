"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuthStore } from "@/store/auth-store";
import { useBranchStore } from "@/store/branch-store";
import { canManageOrgBranches } from "@/lib/rbac";
import Link from "next/link";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export function BranchesSettings() {
  const userRole = useAuthStore((s) => s.user?.role);
  const canEdit = canManageOrgBranches(userRole);
  const branches = useBranchStore((s) => s.branches);
  const addBranch = useBranchStore((s) => s.addBranch);
  const deactivateBranch = useBranchStore((s) => s.deactivateBranch);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    if (!name.trim() || !address.trim() || !phone.trim()) {
      toast.error("Name, address, and phone are required.");
      return;
    }
    try {
      await addBranch({ name, address, phone, isActive: true });
      toast.success("Branch added.");
      setName("");
      setAddress("");
      setPhone("");
      setOpen(false);
    } catch {
      toast.error("Could not add branch. Is the API running?");
    }
  };

  if (!canManageOrgBranches(userRole)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Branches</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Only organization admins can add or change branches. Contact a super admin or admin.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">Branches &amp; locations</CardTitle>
        <Button type="button" size="sm" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          Add branch
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Super admins and admins can create branches used across staff, job cards, payroll, and
          attendance.{" "}
          <Link href="/branches" className="text-primary underline-offset-4 hover:underline font-medium">
            Open location directory
          </Link>{" "}
          for full details and edits.
        </p>
        <div className="rounded-lg border divide-y">
          {branches.map((b) => (
            <div
              key={b.id}
              className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{b.name}</span>
                  <Badge variant={b.isActive ? "default" : "secondary"}>
                    {b.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <span className="text-xs font-mono text-muted-foreground">{b.id}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{b.address}</p>
                <p className="text-sm text-muted-foreground">{b.phone}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                {b.isActive && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        await deactivateBranch(b.id);
                        toast.success("Branch deactivated.");
                      } catch {
                        toast.error("Could not deactivate. Is the API running?");
                      }
                    }}
                  >
                    Deactivate
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add branch</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Branch name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full">
              Save branch
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
