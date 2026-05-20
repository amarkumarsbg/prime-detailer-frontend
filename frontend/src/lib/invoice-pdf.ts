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

function waitForLayout(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

/**
 * Renders print HTML in the main document (not an iframe) so html2canvas
 * does not throw "document is not attached to a window".
 */
async function renderTaxInvoiceHtmlToPdf(html: string): Promise<jsPDF> {
  if (typeof document === "undefined" || !document.body) {
    throw new Error("Invoice PDF can only be generated in the browser");
  }

  const parsed = new DOMParser().parseFromString(html, "text/html");
  const styleText = Array.from(parsed.querySelectorAll("style"))
    .map((el) => el.textContent ?? "")
    .join("\n");

  const host = document.createElement("div");
  host.setAttribute("data-invoice-pdf-host", "true");
  host.setAttribute("aria-hidden", "true");
  Object.assign(host.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: "800px",
    maxWidth: "800px",
    background: "#ffffff",
    color: "#171717",
    zIndex: "2147483646",
    pointerEvents: "none",
    overflow: "visible",
  });

  if (styleText.trim()) {
    const styleEl = document.createElement("style");
    styleEl.textContent = styleText;
    host.appendChild(styleEl);
  }

  const surface = document.createElement("div");
  const wrap = parsed.body.querySelector(".wrap");
  if (wrap) {
    surface.appendChild(wrap.cloneNode(true));
  } else {
    surface.innerHTML = parsed.body.innerHTML;
  }
  host.appendChild(surface);

  document.body.appendChild(host);

  try {
    await waitForLayout();
    await new Promise((r) => setTimeout(r, 150));

    const captureWidth = Math.max(host.scrollWidth, 800);
    const captureHeight = host.scrollHeight;

    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(host, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      width: captureWidth,
      height: captureHeight,
      windowWidth: captureWidth,
      windowHeight: captureHeight,
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0,
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
    host.remove();
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
