"use client";

import { useState, useMemo, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Printer,
  CreditCard,
  Banknote,
  Smartphone,
  ChevronDown,
  Download,
  Share2,
  Gift,
  Coins,
  Percent,
  Ticket,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { InvoiceStatusBadge } from "@/components/shared/status-badge";
import { useInvoiceStore } from "@/store/invoice-store";
import { useJobCardStore } from "@/store/job-card-store";
import { useAuthStore } from "@/store/auth-store";
import { useWalletStore } from "@/store/wallet-store";
import { useCustomerStore } from "@/store/customer-store";
import { useSettingsStore } from "@/store/settings-store";
import { pushActivityLog } from "@/lib/activity-log-helper";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { buildInvoiceWhatsAppMessage } from "@/lib/whatsapp-customer-messages";
import {
  sendCustomerWhatsApp,
  openWhatsAppComposer,
  isWhatsAppNotConfiguredError,
} from "@/lib/whatsapp-send";
import { isResendNotConfiguredError } from "@/lib/invoice-email-send";
import { notifyCustomerPaymentRecordedWhatsApp } from "@/lib/payment-received-whatsapp";
import {
  paymentDisplayNumber,
  paymentInDetailPath,
} from "@/lib/billing/payment-helpers";
import { appendReturnTo } from "@/lib/navigation/return-to";
import { DetailBackButton } from "@/components/shared/detail-back-button";
import { useNotificationStore } from "@/store/notification-store";
import { ApiError } from "@/lib/api-client";
import {
  invoicePdfFilename,
  prefetchInvoicePdf,
  sendInvoiceEmailWithPdf,
  warmInvoicePdfEngine,
  type InvoicePdfOpts,
} from "@/lib/invoice-pdf";
import { buildInvoiceEmailHtml, buildTaxInvoicePrintHtml } from "@/lib/tax-invoice-format";
import { cn, formatInrTable } from "@/lib/utils";
import { toast } from "sonner";
import type { PaymentMethod } from "@/types";

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { value: "CASH", label: "Cash", icon: Banknote },
  { value: "UPI", label: "UPI", icon: Smartphone },
  { value: "CARD", label: "Card", icon: CreditCard },
];

function PaymentMethodBadge({ method }: { method: PaymentMethod }) {
  const config = PAYMENT_METHODS.find((m) => m.value === method);
  const Icon = config?.icon ?? Banknote;
  return (
    <Badge variant="outline" className="gap-1.5">
      <Icon className="w-3.5 h-3.5" />
      {config?.label ?? method}
    </Badge>
  );
}

type SalesInvoiceDetailClientProps = {
  invoiceId: string;
};

