import type { Invoice, InvoiceLineItem, JobCard, Payment } from "@/types";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

/** Default SAC for motor vehicle repair / maintenance services (demo). */
export const DEFAULT_SERVICE_HSN = "998714";

export const TAX_INVOICE_DISCLAIMER = `No detailing service is perfect. Most complaints arise from pre-existing conditions that become visible after cleaning. Our team is not liable for any mechanical or electrical issues revealed post-service. Sensitive areas (engine bay, infotainment, cameras) are avoided. Your presence during the service is required. Please remove all valuables before handover.
(a) GST invoice provided digitally. (b) Services subject to availability. (c) Advance is non-refundable on customer cancellation. (d) Pickup/visit charges: Rs. 200 min + Rs. 10/km beyond 10 km.
This is a computer-generated document. No signature required.  |  Quality Never Goes Out of Cost — Prime Detailers`;

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function splitCgstSgst(taxAmount: number): { cgst: number; sgst: number } {
  const half = taxAmount / 2;
  return { cgst: half, sgst: half };
}

export function gstHalfPercentLabel(taxRate: number): string {
  return `${Math.round(taxRate * 50)}%`;
}

/** List / MRP style rate before line discount (falls back to line total when no line discount). */
export function lineRateDisplay(li: InvoiceLineItem): number {
  const d = li.lineDiscount ?? 0;
  return li.total + d;
}

export function lineGrandWithTax(
  li: InvoiceLineItem,
  invoice: Invoice
): number {
  if (invoice.subtotal <= 0) return li.total;
  return li.total + (invoice.taxAmount * li.total) / invoice.subtotal;
}

/** Net value before GST (matches line subtotal minus invoice-level reductions). */
export function netTaxableForDisplay(invoice: Invoice): number {
  return invoice.grandTotal - invoice.taxAmount;
}

/** Sum of invoice discount, rewards, referral, wallet (derived so it ties to totals). */
export function additionalDiscountTotal(invoice: Invoice): number {
  return invoice.subtotal - invoice.grandTotal + invoice.taxAmount;
}

export interface TaxInvoiceBusinessBlock {
  businessName: string;
  businessTagline: string;
  businessAddress: string;
  businessPhone: string;
  businessWhatsApp: string;
  businessEmail: string;
  businessWebsite: string;
  gstin: string;
  companyPan: string;
  bankName: string;
  bankBranch: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankUpi: string;
}

