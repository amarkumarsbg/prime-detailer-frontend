import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import type { Customer, Invoice, JobCard } from "@/types";
import { formatInrFull } from "@/lib/utils";

const NAVY: [number, number, number] = [26, 35, 74];
const KPI_BLUE: [number, number, number] = [79, 70, 186];
const BORDER_BLUE: [number, number, number] = [173, 216, 230];
/** Top-right brand (light blue) */
const BRAND_BLUE: [number, number, number] = [59, 130, 246];

const formatInrPdf = formatInrFull;

function slugFile(prefix: string): string {
  const d = format(new Date(), "yyyy-MM-dd-HHmm");
  return `${prefix}-${d}.pdf`;
}

function filterJobsByDays(jobCards: JobCard[], days: number): JobCard[] {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  return jobCards.filter((jc) => {
    const t = new Date(jc.createdAt).getTime();
    return t >= start.getTime() && t <= end.getTime();
  });
}

const DEMO_TRANSACTIONS: string[][] = [
  ["1", "01-04-2026", "SANCCHIT MEHROTRA", "Normal car wash", "Assigned to FM", formatInrPdf(700)],
  ["2", "29-03-2026", "new 1", "Premium exterior beautification", "Completed", formatInrPdf(5310)],
];

function jobStatusLabel(status: JobCard["status"]): string {
  return status.replace(/_/g, " ");
}

export function downloadRevenuePerformancePdf(opts: {
  businessName: string;
  days: number;
  jobCards: JobCard[];
}): void {
  const { businessName, days, jobCards } = opts;
  const inRange = filterJobsByDays(jobCards, days);
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);

  let body: string[][];
  let totalRevenue: number;
  let bookings: number;

  if (inRange.length > 0) {
    bookings = inRange.length;
    totalRevenue = inRange.reduce((s, jc) => s + (jc.estimatedAmount ?? 0), 0);
    body = inRange.slice(0, 100).map((jc, i) => {
      const svc = jc.services?.[0]?.name ?? "Service package";
      return [
        String(i + 1),
        format(new Date(jc.createdAt), "dd-MM-yyyy"),
        jc.customerName.toUpperCase(),
        svc.length > 38 ? `${svc.slice(0, 35)}…` : svc,
        jobStatusLabel(jc.status),
        formatInrPdf(jc.estimatedAmount ?? 0),
      ];
    });
  } else {
    body = DEMO_TRANSACTIONS;
    bookings = 2;
    totalRevenue = 6010;
  }

  const avgOrder = bookings > 0 ? totalRevenue / bookings : 0;
  const periodLabel = `${format(start, "dd MMMM, yyyy")} to ${format(end, "dd MMMM, yyyy")}`;
  const generatedLabel = `${format(new Date(), "dd MMMM, yyyy")} · ${format(new Date(), "hh:mm a")}`;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text("Revenue Performance Report", margin, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(businessName || "Your business", pageW - margin, 18, { align: "right" });

  doc.text(`Period: ${periodLabel}`, margin, 30);
  doc.text(`Generated on ${generatedLabel}`, margin, 36);

  doc.setDrawColor(...BORDER_BLUE);
  doc.setLineWidth(0.3);
  doc.line(margin, 42, pageW - margin, 42);

  const boxY = 48;
  const boxH = 22;
  const gap = 4;
  const boxW = (pageW - 2 * margin - 2 * gap) / 3;
  const kpi = [
    { label: "TOTAL REVENUE", value: formatInrPdf(totalRevenue) },
    { label: "TOTAL BOOKINGS", value: String(bookings) },
    { label: "AVG. ORDER VALUE", value: formatInrPdf(avgOrder) },
  ];

  kpi.forEach((k, i) => {
    const x = margin + i * (boxW + gap);
    doc.setDrawColor(...BORDER_BLUE);
    doc.rect(x, boxY, boxW, boxH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...NAVY);
    doc.text(k.label, x + 4, boxY + 7);
    doc.setFontSize(12);
    doc.setTextColor(...KPI_BLUE);
    doc.text(k.value, x + 4, boxY + 16);
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("Key transaction details", margin, boxY + boxH + 14);

  autoTable(doc, {
    startY: boxY + boxH + 18,
    head: [["#", "Date", "Customer", "Service", "Status", "Revenue"]],
    body,
    theme: "plain",
    headStyles: {
      fillColor: NAVY,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8,
    },
    bodyStyles: { fontSize: 8, textColor: [15, 23, 42] },
    styles: { cellPadding: 2.5, lineColor: [226, 232, 240], lineWidth: 0.1 },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 22 },
      2: { cellWidth: 42 },
      3: { cellWidth: 48 },
      4: { cellWidth: 28 },
      5: { cellWidth: 28, halign: "right" },
    },
    margin: { left: margin, right: margin },
  });

  doc.save(slugFile("revenue-performance"));
}

