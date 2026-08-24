import type { InspectionPhoto, InspectionPhotoType } from "@/types";

/** Canonical persisted kinds — always store lowercase on new writes. */
export type InspectionPhotoKind = "before" | "after";

/**
 * Normalize legacy "BEFORE"/"AFTER" and new "before"/"after" (case-insensitive).
 * Returns null for unknown / empty values.
 */
export function normalizeInspectionPhotoKind(
  type: string | undefined | null
): InspectionPhotoKind | null {
  if (type == null) return null;
  const t = String(type).trim().toLowerCase();
  if (t === "before") return "before";
  if (t === "after") return "after";
  return null;
}

/** Value to persist on `InspectionPhoto.type` for new uploads. */
export function toPersistedInspectionPhotoType(kind: InspectionPhotoKind): InspectionPhotoType {
  return kind;
}

/** Upload API query still uses uppercase (backend contract). */
export function toInspectionPhotoUploadQueryType(kind: InspectionPhotoKind): "BEFORE" | "AFTER" {
  return kind === "before" ? "BEFORE" : "AFTER";
}

export function isValidInspectionPhotoUrl(url: string | undefined | null): boolean {
  return typeof url === "string" && url.trim().length > 0;
}

export function isBeforeInspectionPhoto(
  photo: Pick<InspectionPhoto, "type" | "url"> | { type?: string; url?: string }
): boolean {
  return (
    normalizeInspectionPhotoKind(photo.type) === "before" &&
    isValidInspectionPhotoUrl(photo.url)
  );
}

export function isAfterInspectionPhoto(
  photo: Pick<InspectionPhoto, "type" | "url"> | { type?: string; url?: string }
): boolean {
  return (
    normalizeInspectionPhotoKind(photo.type) === "after" &&
    isValidInspectionPhotoUrl(photo.url)
  );
}

export function hasBeforeInspectionPhoto(
  photos: Array<Pick<InspectionPhoto, "type" | "url"> | { type?: string; url?: string }> | null | undefined
): boolean {
  return (photos ?? []).some(isBeforeInspectionPhoto);
}

export function hasAfterInspectionPhoto(
  photos: Array<Pick<InspectionPhoto, "type" | "url"> | { type?: string; url?: string }> | null | undefined
): boolean {
  return (photos ?? []).some(isAfterInspectionPhoto);
}

/** Merge by photo id — later entries win; no duplicate ids. */
export function mergeInspectionPhotosById(
  existing: InspectionPhoto[],
  incoming: InspectionPhoto[]
): InspectionPhoto[] {
  const map = new Map<string, InspectionPhoto>();
  for (const p of existing) {
    if (p?.id) map.set(p.id, p);
  }
  for (const p of incoming) {
    if (p?.id) map.set(p.id, p);
  }
  return [...map.values()];
}
