"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PartyKind } from "@/types/party";

type CreatePartyDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: {
    name: string;
    kind: PartyKind;
    mobile?: string;
    email?: string;
    category?: string;
  }) => void;
};

export function CreatePartyDialog({ open, onOpenChange, onCreate }: CreatePartyDialogProps) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<PartyKind>("customer");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("");

  const reset = () => {
    setName("");
    setKind("customer");
    setMobile("");
    setEmail("");
    setCategory("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate({
      name: trimmed,
      kind,
      mobile: mobile.trim() || undefined,
      email: email.trim() || undefined,
      category: category.trim() || undefined,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create party</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="party-name">Party name</Label>
            <Input
              id="party-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Business or person name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Party type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as PartyKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="supplier">Supplier</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="party-mobile">Mobile</Label>
              <Input
                id="party-mobile"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="10-digit"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="party-cat">Category</Label>
              <Input
                id="party-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="party-email">Email</Label>
            <Input
              id="party-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
