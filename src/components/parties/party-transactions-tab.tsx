"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PartyTransactionsEmptyIcon } from "@/components/parties/party-transactions-empty-icon";
import { cn, formatDate, formatInrTable } from "@/lib/utils";
import type { PartyTransactionRow } from "@/types/party";

type PartyTransactionsTabProps = {
  rows: PartyTransactionRow[];
};

type SortKey = "date" | "amount";
type SortDir = "asc" | "desc";

const thClass =
  "border-r border-border bg-muted px-4 py-3 text-left text-sm font-semibold text-foreground align-middle last:border-r-0";
const tdClass =
  "border-r border-t border-border px-4 py-3 text-sm text-foreground align-middle last:border-r-0 bg-background";

function SortableHeader({
  label,
  active,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <th className={cn(thClass, className)}>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 font-semibold text-foreground transition-colors hover:text-foreground/80"
      >
        {label}
        <ArrowUpDown
          className={cn("h-3.5 w-3.5 shrink-0", active ? "opacity-70" : "opacity-40")}
          aria-hidden
        />
      </button>
    </th>
  );
}

function StatusBadge({ row }: { row: PartyTransactionRow }) {
  if (!row.status) return null;
  return (
    <Badge
      variant={
        row.statusTone === "success"
          ? "success"
          : row.statusTone === "warning"
            ? "warning"
            : "secondary"
      }
      className="h-5 shrink-0 px-1.5 text-[10px]"
    >
      {row.status}
    </Badge>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[160px] flex-col items-center justify-center px-6 py-10 text-center md:min-h-[280px] md:py-16">
      <PartyTransactionsEmptyIcon className="mb-4 h-[54px] w-[54px] shrink-0" />
      <p className="text-sm text-[#858D9D]">No transactions for the selected time period</p>
    </div>
  );
}

export function PartyTransactionsTab({ rows }: PartyTransactionsTabProps) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "asc");
    }
  };

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      if (sortKey === "date") {
        return (new Date(a.at).getTime() - new Date(b.at).getTime()) * mul;
      }
      return (a.amount - b.amount) * mul;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const goTo = (href?: string) => {
    if (href) router.push(href);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="space-y-2 p-3 md:hidden">
        {sortedRows.length === 0 ? (
          <EmptyState />
        ) : (
          sortedRows.map((r) => (
            <div
              key={r.id}
              role={r.href ? "button" : undefined}
              tabIndex={r.href ? 0 : undefined}
              onClick={() => goTo(r.href)}
              onKeyDown={(e) => {
                if (r.href && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  goTo(r.href);
                }
              }}
              className={cn(
                "rounded-lg border border-border bg-card p-3 text-sm shadow-sm",
                r.href && "cursor-pointer transition-colors hover:border-primary/30 hover:bg-muted/40"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">{formatDate(r.at)}</span>
                <StatusBadge row={r} />
              </div>
              <p className="mt-1 text-sm font-medium leading-tight">{r.typeLabel}</p>
              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{r.reference}</p>
              <p className="mt-1.5 text-sm font-bold tabular-nums">
                {formatInrTable(r.amount)}
                {r.unpaidAmount != null && r.unpaidAmount > 0.01 ? (
                  <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">
                    {formatInrTable(r.unpaidAmount)} unpaid
                  </span>
                ) : null}
              </p>
            </div>
          ))
        )}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr>
              <SortableHeader
                label="Date"
                active={sortKey === "date"}
                onClick={() => toggleSort("date")}
              />
              <th className={thClass}>Transaction Type</th>
              <th className={thClass}>Transaction Number</th>
              <SortableHeader
                label="Amount"
                active={sortKey === "amount"}
                onClick={() => toggleSort("amount")}
              />
              <th className={thClass}>Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="border-t border-border bg-background p-0">
                  <EmptyState />
                </td>
              </tr>
            ) : (
              sortedRows.map((r) => (
                <tr
                  key={r.id}
                  className={cn(
                    "hover:bg-muted/30",
                    r.href && "cursor-pointer focus-within:bg-muted/40"
                  )}
                  tabIndex={r.href ? 0 : undefined}
                  role={r.href ? "link" : undefined}
                  onClick={() => goTo(r.href)}
                  onKeyDown={(e) => {
                    if (r.href && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      goTo(r.href);
                    }
                  }}
                >
                  <td className={cn(tdClass, "whitespace-nowrap")}>{formatDate(r.at)}</td>
                  <td className={tdClass}>{r.typeLabel}</td>
                  <td className={cn(tdClass, "font-mono text-xs")}>{r.reference}</td>
                  <td className={cn(tdClass, "font-medium tabular-nums")}>
                    {formatInrTable(r.amount)}
                    {r.unpaidAmount != null && r.unpaidAmount > 0.01 && (
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                        ({formatInrTable(r.unpaidAmount)} unpaid)
                      </span>
                    )}
                  </td>
                  <td className={tdClass}>
                    <StatusBadge row={r} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
