/** Shared favourite keys for report pages + Reports hub. */

export const REPORT_FAVOURITE_EVENT = "prime-report-favourite";

/** Special key: Balance Sheet uses the ledger store, not localStorage. */
export const BALANCE_SHEET_FAV_MARKER = "__balance_sheet_store__";

const DEFAULT_FAVOURITE_HREFS = [
  "/reports/finance/balance-sheet",
  "/reports/gst/gstr-1-sales",
  "/reports/finance/profit-loss",
  "/reports/sales-summary-staff",
  "/reports/analytics",
] as const;

/** href → localStorage key (or balance-sheet marker). */
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
};

const SEED_FLAG = "prime-detailer-fav-defaults-seeded-v1";

export function notifyReportFavouritesChanged(href?: string, value?: boolean): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(REPORT_FAVOURITE_EVENT, { detail: { href, value } })
  );
}

export function getReportFavouriteStorageKey(href: string): string | null {
  return REPORT_FAVOURITE_KEY_BY_HREF[href] ?? null;
}

function readLocalFavourite(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeLocalFavourite(key: string, value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    /* ignore quota */
  }
}

/** Sync helper for report pages that already own a storage key string. */
export function readFavouriteFlag(storageKey: string): boolean {
  if (storageKey === BALANCE_SHEET_FAV_MARKER) {
    try {
      // Lazy import avoided — callers for balance sheet use the store directly.
      return readLocalFavourite("prime-detailer-balance-sheet-favourite");
    } catch {
      return false;
    }
  }
  return readLocalFavourite(storageKey);
}

export function writeFavouriteFlag(storageKey: string, value: boolean): void {
  if (storageKey === BALANCE_SHEET_FAV_MARKER) {
    writeLocalFavourite("prime-detailer-balance-sheet-favourite", value);
  } else {
    writeLocalFavourite(storageKey, value);
  }
  notifyReportFavouritesChanged();
}

export function isReportFavourited(
  href: string,
  balanceSheetFavourite?: boolean
): boolean {
  const key = getReportFavouriteStorageKey(href);
  if (!key) return false;
  if (key === BALANCE_SHEET_FAV_MARKER) {
    if (typeof balanceSheetFavourite === "boolean") return balanceSheetFavourite;
    return readLocalFavourite("prime-detailer-balance-sheet-favourite");
  }
  return readLocalFavourite(key);
}

export function setReportFavourited(
  href: string,
  value: boolean,
  options?: { setBalanceSheetFavourite?: (v: boolean) => void }
): void {
  const key = getReportFavouriteStorageKey(href);
  if (!key) return;
  if (key === BALANCE_SHEET_FAV_MARKER) {
    writeLocalFavourite("prime-detailer-balance-sheet-favourite", value);
    options?.setBalanceSheetFavourite?.(value);
  } else {
    writeLocalFavourite(key, value);
  }
  notifyReportFavouritesChanged(href, value);
}

/** First visit: mark the classic Favourite set as starred when unset. */
export function seedDefaultReportFavourites(
  setBalanceSheetFavourite?: (v: boolean) => void
): void {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(SEED_FLAG) === "1") return;
    for (const href of DEFAULT_FAVOURITE_HREFS) {
      const key = getReportFavouriteStorageKey(href);
      if (!key) continue;
      if (key === BALANCE_SHEET_FAV_MARKER) {
        if (localStorage.getItem("prime-detailer-balance-sheet-favourite") == null) {
          writeLocalFavourite("prime-detailer-balance-sheet-favourite", true);
          setBalanceSheetFavourite?.(true);
        }
      } else if (localStorage.getItem(key) == null) {
        writeLocalFavourite(key, true);
      }
    }
    localStorage.setItem(SEED_FLAG, "1");
  } catch {
    /* ignore */
  }
}
