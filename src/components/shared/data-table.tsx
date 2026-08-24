"use client";

import { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { compareFieldValues } from "@/lib/sort-by-date";
import { cn } from "@/lib/utils";

export interface ServerPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  isLoading?: boolean;
}

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
  /** Extra classes on mobile card wrappers (e.g. tighter padding). */
  mobileCardClassName?: string;
  serverPagination?: ServerPagination;
  onSearchChange?: (search: string) => void;
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
  mobileCardClassName,
  serverPagination,
  onSearchChange,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [internalPage, setInternalPage] = useState(0);
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey ?? null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(
    defaultSortKey ? defaultSortDir : "asc"
  );

  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia(mobileCardBelow === "lg" ? "(max-width: 1023px)" : "(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mobileCardBelow]);

  useEffect(() => {
    if (!serverPagination) {
      queueMicrotask(() => setInternalPage(0));
    }
  }, [data, serverPagination]);

  const isServer = !!serverPagination;
  const currentPage = isServer ? serverPagination!.page - 1 : internalPage;

  const handlePageChange = (newPage: number) => {
    if (isServer) {
      serverPagination!.onPageChange(newPage + 1);
    } else {
      setInternalPage(newPage);
    }
  };

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
    if (idx >= 0) queueMicrotask(() => handlePageChange(Math.floor(idx / pageSize)));
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
  }, [focusItemId, currentPage, sorted, getRowDomId]);

  const totalPages = isServer ? serverPagination!.totalPages : Math.ceil(sorted.length / pageSize);
  const paged = isServer ? data : sorted.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const currentTotal = isServer ? serverPagination!.total : sorted.length;

  const showMobile = !mounted || isMobile;
  const showDesktop = !mounted || !isMobile || !renderMobileCard;

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
              onChange={(e) => { 
                const val = e.target.value;
                setSearch(val); 
                onSearchChange?.(val);
                handlePageChange(0); 
              }}
              className="pl-9 text-sm placeholder:text-muted-foreground"
            />
          </div>
          {actions}
        </div>
      )}
      {hideSearch && actions ? <div className="flex justify-end">{actions}</div> : null}

      <div className="rounded-xl border border-border overflow-hidden">
        {renderMobileCard && showMobile && (
          <div className={`p-3 space-y-3 bg-card`}>
            {paged.length === 0 ? (
              emptyContent ?? (
                <p className="text-center py-12 text-sm text-muted-foreground">No results found</p>
              )
            ) : (
              paged.map((item, i) => {
                const rowKey = String((item as T & { id?: string }).id ?? `${currentPage}-${i}`);
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
                    className={cn(
                      "rounded-lg border border-border bg-card text-sm shadow-sm",
                      mobileCardClassName ?? "p-3",
                      onRowClick &&
                        "cursor-pointer outline-none transition-[background-color,border-color] duration-200 ease-out hover:bg-muted/40 hover:border-primary/30 focus-visible:ring-2 focus-visible:ring-ring"
                    )}
                  >
                    {renderMobileCard(item)}
                  </div>
                );
              })
            )}
          </div>
        )}
        {showDesktop && (
        <div className="overflow-x-auto">
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
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground text-center sm:text-left">
            Showing {currentPage * pageSize + 1}-{Math.min((currentPage + 1) * pageSize, currentTotal)} of {currentTotal}
          </p>
          <div className="flex items-center justify-center gap-1">
            <Button variant="outline" size="icon" onClick={() => handlePageChange(0)} disabled={currentPage === 0}>
              <ChevronsLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 0}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm px-3 font-medium">
              {currentPage + 1} / {totalPages}
            </span>
            <Button variant="outline" size="icon" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= totalPages - 1}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => handlePageChange(totalPages - 1)} disabled={currentPage >= totalPages - 1}>
              <ChevronsRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
