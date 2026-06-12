"use client";

import { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { compareFieldValues } from "@/lib/sort-by-date";

interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  /** When set, used for sorting instead of `item[key]` (e.g. computed delivery date). */
  sortValue?: (item: T) => string | number;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  searchKeys?: string[];
  /** When set, used instead of searchKeys (e.g. match nested fields). */
  searchMatch?: (item: T, queryLower: string) => boolean;
  pageSize?: number;
  onRowClick?: (item: T) => void;
  /** Below `md`, render each row as a card instead of a wide table (no horizontal scroll). */
  renderMobileCard?: (item: T) => React.ReactNode;
  /** When `renderMobileCard` is set, use cards below this breakpoint (`md` = 768px, `lg` = 1024px). */
  mobileCardBelow?: "md" | "lg";
  actions?: React.ReactNode;
  /** Hide built-in search (use when search lives in an external filter bar). */
  hideSearch?: boolean;
  /** When set, row elements get this DOM `id` (e.g. `/expenses?highlight=` scroll). */
  getRowDomId?: (item: T) => string | undefined;
  /** When set with matching `item.id`, jump to that page and scroll the row into view (use with `getRowDomId`). */
  focusItemId?: string;
  /** Default column sort (newest-first: key `createdAt` or `date`, dir `desc`). */
  defaultSortKey?: string;
  defaultSortDir?: "asc" | "desc";
  /** When set, replaces the default empty row/card message. */
  emptyContent?: React.ReactNode;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  searchPlaceholder = "Search...",
  searchKeys = [],
  searchMatch,
  pageSize = 10,
  onRowClick,
  renderMobileCard,
  mobileCardBelow = "md",
  actions,
  hideSearch = false,
  getRowDomId,
  focusItemId,
  defaultSortKey,
  defaultSortDir = "desc",
  emptyContent,
}: DataTableProps<T>) {
  const mobileCardHiddenClass = mobileCardBelow === "lg" ? "lg:hidden" : "md:hidden";
  const tableHiddenClass =
    mobileCardBelow === "lg" ? "hidden lg:block overflow-x-auto" : "hidden md:block overflow-x-auto";

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey ?? null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(
    defaultSortKey ? defaultSortDir : "asc"
  );

  useEffect(() => {
    queueMicrotask(() => setPage(0));
  }, [data]);

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    if (searchMatch) {
      return data.filter((item) => searchMatch(item, q));
    }
    return data.filter((item) =>
      searchKeys.some((key) => {
        const val = item[key];
        return typeof val === "string" && val.toLowerCase().includes(q);
      })
    );
  }, [data, search, searchKeys, searchMatch]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    const read = (item: T) =>
      col?.sortValue ? col.sortValue(item) : item[sortKey];
    return [...filtered].sort((a, b) =>
      compareFieldValues(read(a), read(b), sortDir)
    );
  }, [filtered, sortKey, sortDir, columns]);

  useEffect(() => {
    if (!focusItemId) return;
    const idx = sorted.findIndex(
      (item) => String((item as T & { id?: string }).id) === focusItemId
    );
    if (idx >= 0) queueMicrotask(() => setPage(Math.floor(idx / pageSize)));
  }, [focusItemId, sorted, pageSize]);

  useEffect(() => {
    if (!focusItemId || !getRowDomId) return;
    const item = sorted.find(
      (i) => String((i as T & { id?: string }).id) === focusItemId
    );
    if (!item) return;
    const domId = getRowDomId(item);
    if (!domId) return;
    const t = window.setTimeout(() => {
      document.getElementById(domId)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    return () => window.clearTimeout(t);
  }, [focusItemId, page, sorted, getRowDomId]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  return (
    <div className="space-y-4">
      {!hideSearch && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-9"
            />
          </div>
          {actions}
        </div>
      )}
      {hideSearch && actions ? <div className="flex justify-end">{actions}</div> : null}

      <div className="rounded-xl border border-border overflow-hidden">
        {renderMobileCard && (
          <div className={`${mobileCardHiddenClass} p-3 space-y-3 bg-card`}>
            {paged.length === 0 ? (
              emptyContent ?? (
                <p className="text-center py-12 text-sm text-muted-foreground">No results found</p>
              )
            ) : (
              paged.map((item, i) => {
                const rowKey = String((item as T & { id?: string }).id ?? `${page}-${i}`);
                const domId = getRowDomId?.(item);
                return (
                  <div
                    key={rowKey}
                    id={domId}
                    role={onRowClick ? "button" : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    onClick={() => onRowClick?.(item)}
                    onKeyDown={(e) => {
                      if (!onRowClick) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onRowClick(item);
                      }
                    }}
                    className={`rounded-lg border border-border bg-card p-3 text-sm shadow-sm ${onRowClick ? "cursor-pointer outline-none transition-[background-color,border-color] duration-200 ease-out hover:bg-muted/40 hover:border-primary/30 focus-visible:ring-2 focus-visible:ring-ring" : ""}`}
                  >
                    {renderMobileCard(item)}
                  </div>
                );
              })
            )}
          </div>
        )}
        <div className={renderMobileCard ? tableHiddenClass : "overflow-x-auto"}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`text-left font-medium text-muted-foreground px-4 py-3 whitespace-nowrap ${col.className || ""} ${col.sortable ? "cursor-pointer select-none hover:text-foreground" : ""}`}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {col.sortable && sortKey === col.key && (
                        <span className="text-xs">{sortDir === "asc" ? "↑" : "↓"}</span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="text-center text-muted-foreground">
                    {emptyContent ?? <span className="block py-12">No results found</span>}
                  </td>
                </tr>
              ) : (
                paged.map((item, i) => {
                  const rowKey = String((item as T & { id?: string }).id ?? i);
                  const clickable = Boolean(onRowClick);
                  const domId = getRowDomId?.(item);
                  return (
                    <tr
                      key={rowKey}
                      id={domId}
                      role={clickable ? "button" : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      className={
                        clickable
                          ? "border-b border-border last:border-0 cursor-pointer outline-none transition-colors duration-200 ease-out hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                          : "border-b border-border last:border-0 transition-colors duration-200 ease-out hover:bg-muted/40"
                      }
                      onClick={() => onRowClick?.(item)}
                      onKeyDown={(e) => {
                        if (!onRowClick) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick(item);
                        }
                      }}
                    >
                      {columns.map((col) => (
                        <td key={col.key} className={`px-4 py-3 ${col.className || ""}`}>
                          {col.render ? col.render(item) : (item[col.key] as React.ReactNode)}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground text-center sm:text-left">
            Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, sorted.length)} of {sorted.length}
          </p>
          <div className="flex items-center justify-center gap-1">
            <Button variant="outline" size="icon" onClick={() => setPage(0)} disabled={page === 0}>
              <ChevronsLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setPage(page - 1)} disabled={page === 0}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm px-3 font-medium">
              {page + 1} / {totalPages}
            </span>
            <Button variant="outline" size="icon" onClick={() => setPage(page + 1)} disabled={page >= totalPages - 1}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}>
              <ChevronsRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
