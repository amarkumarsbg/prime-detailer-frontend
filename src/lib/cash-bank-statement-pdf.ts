import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import type { CashBankTransaction } from "@/store/cash-bank-store";
import { requireCanExportData } from "@/lib/assert-can-export";

const SLATE: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [71, 85, 105];
const BORDER: [number, number, number] = [226, 232, 240];

function formatInrPdf(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Paid (money out): show with leading minus sign for clarity. */
function formatPaidColumn(amount: number): string {
  return `−${formatInrPdf(amount)}`;
}

function txnTypeLabel(t: CashBankTransaction["rowType"]): string {
  switch (t) {
    case "OPENING":
      return "Opening Balance";
    case "ADJUST_ADD":
      return "Adjustment (+)";
    case "ADJUST_REDUCE":
      return "Adjustment (−)";
    case "TRANSFER_OUT":
      return "Transfer out";
    case "TRANSFER_IN":
      return "Transfer in";
    default:
      return "—";
  }
}

function slugFile(accountName: string): string {
  const safe = accountName.replace(/[^\w\-]+/g, "_").slice(0, 40);
  const d = format(new Date(), "yyyy-MM-dd-HHmm");
  return `cash-bank-statement-${safe}-${d}.pdf`;
}

function sortTxAsc(tx: CashBankTransaction[]): CashBankTransaction[] {
  return [...tx].sort((a, b) => {
    const ta = new Date(a.date).getTime();
    const tb = new Date(b.date).getTime();
    if (ta !== tb) return ta - tb;
    return a.id.localeCompare(b.id);
  });
}

function openingBalanceBeforeFirst(first: CashBankTransaction): number {
  const rec = first.received ?? 0;
  const paid = first.paid ?? 0;
  return Math.round((first.balanceAfter - rec + paid) * 100) / 100;
}

export function downloadCashBankStatementPdf(opts: {
  businessName: string;
  businessPhone: string;
  accountDisplayName: string;
  rangeStart: Date;
  rangeEnd: Date;
  transactions: CashBankTransaction[];
  /** Used when there are no transactions in range (opening row only). */
  fallbackBalance: number;
}): void {
  requireCanExportData();
  const {
    businessName,
    businessPhone,
    accountDisplayName,
    rangeStart,
    rangeEnd,
    transactions,
    fallbackBalance,
  } = opts;

  const dateRangeLabel = `${format(rangeStart, "dd/MM/yyyy")} - ${format(rangeEnd, "dd/MM/yyyy")}`;
  const asc = sortTxAsc(transactions);

  const body: string[][] = [];

  if (asc.length === 0) {
    body.push([
      "",
      "Opening Balance",
      "",
      "",
      "",
      "",
      "",
      formatInrPdf(fallbackBalance),
      "",
    ]);
  } else {
    const opening = openingBalanceBeforeFirst(asc[0]);
    body.push(["", "Opening Balance", "", "", "", "", "", formatInrPdf(opening), ""]);
    for (const t of asc) {
      body.push([
        format(new Date(t.date), "dd/MM/yyyy"),
        txnTypeLabel(t.rowType),
        t.txnNo ?? "",
        t.party ?? "",
        t.mode ?? "",
        t.paid != null ? formatPaidColumn(t.paid) : "",
        t.received != null ? formatInrPdf(t.received) : "",
        formatInrPdf(t.balanceAfter),
        t.notes ?? "",
      ]);
    }
  }

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...SLATE);
  const nameUpper = (businessName || "Business").toUpperCase();
  doc.text(nameUpper, margin, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`Phone no: ${businessPhone || "—"}`, margin, 22);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...SLATE);
  doc.text("Cash and Bank Statement", pageW - margin, 16, { align: "right" });

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.35);
  doc.line(margin, 26, pageW - margin, 26);

  const boxW = 78;
  const boxH = 18;
  const boxX = pageW - margin - boxW;
  const boxY = 30;
  doc.setDrawColor(...BORDER);
  doc.rect(boxX, boxY, boxW, boxH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...SLATE);
  doc.text(`Date: ${dateRangeLabel}`, boxX + 3, boxY + 7);
  doc.text(`Account Display Name: ${accountDisplayName}`, boxX + 3, boxY + 14, {
    maxWidth: boxW - 6,
  });

  autoTable(doc, {
    startY: boxY + boxH + 8,
    head: [["Date", "Type", "Txn No", "Party", "Mode", "Paid", "Received", "Balance", "Notes"]],
    body,
    theme: "plain",
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: SLATE,
      fontStyle: "bold",
      fontSize: 8,
    },
    bodyStyles: { fontSize: 8, textColor: SLATE },
    styles: {
      cellPadding: 2,
      lineColor: BORDER,
      lineWidth: 0.1,
      valign: "middle",
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 28 },
      2: { cellWidth: 22 },
      3: { cellWidth: 36 },
      4: { cellWidth: 22 },
      5: { halign: "right", cellWidth: 30 },
      6: { halign: "right", cellWidth: 28 },
      7: { halign: "right", cellWidth: 30 },
      8: { cellWidth: 48 },
    },
    margin: { left: margin, right: margin },
  });

  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text(`Generated ${format(new Date(), "dd/MM/yyyy HH:mm")}`, margin, pageH - 8);

  doc.save(slugFile(accountDisplayName));
}
