"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Printer,
  CreditCard,
  Banknote,
  Smartphone,
  MessageCircle,
  Mail,
} from "lucide-react";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
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
import { sendInvoiceEmail, isResendNotConfiguredError } from "@/lib/invoice-email-send";
import { notifyCustomerPaymentRecordedWhatsApp } from "@/lib/payment-received-whatsapp";
import { useNotificationStore } from "@/store/notification-store";
import { ApiError } from "@/lib/api-client";
import { buildInvoicePdfAttachment } from "@/lib/invoice-pdf";
import {
  additionalDiscountTotal,
  buildInvoiceEmailHtml,
  buildTaxInvoicePrintHtml,
  DEFAULT_SERVICE_HSN,
  gstHalfPercentLabel,
  lineGrandWithTax,
  lineRateDisplay,
  netTaxableForDisplay,
  splitCgstSgst,
} from "@/lib/tax-invoice-format";
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

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

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

  const totalPaid = useMemo(
    () => payments.reduce((sum, p) => sum + p.amount, 0),
    [payments]
  );
  const remainingBalance = invoice ? invoice.grandTotal - totalPaid : 0;

  const openRecordDialog = () => {
    setPaymentAmount(remainingBalance > 0 ? String(remainingBalance) : "");
    setPaymentMethod("CASH");
    setReferenceNumber("");
    setRecordDialogOpen(true);
  };

  const handleRecordPayment = async () => {
    const amount = Number(paymentAmount);
    if (!invoice || isNaN(amount) || amount <= 0) return;

    const paidAt = new Date().toISOString();
    const totalPaidBefore = payments.reduce((sum, p) => sum + p.amount, 0);
    const remainingAfter = Math.max(0, invoice.grandTotal - totalPaidBefore - amount);

    const performedBy = user?.id?.toLowerCase() ?? "usr-001";
    const result = await recordInvoicePayment(
      invoice.id,
      {
        invoiceId: invoice.id,
        amount,
        method: paymentMethod,
        referenceNumber: referenceNumber || undefined,
        paidAt,
      },
      { performedBy }
    );
    if (result.inventoryError) {
      toast.error("Could not update inventory", {
        description: result.inventoryError,
      });
    } else {
      toast.success("Payment recorded");
      pushActivityLog({
        action: "PAYMENT_RECEIVED",
        entityType: "INVOICE",
        entityId: invoice.id,
        entityLabel: invoice.invoiceNumber,
        details: `${formatCurrency(amount)} received on ${invoice.invoiceNumber}`,
      });
      void notifyCustomerPaymentRecordedWhatsApp({
        invoice,
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
    const message = buildInvoiceWhatsAppMessage(invoice, {
      businessName,
      remainingBalance,
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
    if (!invoice) return;
    const toEmail = invoiceCustomer?.email?.trim();
    if (!toEmail) {
      toast.error("No customer email", {
        description: "Add an email on the customer profile, then try again.",
      });
      return;
    }
    const pdfOpts = {
      invoice,
      jobCard: jobCard ?? null,
      customerName: invoice.customerName,
      customerPhone: invoice.customerPhone,
      customerEmail: toEmail,
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
    const pdfToast = toast.loading("Preparing invoice PDF…");
    let attachment: { filename: string; content: string };
    try {
      attachment = await buildInvoicePdfAttachment(pdfOpts);
    } catch (e) {
      toast.dismiss(pdfToast);
      toast.error("Could not build invoice PDF", {
        description: e instanceof Error ? e.message : "Try Print and save as PDF instead.",
      });
      return;
    }
    toast.dismiss(pdfToast);
    const html = buildInvoiceEmailHtml({
      customerName: invoice.customerName,
      invoiceNumber: invoice.invoiceNumber,
      businessName,
      grandTotal: invoice.grandTotal,
      remainingBalance,
      vehicleRegNumber: invoice.vehicleRegNumber,
      attachmentFilename: attachment.filename,
    });
    const subject = `Tax invoice ${invoice.invoiceNumber} — ${businessName}`;
    const text = [
      buildInvoiceWhatsAppMessage(invoice, { businessName, remainingBalance }),
      "",
      `Your tax invoice is attached as ${attachment.filename}. Open the PDF to view or download the full invoice.`,
    ].join("\n");
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
      await sendInvoiceEmail({
        to: toEmail,
        subject,
        html,
        text,
        attachments: [attachment],
      });
      toast.success("Invoice emailed", {
        description: `${toEmail} — PDF attached (${attachment.filename})`,
      });
      notify();
      logSent();
    } catch (err) {
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
        <Button variant="outline" onClick={() => router.push("/billing")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Billing
        </Button>
      </div>
    );
  }

  const vehicleMakeModel = jobCard?.vehicleMakeModel ?? "—";
  const { cgst, sgst } = splitCgstSgst(invoice.taxAmount);
  const addDisc = additionalDiscountTotal(invoice);
  const taxable = netTaxableForDisplay(invoice);
  const gstPct = Math.round(invoice.taxRate * 100);

  return (
    <div className="space-y-6 print:hidden">
      <Breadcrumbs items={[
        { label: "Billing", href: "/billing" },
        { label: invoice.invoiceNumber },
      ]} />

      <Card className="overflow-hidden border-indigo-200/40 dark:border-indigo-800/40 shadow-md shadow-indigo-500/10 bg-gradient-to-br from-card via-card to-violet-50/40 dark:to-violet-950/20">
        <div className="h-2 bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-400" aria-hidden />
        <CardContent className="pt-5 pb-5 space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <Button variant="ghost" size="sm" className="-ml-2 h-8 w-fit text-muted-foreground hover:text-foreground" asChild>
              <Link href="/billing">
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                All invoices
              </Link>
            </Button>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" type="button" onClick={() => void handleInvoiceWhatsApp()}>
                <MessageCircle className="w-4 h-4 mr-2" />
                WhatsApp
              </Button>
              <Button variant="outline" size="sm" type="button" onClick={() => void handleInvoiceEmail()}>
                <Mail className="w-4 h-4 mr-2" />
                Email
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
              {(invoice.status === "ISSUED" || invoice.status === "PARTIALLY_PAID") &&
                remainingBalance > 0 && (
                  <Button size="sm" onClick={openRecordDialog}>Record payment</Button>
                )}
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start border-b border-indigo-200/50 dark:border-indigo-800/40 pb-5 rounded-lg bg-gradient-to-r from-indigo-500/5 via-violet-500/5 to-cyan-500/5 -mx-1 px-3 py-4 sm:py-3">
            <div className="space-y-1 min-w-0">
              <p className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-violet-400">{businessName}</p>
              <p className="text-xs font-medium text-violet-600 dark:text-violet-400">{businessTagline}</p>
              <p className="text-xs text-muted-foreground max-w-md leading-relaxed">{businessAddress}</p>
              <p className="text-xs text-muted-foreground pt-1">
                Phone: {businessPhone} <span className="text-indigo-300 dark:text-indigo-700">|</span> WhatsApp: {businessWhatsApp}
              </p>
              <p className="text-xs text-muted-foreground">
                Email: {businessEmail} <span className="text-indigo-300 dark:text-indigo-700">|</span> {businessWebsite}
              </p>
            </div>
            <div className="text-left sm:text-right shrink-0">
              <p className="text-xl sm:text-2xl font-extrabold tracking-[0.2em] bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 bg-clip-text text-transparent dark:from-indigo-400 dark:via-violet-400 dark:to-fuchsia-400">TAX INVOICE</p>
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground justify-start sm:justify-end">
                <InvoiceStatusBadge status={invoice.status} />
                <Link
                  href={`/job-cards/${invoice.jobCardId}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Job {invoice.jobNumber}
                </Link>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono rounded-lg border border-indigo-200/60 dark:border-indigo-800/50 bg-gradient-to-r from-indigo-50/90 to-cyan-50/80 dark:from-indigo-950/50 dark:to-cyan-950/40 px-3 py-2.5 shadow-sm">
            <span className="text-muted-foreground">eBill No: <span className="text-indigo-700 dark:text-indigo-300 font-semibold">{invoice.invoiceNumber}</span></span>
            <span className="text-indigo-200 dark:text-indigo-800 hidden sm:inline">|</span>
            <span className="text-muted-foreground">Booking Ref: <span className="text-violet-700 dark:text-violet-300 font-semibold">{invoice.jobNumber}</span></span>
            <span className="text-indigo-200 dark:text-indigo-800 hidden sm:inline">|</span>
            <span className="text-muted-foreground">Date: <span className="text-cyan-800 dark:text-cyan-300 font-semibold">{formatDate(invoice.createdAt)}</span></span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-indigo-200/50 dark:border-indigo-800/40 overflow-hidden shadow-md shadow-indigo-500/5 border-l-4 border-l-indigo-500">
          <CardHeader className="pb-3 border-b-0 bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-white">Billed to</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-2 text-sm">
            <p className="font-semibold text-foreground">{invoice.customerName}</p>
            <p><span className="text-muted-foreground">Mobile:</span> {invoice.customerPhone}</p>
            <p><span className="text-muted-foreground">Email:</span> {invoiceCustomer?.email ?? "—"}</p>
            <p><span className="text-muted-foreground">Address:</span> {invoiceCustomer?.address ?? "—"}</p>
          </CardContent>
        </Card>
        <Card className="border-cyan-200/50 dark:border-cyan-900/40 overflow-hidden shadow-md shadow-cyan-500/5 border-l-4 border-l-cyan-500">
          <CardHeader className="pb-3 border-b-0 bg-gradient-to-r from-cyan-600 to-teal-600 text-white">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-white">Booking details</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Booking date:</span>{" "}
              {jobCard ? formatDateTime(jobCard.createdAt) : formatDateTime(invoice.createdAt)}
            </p>
            <p><span className="text-muted-foreground">Mode:</span> Visit outlet</p>
            <p>
              <span className="text-muted-foreground">Expected delivery:</span>{" "}
              {jobCard?.expectedDelivery ? formatDateTime(jobCard.expectedDelivery) : "—"}
            </p>
            <p><span className="text-muted-foreground">Vehicle:</span> {vehicleMakeModel}</p>
            <p><span className="text-muted-foreground">Vehicle no:</span> <span className="font-mono font-medium">{invoice.vehicleRegNumber}</span></p>
            {invoice.mechanicName && (
              <p className="text-muted-foreground pt-1">
                Mechanic: <span className="text-foreground font-medium">{invoice.mechanicName}</span>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-indigo-200/40 dark:border-indigo-800/40 shadow-md shadow-indigo-500/10 overflow-hidden">
        <CardHeader className="border-b-0 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 text-white">
          <CardTitle className="text-base text-white">Services &amp; charges</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-indigo-400/30 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm">
                  <th className="text-center font-semibold py-2.5 px-2 w-8 text-white/95">#</th>
                  <th className="text-left font-semibold py-2.5 px-2 text-white/95">Service / description</th>
                  <th className="text-center font-semibold py-2.5 px-2 w-20 text-white/95">HSN/SAC</th>
                  <th className="text-right font-semibold py-2.5 px-2 w-24 text-white/95">Rate (Rs.)</th>
                  <th className="text-right font-semibold py-2.5 px-2 w-20 text-white/95">Discount</th>
                  <th className="text-right font-semibold py-2.5 px-2 w-24 text-white/95">Price</th>
                  <th className="text-center font-semibold py-2.5 px-2 w-14 text-white/95">GST %</th>
                  <th className="text-right font-semibold py-2.5 px-2 w-28 text-white/95">G-Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((item, idx) => {
                  const disc = item.lineDiscount ?? 0;
                  return (
                    <tr key={item.id} className={`border-b border-indigo-100/80 dark:border-indigo-950/50 last:border-0 transition-colors ${idx % 2 === 0 ? "bg-white dark:bg-background" : "bg-indigo-50/50 dark:bg-indigo-950/20"} hover:bg-violet-50/80 dark:hover:bg-violet-950/25`}>
                      <td className="py-2.5 px-2 text-center tabular-nums text-muted-foreground">{idx + 1}</td>
                      <td className="py-2.5 px-2 align-top">
                        <span className="text-foreground">{item.description}</span>
                        <Badge variant="outline" className="ml-2 text-[10px] font-normal align-middle">{item.type}</Badge>
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono text-xs">{item.hsnSac ?? DEFAULT_SERVICE_HSN}</td>
                      <td className="py-2.5 px-2 text-right tabular-nums">{formatCurrency(lineRateDisplay(item))}</td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-muted-foreground">
                        {disc > 0 ? formatCurrency(disc) : "—"}
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums font-medium">{formatCurrency(item.total)}</td>
                      <td className="py-2.5 px-2 text-center">{gstPct}%</td>
                      <td className="py-2.5 px-2 text-right tabular-nums font-semibold text-indigo-700 dark:text-indigo-300">{formatCurrency(lineGrandWithTax(item, invoice))}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-indigo-200/60 dark:border-indigo-800/50 bg-gradient-to-r from-slate-50 to-indigo-50/40 dark:from-slate-900/80 dark:to-indigo-950/40">
                  <td colSpan={7} className="py-2.5 px-4 text-right text-muted-foreground font-medium">
                    Sub-Total
                  </td>
                  <td className="py-2.5 px-2 text-right font-semibold tabular-nums text-foreground">{formatCurrency(invoice.subtotal)}</td>
                </tr>
                {addDisc > 0 && (
                  <tr>
                    <td colSpan={7} className="py-2 px-4 text-right text-muted-foreground">
                      Additional discount
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-amber-700 dark:text-amber-400">
                      -{formatCurrency(addDisc)}
                    </td>
                  </tr>
                )}
                <tr>
                  <td colSpan={7} className="py-2 px-4 text-right text-muted-foreground">
                    Taxable amount
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">{formatCurrency(taxable)}</td>
                </tr>
                <tr className="bg-cyan-50/60 dark:bg-cyan-950/20">
                  <td colSpan={7} className="py-2 px-4 text-right text-cyan-800 dark:text-cyan-300 font-medium">
                    CGST ({gstHalfPercentLabel(invoice.taxRate)})
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums font-semibold text-cyan-800 dark:text-cyan-300">{formatCurrency(cgst)}</td>
                </tr>
                <tr className="bg-sky-50/60 dark:bg-sky-950/20">
                  <td colSpan={7} className="py-2 px-4 text-right text-sky-800 dark:text-sky-300 font-medium">
                    SGST ({gstHalfPercentLabel(invoice.taxRate)})
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums font-semibold text-sky-800 dark:text-sky-300">{formatCurrency(sgst)}</td>
                </tr>
                <tr className="border-t-2 border-indigo-300/60 dark:border-indigo-700 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 text-white shadow-inner">
                  <td colSpan={7} className="py-3 px-4 text-right font-bold text-base text-white">
                    Grand total
                  </td>
                  <td className="py-3 px-2 text-right font-bold text-base tabular-nums text-white">
                    {formatCurrency(invoice.grandTotal)}
                  </td>
                </tr>
                {totalPaid > 0 && (
                  <tr>
                    <td colSpan={7} className="py-2 px-4 text-right text-muted-foreground">
                      Advance paid
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums font-medium">{formatCurrency(totalPaid)}</td>
                  </tr>
                )}
                {remainingBalance > 0 && (
                  <tr>
                    <td colSpan={7} className="py-2 px-4 text-right font-semibold text-amber-700 dark:text-amber-400">
                      Balance due
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums font-bold text-amber-700 dark:text-amber-400">
                      {formatCurrency(remainingBalance)}
                    </td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-violet-200/50 dark:border-violet-900/40 overflow-hidden shadow-md border-l-4 border-l-violet-500">
          <CardHeader className="pb-3 border-b-0 bg-gradient-to-r from-violet-600 to-purple-600 text-white">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-white">Bank details</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-1.5 text-sm text-muted-foreground">
            <p><span className="text-foreground/80">Bank:</span> {bankName}</p>
            <p><span className="text-foreground/80">Branch:</span> {bankBranch}</p>
            <p><span className="text-foreground/80">A/c No:</span> {bankAccountNumber}</p>
            <p><span className="text-foreground/80">IFSC:</span> {bankIfsc}</p>
            <p><span className="text-foreground/80">UPI / PayTM:</span> {bankUpi}</p>
          </CardContent>
        </Card>
        <Card className="border-fuchsia-200/50 dark:border-fuchsia-900/40 overflow-hidden shadow-md border-l-4 border-l-fuchsia-500">
          <CardHeader className="pb-3 border-b-0 bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-white">Company info</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-1.5 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">{businessName}</p>
            <p><span className="text-foreground/80">PAN:</span> {companyPan}</p>
            <p><span className="text-foreground/80">GSTIN:</span> {gstin}</p>
            <p><span className="text-foreground/80">Address:</span> {businessAddress}</p>
            <p><span className="text-foreground/80">Contact:</span> {businessPhone}</p>
          </CardContent>
        </Card>
      </div>

      {(invoice.termsAndConditions || jobCard?.termsAndConditions) && (
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="border-b border-border/80 bg-muted/20">
            <CardTitle className="text-base">Terms & Conditions</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {invoice.termsAndConditions || jobCard?.termsAndConditions}
            </p>
          </CardContent>
        </Card>
      )}

      {(invoice.notes || jobCard?.notes) && (
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="border-b border-border/80 bg-muted/20">
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {invoice.notes || jobCard?.notes}
            </p>
          </CardContent>
        </Card>
      )}

      {invoiceCustomer?.referralCode && (
        <Card className="border-border bg-muted/30 shadow-sm">
          <CardContent className="py-5 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
              Your referral code
            </p>
            <p className="text-2xl font-semibold tracking-wider font-mono border border-dashed border-border rounded-md py-2.5 px-5 inline-block bg-background">
              {invoiceCustomer.referralCode}
            </p>
            <p className="text-sm text-muted-foreground mt-3 max-w-md mx-auto leading-relaxed">
              Share this code with friends. When they book their <span className="font-medium text-foreground">first service</span> using your code, they save{" "}
              <span className="font-semibold text-foreground">{formatCurrency(newCustomerDiscount)}</span> and you receive{" "}
              <span className="font-semibold text-foreground">{formatCurrency(referralRewardAmount)}</span> in your wallet.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/80 bg-muted/20">
          <CardTitle className="text-base">Payment history</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {payments.length === 0 ? (
            <p className="text-muted-foreground text-sm py-2">No payments recorded yet.</p>
          ) : (
            <div className="space-y-0 divide-y divide-border/80">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between py-4 first:pt-0"
                >
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <span className="text-sm text-muted-foreground">
                      {formatDateTime(payment.paidAt)}
                    </span>
                    <PaymentMethodBadge method={payment.method} />
                    {payment.referenceNumber && (
                      <span className="text-xs text-muted-foreground font-mono">
                        {payment.referenceNumber}
                      </span>
                    )}
                  </div>
                  <span className="font-medium">{formatCurrency(payment.amount)}</span>
                </div>
              ))}
              {(invoice.status === "PARTIALLY_PAID" || invoice.status === "ISSUED") &&
                remainingBalance > 0 && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                        Remaining Balance
                      </span>
                      <span className="font-bold">{formatCurrency(remainingBalance)}</span>
                    </div>
                  </>
                )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={recordDialogOpen} onOpenChange={setRecordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (₹)</Label>
              <Input
                id="amount"
                type="number"
                min="1"
                step="0.01"
                placeholder="Enter amount"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>
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
