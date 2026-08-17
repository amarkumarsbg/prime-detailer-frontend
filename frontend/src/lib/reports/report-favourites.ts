/** Shared favourite helpers for report pages + Reports hub (user-scoped via API). */

import { useReportFavouritesStore } from "@/store/report-favourites-store";
import {
  BALANCE_SHEET_FAV_MARKER,
  getReportFavouriteStorageKey,
  getReportHrefForFavouriteKey,
  notifyReportFavouritesChanged,
  REPORT_FAVOURITE_EVENT,
  REPORT_FAVOURITE_KEY_BY_HREF,
  REPORT_HREF_BY_FAVOURITE_KEY,
} from "@/lib/reports/report-favourites-keys";

export {
  BALANCE_SHEET_FAV_MARKER,
  getReportFavouriteStorageKey,
  getReportHrefForFavouriteKey,
  notifyReportFavouritesChanged,
  REPORT_FAVOURITE_EVENT,
  REPORT_FAVOURITE_KEY_BY_HREF,
  REPORT_HREF_BY_FAVOURITE_KEY,
};

/** @deprecated Prefer isReportFavourited(href) — kept for chrome storage-key callers. */
export function readFavouriteFlag(storageKey: string): boolean {
  const href = getReportHrefForFavouriteKey(storageKey);
  if (!href) return false;
  return useReportFavouritesStore.getState().isFavourited(href);
}

export function writeFavouriteFlag(storageKey: string, value: boolean): void {
  const href = getReportHrefForFavouriteKey(storageKey);
  if (!href) return;
  void useReportFavouritesStore.getState().setFavourited(href, value);
}

export function isReportFavourited(href: string): boolean {
  return useReportFavouritesStore.getState().isFavourited(href);
}

export function setReportFavourited(href: string, value: boolean): void {
  void useReportFavouritesStore.getState().setFavourited(href, value);
}

/** No-op: defaults are no longer seeded client-side (user-specific server list). */
export function seedDefaultReportFavourites(): void {
  /* intentionally empty */
}
