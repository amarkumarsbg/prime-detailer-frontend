"use client";

import { useEffect, useId, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogMobileSheetContentClasses,
  dialogMobileSheetHeaderClasses,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Trash2 } from "lucide-react";
import { useExpenseStore } from "@/store/expense-store";
import { useBranchStore } from "@/store/branch-store";
import { useAuthStore } from "@/store/auth-store";
import { resolveSessionBranchId } from "@/lib/all-branches";
import { useBranchScope } from "@/lib/branch-scope";
import type { Expense, ExpenseCategory, ExpensePaymentMethod, ExpensePaymentStatus } from "@/types";
import { toast } from "sonner";

const BASE_CATEGORIES: ExpenseCategory[] = [
  "RENT",
  "SALARY",
  "UTILITIES",
  "SUPPLIES",
  "MAINTENANCE",
  "MARKETING",
  "INSURANCE",
  "MISCELLANEOUS",
];

function categoryLabel(c: string): string {
  if (/^[A-Z_]+$/.test(c)) {
    return c.charAt(0) + c.slice(1).toLowerCase().replace(/_/g, " ");
  }
  return c;
}

function paymentMethodLabel(m: ExpensePaymentMethod): string {
  switch (m) {
    case "BANK_TRANSFER":
      return "Bank transfer";
    default:
      return m.charAt(0) + m.slice(1).toLowerCase();
  }
}

function paymentStatusLabel(s: ExpensePaymentStatus): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

type AddExpenseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, dialog edits this expense instead of creating a new one. */
  expense?: Expense | null;
};

