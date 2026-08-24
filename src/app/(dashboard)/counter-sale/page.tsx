"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Pencil, Plus, Search, ShoppingCart, Trash2 } from "lucide-react";
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
  canonicalSecondaryToUnitQty,
  formatAvailableStock,
  getSelectableUnits,
  getUnitPrice,
  partMatchesInventorySearch,
  quantityToCanonicalSecondary,
  validateStockConsumption,
} from "@/lib/inventory/multi-unit";
import {
  buildCounterSaleInvoice,
  catalogForCounterSale,
  counterSaleCartSubtotal,
  counterSaleInvoiceStatus,
  counterSaleLineTotal,
  type CounterSaleCartLine,
} from "@/lib/counter-sale";
import { referredByFromOptionalInput } from "@/lib/referral-eligibility";
import { NewCustomerReferralCodeField } from "@/components/customers/new-customer-referral-code-field";
import { formatCurrency } from "@/lib/utils";
import { normalizePhoneDigits } from "@/lib/phone";
import type { Customer, PaymentMethod, Part } from "@/types";

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
  const findByReferralCode = useCustomerStore((s) => s.findByReferralCode);
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
  const [newCustomerReferralCode, setNewCustomerReferralCode] = useState("");
  const [partSearch, setPartSearch] = useState("");
  const [cart, setCart] = useState<CounterSaleCartLine[]>([]);
  const [catalogueUnits, setCatalogueUnits] = useState<Record<string, string>>({});
  const [discountAmount, setDiscountAmount] = useState(0);
  const [leavePending, setLeavePending] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [receivedInAccountId, setReceivedInAccountId] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingPriceKey, setEditingPriceKey] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState("");

  const commitCustomPrice = (line: CounterSaleCartLine) => {
    const n = Number.parseFloat(priceDraft.replace(/,/g, "").trim());
    const part = parts.find((p) => p.id === line.partId);
    const catalogPrice = part ? getUnitPrice(part, line.unit) : line.unitPrice;
    const newPrice = Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : catalogPrice;
    setCart(cart.map((l) =>
      l.partId === line.partId && l.unit === line.unit ? { ...l, unitPrice: newPrice } : l
    ));
    setEditingPriceKey(null);
  };

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
  const canComplete =
    !submitting &&
    Boolean(branchId) &&
    cart.length > 0 &&
    !(showReceivedIn && !receivedInAccountId);

  const checkBranchStockAvailable = (part: Part, neededQty: number, unit: string): boolean => {
    const needed = quantityToCanonicalSecondary(part, neededQty, unit);
    const available = getBranchCanonicalQty(branchStocks, part, branchId);
    return needed <= available + 1e-9;
  };

  const addPartToCart = (partId: string, chosenUnit?: string) => {
    const part = parts.find((p) => p.id === partId);
    if (!part) return;
    const unit = chosenUnit ?? getSelectableUnits(part)[0] ?? part.primaryUnit;
    const existing = cart.find((l) => l.partId === partId && l.unit === unit);
    const nextQty = existing ? existing.quantity + 1 : 1;
    if (!checkBranchStockAvailable(part, nextQty, unit)) {
      const canonical = getBranchCanonicalQty(branchStocks, part, branchId);
      const qtyVal = canonicalSecondaryToUnitQty(part, canonical, unit);
      const formatted = Number.isInteger(qtyVal) ? qtyVal.toLocaleString("en-IN") : qtyVal.toLocaleString("en-IN", { maximumFractionDigits: 2 });
      toast.error(`Insufficient stock for ${part.name}`, {
        description: `Only ${formatted} ${unit} available in ${viewingLabel || "branch"}`
      });
      return;
    }
    if (existing) {
      setCart(
        cart.map((l) =>
          l.partId === partId && l.unit === unit ? { ...l, quantity: l.quantity + 1 } : l
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
      const referred = referredByFromOptionalInput(newCustomerReferralCode, findByReferralCode);
      if (referred.error) {
        toast.error(referred.error);
        return;
      }
      try {
        const created = await addCustomer({
          name: customerName,
          phone: normalizePhoneDigits(customerPhone),
          email: "",
          address: "",
          referralCode: `REF-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
          referredBy: referred.referredBy,
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
      if (collected > 0.01) {
        const cashAcc = cashBankAccounts.find((a) => a.type === "cash") ?? cashBankAccounts[0];
        const accountId = needsPaymentReceivedIn(paymentMethod) ? receivedInAccountId : cashAcc?.id;
        if (accountId) {
          useCashBankStore.getState().adjustBalance({
            accountId,
            amount: collected,
            add: true,
            dateIso: now.slice(0, 10),
            remarks: `Counter Sale ${invoice.invoiceNumber}`,
            party: customerName,
            mode: paymentMethod.replace(/_/g, " "),
          });
        }
      }
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
    <div className="min-w-0 max-w-full overflow-x-hidden space-y-4 sm:space-y-5 max-md:pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
      <PageHeader
        title="Counter Sale"
        description={`Sell parts at the counter for ${viewingLabel}.`}
        hideDescriptionOnMobile
      />

      <div className="grid min-w-0 gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4 sm:space-y-5">
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
                                  setNewCustomerReferralCode("");
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
                    <div className="sm:col-span-2">
                      <NewCustomerReferralCodeField
                        id="cs-new-referral"
                        value={newCustomerReferralCode}
                        onChange={setNewCustomerReferralCode}
                        compact
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
                          className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{part.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {part.sku} · {formatAvailableStock(part)}
                            </p>
                          </div>
                           {(() => {
                            const units = getSelectableUnits(part);
                            const selected = catalogueUnits[part.id] ?? units[0] ?? part.primaryUnit;
                            const price = getUnitPrice(part, selected);
                            return (
                              <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
                                <span className="text-sm font-medium tabular-nums">
                                  {formatCurrency(price)}
                                </span>
                                {units.length > 1 && (
                                  <Select
                                    value={selected}
                                    onValueChange={(unit) =>
                                      setCatalogueUnits((prev) => ({ ...prev, [part.id]: unit }))
                                    }
                                  >
                                    <SelectTrigger className="h-7 w-[4.5rem] text-[11px] px-1.5 focus:ring-0">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {units.map((u) => (
                                        <SelectItem key={u} value={u} className="text-xs">
                                          {u}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                                {(() => {
                                  const cartItem = cart.find((l) => l.partId === part.id && l.unit === selected);
                                  if (cartItem) {
                                    return (
                                      <div className="flex items-center gap-1.5 border rounded-md px-1 py-0.5 bg-card">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 shrink-0"
                                          onClick={() => {
                                            if (cartItem.quantity === 1) {
                                              setCart(cart.filter((l) => !(l.partId === part.id && l.unit === selected)));
                                            } else {
                                              setCart(
                                                cart.map((l) =>
                                                  l.partId === part.id && l.unit === selected
                                                    ? { ...l, quantity: l.quantity - 1 }
                                                    : l
                                                )
                                              );
                                            }
                                          }}
                                        >
                                          <Minus className="h-2.5 w-2.5" />
                                        </Button>
                                        <span className="w-6 text-center text-xs font-semibold tabular-nums">
                                          {cartItem.quantity}
                                        </span>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 shrink-0"
                                          onClick={() => {
                                            const nextQty = cartItem.quantity + 1;
                                            if (!checkBranchStockAvailable(part, nextQty, selected)) {
                                              const canonical = getBranchCanonicalQty(branchStocks, part, branchId);
                                              const qtyVal = canonicalSecondaryToUnitQty(part, canonical, selected);
                                              const formatted = Number.isInteger(qtyVal) ? qtyVal.toLocaleString("en-IN") : qtyVal.toLocaleString("en-IN", { maximumFractionDigits: 2 });
                                              toast.error(`Insufficient stock for ${part.name}`, {
                                                description: `Only ${formatted} ${selected} available in ${viewingLabel || "branch"}`
                                              });
                                              return;
                                            }
                                            setCart(
                                              cart.map((l) =>
                                                l.partId === part.id && l.unit === selected
                                                  ? { ...l, quantity: l.quantity + 1 }
                                                  : l
                                              )
                                            );
                                          }}
                                        >
                                          <Plus className="h-2.5 w-2.5" />
                                        </Button>
                                      </div>
                                    );
                                  }
                                  return (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => addPartToCart(part.id, selected)}
                                    >
                                      Add
                                    </Button>
                                  );
                                })()}
                              </div>
                            );
                          })()}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-4 sm:space-y-5">
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
                    <li key={`${line.partId}-${line.unit}`} className="rounded-md border p-2.5 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-tight">{line.name}</p>
                          <p className="text-xs text-muted-foreground">{line.sku}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => setCart(cart.filter((l) => !(l.partId === line.partId && l.unit === line.unit)))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground font-medium">
                          Qty: <span className="text-foreground font-semibold tabular-nums">{line.quantity}</span> {line.unit}
                        </span>
                        <span className="text-sm font-semibold tabular-nums text-foreground">
                          {formatCurrency(counterSaleLineTotal(line))}
                        </span>
                      </div>
                      {/* Unit price with custom price editing */}
                      {(() => {
                        const key = `${line.partId}-${line.unit}`;
                        const part = parts.find((p) => p.id === line.partId);
                        const catalogPrice = part ? getUnitPrice(part, line.unit) : line.unitPrice;
                        const isCustom = Math.abs(line.unitPrice - catalogPrice) > 0.005;
                        if (editingPriceKey === key) {
                          return (
                            <div className="flex items-center gap-2 pt-0.5">
                              <Label className="text-[11px] text-muted-foreground shrink-0">Unit price (₹)</Label>
                              <Input
                                type="text"
                                inputMode="decimal"
                                className="h-7 w-24 text-xs tabular-nums"
                                value={priceDraft}
                                autoFocus
                                onChange={(e) => setPriceDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") { e.preventDefault(); commitCustomPrice(line); }
                                  if (e.key === "Escape") { e.preventDefault(); setEditingPriceKey(null); }
                                }}
                                onBlur={() => commitCustomPrice(line)}
                              />
                            </div>
                          );
                        }
                        return (
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <span className="text-xs text-muted-foreground">
                              Unit: <span className="text-foreground tabular-nums">{formatCurrency(line.unitPrice)}</span>
                            </span>
                            {isCustom && (
                              <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1 rounded">custom</span>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 text-muted-foreground"
                              onClick={() => {
                                setPriceDraft(String(line.unitPrice));
                                setEditingPriceKey(key);
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </div>
                        );
                      })()}
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
                className="hidden w-full md:inline-flex"
                disabled={!canComplete}
                onClick={() => void completeSale()}
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                {submitting ? "Saving…" : `Complete Counter Sale · ${formatCurrency(grandTotal)}`}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-[90] border-t border-border bg-background/95 px-3 py-2.5 shadow-[0_-4px_20px_rgba(15,23,42,0.08)] backdrop-blur-sm md:hidden">
        <div className="pointer-events-auto mx-auto flex max-w-lg items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Total
            </p>
            <p className="text-base font-bold tabular-nums leading-tight">
              {formatCurrency(grandTotal)}
            </p>
            <p className="truncate text-[10px] text-muted-foreground">
              {cart.length === 0
                ? "Add parts to continue"
                : `${cart.length} item${cart.length === 1 ? "" : "s"} in cart`}
            </p>
          </div>
          <Button
            type="button"
            className="shrink-0"
            disabled={!canComplete}
            onClick={() => void completeSale()}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            {submitting ? "Saving…" : "Complete"}
          </Button>
        </div>
      </div>
    </div>
  );
}
