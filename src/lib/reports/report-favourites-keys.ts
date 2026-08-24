/** Favourite report href ↔ legacy localStorage key maps + migration helpers. */

export const REPORT_FAVOURITE_EVENT = "prime-report-favourite";

/** Special key: Balance Sheet previously lived in the ledger store. */
export const BALANCE_SHEET_FAV_MARKER = "__balance_sheet_store__";

const BALANCE_SHEET_LOCAL_KEY = "prime-detailer-balance-sheet-favourite";

/** href → legacy localStorage key (or balance-sheet marker). */
export const REPORT_FAVOURITE_KEY_BY_HREF: Record<string, string> = {
  "/reports/finance/balance-sheet": BALANCE_SHEET_FAV_MARKER,
  "/reports/finance/profit-loss": "prime-detailer-pl-favourite",
  "/reports/gst/gstr-1-sales": "prime-detailer-gstr1-favourite",
  "/reports/gst/gstr-2-purchase": "prime-detailer-gstr2-favourite",
  "/reports/gst/gstr-3b": "prime-detailer-gstr3b-favourite",
  "/reports/gst/gst-purchase-hsn": "prime-detailer-gst-purchase-hsn-favourite",
  "/reports/gst/gst-sales-hsn": "prime-detailer-gst-sales-hsn-favourite",
  "/reports/gst/hsn-wise-sales-summary": "prime-detailer-hsn-wise-sales-favourite",
  "/reports/gst/tds-payable": "prime-detailer-tds-payable-fav",
  "/reports/gst/tds-receivable": "prime-detailer-tds-receivable-fav",
  "/reports/gst/tcs-payable": "prime-detailer-tcs-payable-fav",
  "/reports/gst/tcs-receivable": "prime-detailer-tcs-receivable-fav",
  "/reports/sales-summary-staff": "prime-detailer-sales-staff-favourite",
  "/reports/analytics": "prime-detailer-analytics-favourite",
  "/reports/transaction/bill-wise-profit": "prime-detailer-bill-wise-profit-fav",
  "/reports/transaction/cash-bank": "prime-detailer-cash-bank-fav",
  "/reports/transaction/daybook": "prime-detailer-daybook-fav",
  "/reports/transaction/expense-category": "prime-detailer-expense-cat-fav",
  "/reports/transaction/expense-transaction": "prime-detailer-expense-txn-fav",
  "/reports/transaction/purchase-summary": "prime-detailer-purchase-summary-fav",
  "/reports/item/by-party": "prime-detailer-item-by-party-fav",
  "/reports/item/sales-purchase-summary": "prime-detailer-item-sp-summary-fav",
  "/reports/item/low-stock-summary": "prime-detailer-low-stock-fav",
  "/reports/item/rate-list": "prime-detailer-rate-list-fav",
  "/reports/item/stock-detail": "prime-detailer-stock-detail-fav",
  "/reports/item/stock-summary": "prime-detailer-stock-summary-fav",
  "/reports/party/receivable-ageing": "prime-detailer-ageing-fav",
  "/reports/party/by-item": "prime-detailer-party-by-item-fav",
  "/reports/party/ledger": "prime-detailer-party-ledger-fav",
  "/reports/party/party-wise-outstanding": "prime-detailer-party-outstanding-fav",
  "/reports/party/sales-summary-category": "prime-detailer-sales-cat-wise-fav",
  "/reports/hr-attendance": "prime-detailer-hr-attendance-favourite",
  "/reports/hr-leave": "prime-detailer-hr-leave-favourite",
  "/reports/hr-payroll": "prime-detailer-hr-payroll-favourite",
  "/reports/hr-rewards": "prime-detailer-hr-rewards-favourite",

};

/** Reverse map: storage key → href */
export const REPORT_HREF_BY_FAVOURITE_KEY: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [href, key] of Object.entries(REPORT_FAVOURITE_KEY_BY_HREF)) {
    out[key] = href;
  }
  out[BALANCE_SHEET_LOCAL_KEY] = "/reports/finance/balance-sheet";
  return out;
})();

export function notifyReportFavouritesChanged(href?: string, value?: boolean): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(REPORT_FAVOURITE_EVENT, { detail: { href, value } })
  );
}

export function getReportFavouriteStorageKey(href: string): string | null {
  return REPORT_FAVOURITE_KEY_BY_HREF[href] ?? null;
}

export function getReportHrefForFavouriteKey(storageKey: string): string | null {
  if (storageKey === BALANCE_SHEET_FAV_MARKER) {
    return "/reports/finance/balance-sheet";
  }
  return REPORT_HREF_BY_FAVOURITE_KEY[storageKey] ?? null;
}

function readLocalFavourite(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

/** Collect favourited hrefs from legacy per-report localStorage flags (one-time migrate). */
export function collectLocalFavouriteHrefs(): string[] {
  if (typeof window === "undefined") return [];
  const hrefs: string[] = [];
  const seen = new Set<string>();
  for (const [href, key] of Object.entries(REPORT_FAVOURITE_KEY_BY_HREF)) {
    const localKey = key === BALANCE_SHEET_FAV_MARKER ? BALANCE_SHEET_LOCAL_KEY : key;
    if (readLocalFavourite(localKey) && !seen.has(href)) {
      seen.add(href);
      hrefs.push(href);
    }
  }
  return hrefs;
}

export function shouldMigrateLocalFavourites(userId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(`prime-detailer-fav-migrated-${userId}`) !== "1";
  } catch {
    return false;
  }
}

export function markLocalFavouritesMigrated(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`prime-detailer-fav-migrated-${userId}`, "1");
  } catch {
    /* ignore */
  }
}