export function AddExpenseDialog({ open, onOpenChange, expense = null }: AddExpenseDialogProps) {
  const isEdit = Boolean(expense);
  const addExpense = useExpenseStore((s) => s.addExpense);
  const updateExpense = useExpenseStore((s) => s.updateExpense);
  const customCategories = useExpenseStore((s) => s.customCategories);
  const categoryDescriptions = useExpenseStore((s) => s.categoryDescriptions);
  const addCustomCategory = useExpenseStore((s) => s.addCustomCategory);
  const updateCustomCategory = useExpenseStore((s) => s.updateCustomCategory);
  const removeCustomCategory = useExpenseStore((s) => s.removeCustomCategory);
  const vendorSuggestions = useExpenseStore((s) => s.vendorSuggestions);
  const vendorDirectory = useExpenseStore((s) => s.vendorDirectory);
  const addVendorDirectoryEntry = useExpenseStore((s) => s.addVendorDirectoryEntry);

  const branches = useBranchStore((s) => s.branches);
  const user = useAuthStore((s) => s.user);
  const currentBranch = useAuthStore((s) => s.currentBranch);
  const { showBranchPicker } = useBranchScope();

  const vendorListId = useId();

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [dateStr, setDateStr] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [categoryInput, setCategoryInput] = useState("SUPPLIES");
  const [vendorInput, setVendorInput] = useState("");
  const [branchId, setBranchId] = useState("");
  const [paymentStatus, setPaymentStatus] =
    useState<ExpensePaymentStatus>("PAID");
  const [paymentMethod, setPaymentMethod] =
    useState<ExpensePaymentMethod>("CASH");
  const [description, setDescription] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [receiptName, setReceiptName] = useState("");

  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [catDialogMode, setCatDialogMode] = useState<"create" | "edit">("create");
  const [editingCategoryKey, setEditingCategoryKey] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDesc, setNewCategoryDesc] = useState("");
  const [manageCatsOpen, setManageCatsOpen] = useState(false);
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [vName, setVName] = useState("");
  const [vContact, setVContact] = useState("");
  const [vEmail, setVEmail] = useState("");
  const [vPhone, setVPhone] = useState("");
  const [vTerms, setVTerms] = useState("");
  const [vAddress, setVAddress] = useState("");
  const [vGst, setVGst] = useState("");
  const [vPan, setVPan] = useState("");
  const [vNotes, setVNotes] = useState("");

  const mergedCategories = useMemo(() => {
    const set = new Set<string>([...BASE_CATEGORIES, ...customCategories]);
    if (categoryInput.trim()) set.add(categoryInput.trim());
    return [...set];
  }, [customCategories, categoryInput]);

  const mergedVendorNames = useMemo(() => {
    const set = new Set(vendorSuggestions);
    for (const v of vendorDirectory) set.add(v.name);
    return [...set];
  }, [vendorSuggestions, vendorDirectory]);

  const openCreateCategory = () => {
    setCatDialogMode("create");
    setEditingCategoryKey(null);
    setNewCategoryName("");
    setNewCategoryDesc("");
    setCatDialogOpen(true);
  };

  const openEditCategory = (key: string) => {
    setCatDialogMode("edit");
    setEditingCategoryKey(key);
    setNewCategoryName(key);
    setNewCategoryDesc(categoryDescriptions[key] ?? "");
    setCatDialogOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      if (expense) {
        setTitle(expense.title);
        setAmount(String(expense.amount));
        setDateStr(expense.date.slice(0, 10));
        setCategoryInput(expense.category);
        setVendorInput(expense.vendorName ?? "");
        setBranchId(expense.branchId);
        setPaymentStatus(expense.paymentStatus);
        setPaymentMethod(expense.paymentMethod);
        setDescription(expense.description ?? "");
        setAmountPaid(
          expense.amountPaid != null && expense.amountPaid > 0
            ? String(expense.amountPaid)
            : ""
        );
        setReceiptName(expense.receipt ?? "");
        return;
      }
      const resolved = resolveSessionBranchId(currentBranch, user?.branchId);
      setBranchId(resolved);
      setTitle("");
      setAmount("");
      setDateStr(new Date().toISOString().slice(0, 10));
      setCategoryInput("SUPPLIES");
      setVendorInput("");
      setPaymentStatus("PAID");
      setPaymentMethod("CASH");
      setDescription("");
      setAmountPaid("");
      setReceiptName("");
    });
  }, [open, expense, currentBranch, user?.branchId]);

  const handleSaveCategory = async () => {
    const t = newCategoryName.trim();
    if (!t) {
      toast.error("Enter a category name.");
      return;
    }
    if (catDialogMode === "edit" && editingCategoryKey) {
      const ok = await updateCustomCategory(editingCategoryKey, {
        label: t,
        description: newCategoryDesc.trim() || undefined,
      });
      if (!ok) {
        toast.error("Could not update category. Name may already exist.");
        return;
      }
      if (categoryInput === editingCategoryKey) setCategoryInput(t);
      setCatDialogOpen(false);
      toast.success("Category updated.");
      return;
    }
    if (
      BASE_CATEGORIES.includes(t as ExpenseCategory) ||
      customCategories.includes(t)
    ) {
      toast.error("That category already exists.");
      return;
    }
    await addCustomCategory(t, newCategoryDesc.trim() || undefined);
    setCategoryInput(t);
    setNewCategoryName("");
    setNewCategoryDesc("");
    setCatDialogOpen(false);
    toast.success("Category created.");
  };

  const handleDeleteCategory = async (key: string) => {
    const ok = await removeCustomCategory(key);
    if (!ok) {
      toast.error("Could not delete category.");
      return;
    }
    if (categoryInput === key) setCategoryInput("SUPPLIES");
    toast.success("Category removed.");
  };

  const handleAddVendor = async () => {
    const entry = await addVendorDirectoryEntry({
      name: vName,
      contactPerson: vContact || undefined,
      email: vEmail || undefined,
      phone: vPhone || undefined,
      paymentTerms: vTerms || undefined,
      address: vAddress || undefined,
      gstNumber: vGst || undefined,
      panNumber: vPan || undefined,
      notes: vNotes || undefined,
    });
    if (!entry) {
      toast.error("Enter a vendor name.");
      return;
    }
    setVendorInput(entry.name);
    setVName("");
    setVContact("");
    setVEmail("");
    setVPhone("");
    setVTerms("");
    setVAddress("");
    setVGst("");
    setVPan("");
    setVNotes("");
    setVendorDialogOpen(false);
    toast.success("Vendor created.");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    if (!title.trim()) {
      toast.error("Enter a title.");
      return;
    }
    if (Number.isNaN(n) || n <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    const cat = categoryInput.trim();
    if (!cat) {
      toast.error("Select or enter a category.");
      return;
    }
    if (!branchId) {
      toast.error("Select a branch.");
      return;
    }

    let paid: number | undefined;
    if (paymentStatus === "PARTIAL") {
      const ap = Number(amountPaid);
      if (Number.isNaN(ap) || ap <= 0 || ap >= n) {
        toast.error("Partial payment must be greater than 0 and less than the amount.");
        return;
      }
      paid = ap;
    }

    if (expense) {
      void updateExpense(expense.id, {
        title: title.trim(),
        category: cat,
        description: description.trim() || undefined,
        amount: n,
        amountPaid: paymentStatus === "PARTIAL" ? paid : undefined,
        date: dateStr,
        vendorName: vendorInput.trim() || undefined,
        paymentStatus,
        paymentMethod,
        receipt: receiptName || undefined,
        branchId,
      }).then((ok) => {
        if (!ok) {
          toast.error("Could not update expense.");
          return;
        }
        toast.success("Expense updated.");
        onOpenChange(false);
      });
      return;
    }

    const createdBy = user?.id ?? "usr-001";
    const createdByName = user?.name ?? "User";

    void addExpense({
      title: title.trim(),
      category: cat,
      description: description.trim() || undefined,
      amount: n,
      amountPaid: paid,
      date: dateStr,
      vendorName: vendorInput.trim() || undefined,
      paymentStatus,
      paymentMethod,
      receipt: receiptName || undefined,
      createdBy,
      createdByName,
      branchId,
    }).then(() => {
      toast.success("Expense saved.");
      onOpenChange(false);
    });
  };

  const onReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setReceiptName("");
      return;
    }
    const max = 5 * 1024 * 1024;
    if (file.size > max) {
      toast.error("File must be 5MB or smaller.");
      e.target.value = "";
      return;
    }
    setReceiptName(file.name);
  };

  const sectionLabelClass =
    "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            dialogMobileSheetContentClasses,
            "max-h-[min(92dvh,100%)] sm:max-w-[480px]"
          )}
          showClose
        >
          <DialogHeader className={cn(dialogMobileSheetHeaderClasses, "pb-2")}>
            <DialogTitle className="text-lg font-semibold sm:text-xl">
              {isEdit ? "Edit Expense" : "Add Expense"}
            </DialogTitle>
          </DialogHeader>

          <form
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-6 py-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:space-y-4 sm:py-4">
              <div className="space-y-2">
                <p className={sectionLabelClass}>Basics</p>
                <div className="space-y-1.5">
                  <Label htmlFor="exp-title">Title</Label>
                  <Input
                    id="exp-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Office Supplies"
                    autoComplete="off"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="exp-amt">Amount</Label>
                    <Input
                      id="exp-amt"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="exp-date">Date</Label>
                    <Input
                      id="exp-date"
                      type="date"
                      className="date-input-icon-end pr-9"
                      value={dateStr}
                      onChange={(e) => setDateStr(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className={sectionLabelClass}>Category & vendor</p>
                <div className="space-y-1.5">
                  <Label htmlFor="exp-cat">Category *</Label>
                  <div className="flex flex-col gap-1.5 sm:flex-row">
                    <Select value={categoryInput} onValueChange={setCategoryInput}>
                      <SelectTrigger id="exp-cat" className="w-full min-w-0 sm:flex-1">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {mergedCategories.map((c) => (
                          <SelectItem key={c} value={c}>
                            {categoryLabel(c)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex shrink-0 gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="flex-1 px-2 text-primary sm:flex-none"
                        onClick={openCreateCategory}
                      >
                        + New
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1 px-2 sm:flex-none"
                        onClick={() => setManageCatsOpen(true)}
                      >
                        Manage
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="exp-vendor">Vendor (optional)</Label>
                  <div className="flex gap-1.5">
                    <Input
                      id="exp-vendor"
                      list={vendorListId}
                      value={vendorInput}
                      onChange={(e) => setVendorInput(e.target.value)}
                      placeholder="Search or select..."
                      autoComplete="off"
                      className="min-w-0"
                    />
                    <datalist id={vendorListId}>
                      {mergedVendorNames.map((v) => (
                        <option key={v} value={v} />
                      ))}
                    </datalist>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0 px-2 text-primary"
                      onClick={() => setVendorDialogOpen(true)}
                    >
                      + New
                    </Button>
                  </div>
                </div>
              </div>

              {showBranchPicker ? (
                <div className="space-y-1.5">
                  <Label>Branch</Label>
                  <Select value={branchId} onValueChange={setBranchId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Branch" />
                    </SelectTrigger>
                    <SelectContent>
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
                <p className={sectionLabelClass}>Payment</p>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select
                      value={paymentStatus}
                      onValueChange={(v) =>
                        setPaymentStatus(v as ExpensePaymentStatus)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          ["PAID", "PENDING", "PARTIAL", "OVERDUE"] as const
                        ).map((s) => (
                          <SelectItem key={s} value={s}>
                            {paymentStatusLabel(s)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Method</Label>
                    <Select
                      value={paymentMethod}
                      onValueChange={(v) =>
                        setPaymentMethod(v as ExpensePaymentMethod)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          [
                            "CASH",
                            "CARD",
                            "UPI",
                            "BANK_TRANSFER",
                            "OTHER",
                          ] as const
                        ).map((m) => (
                          <SelectItem key={m} value={m}>
                            {paymentMethodLabel(m)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {paymentStatus === "PARTIAL" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="exp-partial">Amount paid so far</Label>
                    <Input
                      id="exp-partial"
                      inputMode="decimal"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className={sectionLabelClass}>Additional</p>
                <div className="space-y-1.5">
                  <Label htmlFor="exp-desc">Description</Label>
                  <Textarea
                    id="exp-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional details..."
                    rows={2}
                    className="min-h-0 resize-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="exp-receipt">Receipt (PDF/image)</Label>
                  <Input
                    id="exp-receipt"
                    type="file"
                    accept=".pdf,image/*"
                    className="cursor-pointer"
                    onChange={onReceiptChange}
                  />
                  {receiptName ? (
                    <p className="truncate text-xs text-muted-foreground">{receiptName}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Max 5MB</p>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="shrink-0 flex-row gap-2 border-t border-border/60 bg-background/95 px-4 py-2.5 backdrop-blur-sm sm:justify-end sm:px-6 sm:py-3 [&_button]:h-9 [&_button]:min-h-9 [&_button]:w-auto [&_button]:flex-1 [&_button]:px-3 sm:[&_button]:flex-none">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm">
                <span className="sm:hidden">{isEdit ? "Update" : "Save"}</span>
                <span className="hidden sm:inline">{isEdit ? "Update Expense" : "Save Expense"}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {catDialogMode === "edit" ? "Edit Category" : "Add New Category"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-cat-name">Category Name</Label>
              <Input
                id="new-cat-name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g., Marketing, Office Maintenance"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-cat-desc">Description (Optional)</Label>
              <Textarea
                id="new-cat-desc"
                value={newCategoryDesc}
                onChange={(e) => setNewCategoryDesc(e.target.value)}
                placeholder="category details..."
                rows={3}
                className="resize-y min-h-[72px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCatDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSaveCategory()}>
              {catDialogMode === "edit" ? "Save Changes" : "Create Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manageCatsOpen} onOpenChange={setManageCatsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Categories</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-3 overflow-y-auto py-2">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Built-in
              </p>
              <ul className="space-y-1.5">
                {BASE_CATEGORIES.map((c) => (
                  <li
                    key={c}
                    className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm"
                  >
                    <span>{categoryLabel(c)}</span>
                    <span className="text-xs text-muted-foreground">Fixed</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Custom
              </p>
              {customCategories.length === 0 ? (
                <p className="rounded-md border border-dashed border-border/70 px-3 py-6 text-center text-sm text-muted-foreground">
                  No custom categories yet. Use + New to add one.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {customCategories.map((c) => (
                    <li
                      key={c}
                      className="flex items-start justify-between gap-2 rounded-md border border-border/60 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{c}</p>
                        {categoryDescriptions[c] ? (
                          <p className="truncate text-xs text-muted-foreground">
                            {categoryDescriptions[c]}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditCategory(c)}
                          aria-label={`Edit ${c}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => void handleDeleteCategory(c)}
                          aria-label={`Delete ${c}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="outline" onClick={openCreateCategory}>
              + New category
            </Button>
            <Button type="button" onClick={() => setManageCatsOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={vendorDialogOpen} onOpenChange={setVendorDialogOpen}>
        <DialogContent className={cn(dialogMobileSheetContentClasses, "max-h-[90vh]")}>
          <DialogHeader className={cn(dialogMobileSheetHeaderClasses, "pb-2")}>
            <DialogTitle>Add New Vendor</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="space-y-4 pb-4">
              <div className="space-y-2">
                <Label htmlFor="v-name">Vendor Name</Label>
                <Input
                  id="v-name"
                  value={vName}
                  onChange={(e) => setVName(e.target.value)}
                  placeholder="e.g., ABC Suppliers Ltd."
                  autoComplete="organization"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="v-contact">Contact Person</Label>
                <Input
                  id="v-contact"
                  value={vContact}
                  onChange={(e) => setVContact(e.target.value)}
                  placeholder="Contact name"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="v-email">Email</Label>
                  <Input
                    id="v-email"
                    type="email"
                    value={vEmail}
                    onChange={(e) => setVEmail(e.target.value)}
                    placeholder="vendor@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="v-phone">Phone</Label>
                  <Input
                    id="v-phone"
                    value={vPhone}
                    onChange={(e) => setVPhone(e.target.value)}
                    placeholder="Phone number"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="v-terms">Payment Terms</Label>
                <Input
                  id="v-terms"
                  value={vTerms}
                  onChange={(e) => setVTerms(e.target.value)}
                  placeholder="e.g., Net 30, COD"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="v-address">Address</Label>
                <Textarea
                  id="v-address"
                  value={vAddress}
                  onChange={(e) => setVAddress(e.target.value)}
                  placeholder="Full address"
                  rows={3}
                  className="resize-y min-h-[72px]"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="v-gst">GST Number</Label>
                  <Input
                    id="v-gst"
                    value={vGst}
                    onChange={(e) => setVGst(e.target.value)}
                    placeholder="GST Number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="v-pan">PAN Number</Label>
                  <Input
                    id="v-pan"
                    value={vPan}
                    onChange={(e) => setVPan(e.target.value)}
                    placeholder="PAN Number"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="v-notes">Notes</Label>
                <Textarea
                  id="v-notes"
                  value={vNotes}
                  onChange={(e) => setVNotes(e.target.value)}
                  placeholder="Additional notes..."
                  rows={3}
                  className="resize-y min-h-[72px]"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t border-border shrink-0">
            <Button type="button" variant="outline" onClick={() => setVendorDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleAddVendor()}>
              Create Vendor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
