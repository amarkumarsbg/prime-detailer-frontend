"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Search, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/skeleton-loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDashboardStoresReady } from "@/hooks/use-dashboard-stores-ready";
import { useAuthStore } from "@/store/auth-store";
import { useBranchStore } from "@/store/branch-store";
import { useCustomerStore } from "@/store/customer-store";
import { useInventoryStore } from "@/store/inventory-store";
import { useInvoiceStore } from "@/store/invoice-store";
import { useSettingsStore } from "@/store/settings-store";
import { useVehicleStore } from "@/store/vehicle-store";
import { useBranchScope } from "@/lib/branch-scope";
import { computeGstFromSubtotal } from "@/lib/gst-tax";
import { computeCustomerLookupMatches } from "@/lib/customer-vehicle-lookup";
import {
  needsPaymentReceivedIn,
  PaymentReceivedInField,
} from "@/components/billing/payment-received-in-field";
import { useCashBankStore } from "@/store/cash-bank-store";
import { getBranchCanonicalQty } from "@/lib/inventory/branch-stock";
import { isMlTrackedPart } from "@/lib/inventory-units";
import {
  formatAvailableStock,
  getSelectableUnits,
  getUnitPrice,
  partMatchesInventorySearch,
  quantityToCanonicalSecondary,
} from "@/lib/inventory/multi-unit";
import {
  buildCounterSaleInvoice,
  catalogForCounterSale,
  counterSaleCartSubtotal,
  counterSaleInvoiceStatus,
  counterSaleLineTotal,
  type CounterSaleCartLine,
} from "@/lib/counter-sale";
import { formatCurrency } from "@/lib/utils";
import { normalizePhoneDigits } from "@/lib/phone";
import type { Customer, PaymentMethod } from "@/types";

