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
  prefetchInvoicePdf,
  sendInvoiceEmailWithPdf,
  warmInvoicePdfEngine,
  type InvoicePdfOpts,
} from "@/lib/invoice-pdf";
import { buildTaxInvoicePrintHtml } from "@/lib/tax-invoice-format";
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

  const invoicePdfOpts = useMemo((): InvoicePdfOpts | null => {
    if (!invoice) return null;
    return {
      invoice,
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
    const attachmentFilename = `Tax-Invoice-${invoice.invoiceNumber.replace(/[^\w.-]+/g, "_").slice(0, 48)}.pdf`;
    const emailHtml = buildInvoiceEmailHtml({
      customerName: invoice.customerName,
      invoiceNumber: invoice.invoiceNumber,
      businessName,
      grandTotal: invoice.grandTotal,
      remainingBalance,
      vehicleRegNumber: invoice.vehicleRegNumber,
      attachmentFilename,
    });
    const subject = `Tax invoice ${invoice.invoiceNumber} — ${businessName}`;
    const text = [
      buildInvoiceWhatsAppMessage(invoice, { businessName, remainingBalance }),
      "",
      `Your tax invoice is attached as ${attachmentFilename}. Open the PDF to view or download the full invoice.`,
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
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => toast.message("Share", { description: "Coming soon." })}
              >
                Copy link
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
              title="Tax invoice preview"
              className="h-[min(85vh,920px)] w-full border-0"
              srcDoc={previewHtml}
            />
          ) : (
            <p className="p-8 text-sm text-muted-foreground">Loading preview…</p>
          )}
        </div>

        <Card className="border-border shadow-sm lg:sticky lg:top-4">
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