export function buildTaxInvoicePrintHtml(opts: {
  invoice: Invoice;
  jobCard: JobCard | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  customerWhatsApp?: string;
  vehicleMakeModel: string;
  business: TaxInvoiceBusinessBlock;
  payments: Payment[];
  totalPaid: number;
  remainingBalance: number;
  /** Shown in booking details; default Visit Outlet */
  serviceModeLabel?: string;
  /** Referral promo block (matches on-screen invoice) */
  referralCode?: string;
  referralRewardAmount?: number;
  newCustomerDiscount?: number;
}): string {
  const {
    invoice,
    jobCard,
    customerName,
    customerPhone,
    customerEmail,
    customerAddress,
    customerWhatsApp,
    vehicleMakeModel,
    business,
    payments,
    totalPaid,
    remainingBalance,
    serviceModeLabel = "Visit Outlet",
    referralCode,
    referralRewardAmount = 0,
    newCustomerDiscount = 0,
  } = opts;

  const { cgst, sgst } = splitCgstSgst(invoice.taxAmount);
  const gstPct = Math.round(invoice.taxRate * 100);
  const bookingRef = jobCard?.jobNumber ?? invoice.jobNumber;
  const bookingWhen = jobCard
    ? formatDateTime(jobCard.createdAt)
    : formatDateTime(invoice.createdAt);
  const expectedDel = jobCard?.expectedDelivery
    ? formatDateTime(jobCard.expectedDelivery)
    : "—";
  const additionalOff = additionalDiscountTotal(invoice);
  const taxable = netTaxableForDisplay(invoice);
  const termsText = TAX_INVOICE_DISCLAIMER;
  const notesText =
    [invoice.notes, jobCard?.notes, invoice.termsAndConditions, jobCard?.termsAndConditions]
      .filter((x): x is string => Boolean(x && x.trim()))
      .join("\n\n") || undefined;
  const termsHtml = escapeHtml(termsText).replace(/\n/g, "<br>");
  const notesHtml = notesText
    ? `<br><br><strong>Notes</strong><br>${escapeHtml(notesText).replace(/\n/g, "<br>")}`
    : "";

  const referralTrim = referralCode?.trim();
  const referralBlockHtml =
    referralTrim
      ? `<div class="referral-box">
  <p class="ref-title">YOUR REFERRAL CODE</p>
  <p class="ref-code">${escapeHtml(referralTrim)}</p>
  <p class="ref-note">Share this code with friends. When they book their <strong>first service</strong> using your code, they save <span class="ref-save">${formatCurrency(newCustomerDiscount)}</span> and you receive <span class="ref-earn">${formatCurrency(referralRewardAmount)}</span> in your wallet.</p>
</div>`
      : "";

  const lineRows =
    invoice.lineItems
      .map((li, idx) => {
        const hsn = li.hsnSac ?? DEFAULT_SERVICE_HSN;
        const disc = li.lineDiscount ?? 0;
        const gTot = lineGrandWithTax(li, invoice);
        return `<tr>
        <td class="c">${idx + 1}</td>
        <td class="desc">${escapeHtml(li.description)}</td>
        <td class="c">${hsn}</td>
        <td class="r">${formatCurrency(lineRateDisplay(li))}</td>
        <td class="r">${disc > 0 ? formatCurrency(disc) : "—"}</td>
        <td class="r">${formatCurrency(li.total)}</td>
        <td class="c">${gstPct}%</td>
        <td class="r b">${formatCurrency(gTot)}</td>
      </tr>`;
      })
      .join("") ?? "";

  const payRows =
    payments.length > 0
      ? payments
          .map(
            (p) => `<div class="pay-row"><span>${formatDateTime(p.paidAt)} · ${escapeHtml(p.method)}${p.referenceNumber ? ` · ${escapeHtml(p.referenceNumber)}` : ""}</span><span>${formatCurrency(p.amount)}</span></div>`
          )
          .join("")
      : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Tax Invoice ${escapeHtml(invoice.invoiceNumber)}</title>
<style>
@page { margin: 12mm; size: A4; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Segoe UI', system-ui, sans-serif; font-size: 11px; color: #171717; background: #ffffff; line-height: 1.35; }
.wrap { max-width: 800px; margin: 0 auto; padding: 8px 0 24px; }
.top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding-bottom: 14px; margin-bottom: 12px; border-bottom: 1px solid #d4d4d4; }
.brand-name { font-size: 18px; font-weight: 700; color: #171717; letter-spacing: -0.2px; }
.brand-sub { font-size: 10px; color: #525252; font-weight: 500; margin-top: 2px; }
.brand-addr { font-size: 10px; color: #404040; margin-top: 6px; max-width: 380px; }
.brand-contact { font-size: 10px; color: #525252; margin-top: 4px; }
.tax-title { font-size: 18px; font-weight: 700; color: #171717; letter-spacing: 0.12em; text-align: right; }
.meta-bar { display: flex; flex-wrap: wrap; gap: 12px 24px; font-size: 10px; margin-bottom: 12px; padding: 10px 12px; background: #fafafa; border: 1px solid #e5e5e5; border-radius: 4px; }
.meta-bar span { font-weight: 600; color: #262626; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
.box { border: 1px solid #d4d4d4; border-radius: 4px; overflow: hidden; min-height: 120px; background: #ffffff; }
.box-inner { padding: 10px 12px 12px; }
.box-inner p:first-of-type { margin-top: 0; }
.box h3 { font-size: 9px; font-weight: 700; letter-spacing: 0.08em; margin: 0; padding: 8px 12px; color: #fff; background: #404040; text-transform: uppercase; }
.box.box-alt h3 { background: #525252; }
.box p { font-size: 10px; color: #404040; margin-bottom: 3px; }
.box .lbl { color: #737373; font-size: 9px; }
table.inv { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 10px; border: 1px solid #d4d4d4; }
table.inv th { background: #f5f5f5; border: 1px solid #d4d4d4; padding: 8px 4px; font-weight: 600; text-align: center; color: #171717; }
table.inv th.desc { text-align: left; }
table.inv td { border: 1px solid #e5e5e5; padding: 6px 4px; vertical-align: top; color: #262626; }
table.inv tbody tr:nth-child(even) { background: #fafafa; }
table.inv tbody tr:nth-child(odd) { background: #fff; }
table.inv td.desc { text-align: left; }
table.inv .c { text-align: center; }
table.inv .r { text-align: right; font-variant-numeric: tabular-nums; }
table.inv .b { font-weight: 700; color: #171717; }
.tot-wrap { display: flex; justify-content: flex-end; margin-bottom: 12px; }
.tot { width: 300px; font-size: 10px; padding: 12px 14px; border-radius: 4px; background: #fafafa; border: 1px solid #d4d4d4; }
.tot-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e5e5e5; color: #404040; }
.tot-row span:last-child { font-weight: 600; color: #171717; }
.tot-row.grand { font-weight: 700; font-size: 12px; border: none; margin-top: 6px; padding: 10px 12px; border-radius: 4px; background: #f5f5f5; border: 1px solid #d4d4d4; color: #171717 !important; }
.tot-row.grand span { color: #171717 !important; }
.tot-row.cgst { color: #404040; }
.tot-row.cgst span:last-child { color: #171717; }
.tot-row.sgst { color: #404040; }
.tot-row.sgst span:last-child { color: #171717; }
.tot-row.balance { font-weight: 700; color: #171717; }
.tot-row.balance span:last-child { color: #171717; }
.bank-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px; font-size: 10px; }
.bank-grid .box { min-height: auto; }
.bank-grid h3 { margin-bottom: 0; }
.disclaimer { margin-top: 14px; padding: 12px 14px; border: 1px solid #e5e5e5; border-radius: 4px; background: #fafafa; font-size: 9px; color: #525252; line-height: 1.55; white-space: pre-wrap; }
.disclaimer strong { color: #171717; font-size: 10px; }
.pay-block { margin-top: 10px; font-size: 10px; padding: 10px 12px; border-radius: 4px; background: #fafafa; border: 1px dashed #a3a3a3; color: #404040; }
.pay-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #d4d4d4; }
.referral-box { margin-top: 12px; margin-bottom: 12px; padding: 12px 14px; border: 1px solid #d4d4d4; border-radius: 4px; background: #fafafa; text-align: center; page-break-inside: avoid; }
.ref-title { font-size: 8px; font-weight: 600; letter-spacing: 0.06em; color: #737373; margin-bottom: 6px; text-transform: uppercase; }
.ref-code { font-size: 18px; font-weight: 600; font-family: ui-monospace, Consolas, monospace; letter-spacing: 0.08em; color: #171717; margin: 0 0 8px; }
.ref-note { font-size: 9px; color: #525252; line-height: 1.5; max-width: 520px; margin: 0 auto; }
.ref-save, .ref-earn { color: #404040; font-weight: 600; }
@media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
</style></head><body>
<div class="wrap">
  <div class="top">
    <div>
      <div class="brand-name">${escapeHtml(business.businessName)}</div>
      <div class="brand-sub">${escapeHtml(business.businessTagline)}</div>
      <div class="brand-addr">${escapeHtml(business.businessAddress)}</div>
      <div class="brand-contact">Phone: ${escapeHtml(business.businessPhone)} &nbsp;|&nbsp; WhatsApp: ${escapeHtml(business.businessWhatsApp)}<br>
      Email: ${escapeHtml(business.businessEmail)} &nbsp;|&nbsp; ${escapeHtml(business.businessWebsite)}</div>
    </div>
    <div class="tax-title">TAX INVOICE</div>
  </div>

  <div class="meta-bar">
    <span>eBill No: ${escapeHtml(invoice.invoiceNumber)}</span>
    <span>Booking Ref: ${escapeHtml(bookingRef)}</span>
    <span>Date: ${escapeHtml(formatDate(invoice.createdAt))}</span>
  </div>

  <div class="two-col">
    <div class="box">
      <h3>BILLED TO</h3>
      <div class="box-inner">
      <p style="font-weight:700;font-size:11px;">${escapeHtml(customerName)}</p>
      <p><span class="lbl">Mobile:</span> ${escapeHtml(customerPhone)}</p>
      ${customerWhatsApp ? `<p><span class="lbl">WhatsApp:</span> ${escapeHtml(customerWhatsApp)}</p>` : ""}
      <p><span class="lbl">Email:</span> ${escapeHtml(customerEmail || "—")}</p>
      <p><span class="lbl">Address:</span> ${escapeHtml(customerAddress || "—")}</p>
      </div>
    </div>
    <div class="box box-alt">
      <h3>BOOKING DETAILS</h3>
      <div class="box-inner">
      <p><span class="lbl">Booking Date:</span> ${escapeHtml(bookingWhen)}</p>
      <p><span class="lbl">Mode:</span> ${escapeHtml(serviceModeLabel)}</p>
      <p><span class="lbl">Expected Delivery:</span> ${escapeHtml(expectedDel)}</p>
      <p><span class="lbl">Vehicle:</span> ${escapeHtml(vehicleMakeModel)}</p>
      <p><span class="lbl">Vehicle No:</span> ${escapeHtml(invoice.vehicleRegNumber)}</p>
      </div>
    </div>
  </div>

  <table class="inv">
    <thead>
      <tr>
        <th style="width:28px">#</th>
        <th class="desc">Service / Description</th>
        <th style="width:52px">HSN/SAC</th>
        <th style="width:72px">Rate (Rs.)</th>
        <th style="width:64px">Discount</th>
        <th style="width:72px">Price</th>
        <th style="width:44px">GST %</th>
        <th style="width:80px">G-Total</th>
      </tr>
    </thead>
    <tbody>${lineRows}</tbody>
  </table>

  <div class="tot-wrap">
    <div class="tot">
      <div class="tot-row"><span>Sub-Total:</span><span>${formatCurrency(invoice.subtotal)}</span></div>
      ${additionalOff > 0 ? `<div class="tot-row"><span>Additional Discount:</span><span>- ${formatCurrency(additionalOff)}</span></div>` : ""}
      <div class="tot-row"><span>Taxable Amount:</span><span>${formatCurrency(taxable)}</span></div>
      <div class="tot-row cgst"><span>CGST (${gstHalfPercentLabel(invoice.taxRate)}):</span><span>${formatCurrency(cgst)}</span></div>
      <div class="tot-row sgst"><span>SGST (${gstHalfPercentLabel(invoice.taxRate)}):</span><span>${formatCurrency(sgst)}</span></div>
      <div class="tot-row grand"><span>GRAND TOTAL:</span><span>${formatCurrency(invoice.grandTotal)}</span></div>
      ${totalPaid > 0 ? `<div class="tot-row"><span>Advance Paid:</span><span>${formatCurrency(totalPaid)}</span></div>` : ""}
      ${remainingBalance > 0 ? `<div class="tot-row balance"><span>Balance Due:</span><span>${formatCurrency(remainingBalance)}</span></div>` : ""}
    </div>
  </div>

  ${payments.length > 0 ? `<div class="pay-block"><strong>Payments</strong>${payRows}</div>` : ""}

  ${referralBlockHtml}

  <div class="bank-grid">
    <div class="box">
      <h3>BANK DETAILS</h3>
      <div class="box-inner">
      <p><span class="lbl">Bank:</span> ${escapeHtml(business.bankName)}</p>
      <p><span class="lbl">Branch:</span> ${escapeHtml(business.bankBranch)}</p>
      <p><span class="lbl">A/c No:</span> ${escapeHtml(business.bankAccountNumber)}</p>
      <p><span class="lbl">IFSC:</span> ${escapeHtml(business.bankIfsc)}</p>
      <p><span class="lbl">UPI / PayTM:</span> ${escapeHtml(business.bankUpi)}</p>
      </div>
    </div>
    <div class="box box-alt">
      <h3>COMPANY INFO</h3>
      <div class="box-inner">
      <p style="font-weight:600;">${escapeHtml(business.businessName)}</p>
      <p><span class="lbl">PAN:</span> ${escapeHtml(business.companyPan)}</p>
      <p><span class="lbl">GSTIN:</span> ${escapeHtml(business.gstin)}</p>
      <p><span class="lbl">Address:</span> ${escapeHtml(business.businessAddress)}</p>
      <p><span class="lbl">Contact:</span> ${escapeHtml(business.businessPhone)}</p>
      </div>
    </div>
  </div>

  <div class="disclaimer"><strong>DISCLAIMER & TERMS</strong><br><br>${termsHtml}${notesHtml}</div>
</div>
<script>window.onload=function(){window.print();}</script>
</body></html>`;
}

/** Short HTML body for customer email — full invoice is attached as PDF. */
export function buildInvoiceEmailHtml(opts: {
  customerName: string;
  invoiceNumber: string;
  businessName: string;
  grandTotal: number;
  remainingBalance: number;
  vehicleRegNumber: string;
  attachmentFilename: string;
}): string {
  const {
    customerName,
    invoiceNumber,
    businessName,
    grandTotal,
    remainingBalance,
    vehicleRegNumber,
    attachmentFilename,
  } = opts;
  const balanceNote =
    remainingBalance > 0
      ? `<p style="margin:0 0 12px;color:#404040;">Balance due: <strong>${formatCurrency(remainingBalance)}</strong></p>`
      : `<p style="margin:0 0 12px;color:#166534;">This invoice is paid in full. Thank you!</p>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Segoe UI,system-ui,sans-serif;font-size:14px;color:#171717;line-height:1.5;margin:0;padding:24px;">
<p style="margin:0 0 12px;">Dear ${escapeHtml(customerName)},</p>
<p style="margin:0 0 12px;color:#404040;">Please find your tax invoice <strong>${escapeHtml(invoiceNumber)}</strong> from <strong>${escapeHtml(businessName)}</strong> attached to this email.</p>
<p style="margin:0 0 8px;color:#404040;">Vehicle: <strong>${escapeHtml(vehicleRegNumber)}</strong></p>
<p style="margin:0 0 8px;color:#404040;">Grand total: <strong>${formatCurrency(grandTotal)}</strong></p>
${balanceNote}
<p style="margin:0 0 16px;padding:12px 14px;background:#f5f5f5;border:1px solid #e5e5e5;border-radius:6px;color:#262626;">
  <strong>Download your invoice:</strong> Open the attachment <strong>${escapeHtml(attachmentFilename)}</strong> to view, save, or print the full tax invoice (line items, GST, and bank details).
</p>
<p style="margin:0;color:#737373;font-size:12px;">If you have questions, reply to this email or contact ${escapeHtml(businessName)}.</p>
</body></html>`;
}