export default function CounterSalePage() {
  const storesReady = useDashboardStoresReady();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { selectedBranchId, viewingLabel } = useBranchScope();
  const branches = useBranchStore((s) => s.branches);
  const parts = useInventoryStore((s) => s.parts);
  const branchStocks = useInventoryStore((s) => s.branchStocks);
  const recordStockAdjustment = useInventoryStore((s) => s.recordStockAdjustment);
  const customers = useCustomerStore((s) => s.customers);
  const addCustomer = useCustomerStore((s) => s.addCustomer);
  const vehicles = useVehicleStore((s) => s.vehicles);
  const addInvoice = useInvoiceStore((s) => s.addInvoice);
  const getNextInvoiceNumber = useInvoiceStore((s) => s.getNextInvoiceNumber);
  const gstRegistrationStatus = useSettingsStore((s) => s.gstRegistrationStatus);
  const cashBankAccounts = useCashBankStore((s) => s.accounts);

  const activeBranches = useMemo(() => branches.filter((b) => b.isActive), [branches]);
  const [branchId, setBranchId] = useState("");
  useEffect(() => {
    if (selectedBranchId) {
      setBranchId(selectedBranchId);
      return;
    }
    if (!branchId && activeBranches.length === 1) {
      setBranchId(activeBranches[0]!.id);
    }
  }, [selectedBranchId, activeBranches, branchId]);

  const [lookupQuery, setLookupQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [partSearch, setPartSearch] = useState("");
  const [cart, setCart] = useState<CounterSaleCartLine[]>([]);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [leavePending, setLeavePending] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [receivedInAccountId, setReceivedInAccountId] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const lookupMatches = useMemo(
    () => computeCustomerLookupMatches(lookupQuery, customers, vehicles, 12),
    [lookupQuery, customers, vehicles]
  );

  const eligibleParts = useMemo(() => {
    return catalogForCounterSale(parts).filter((p) => partMatchesInventorySearch(p, partSearch));
  }, [parts, partSearch]);

  const subtotal = counterSaleCartSubtotal(cart);
  const taxable = Math.max(0, subtotal - discountAmount);
  const gst = computeGstFromSubtotal(taxable, gstRegistrationStatus);
  const grandTotal = gst.grandTotal;
  const paidNumber = leavePending ? 0 : Number(paidAmount);
  const paid = Number.isFinite(paidNumber) && paidNumber > 0 ? paidNumber : 0;
  const due = Math.max(0, Math.round((grandTotal - (leavePending ? 0 : Math.min(paid, grandTotal))) * 100) / 100);
  const showReceivedIn = !leavePending && needsPaymentReceivedIn(paymentMethod);

  const addPartToCart = (partId: string) => {
    const part = parts.find((p) => p.id === partId);
    if (!part) return;
    const unit = getSelectableUnits(part)[0] ?? part.primaryUnit;
    const existing = cart.find((l) => l.partId === partId);
    if (existing) {
      setCart(
        cart.map((l) =>
          l.partId === partId ? { ...l, quantity: l.quantity + 1 } : l
        )
      );
      return;
    }
    setCart([
      ...cart,
      {
        partId: part.id,
        name: part.name,
        sku: part.sku,
        quantity: 1,
        unit,
        unitPrice: getUnitPrice(part, unit),
        lineDiscount: 0,
        hsnSac: part.hsnCode,
      },
    ]);
  };

  const completeSale = async () => {
    if (!branchId) {
      toast.error("Select a branch to continue");
      return;
    }
    if (cart.length === 0) {
      toast.error("Add at least one part");
      return;
    }
    const collectedPreview = leavePending ? 0 : Math.min(Math.max(0, paid || grandTotal), grandTotal);
    const needsBank = collectedPreview > 0.01 && needsPaymentReceivedIn(paymentMethod);
    if (needsBank && !receivedInAccountId) {
      toast.error("Select Payment Received In", {
        description: "Choose the bank account for UPI or Card payments.",
      });
      return;
    }
    let customerId = selectedCustomer?.id ?? "";
    let customerName = selectedCustomer?.name ?? newCustomerName.trim();
    let customerPhone = selectedCustomer?.phone ?? newCustomerPhone.trim();
    if (!selectedCustomer) {
      if (!customerName) {
        toast.error("Enter customer name");
        return;
      }
      if (normalizePhoneDigits(customerPhone).length !== 10) {
        toast.error("Enter a 10-digit phone number");
        return;
      }
      try {
        const created = await addCustomer({
          name: customerName,
          phone: normalizePhoneDigits(customerPhone),
          email: "",
          address: "",
          referralCode: `REF-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
          totalVisits: 0,
          rewardPoints: 0,
          walletBalance: 0,
        });
        if (!created) {
          toast.error("Could not save customer", {
            description: "This phone may already be on file. Search for the existing customer.",
          });
          return;
        }
        customerId = created.id;
        customerName = created.name;
        customerPhone = created.phone;
      } catch {
        toast.error("Could not save customer");
        return;
      }
    }

    for (const line of cart) {
      const part = parts.find((p) => p.id === line.partId);
      if (!part) {
        toast.error(`Part not found: ${line.name}`);
        return;
      }
      const needed = quantityToCanonicalSecondary(part, line.quantity, line.unit);
      const available = getBranchCanonicalQty(branchStocks, part, branchId);
      if (needed > available + 1e-9) {
        toast.error(`Insufficient stock for ${part.name}`, {
          description: `Only ${formatAvailableStock(part, line.unit)} available`,
        });
        return;
      }
    }

    const collected = leavePending ? 0 : Math.min(Math.max(0, paid || grandTotal), grandTotal);
    const now = new Date().toISOString();
    const invoiceId = `inv-cs-${Date.now()}`;
    const receivedInAccount =
      collected > 0.01 && needsPaymentReceivedIn(paymentMethod)
        ? cashBankAccounts.find((a) => a.id === receivedInAccountId)
        : undefined;
    const invoice = buildCounterSaleInvoice({
      id: invoiceId,
      invoiceNumber: getNextInvoiceNumber(),
      branchId,
      customerId,
      customerName,
      customerPhone,
      lines: cart,
      discountAmount,
      taxRate: gst.taxRate,
      taxAmount: gst.taxAmount,
      grandTotal,
      paidAmount: collected,
      paymentMethod,
      receivedInAccountId: receivedInAccount?.id,
      receivedInAccountName: receivedInAccount?.displayName,
      notes: notes.trim() || undefined,
      createdAt: now,
    });

    setSubmitting(true);
    try {
      await addInvoice(invoice);
      for (const line of cart) {
        const part = parts.find((p) => p.id === line.partId)!;
        const canonical = quantityToCanonicalSecondary(part, line.quantity, line.unit);
        const result = recordStockAdjustment({
          partId: part.id,
          direction: "OUT",
          ...(isMlTrackedPart(part) ? { amountMl: canonical } : { amountCount: canonical }),
          reason: `Counter Sale ${invoice.invoiceNumber}`,
          performedBy: user?.email ?? user?.name ?? "staff",
          branchId,
          movementKind: "DIRECT_ISSUE",
          invoiceId: invoice.id,
        });
        if (!result.ok) {
          toast.error(result.error ?? "Stock update failed");
          setSubmitting(false);
          return;
        }
      }
      toast.success("Counter Sale recorded", {
        description: `${invoice.invoiceNumber} · ${counterSaleInvoiceStatus(grandTotal, collected)}`,
      });
      router.push(`/billing/invoices/${invoice.id}`);
    } catch (e) {
      toast.error("Could not complete Counter Sale", {
        description: e instanceof Error ? e.message : "Please try again",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!storesReady) return <PageSkeleton />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Counter Sale"
        description={`Sell parts at the counter for ${viewingLabel}.`}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          {!selectedBranchId ? (
            <Card>
              <CardHeader className="px-5 py-4 pb-0">
                <CardTitle className="text-base">Branch</CardTitle>
              </CardHeader>
              <CardContent className="px-5 py-4">
                <Label>Select branch</Label>
                <Select value={branchId || undefined} onValueChange={setBranchId}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeBranches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!branchId ? (
                  <p className="text-sm text-destructive mt-2">Please select a branch to continue</p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="px-5 py-4 pb-0">
              <CardTitle className="text-base">Customer</CardTitle>
            </CardHeader>
            <CardContent className="px-5 py-4 space-y-3">
              {selectedCustomer ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{selectedCustomer.name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">{selectedCustomer.phone}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setSelectedCustomer(null)}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="cs-customer-lookup" className="text-sm font-medium">
                      Search Existing Customer
                    </Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="cs-customer-lookup"
                        className="pl-9"
                        value={lookupQuery}
                        onChange={(e) => {
                          const next = e.target.value;
                          setLookupQuery(next);
                          if (!next.trim()) setSelectedCustomer(null);
                        }}
                        placeholder="Enter Mobile or Vehicle number"
                        autoComplete="off"
                      />
                    </div>
                    {lookupQuery.trim() ? (
                      <div className="rounded-md border border-border bg-background p-2 max-h-40 overflow-auto">
                        {lookupMatches.length > 0 ? (
                          <div className="space-y-1">
                            {lookupMatches.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                className="w-full rounded-md border border-transparent px-3 py-2 text-left hover:bg-muted/60"
                                onClick={() => {
                                  setSelectedCustomer(c);
                                  setLookupQuery("");
                                }}
                              >
                                <p className="text-sm font-medium">{c.name}</p>
                                <p className="text-xs text-muted-foreground">{c.phone}</p>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground px-1 py-1">
                            No customer found. Continue below to fill details for a new customer.
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 rounded-lg border p-3 bg-muted/5">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="cs-new-name" className="text-xs">
                        Full Name *
                      </Label>
                      <Input
                        id="cs-new-name"
                        value={newCustomerName}
                        onChange={(e) => setNewCustomerName(e.target.value)}
                        placeholder="Customer name"
                        autoComplete="name"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="cs-new-phone" className="text-xs">
                        Phone Number *
                      </Label>
                      <Input
                        id="cs-new-phone"
                        value={newCustomerPhone}
                        onChange={(e) => setNewCustomerPhone(normalizePhoneDigits(e.target.value))}
                        placeholder="Phone number"
                        maxLength={10}
                        className="h-9"
                      />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="px-5 py-4 pb-0">
              <CardTitle className="text-base">Parts catalogue</CardTitle>
            </CardHeader>
            <CardContent className="px-5 py-4 space-y-3">
              {!branchId ? (
                <p className="text-sm text-muted-foreground">
                  Select a branch above to load parts.
                </p>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-8"
                      placeholder="Search parts by name or SKU..."
                      value={partSearch}
                      onChange={(e) => setPartSearch(e.target.value)}
                    />
                  </div>
                  {eligibleParts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No Counter Sale parts. Enable Direct Sale on a catalog item.
                    </p>
                  ) : (
                    <ul className="divide-y rounded-md border">
                      {eligibleParts.map((part) => (
                        <li
                          key={part.id}
                          className="flex items-center justify-between gap-3 px-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{part.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {part.sku} · {formatAvailableStock(part)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-sm font-medium tabular-nums">
                              {formatCurrency(part.unitPrice)}
                            </span>
                            <Button type="button" size="sm" variant="outline" onClick={() => addPartToCart(part.id)}>
                              Add
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader className="px-5 py-4 pb-0 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Cart ({cart.length} items)</CardTitle>
              {cart.length > 0 ? (
                <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setCart([])}>
                  Clear
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="px-5 py-4">
              {cart.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No items yet — add a part from the catalogue.
                </p>
              ) : (
                <ul className="space-y-3">
                  {cart.map((line) => (
                    <li key={line.partId} className="rounded-md border p-2.5 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-tight">{line.name}</p>
                          <p className="text-xs text-muted-foreground">{line.sku}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setCart(cart.filter((l) => l.partId !== line.partId))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() =>
                            setCart(
                              cart.map((l) =>
                                l.partId === line.partId
                                  ? { ...l, quantity: Math.max(1, l.quantity - 1) }
                                  : l
                              )
                            )
                          }
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center text-sm tabular-nums">{line.quantity}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() =>
                            setCart(
                              cart.map((l) =>
                                l.partId === line.partId ? { ...l, quantity: l.quantity + 1 } : l
                              )
                            )
                          }
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <span className="ml-auto text-sm font-medium tabular-nums">
                          {formatCurrency(counterSaleLineTotal(line))}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="px-5 py-4 pb-0">
              <CardTitle className="text-base">Billing</CardTitle>
            </CardHeader>
            <CardContent className="px-5 py-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{formatCurrency(subtotal)}</span>
              </div>
              <div className="space-y-1.5">
                <Label>Discount (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={discountAmount || ""}
                  onChange={(e) => setDiscountAmount(Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Tax ({Math.round(gst.taxRate * 100)}%)
                </span>
                <span className="tabular-nums">{formatCurrency(gst.taxAmount)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatCurrency(grandTotal)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="px-5 py-4 pb-0">
              <CardTitle className="text-base">Payment</CardTitle>
            </CardHeader>
            <CardContent className="px-5 py-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="cs-pending">Leave as pending (credit)</Label>
                <Switch id="cs-pending" checked={leavePending} onCheckedChange={setLeavePending} />
              </div>
              <div className="space-y-1.5">
                <Label>Payment method</Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(v) => {
                    const next = v as PaymentMethod;
                    setPaymentMethod(next);
                    if (!needsPaymentReceivedIn(next)) setReceivedInAccountId("");
                  }}
                  disabled={leavePending}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="CARD">Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {showReceivedIn ? (
                <PaymentReceivedInField
                  value={receivedInAccountId}
                  onChange={setReceivedInAccountId}
                  id="cs-payment-received-in"
                />
              ) : null}
              {!leavePending ? (
                <div className="space-y-1.5">
                  <Label>Amount paid</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder={String(grandTotal)}
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave blank to collect the full total. Due: {formatCurrency(due)}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Full amount stays outstanding on the customer ledger.
                </p>
              )}
              <div className="space-y-1.5">
                <Label>Notes (optional)</Label>
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <Button
                type="button"
                className="w-full"
                disabled={
                  submitting ||
                  !branchId ||
                  cart.length === 0 ||
                  (showReceivedIn && !receivedInAccountId)
                }
                onClick={() => void completeSale()}
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                {submitting ? "Saving…" : `Complete Counter Sale · ${formatCurrency(grandTotal)}`}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