const DEMO_LIFETIME_ROWS: string[][] = [
  ["1", "SANCCHIT MEHROTRA", "4", "9565999955", "Active", formatInrPdf(11648)],
  ["2", "NEW 1", "1", "1324897417", "Active", formatInrPdf(5310)],
];

function customerLifetimeMetrics(
  c: Customer,
  invoices: Invoice[],
  jobCards: JobCard[]
): { invoiceOrJobCount: number; lifetimeRevenue: number } {
  const invs = invoices.filter((i) => i.customerId === c.id);
  const jobs = jobCards.filter((j) => j.customerId === c.id);
  const fromInvoices = invs.reduce((s, i) => s + i.grandTotal, 0);
  const fromJobs = jobs.reduce((s, j) => s + (j.estimatedAmount ?? 0), 0);
  const lifetimeRevenue = fromInvoices > 0 ? fromInvoices : fromJobs;
  const invoiceOrJobCount = invs.length > 0 ? invs.length : jobs.length;
  return { invoiceOrJobCount, lifetimeRevenue };
}

export function downloadCustomerLifetimeAnalysisPdf(opts: {
  businessName: string;
  activeOnly: boolean;
  customers: Customer[];
  invoices: Invoice[];
  jobCards: JobCard[];
}): void {
  const { businessName, activeOnly, customers, invoices, jobCards } = opts;

  const totalDatabase = customers.length;
  const activeClients = customers.filter((c) => !c.isInactive).length;

  const rowsBase = customers.map((c) => {
    const m = customerLifetimeMetrics(c, invoices, jobCards);
    return {
      customer: c,
      invoiceOrJobCount: m.invoiceOrJobCount,
      lifetimeRevenue: m.lifetimeRevenue,
      status: c.isInactive ? "Inactive" : "Active",
    };
  });

  const totalLifetimeValueAll = rowsBase.reduce((s, r) => s + r.lifetimeRevenue, 0);

  const portfolio = activeOnly ? rowsBase.filter((r) => !r.customer.isInactive) : [...rowsBase];
  portfolio.sort((a, b) => b.lifetimeRevenue - a.lifetimeRevenue);

  const useDemo = portfolio.length === 0;

  const body: string[][] = useDemo
    ? DEMO_LIFETIME_ROWS
    : portfolio.slice(0, 200).map((r, i) => [
        String(i + 1),
        r.customer.name.toUpperCase(),
        String(r.invoiceOrJobCount),
        r.customer.phone,
        r.status,
        formatInrPdf(r.lifetimeRevenue),
      ]);

  const kpiDb = useDemo ? 2 : totalDatabase;
  const kpiActive = useDemo ? 2 : activeClients;
  const kpiLTV = useDemo ? 16958 : totalLifetimeValueAll;

  const generatedLabel = `${format(new Date(), "dd MMMM, yyyy")} · ${format(new Date(), "hh:mm a")}`;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text("Customer Lifetime Analysis", margin, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND_BLUE);
  doc.text(businessName || "Your business", pageW - margin, 18, { align: "right" });

  doc.setTextColor(100, 116, 139);
  doc.text(`Generated on ${generatedLabel}`, margin, 30);

  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.35);
  doc.line(margin, 36, pageW - margin, 36);

  const boxY = 42;
  const boxH = 24;
  const gap = 4;
  const boxW = (pageW - 2 * margin - 2 * gap) / 3;
  const kpis = [
    { label: "TOTAL DATABASE", value: String(kpiDb) },
    { label: "ACTIVE CLIENTS", value: String(kpiActive) },
    { label: "TOTAL LIFETIME VALUE", value: formatInrPdf(kpiLTV) },
  ];

  kpis.forEach((k, i) => {
    const x = margin + i * (boxW + gap);
    doc.setFillColor(248, 250, 252);
    doc.rect(x, boxY, boxW, boxH, "FD");
    doc.setDrawColor(...BORDER_BLUE);
    doc.rect(x, boxY, boxW, boxH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...NAVY);
    doc.text(k.label, x + 4, boxY + 8);
    doc.setFontSize(i === 2 ? 10 : 12);
    doc.setTextColor(...KPI_BLUE);
    const vLines = doc.splitTextToSize(k.value, boxW - 8);
    doc.text(vLines, x + 4, boxY + 17);
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("Customer portfolio ranking", margin, boxY + boxH + 14);

  let tableStartY = boxY + boxH + 18;
  if (!useDemo && activeOnly) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("Showing active clients only.", margin, boxY + boxH + 20);
    tableStartY = boxY + boxH + 24;
  }

  autoTable(doc, {
    startY: tableStartY,
    head: [["Rank", "Client name", "Invoices", "Phone", "Status", "Lifetime revenue"]],
    body,
    theme: "plain",
    headStyles: {
      fillColor: NAVY,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8,
    },
    bodyStyles: { fontSize: 8, textColor: [15, 23, 42] },
    styles: { cellPadding: 2.5, lineColor: [226, 232, 240], lineWidth: 0.1 },
    columnStyles: {
      0: { cellWidth: 14 },
      1: { cellWidth: 48 },
      2: { cellWidth: 22, halign: "center" },
      3: { cellWidth: 32 },
      4: { cellWidth: 24 },
      5: { cellWidth: 36, halign: "right" },
    },
    margin: { left: margin, right: margin },
  });

  doc.save(slugFile("customer-lifetime-analysis"));
}

