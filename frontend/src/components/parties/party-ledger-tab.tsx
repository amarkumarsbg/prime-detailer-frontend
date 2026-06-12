"use client";

import { useRouter } from "next/navigation";
import { statementLineHref } from "@/lib/billing/payment-helpers";
import { appendReturnTo } from "@/lib/navigation/return-to";
import { cn, formatInrTable } from "@/lib/utils";
import type { PartyStatementLine } from "@/types/party";

type PartyLedgerTabProps = {
  lines: PartyStatementLine[];
  /** When set, detail pages receive `?from=` for the back arrow. */
  returnTo?: string;
};

const thClass =
  "border-r border-border bg-muted px-4 py-3 text-left text-sm font-semibold text-foreground align-middle last:border-r-0 whitespace-nowrap";
const tdClass =
  "border-r border-t border-border px-4 py-3 text-sm text-foreground align-middle last:border-r-0 bg-background";
const tdNumClass = cn(tdClass, "tabular-nums text-right");

function debitForRow(row: PartyStatementLine): string {
  if (row.debit != null) return formatInrTable(row.debit);
  if (row.isSummary) {
    if (row.id === "opening" || row.id === "closing") {
      return formatInrTable(0);
    }
  }
  return "—";
}

function creditForRow(row: PartyStatementLine): string {
  if (row.credit != null) return formatInrTable(row.credit);
  return "—";
}

function balanceForRow(row: PartyStatementLine): string {
  if (row.isSummary && row.id === "closing") return "—";
  return formatInrTable(row.balance);
}

export function PartyLedgerTab({ lines, returnTo }: PartyLedgerTabProps) {
  const router = useRouter();

  const navigate = (row: PartyStatementLine) => {
    if (row.isSummary) return;
    const baseHref = statementLineHref(row.id);
    const href = baseHref && returnTo ? appendReturnTo(baseHref, returnTo) : baseHref;
    if (href) router.push(href);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="space-y-2 p-3 md:hidden">
        {lines.map((row) => {
          const clickable = !row.isSummary && statementLineHref(row.id);
          return (
            <div
              key={row.id}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : undefined}
              onClick={() => navigate(row)}
              onKeyDown={(e) => {
                if (clickable && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  navigate(row);
                }
              }}
              className={cn(
                "rounded-lg border border-border bg-card p-3 text-sm",
                row.isSummary && "bg-muted/30 font-medium",
                clickable && "cursor-pointer shadow-sm transition-colors hover:border-primary/30 hover:bg-muted/40"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-muted-foreground">{row.date}</p>
                  <p className="mt-0.5 truncate text-sm font-medium leading-tight">{row.voucher}</p>
                </div>
                <p className="shrink-0 text-sm font-bold tabular-nums">{balanceForRow(row)}</p>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span>
                  Credit: <span className="font-medium text-foreground">{creditForRow(row)}</span>
                </span>
                <span>
                  Debit: <span className="font-medium text-foreground">{debitForRow(row)}</span>
                </span>
                {row.paymentMode && row.paymentMode !== "—" ? (
                  <span className="col-span-2">Mode: {row.paymentMode}</span>
                ) : null}
                {row.dueLabel ? (
                  <span className="col-span-2 text-amber-700 dark:text-amber-400">{row.dueLabel}</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <thead>
            <tr>
              <th className={thClass}>Date</th>
              <th className={thClass}>Voucher</th>
              <th className={thClass}>Sr No</th>
              <th className={thClass}>Payment Mode</th>
              <th className={cn(thClass, "text-right")}>Credit</th>
              <th className={cn(thClass, "text-right")}>Debit</th>
              <th className={cn(thClass, "text-right")}>Balance</th>
              <th className={thClass}>Due Date (Overdue by)</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((row) => {
              const baseHref = !row.isSummary ? statementLineHref(row.id) : undefined;
              const href =
                baseHref && returnTo ? appendReturnTo(baseHref, returnTo) : baseHref;
              return (
                <tr
                  key={row.id}
                  className={cn(
                    "hover:bg-muted/20",
                    row.isSummary && "bg-muted/25 font-medium",
                    href && "cursor-pointer"
                  )}
                  tabIndex={href ? 0 : undefined}
                  role={href ? "link" : undefined}
                  onClick={() => href && router.push(href)}
                  onKeyDown={(e) => {
                    if (href && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      router.push(href);
                    }
                  }}
                >
                  <td className={cn(tdClass, "whitespace-nowrap")}>{row.date}</td>
                  <td className={tdClass}>{row.voucher}</td>
                  <td className={cn(tdClass, "font-mono text-xs")}>{row.serialNo}</td>
                  <td className={cn(tdClass, "text-muted-foreground")}>{row.paymentMode}</td>
                  <td className={tdNumClass}>{creditForRow(row)}</td>
                  <td className={tdNumClass}>{debitForRow(row)}</td>
                  <td className={cn(tdNumClass, "font-medium")}>{balanceForRow(row)}</td>
                  <td className={tdClass}>
                    {row.dueLabel ? (
                      <span className="text-xs text-amber-700 dark:text-amber-400">{row.dueLabel}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