export function SalesInvoiceDetailClient({ invoiceId: id }: SalesInvoiceDetailClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const returnQuery = searchParams.toString();
  const currentReturnPath = returnQuery ? `${pathname}?${returnQuery}` : pathname;

  const invoices = useInvoiceStore((s) => s.invoices);
  const recordInvoicePayment = useInvoiceStore((s) => s.recordPayment);
  const jobCards = useJobCardStore((s) => s.jobCards);
  const user = useAuthStore((s) => s.user);

  const invoice = useMemo(
    () => invoices.find((inv) => inv.id === id),
    [invoices, id]
  );

  const jobCard = useMemo(
    () => (invoice ? jobCards.find((jc) => jc.id === invoice.jobCardId) : null),
    [invoice, jobCards]
  );

  const { customers } = useCustomerStore();
  const {
    gstRegistrationStatus,
    referralRewardAmount,
    newCustomerDiscount,
    businessName,
    businessTagline,
    businessPhone,
    businessWhatsApp,
    businessEmail,
    businessAddress,
    businessWebsite,
    gstin,
    companyPan,
    bankName,
    bankBranch,
    bankAccountNumber,
    bankIfsc,
    bankUpi,
  } = useSettingsStore();

  const invoiceCustomer = useMemo(
    () => (invoice ? customers.find((c) => c.id === invoice.customerId) : null),
    [invoice, customers]
  );

  const payments = useMemo(() => invoice?.payments ?? [], [invoice]);
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [useWallet, setUseWallet] = useState(false);
  const [addExtraToWallet, setAddExtraToWallet] = useState(false);

  // Local edit states for discounts
  const [flatDiscountStr, setFlatDiscountStr] = useState(() => invoice ? String(invoice.discountAmount || "") : "");
  const [pointsRedeemStr, setPointsRedeemStr] = useState(() => {
    if (!invoice) return "";
    const dbPts = invoice.rewardDiscount || 0;
    return dbPts > 200 ? "" : String(dbPts || "");
  });
  const [referralCode, setReferralCode] = useState(() => invoice ? String(invoice.referralCodeUsed || "") : "");
  const [appliedReferrerId, setAppliedReferrerId] = useState(() => invoice ? invoice.referralAdvocateId || "" : "");
  const [referralDiscountApplied, setReferralDiscountApplied] = useState(() => invoice ? invoice.referralDiscount || 0 : 0);
  const [referralVerifiedMsg, setReferralVerifiedMsg] = useState("");
  const [referralErrorMsg, setReferralErrorMsg] = useState("");
  const [isApplying, setIsApplying] = useState(false);

  const availablePoints = invoiceCustomer?.rewardPoints ?? 0;
  const maxAllowedPoints = Math.min(200, availablePoints);

  useEffect(() => {
    if (invoice && typeof window !== "undefined") {
      const draftFlat = sessionStorage.getItem(`draft-flat-${invoice.id}`);
      const draftReward = sessionStorage.getItem(`draft-reward-${invoice.id}`);
      const draftCode = sessionStorage.getItem(`draft-code-${invoice.id}`);
      const draftAdvocate = sessionStorage.getItem(`draft-advocate-${invoice.id}`);
      const draftRefDiscount = sessionStorage.getItem(`draft-refdiscount-${invoice.id}`);

      // Exclusivity Priority: 1. Reward draft / Referral draft, 2. Flat draft / DB values
      const hasRewardDraft = draftReward !== null && Number(draftReward) > 0;
      const hasReferralDraft = draftCode !== null && draftCode.trim() !== "";

      let finalFlat = "";
      let finalReward = "";
      let finalCode = "";
      let finalAdvocate = "";
      let finalRefDiscount = 0;

      if (hasRewardDraft || hasReferralDraft) {
        finalFlat = "";
        if (hasRewardDraft) {
          const dbPts = invoice.rewardDiscount || 0;
          const initialPts = dbPts > 200 ? 0 : dbPts;
          const parsedDraftReward = (Number(draftReward) <= 200 && Number(draftReward) <= availablePoints) ? draftReward : null;
          finalReward = parsedDraftReward !== null ? parsedDraftReward : (initialPts > 0 ? String(initialPts) : "");
        }
        if (hasReferralDraft) {
          finalCode = draftCode || "";
          finalAdvocate = draftAdvocate || "";
          finalRefDiscount = draftRefDiscount !== null ? Number(draftRefDiscount) : 0;
        }
      } else {
        const dbFlat = invoice.discountAmount || 0;
        finalFlat = draftFlat !== null ? draftFlat : (dbFlat > 0 ? String(dbFlat) : "");
        if (Number(finalFlat) > 0) {
          finalReward = "";
          finalCode = "";
          finalAdvocate = "";
          finalRefDiscount = 0;
        } else {
          const dbPts = invoice.rewardDiscount || 0;
          const initialPts = dbPts > 200 ? 0 : dbPts;
          finalReward = initialPts > 0 ? String(initialPts) : "";

          finalCode = invoice.referralCodeUsed || "";
          finalAdvocate = invoice.referralAdvocateId || "";
          finalRefDiscount = invoice.referralDiscount || 0;
        }
      }

      setFlatDiscountStr(finalFlat);
      setPointsRedeemStr(finalReward);
      setReferralCode(finalCode);
      setAppliedReferrerId(finalAdvocate);
      setReferralDiscountApplied(finalRefDiscount);
      setReferralVerifiedMsg(
        finalCode
          ? (hasReferralDraft ? "Referral code applied (unsaved draft)" : "Referral code applied")
          : ""
      );
      setReferralErrorMsg("");
    }
  }, [invoice, availablePoints]);

  const handleFlatDiscountChange = (val: string) => {
    setFlatDiscountStr(val);
    if (!invoice) return;
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`draft-flat-${invoice.id}`, val);
      if (Number(val) > 0) {
        setPointsRedeemStr("");
        sessionStorage.setItem(`draft-reward-${invoice.id}`, "");

        // Also clear referral code draft
        setReferralCode("");
        setAppliedReferrerId("");
        setReferralDiscountApplied(0);
        setReferralVerifiedMsg("");
        setReferralErrorMsg("");
        sessionStorage.removeItem(`draft-code-${invoice.id}`);
        sessionStorage.removeItem(`draft-advocate-${invoice.id}`);
        sessionStorage.removeItem(`draft-refdiscount-${invoice.id}`);
      }
    }
  };

  const handlePointsRedeemChange = (val: string) => {
    setPointsRedeemStr(val);
    if (!invoice) return;
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`draft-reward-${invoice.id}`, val);
      if (Number(val) > 0) {
        setFlatDiscountStr("");
        sessionStorage.setItem(`draft-flat-${invoice.id}`, "");
      }
    }
  };



  const subtotal = invoice ? invoice.subtotal : 0;
  const flatDiscount = Number(flatDiscountStr) || 0;
  const pointsRedeem = Number(pointsRedeemStr) || 0;
  const referralDiscount = referralDiscountApplied;

  const isPointsDisabled = flatDiscount > 0;
  const isFlatDisabled = pointsRedeem > 0 || referralDiscountApplied > 0;
  const isReferralDisabled = flatDiscount > 0;

  const activeFlatDiscount = isFlatDisabled ? 0 : flatDiscount;
  const activeRewardDiscount = isPointsDisabled ? 0 : ((pointsRedeem > 200 || pointsRedeem > availablePoints) ? 0 : pointsRedeem);
  const activeReferralDiscount = isReferralDisabled ? 0 : referralDiscount;

  // Derive pointsErrorMsg synchronously during render to prevent render lags
  const pointsErrorMsg = (() => {
    if (pointsRedeem > 200) {
      return "Maximum reward points redemption limit is 200 points.";
    }
    if (pointsRedeem > availablePoints) {
      return `Insufficient points. Customer has ${availablePoints} points.`;
    }
    return "";
  })();

  const discountTotal = activeFlatDiscount + activeRewardDiscount + activeReferralDiscount;
  const taxableSubtotal = Math.max(0, subtotal - discountTotal);
  const taxRate = gstRegistrationStatus === "NOT_REGISTERED" ? 0 : invoice ? invoice.taxRate : 0.18;
  const taxAmount = Math.round(taxableSubtotal * taxRate * 100) / 100;
  const grandTotalComputed = Math.round((taxableSubtotal + taxAmount) * 100) / 100;
  const pointsToEarn = Math.floor(taxableSubtotal / 100);

  const handleVerifyReferralCode = () => {
    setReferralErrorMsg("");
    setReferralVerifiedMsg("");
    if (!invoice) return;
    
    if (flatDiscount > 0) {
      setReferralErrorMsg("Cannot apply referral code while flat discount is active.");
      return;
    }

    if (!referralCode.trim()) {
      setReferralErrorMsg("Enter a referral code first.");
      return;
    }

    const trimmed = referralCode.trim();
    if (invoiceCustomer && trimmed.toLowerCase() === invoiceCustomer.referralCode.toLowerCase()) {
      setReferralErrorMsg("A customer cannot use their own referral code.");
      return;
    }

    const { findByReferralCode } = useCustomerStore.getState();
    const referrer = findByReferralCode(trimmed);
    if (!referrer) {
      setReferralErrorMsg("Invalid referral code.");
      return;
    }

    // Valid referral!
    setAppliedReferrerId(referrer.id);
    setReferralDiscountApplied(newCustomerDiscount);
    setReferralVerifiedMsg(`Applied! Referred by ${referrer.name}`);
    toast.success(`Referral code verified: Referred by ${referrer.name}`);

    if (typeof window !== "undefined") {
      sessionStorage.setItem(`draft-code-${invoice.id}`, trimmed);
      sessionStorage.setItem(`draft-advocate-${invoice.id}`, referrer.id);
      sessionStorage.setItem(`draft-refdiscount-${invoice.id}`, String(newCustomerDiscount));
    }
  };

  const handleRemoveReferral = () => {
    setReferralCode("");
    setAppliedReferrerId("");
    setReferralDiscountApplied(0);
    setReferralVerifiedMsg("");
    setReferralErrorMsg("");
    toast.message("Referral code removed");
    if (!invoice) return;

    if (typeof window !== "undefined") {
      sessionStorage.removeItem(`draft-code-${invoice.id}`);
      sessionStorage.removeItem(`draft-advocate-${invoice.id}`);
      sessionStorage.removeItem(`draft-refdiscount-${invoice.id}`);
    }
  };

  const updateInvoiceDiscounts = useInvoiceStore((s) => s.updateInvoice);

  const handleSaveDiscounts = async () => {
    if (!invoice) return;
    if (pointsErrorMsg) {
      toast.error(pointsErrorMsg);
      return;
    }

    setIsApplying(true);
    try {
      await updateInvoiceDiscounts(invoice.id, {
        discountAmount: activeFlatDiscount,
        rewardDiscount: activeRewardDiscount,
        referralDiscount: activeReferralDiscount,
        referralAdvocateId: activeReferralDiscount > 0 ? (appliedReferrerId || undefined) : undefined,
        referralCodeUsed: activeReferralDiscount > 0 ? (referralCode.trim() || undefined) : undefined,
        taxAmount: taxAmount,
        grandTotal: grandTotalComputed,
      });
      toast.success("Invoice discounts applied successfully");

      if (typeof window !== "undefined") {
        sessionStorage.removeItem(`draft-flat-${invoice.id}`);
        sessionStorage.removeItem(`draft-reward-${invoice.id}`);
        sessionStorage.removeItem(`draft-code-${invoice.id}`);
        sessionStorage.removeItem(`draft-advocate-${invoice.id}`);
        sessionStorage.removeItem(`draft-refdiscount-${invoice.id}`);
      }
    } catch (err) {
      toast.error("Failed to apply discounts to invoice");
    } finally {
      setIsApplying(false);
    }
  };

  const totalPaid = useMemo(
    () => payments.reduce((sum, p) => sum + p.amount, 0) + (invoice?.walletAmountUsed || 0),
    [payments, invoice?.walletAmountUsed]
  );
  const remainingBalance = invoice ? invoice.grandTotal - totalPaid : 0;

  const invoicePdfOpts = useMemo((): InvoicePdfOpts | null => {
    if (!invoice) return null;
    const sanitizedInvoice = {
      ...invoice,
      rewardDiscount: (invoice.rewardDiscount || 0) > 200 ? 0 : invoice.rewardDiscount,
    };
    return {
      invoice: sanitizedInvoice,
      jobCard: jobCard ?? null,
      customerName: invoice.customerName,
      customerPhone: invoice.customerPhone,
      customerEmail: invoiceCustomer?.email?.trim() ?? "",
      customerAddress: invoiceCustomer?.address ?? "",
      vehicleMakeModel: jobCard?.vehicleMakeModel ?? "—",
      business: {
        businessName,
        businessTagline,
        businessAddress,
        businessPhone,
        businessWhatsApp,
        businessEmail,
        businessWebsite,
        gstRegistrationStatus,
        gstin,
        companyPan,
        bankName,
        bankBranch,
        bankAccountNumber,
        bankIfsc,
        bankUpi,
      },
      payments,
      totalPaid,
      remainingBalance,
      referralCode: invoiceCustomer?.referralCode,
      referralRewardAmount,
      newCustomerDiscount,
    };
  }, [
    invoice,
    jobCard,
    invoiceCustomer,
    payments,
    totalPaid,
    remainingBalance,
    businessName,
    businessTagline,
    businessAddress,
    businessPhone,
    businessWhatsApp,
    businessEmail,
    businessWebsite,
    gstRegistrationStatus,
    gstin,
    companyPan,
    bankName,
    bankBranch,
    bankAccountNumber,
    bankIfsc,
    bankUpi,
    referralRewardAmount,
    newCustomerDiscount,
  ]);

  useEffect(() => {
    warmInvoicePdfEngine();
    if (invoicePdfOpts) prefetchInvoicePdf(invoicePdfOpts);
  }, [invoicePdfOpts]);

  const previewHtml = useMemo(() => {
    if (!invoicePdfOpts) return "";
    const o = invoicePdfOpts;
    return buildTaxInvoicePrintHtml(
      {
        invoice: o.invoice,
        jobCard: o.jobCard,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        customerEmail: o.customerEmail,
        customerAddress: o.customerAddress,
        vehicleMakeModel: o.jobCard?.vehicleMakeModel ?? "—",
        business: o.business,
        payments: o.payments,
        totalPaid: o.totalPaid,
        remainingBalance: o.remainingBalance,
        referralCode: o.referralCode,
        referralRewardAmount: o.referralRewardAmount,
        newCustomerDiscount: o.newCustomerDiscount,
      },
      { includePrintScript: false }
    );
  }, [invoicePdfOpts]);

  const openRecordDialog = () => {
    setPaymentAmount(remainingBalance > 0 ? String(remainingBalance) : "");
    setPaymentMethod("CASH");
    setReferenceNumber("");
    setUseWallet(false);
    setAddExtraToWallet(false);
    setRecordDialogOpen(true);
  };

  const handleRecordPayment = async () => {
    const amount = Number(paymentAmount);
    if (!invoice || isNaN(amount) || amount <= 0) return;

    const paidAt = new Date().toISOString();
    const totalPaidBefore = payments.reduce((sum, p) => sum + p.amount, 0) + (invoice.walletAmountUsed || 0);

    const walletAmountUsed = useWallet
      ? Math.min(invoiceCustomer?.walletBalance || 0, remainingBalance)
      : 0;

    const extraAmount = amount > (remainingBalance - walletAmountUsed)
      ? Math.round((amount - (remainingBalance - walletAmountUsed)) * 100) / 100
      : 0;

    const remainingAfter = Math.max(0, remainingBalance - walletAmountUsed - amount);

    const performedBy = user?.id?.toLowerCase() ?? "usr-001";
    const result = await recordInvoicePayment(
      invoice.id,
      {
        invoiceId: invoice.id,
        amount,
        method: paymentMethod,
        referenceNumber: referenceNumber || undefined,
        paidAt,
        addExtraToWallet: addExtraToWallet && extraAmount > 0,
        extraAmount: addExtraToWallet && extraAmount > 0 ? extraAmount : undefined,
      },
      { performedBy },
      walletAmountUsed
    );
    if (result.inventoryError) {
      toast.error("Could not update inventory", {
        description: result.inventoryError,
      });
    } else {
      toast.success("Payment recorded");

      try {
        await useCustomerStore.getState().fetchCustomers();
        await useWalletStore.getState().fetchTransactions();
      } catch (e) {
        console.error("Failed to reload customer/wallet state:", e);
      }

      const totalPaidAfter = totalPaidBefore + amount + walletAmountUsed;
      const latestInvoice = useInvoiceStore.getState().invoices.find(i => i.id === invoice.id) || invoice;
      const isFullyPaidNow = totalPaidAfter >= latestInvoice.grandTotal - 0.01;
      if (isFullyPaidNow) {
        const buyer = useCustomerStore.getState().customers.find(c => c.id === latestInvoice.customerId) || invoiceCustomer;
        if (buyer) {
          const pointsRedeemed = latestInvoice.rewardDiscount || 0;
          const discountAmt = latestInvoice.discountAmount || 0;
          const refDiscount = latestInvoice.referralDiscount || 0;
          const taxable = Math.max(0, latestInvoice.subtotal - discountAmt - pointsRedeemed - refDiscount);
          const pointsEarned = Math.floor(taxable / 100);
          const nextPoints = Math.max(0, buyer.rewardPoints - pointsRedeemed + pointsEarned);

          await useCustomerStore.getState().updateCustomer(buyer.id, {
            rewardPoints: nextPoints,
            totalVisits: (buyer.totalVisits || 0) + 1,
          });

          toast.success(`Loyalty points updated: ${buyer.name} earned ${pointsEarned} points and redeemed ${pointsRedeemed} points.`);
        }

        if (latestInvoice.referralAdvocateId) {
          const advocate = useCustomerStore.getState().customers.find(c => c.id === latestInvoice.referralAdvocateId);
          if (advocate) {
            const nextAdvocatePoints = (advocate.rewardPoints || 0) + referralRewardAmount;
            await useCustomerStore.getState().updateCustomer(advocate.id, {
              rewardPoints: nextAdvocatePoints,
            });
            toast.success(`Referrer credited: ${advocate.name} received ${referralRewardAmount} referral reward points.`);
          }
        }
      }

      pushActivityLog({
        action: "PAYMENT_RECEIVED",
        entityType: "INVOICE",
        entityId: invoice.id,
        entityLabel: invoice.invoiceNumber,
        details: `${formatCurrency(amount)} received on ${invoice.invoiceNumber}`,
      });
      void notifyCustomerPaymentRecordedWhatsApp({
        invoice: latestInvoice,
        amount,
        method: paymentMethod,
        referenceNumber: referenceNumber || undefined,
        paidAt,
        remainingBalanceAfter: remainingAfter,
        businessName,
      });
    }
    setRecordDialogOpen(false);
  };

  const handlePrint = () => {
    if (!invoice) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.print();
      return;
    }
    const html = buildTaxInvoicePrintHtml({
      invoice,
      jobCard: jobCard ?? null,
      customerName: invoice.customerName,
      customerPhone: invoice.customerPhone,
      customerEmail: invoiceCustomer?.email ?? "",
      customerAddress: invoiceCustomer?.address ?? "",
      vehicleMakeModel: jobCard?.vehicleMakeModel ?? "—",
      business: {
        businessName,
        businessTagline,
        businessAddress,
        businessPhone,
        businessWhatsApp,
        businessEmail,
        businessWebsite,
        gstRegistrationStatus,
        gstin,
        companyPan,
        bankName,
        bankBranch,
        bankAccountNumber,
        bankIfsc,
        bankUpi,
      },
      payments,
      totalPaid,
      remainingBalance,
      referralCode: invoiceCustomer?.referralCode,
      referralRewardAmount,
      newCustomerDiscount,
    });
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleInvoiceWhatsApp = async () => {
    if (!invoice) return;
    const invoiceLabel = gstRegistrationStatus === "NOT_REGISTERED" ? "invoice" : "tax invoice";
    const message = buildInvoiceWhatsAppMessage(invoice, {
      businessName,
      remainingBalance,
      invoiceLabel,
    });
    const phone = invoice.customerPhone;
    const notify = (channel: "api" | "composer") => {
      useNotificationStore.getState().addNotification({
        type: "whatsapp_sent",
        title: channel === "api" ? "Invoice shared via WhatsApp" : "Invoice — WhatsApp composer",
        message: `${invoice.invoiceNumber} → ${phone}`,
        href: `/billing/${invoice.id}`,
        branchId: jobCard?.branchId,
      });
    };
    const logSent = () => {
      pushActivityLog({
        action: "WHATSAPP_SENT",
        entityType: "INVOICE",
        entityId: invoice.id,
        entityLabel: invoice.invoiceNumber,
        details: `Invoice ${invoice.invoiceNumber} shared with ${invoice.customerName} via WhatsApp`,
      });
    };
    try {
      await sendCustomerWhatsApp(phone, message);
      toast.success("Invoice sent via WhatsApp", { description: phone });
      notify("api");
      logSent();
    } catch (err) {
      if (isWhatsAppNotConfiguredError(err)) {
        openWhatsAppComposer(phone, message);
        toast.info("WhatsApp opened", {
          description: "Finish sending in the app, or configure Twilio WhatsApp on the server.",
        });
        notify("composer");
        logSent();
        return;
      }
      toast.error("WhatsApp failed", {
        description: err instanceof ApiError ? err.message : "Could not send",
      });
    }
  };

  const handleInvoiceEmail = async () => {
    if (!invoice || !invoicePdfOpts) return;
    const toEmail = invoiceCustomer?.email?.trim();
    if (!toEmail) {
      toast.error("No customer email", {
        description: "Add an email on the customer profile, then try again.",
      });
      return;
    }
    const latestInvoice =
      useInvoiceStore.getState().invoices.find((i) => i.id === invoice.id) ?? invoice;
    const pdfOpts: InvoicePdfOpts = {
      ...invoicePdfOpts!,
      invoice: latestInvoice,
      customerEmail: toEmail,
    };
    const attachmentFilename = invoicePdfFilename(invoice.invoiceNumber, gstRegistrationStatus);
    const titleCaseLabel = gstRegistrationStatus === "NOT_REGISTERED" ? "Invoice" : "Tax Invoice";
    const sentenceCaseLabel = gstRegistrationStatus === "NOT_REGISTERED" ? "invoice" : "tax invoice";
    const emailHtml = buildInvoiceEmailHtml({
      customerName: invoice.customerName,
      invoiceNumber: invoice.invoiceNumber,
      businessName,
      invoiceLabel: titleCaseLabel,
      grandTotal: invoice.grandTotal,
      remainingBalance,
      vehicleRegNumber: invoice.vehicleRegNumber,
      attachmentFilename,
    });
    const subject = `${titleCaseLabel} ${invoice.invoiceNumber} — ${businessName}`;
    const text = [
      buildInvoiceWhatsAppMessage(invoice, { businessName, remainingBalance, invoiceLabel: sentenceCaseLabel }),
      "",
      `Your ${sentenceCaseLabel} is attached as ${attachmentFilename}. Open the PDF to view or download the full invoice.`,
    ].join("\n");
    const pdfToast = toast.loading("Sending invoice email…");
    const notify = () => {
      useNotificationStore.getState().addNotification({
        type: "email_sent",
        title: "Invoice emailed",
        message: `${invoice.invoiceNumber} → ${toEmail}`,
        href: `/billing/${invoice.id}`,
        branchId: jobCard?.branchId,
      });
    };
    const logSent = () => {
      pushActivityLog({
        action: "EMAIL_SENT",
        entityType: "INVOICE",
        entityId: invoice.id,
        entityLabel: invoice.invoiceNumber,
        details: `Invoice ${invoice.invoiceNumber} emailed to ${invoice.customerName} (${toEmail}) with PDF attachment`,
      });
    };
    try {
      await sendInvoiceEmailWithPdf({
        pdfOpts,
        to: toEmail,
        subject,
        emailHtml,
        text,
      });
      toast.dismiss(pdfToast);
      toast.success("Invoice emailed", {
        description: `${toEmail} — PDF attached (${attachmentFilename})`,
      });
      notify();
      logSent();
    } catch (err) {
      toast.dismiss(pdfToast);
      if (isResendNotConfiguredError(err)) {
        toast.error("Email not configured", {
          description:
            "Set RESEND_API_KEY on the API server (same as password reset). Optionally set MAIL_FROM.",
        });
        return;
      }
      if (err instanceof ApiError && err.code === "PAYLOAD_TOO_LARGE") {
        toast.error("Invoice PDF too large", {
          description: err.message,
        });
        return;
      }
      toast.error("Email failed", {
        description: err instanceof ApiError ? err.message : "Could not send",
      });
    }
  };

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-muted-foreground">Invoice not found</p>
        <DetailBackButton fallbackHref="/billing" />
      </div>
    );
  }

  const formatShortDate = (iso: string) =>
    new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
      .format(new Date(iso))
      .replace(/ /g, "-");

  return (
    <div className="space-y-4 print:hidden">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <DetailBackButton fallbackHref="/billing" />
          <h1 className="text-lg font-semibold">Sales Invoice #{invoice.invoiceNumber}</h1>
          <InvoiceStatusBadge status={invoice.status} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Download className="mr-1.5 h-4 w-4" />
            Download PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="mr-1.5 h-4 w-4" />
            Print PDF
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Share2 className="mr-1.5 h-4 w-4" />
                Share
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onClick={() => {
                  const customerName = invoice.customerName;
                  const businessNameVal = businessName || "Prime Detailers";
                  const invoiceNumber = invoice.invoiceNumber;
                  const totalAmount = invoice.grandTotal;
                  const vehicleName = jobCard?.vehicleMakeModel ?? "Vehicle";
                  const vehicleNumber = invoice.vehicleRegNumber || jobCard?.vehicleRegNumber || "";
                  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
                  const publicInvoiceUrl = `${appBaseUrl}/public-invoice/${invoice.id}`;

                  const msg = `Hi ${customerName},

Please find your invoice from ${businessNameVal}.

Invoice: ${invoiceNumber}

Amount: ₹${totalAmount}

Vehicle: ${vehicleName} - ${vehicleNumber}

You can view the invoice here: ${publicInvoiceUrl}

Thank you,
${businessNameVal}`;

                  openWhatsAppComposer(invoice.customerPhone, msg);
                }}
              >
                <svg
                  className="mr-0.5 h-4 w-4 shrink-0"
                  viewBox="0 0 240 241.19"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fill="#25d366"
                    fillRule="evenodd"
                    d="M205,35.05A118.61,118.61,0,0,0,120.46,0C54.6,0,1,53.61,1,119.51a119.5,119.5,0,0,0,16,59.74L0,241.19l63.36-16.63a119.43,119.43,0,0,0,57.08,14.57h0A119.54,119.54,0,0,0,205,35.07v0ZM120.5,219A99.18,99.18,0,0,1,69.91,205.1l-3.64-2.17-37.6,9.85,10-36.65-2.35-3.76A99.37,99.37,0,0,1,190.79,49.27,99.43,99.43,0,0,1,120.49,219ZM175,144.54c-3-1.51-17.67-8.71-20.39-9.71s-4.72-1.51-6.75,1.51-7.72,9.71-9.46,11.72-3.49,2.27-6.45.76-12.63-4.66-24-14.84A91.1,91.1,0,0,1,91.25,113.3c-1.75-3-.19-4.61,1.33-6.07s3-3.48,4.47-5.23a19.65,19.65,0,0,0,3-5,5.51,5.51,0,0,0-.24-5.23C99,90.27,93,75.57,90.6,69.58s-4.89-5-6.73-5.14-3.73-.09-5.7-.09a11,11,0,0,0-8,3.73C67.48,71.05,59.75,78.3,59.75,93s10.69,28.88,12.19,30.9S93,156.07,123,169c7.12,3.06,12.68,4.9,17,6.32a41.18,41.18,0,0,0,18.8,1.17c5.74-.84,17.66-7.21,20.17-14.18s2.5-13,1.75-14.19-2.69-2.06-5.7-3.59l0,0Z"
                  />
                </svg>
                Whatsapp
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {(invoice.status === "ISSUED" || invoice.status === "PARTIALLY_PAID") &&
            remainingBalance > 0.01 && (
              <Button size="sm" onClick={openRecordDialog}>
                Record Payment In
              </Button>
            )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px] lg:items-start">
        <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
          {previewHtml ? (
            <iframe
              title={gstRegistrationStatus === "NOT_REGISTERED" ? "Invoice preview" : "Tax invoice preview"}
              className="h-[min(85vh,920px)] w-full border-0"
              srcDoc={previewHtml}
            />
          ) : (
            <p className="p-8 text-sm text-muted-foreground">Loading preview…</p>
          )}
        </div>

        <div className="space-y-4 lg:sticky lg:top-4">
          {payments.length === 0 && (invoice.status === "DRAFT" || invoice.status === "ISSUED") && (
            <Card className="border-border shadow-sm">
              <CardHeader className="border-b border-border py-3 bg-violet-50/40 dark:bg-violet-950/10">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Gift className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  Discounts & Rewards
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4 text-sm">
                {/* Flat Discount Input */}
                <div className="space-y-1.5">
                  <Label htmlFor="flat-discount" className="font-medium text-foreground">
                    Flat Discount (₹)
                  </Label>
                  <Input
                    id="flat-discount"
                    type="number"
                    min="0"
                    placeholder="Enter flat discount"
                    value={flatDiscountStr}
                    disabled={isFlatDisabled}
                    onChange={(e) => handleFlatDiscountChange(e.target.value)}
                  />
                  {isFlatDisabled && (
                    <p className="text-[11px] text-amber-600">Disabled because reward points or referral discount is active.</p>
                  )}
                </div>

                {/* Reward Points Input */}
                <div className="space-y-1.5">
                  <Label htmlFor="reward-points" className="flex items-center justify-between gap-2 font-medium text-foreground w-full">
                    <span className="flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5 text-muted-foreground" />
                      Redeem Reward Points
                    </span>
                    <span className="text-[10px] text-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/20 px-2 py-0.5 rounded-full font-bold font-mono border border-indigo-100 dark:border-indigo-900/50 shrink-0 whitespace-nowrap">
                      Available: {availablePoints}
                    </span>
                  </Label>
                  <Input
                    id="reward-points"
                    type="number"
                    min="0"
                    max="200"
                    placeholder="Enter points"
                    value={pointsRedeemStr}
                    disabled={isPointsDisabled}
                    onChange={(e) => handlePointsRedeemChange(e.target.value)}
                  />
                  {isPointsDisabled && (
                    <p className="text-[11px] text-amber-600">Disabled because flat discount is applied.</p>
                  )}
                  {pointsErrorMsg ? (
                    <p className="text-[11px] text-destructive">{pointsErrorMsg}</p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">Max 200 points redemption allowed (1 pt = ₹1 discount).</p>
                  )}
                </div>

                {/* Referral Code Input */}
                <div className="space-y-1.5">
                  <Label htmlFor="referral-code" className="flex items-center gap-1.5 font-medium text-foreground">
                    <Ticket className="w-3.5 h-3.5 text-muted-foreground" />
                    Referral Discount Code
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="referral-code"
                      placeholder="Enter friend's code"
                      value={referralCode}
                      onChange={(e) => {
                        setReferralCode(e.target.value);
                        if (invoice && typeof window !== "undefined") {
                          sessionStorage.setItem(`draft-code-${invoice.id}`, e.target.value);
                        }
                      }}
                      disabled={Boolean(appliedReferrerId) || isReferralDisabled}
                    />
                    {appliedReferrerId ? (
                      <Button variant="outline" size="icon" className="shrink-0 text-destructive border-destructive/20 hover:bg-destructive/5" onClick={handleRemoveReferral}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button variant="outline" className="shrink-0" onClick={handleVerifyReferralCode} disabled={isReferralDisabled}>
                        Apply
                      </Button>
                    )}
                  </div>
                  {isReferralDisabled && (
                    <p className="text-[11px] text-amber-600">Disabled because flat discount is active.</p>
                  )}
                  {referralVerifiedMsg && (
                    <p className="text-[11px] text-emerald-600 font-medium">{referralVerifiedMsg}</p>
                  )}
                  {referralErrorMsg && (
                    <p className="text-[11px] text-destructive">{referralErrorMsg}</p>
                  )}
                </div>

                <Separator />

                {/* Calculation Summary */}
                <div className="space-y-2 text-xs">
                  <p className="font-semibold text-foreground text-sm mb-2">Pre-Invoice Calculation</p>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-mono">{formatCurrency(subtotal)}</span>
                  </div>
                  {activeFlatDiscount > 0 && (
                    <div className="flex justify-between text-amber-600 font-medium">
                      <span>Flat Discount</span>
                      <span className="font-mono">-{formatCurrency(activeFlatDiscount)}</span>
                    </div>
                  )}
                  {activeRewardDiscount > 0 && (
                    <div className="flex justify-between text-amber-600 font-medium">
                      <span>Reward Discount ({activeRewardDiscount} pts)</span>
                      <span className="font-mono">-{formatCurrency(activeRewardDiscount)}</span>
                    </div>
                  )}
                  {activeReferralDiscount > 0 && (
                    <div className="flex justify-between text-amber-600 font-medium">
                      <span>Referral Discount</span>
                      <span className="font-mono">-{formatCurrency(activeReferralDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold border-t border-border pt-1.5 text-[13px]">
                    <span>Taxable Subtotal</span>
                    <span className="font-mono">{formatCurrency(taxableSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>GST ({Math.round(taxRate * 100)}%)</span>
                    <span className="font-mono">{formatCurrency(taxAmount)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm border-t border-border pt-1.5 text-primary">
                    <span>Revised Grand Total</span>
                    <span className="font-mono">{formatCurrency(grandTotalComputed)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 font-medium bg-emerald-500/5 dark:bg-emerald-500/10 p-2 rounded-md mt-2">
                    <span>Loyalty Points to Earn</span>
                    <span>{pointsToEarn} points</span>
                  </div>
                </div>

                <Button className="w-full bg-violet-600 hover:bg-violet-700 text-white font-medium animate-in fade-in duration-200" disabled={isApplying || Boolean(pointsErrorMsg)} onClick={handleSaveDiscounts}>
                  {isApplying ? "Applying..." : "Apply to Invoice"}
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="border-border shadow-sm">
            <CardHeader className="border-b border-border py-3">
              <CardTitle className="text-base font-semibold">Payment History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Invoice Amount</span>
                <span className="font-semibold tabular-nums">{formatInrTable(invoice.grandTotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Initial Amount Received</span>
                <span className="tabular-nums">{formatInrTable(0)}</span>
              </div>
              <Separator />
              {payments.length === 0 ? (
                <p className="text-muted-foreground text-sm">No payments recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {payments.map((payment) => (
                    <div
                      key={payment.id}
                      role="link"
                      tabIndex={0}
                      className="cursor-pointer rounded-md border border-border p-3 hover:bg-muted/30"
                      onClick={() =>
                        router.push(
                          appendReturnTo(paymentInDetailPath(payment.id), currentReturnPath)
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(
                            appendReturnTo(paymentInDetailPath(payment.id), currentReturnPath)
                          );
                        }
                      }}
                    >
                      <p className="font-medium">Payment In #{paymentDisplayNumber(payment.id)}</p>
                      <p className="mt-1 font-semibold tabular-nums">{formatInrTable(payment.amount)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatShortDate(payment.paidAt)}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {payment.method.toLowerCase()}
                        {payment.referenceNumber ? ` (${payment.referenceNumber})` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <Separator />
              <div className="flex items-center justify-between gap-2 font-medium">
                <span>Total Amount Received</span>
                <span className="tabular-nums">{formatInrTable(totalPaid)}</span>
              </div>
              {remainingBalance > 0.01 && (
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">Balance Amount</span>
                  <span className={cn("font-bold tabular-nums text-destructive")}>
                    {formatInrTable(remainingBalance)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={recordDialogOpen} onOpenChange={setRecordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {invoiceCustomer && invoiceCustomer.walletBalance > 0 && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    Wallet Balance: ₹{invoiceCustomer.walletBalance}
                  </span>
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useWallet}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setUseWallet(checked);
                        const walletUse = checked
                          ? Math.min(invoiceCustomer.walletBalance, remainingBalance)
                          : 0;
                        setPaymentAmount(String(Math.max(0, Math.round((remainingBalance - walletUse) * 100) / 100)));
                      }}
                      className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                    />
                    Use Wallet Balance
                  </label>
                </div>
                {useWallet && (
                  <div className="text-xs space-y-1 pt-1 border-t border-emerald-500/10 font-mono text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Invoice Remaining:</span>
                      <span>₹{remainingBalance}</span>
                    </div>
                    <div className="flex justify-between text-rose-500">
                      <span>Wallet Used:</span>
                      <span>-₹{Math.min(invoiceCustomer.walletBalance, remainingBalance)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-foreground">
                      <span>Amount to Pay:</span>
                      <span>₹{Math.max(0, Math.round((remainingBalance - Math.min(invoiceCustomer.walletBalance, remainingBalance)) * 100) / 100)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="amount">Amount (₹)</Label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="Enter amount"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>

            {(() => {
              const walletUse = useWallet
                ? Math.min(invoiceCustomer?.walletBalance || 0, remainingBalance)
                : 0;
              const inputAmt = Number(paymentAmount) || 0;
              const targetBalance = remainingBalance - walletUse;
              const extra = inputAmt > targetBalance ? Math.round((inputAmt - targetBalance) * 100) / 100 : 0;
              
              if (extra > 0) {
                return (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-3">
                    <div className="text-xs space-y-1 font-mono text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Invoice Amount:</span>
                        <span>₹{targetBalance}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Amount Received:</span>
                        <span>₹{inputAmt}</span>
                      </div>
                      <div className="flex justify-between font-bold text-amber-600">
                        <span>Extra Amount:</span>
                        <span>₹{extra}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 border-t border-amber-500/10 pt-2">
                      <input
                        id="add-to-wallet-chk"
                        type="checkbox"
                        checked={addExtraToWallet}
                        onChange={(e) => setAddExtraToWallet(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                      />
                      <Label htmlFor="add-to-wallet-chk" className="text-xs font-semibold cursor-pointer select-none">
                        Add ₹{extra} to customer wallet?
                      </Label>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reference">Reference Number (optional)</Label>
              <Input
                id="reference"
                placeholder="UPI ref, TXN ID, etc."
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleRecordPayment()}
              disabled={
                !paymentAmount ||
                isNaN(Number(paymentAmount)) ||
                Number(paymentAmount) <= 0
              }
            >
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
