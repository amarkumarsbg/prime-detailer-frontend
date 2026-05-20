import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  DEFAULT_SERVICE_HSN,
  splitCgstSgst,
  type TaxInvoiceBusinessBlock,
} from "@/lib/tax-invoice-format";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import type { Invoice, JobCard, Payment } from "@/types";

const SLATE: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [71, 85, 105];

export type InvoicePdfOpts = {
  invoice: Invoice;
  jobCard: JobCard | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  vehicleMakeModel: string;
  business: TaxInvoiceBusinessBlock;
  payments: Payment[];
  totalPaid: number;
  remainingBalance: number;
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function invoicePdfFilename(invoiceNumber: string): string {
  const safe = invoiceNumber.replace(/[^\w.-]+/g, "_").slice(0, 48);
  return `Tax-Invoice-${safe}.pdf`;
}

/** Builds a PDF tax invoice for email attachment or local download. */
export function buildInvoicePdfAttachment(opts: InvoicePdfOpts): {
  filename: string;
  content: string;
} {
  const {
    invoice,
    jobCard,
    customerName,
    customerPhone,
    customerEmail,
    customerAddress,
    vehicleMakeModel,
    business,
    payments,
    totalPaid,
    remainingBalance,
  } = opts;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...SLATE);
  doc.text(business.businessName, 14, y);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  y += 6;
  doc.text(business.businessTagline, 14, y);
  y += 5;
  const addrLines = doc.splitTextToSize(business.businessAddress, pageW - 90);
  doc.text(addrLines, 14, y);
  y += addrLines.length * 4.5 + 2;
  doc.text(
    `Phone: ${business.businessPhone}  |  GSTIN: ${business.gstin}`,
    14,
    y
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...SLATE);
  doc.text("TAX INVOICE", pageW - 14, 14, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text(`Invoice: ${invoice.invoiceNumber}`, pageW - 14, 22, { align: "right" });
  doc.text(`Date: ${formatDate(invoice.createdAt)}`, pageW - 14, 27, { align: "right" });
  if (jobCard) {
    doc.text(`Job: ${jobCard.jobNumber}`, pageW - 14, 32, { align: "right" });
  }

  y = Math.max(y + 8, 42);
  doc.setDrawColor(220, 220, 220);
  doc.line(14, y, pageW - 14, y);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...SLATE);
  doc.text("Bill To", 14, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text(customerName, 14, y);
  y += 4;
  doc.text(`Phone: ${customerPhone}`, 14, y);
  y += 4;
  if (customerEmail) {
    doc.text(`Email: ${customerEmail}`, 14, y);
    y += 4;
  }
  if (customerAddress.trim()) {
    const custAddr = doc.splitTextToSize(customerAddress, 85);
    doc.text(custAddr, 14, y);
    y += custAddr.length * 4;
  }
  doc.text(`Vehicle: ${vehicleMakeModel} (${invoice.vehicleRegNumber})`, 14, y + 4);

  const lineBody = invoice.lineItems.map((li, idx) => [
    String(idx + 1),
    li.description,
    li.hsnSac ?? DEFAULT_SERVICE_HSN,
    String(li.quantity),
    formatCurrency(li.unitPrice),
    formatCurrency(li.total),
  ]);

  autoTable(doc, {
    startY: y + 14,
    head: [["#", "Description", "HSN/SAC", "Qty", "Rate", "Amount"]],
    body: lineBody,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: SLATE, textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      2: { cellWidth: 22, halign: "center" },
      3: { cellWidth: 12, halign: "center" },
      4: { halign: "right" },
      5: { halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });

  const tableEnd = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
    ?.finalY;
  y = (tableEnd ?? y) + 8;

  const { cgst, sgst } = splitCgstSgst(invoice.taxAmount);
  const gstPct = Math.round(invoice.taxRate * 100);
  const totalsX = pageW - 14;
  const labelX = pageW - 72;

  const addTotalRow = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(9);
    doc.setTextColor(...(bold ? SLATE : MUTED));
    doc.text(label, labelX, y);
    doc.text(value, totalsX, y, { align: "right" });
    y += 5;
  };

  addTotalRow("Subtotal", formatCurrency(invoice.subtotal));
  if (invoice.discountAmount > 0) {
    addTotalRow("Discount", `−${formatCurrency(invoice.discountAmount)}`);
  }
  addTotalRow(`CGST (${gstPct / 2}%)`, formatCurrency(cgst));
  addTotalRow(`SGST (${gstPct / 2}%)`, formatCurrency(sgst));
  addTotalRow("Grand Total", formatCurrency(invoice.grandTotal), true);
  addTotalRow("Paid", formatCurrency(totalPaid));
  addTotalRow("Balance Due", formatCurrency(remainingBalance), true);

  if (payments.length > 0) {
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...SLATE);
    doc.text("Payment history", 14, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    for (const p of payments) {
      doc.text(
        `${formatDateTime(p.paidAt)} · ${p.method}${p.referenceNumber ? ` · ${p.referenceNumber}` : ""} — ${formatCurrency(p.amount)}`,
        14,
        y
      );
      y += 4;
    }
  }

  y += 6;
  doc.setFontSize(8);
  doc.text(
    `Bank: ${business.bankName} (${business.bankBranch}) · A/C ${business.bankAccountNumber} · IFSC ${business.bankIfsc} · UPI ${business.bankUpi}`,
    14,
    y,
    { maxWidth: pageW - 28 }
  );
  y += 8;
  doc.setFontSize(7);
  doc.text(
    "Computer-generated tax invoice. Please retain this PDF for your records.",
    14,
    y,
    { maxWidth: pageW - 28 }
  );

  const filename = invoicePdfFilename(invoice.invoiceNumber);
  const content = arrayBufferToBase64(doc.output("arraybuffer"));
  return { filename, content };
}

export function downloadInvoicePdf(opts: InvoicePdfOpts): void {
  const { filename, content } = buildInvoicePdfAttachment(opts);
  const binary = atob(content);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
