import jsPDF from "jspdf";
import {
  buildTaxInvoicePrintHtml,
  type TaxInvoiceDocumentOpts,
} from "@/lib/tax-invoice-format";

export type InvoicePdfOpts = TaxInvoiceDocumentOpts;

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

/** Renders the same HTML as Print into a multi-page A4 PDF. */
async function renderTaxInvoiceHtmlToPdf(html: string): Promise<jsPDF> {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    left: "-12000px",
    top: "0",
    width: "800px",
    height: "0",
    border: "none",
    visibility: "hidden",
  });
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) throw new Error("Could not render invoice PDF");

    iframe.srcdoc = html;
    await new Promise<void>((resolve) => {
      iframe.onload = () => resolve();
      setTimeout(resolve, 500);
    });

    const body = doc.body;
    if (!body) throw new Error("Invoice document body missing");

    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(body, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      windowWidth: 800,
      width: body.scrollWidth,
      height: body.scrollHeight,
    });

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * contentWidth) / canvas.width;
    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    const pageContentHeight = pageHeight - margin * 2;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "JPEG", margin, margin, contentWidth, imgHeight);
    heightLeft -= pageContentHeight;

    while (heightLeft > 0) {
      position -= pageContentHeight;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", margin, position + margin, contentWidth, imgHeight);
      heightLeft -= pageContentHeight;
    }

    return pdf;
  } finally {
    document.body.removeChild(iframe);
  }
}

/**
 * PDF attachment for customer email — same layout as Print / on-screen tax invoice.
 */
export async function buildInvoicePdfAttachment(opts: InvoicePdfOpts): Promise<{
  filename: string;
  content: string;
}> {
  const html = buildTaxInvoicePrintHtml(opts, { includePrintScript: false });
  const pdf = await renderTaxInvoiceHtmlToPdf(html);
  const filename = invoicePdfFilename(opts.invoice.invoiceNumber);
  const content = arrayBufferToBase64(pdf.output("arraybuffer"));
  return { filename, content };
}

export async function downloadInvoicePdf(opts: InvoicePdfOpts): Promise<void> {
  const { filename, content } = await buildInvoicePdfAttachment(opts);
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