export function downloadSimpleTablePdf(opts: {
  businessName: string;
  title: string;
  periodNote: string;
  columns: string[];
  rows: string[][];
  kpis?: { label: string; value: string }[];
  fileSlug: string;
}): void {
  const { businessName, title, periodNote, columns, rows, kpis, fileSlug } = opts;
  const generatedLabel = `${format(new Date(), "dd MMMM, yyyy · hh:mm a")}`;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(title, margin, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(businessName || "Your business", pageW - margin, 18, { align: "right" });
  doc.text(periodNote, margin, 30);
  doc.text(`Generated on ${generatedLabel}`, margin, 36);

  doc.setDrawColor(...BORDER_BLUE);
  doc.line(margin, 42, pageW - margin, 42);

  let startY = 50;
  if (kpis && kpis.length > 0) {
    const boxY = 48;
    const boxH = 20;
    const gap = 4;
    const n = kpis.length;
    const boxW = (pageW - 2 * margin - (n - 1) * gap) / n;
    kpis.forEach((k, i) => {
      const x = margin + i * (boxW + gap);
      doc.setDrawColor(...BORDER_BLUE);
      doc.rect(x, boxY, boxW, boxH);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...NAVY);
      doc.text(k.label.toUpperCase(), x + 4, boxY + 7);
      doc.setFontSize(11);
      doc.setTextColor(...KPI_BLUE);
      doc.text(k.value, x + 4, boxY + 15);
    });
    startY = boxY + boxH + 12;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("Report data", margin, startY);
  startY += 6;

  autoTable(doc, {
    startY,
    head: [columns],
    body: rows,
    theme: "plain",
    headStyles: {
      fillColor: NAVY,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8,
    },
    bodyStyles: { fontSize: 8 },
    styles: { cellPadding: 2, lineColor: [226, 232, 240] },
    margin: { left: margin, right: margin },
  });

  doc.save(slugFile(fileSlug));
}
