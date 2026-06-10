"use client";

import { useMemo, useState } from "react";
import { ReportPageChrome } from "@/components/reports/report-page-chrome";
import { computeGstr3bOutwardFromInvoices } from "@/lib/reports/gstr3b-from-invoices";
import { useScopedInvoices } from "@/hooks/use-scoped-data";
import { toast } from "sonner";

const FAV_KEY = "prime-detailer-gstr3b-favourite";

function N({ n }: { n: number }) {
  return <td className="border border-border px-2 py-1.5 text-right tabular-nums">{n.toFixed(2)}</td>;
}

function Z() {
  return <N n={0} />;
}

const ROWS_31 = [
  "Outward taxable supplies (Other than zero rated, nil rated and exempted)",
  "Outward taxable supplies (Zero rated)",
  "Other outward supplies (Nil rated and exempted)",
  "Inward supplies (Liable to reverse charge)",
  "Non-GST outward supplies",
] as const;

export function Gstr3bReport() {
  const [period, setPeriod] = useState("week");
  const invoices = useScopedInvoices();

  const outward = useMemo(
    () => computeGstr3bOutwardFromInvoices(invoices, period),
    [invoices, period]
  );

  const downloadCsv = () => {
    toast.message("Download started", { description: "GSTR-3B summary export." });
  };

  return (
    <ReportPageChrome
      title="GSTR-3B"
      favouriteStorageKey={FAV_KEY}
      emailReportName="GSTR-3B"
      period={period}
      onPeriodChange={setPeriod}
      onDownloadCsv={downloadCsv}
    >
      <div className="space-y-8 text-sm">
        <section className="overflow-x-auto rounded-lg border border-border bg-card print:border-0">
          <h2 className="border-b border-border bg-muted/40 px-3 py-2 text-sm font-semibold">
            3.1 Details of Outward supplies and Inward supplies liable to reverse charge
          </h2>
          <table className="w-full min-w-[720px] border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-muted/50 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">
                <th className="border border-border px-2 py-2">Nature of supplies</th>
                <th className="border border-border px-2 py-2 text-right">Total taxable value</th>
                <th className="border border-border px-2 py-2 text-right">Integrated tax</th>
                <th className="border border-border px-2 py-2 text-right">Central tax</th>
                <th className="border border-border px-2 py-2 text-right">State/UT tax</th>
                <th className="border border-border px-2 py-2 text-right">Cess</th>
              </tr>
            </thead>
            <tbody>
              {ROWS_31.map((label, i) => (
                <tr key={label} className="hover:bg-muted/10">
                  <td className="border border-border px-2 py-1.5">{label}</td>
                  {i === 0 ? (
                    <>
                      <N n={outward.taxableValue} />
                      <N n={outward.igst} />
                      <N n={outward.cgst} />
                      <N n={outward.sgst} />
                      <N n={outward.cess} />
                    </>
                  ) : (
                    <>
                      <Z />
                      <Z />
                      <Z />
                      <Z />
                      <Z />
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="overflow-x-auto rounded-lg border border-border bg-card">
          <h2 className="border-b border-border bg-muted/40 px-3 py-2 text-sm font-semibold">
            3.2 Details of Inter-State supplies made to unregistered persons, composition dealer and
            UIN holders
          </h2>
          <table className="w-full min-w-[960px] border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-muted/50 text-[10px] font-semibold uppercase text-muted-foreground sm:text-xs">
                <th className="border border-border px-2 py-2" rowSpan={2}>
                  Place of supply
                </th>
                <th className="border border-border px-2 py-1 text-center" colSpan={2}>
                  Supplies made to unregistered persons
                </th>
                <th className="border border-border px-2 py-1 text-center" colSpan={2}>
                  Supplies made to composition taxable persons
                </th>
                <th className="border border-border px-2 py-1 text-center" colSpan={2}>
                  Supplies made to UIN holders
                </th>
              </tr>
              <tr className="bg-muted/40 text-[10px] font-medium text-muted-foreground sm:text-xs">
                <th className="border border-border px-2 py-1.5">Total taxable value</th>
                <th className="border border-border px-2 py-1.5">Amount of integrated tax</th>
                <th className="border border-border px-2 py-1.5">Total taxable value</th>
                <th className="border border-border px-2 py-1.5">Amount of integrated tax</th>
                <th className="border border-border px-2 py-1.5">Total taxable value</th>
                <th className="border border-border px-2 py-1.5">Amount of integrated tax</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  colSpan={7}
                  className="border border-border px-4 py-12 text-center text-muted-foreground"
                >
                  No inter-state B2C lines for this period.
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="overflow-x-auto rounded-lg border border-border bg-card">
          <h2 className="border-b border-border bg-muted/40 px-3 py-2 text-sm font-semibold">
            4 Details of Eligible Input Tax Credit
          </h2>
          <table className="w-full min-w-[720px] border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-muted/50 text-[10px] font-semibold uppercase text-muted-foreground sm:text-xs">
                <th className="border border-border px-2 py-2 text-left">Details</th>
                <th className="border border-border px-2 py-2 text-right">Integrated tax</th>
                <th className="border border-border px-2 py-2 text-right">Central tax</th>
                <th className="border border-border px-2 py-2 text-right">State/UT tax</th>
                <th className="border border-border px-2 py-2 text-right">Cess</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-muted/20 font-medium">
                <td className="border border-border px-2 py-1.5" colSpan={5}>
                  (A) ITC Available (Whether in full or part)
                </td>
              </tr>
              {[
                "(1) Import of goods",
                "(2) Import of services",
                "(3) Inward supplies liable for reverse charge (other than 1 & 2 above)",
                "(4) Inward Supplies for ISD",
                "(5) All Other ITC",
              ].map((label) => (
                <tr key={label}>
                  <td className="border border-border px-2 py-1.5 pl-4">{label}</td>
                  <Z />
                  <Z />
                  <Z />
                  <Z />
                </tr>
              ))}
              <tr className="bg-muted/20 font-medium">
                <td className="border border-border px-2 py-1.5" colSpan={5}>
                  (D) Ineligible
                </td>
              </tr>
              {["(1) As per section 17(5)", "(5) Others"].map((label) => (
                <tr key={label}>
                  <td className="border border-border px-2 py-1.5 pl-4">{label}</td>
                  <Z />
                  <Z />
                  <Z />
                  <Z />
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="overflow-x-auto rounded-lg border border-border bg-card">
          <h2 className="border-b border-border bg-muted/40 px-3 py-2 text-sm font-semibold">
            5 Details of exempt, nil-rated and non-GST inward supplies
          </h2>
          <table className="w-full min-w-[560px] border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-muted/50 text-[10px] font-semibold uppercase text-muted-foreground sm:text-xs">
                <th className="border border-border px-2 py-2 text-left">Nature of supplies</th>
                <th className="border border-border px-2 py-2 text-right">Inter state supplies</th>
                <th className="border border-border px-2 py-2 text-right">Intra state supplies</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-border px-2 py-1.5">
                  From a supplier under composition scheme, Exempt and Nil rated supply
                </td>
                <Z />
                <Z />
              </tr>
              <tr>
                <td className="border border-border px-2 py-1.5">Non GST supply</td>
                <Z />
                <Z />
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    </ReportPageChrome>
  );
}
