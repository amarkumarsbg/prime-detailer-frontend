import { apiGet, apiPostForm } from "./api-client";
import {
  toInspectionPhotoUploadQueryType,
  type InspectionPhotoKind,
} from "@/lib/job-card-inspection-photos";
import type { JobCard } from "@/types";
import { useJobCardStore } from "@/store/job-card-store";

export const INSPECTION_PHOTO_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Upload one inspection photo; returns persisted URL/path stored on `InspectionPhoto.url`.
 * `kind` is normalized; the HTTP query uses uppercase for the backend contract.
 */
export async function uploadJobInspectionPhoto(
  jobCardId: string,
  kind: InspectionPhotoKind | "BEFORE" | "AFTER",
  file: File,
  photoId: string
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file (JPEG, PNG, WebP, or GIF).");
  }
  if (file.size > INSPECTION_PHOTO_MAX_BYTES) {
    throw new Error("Each photo must be 10 MB or smaller.");
  }
  const normalized = kind === "AFTER" || kind === "after" ? "after" : "before";
  const fd = new FormData();
  fd.append("photo", file);
  const q = new URLSearchParams({
    type: toInspectionPhotoUploadQueryType(normalized),
    photoId: photoId.slice(0, 96),
  });
  const data = await apiPostForm<{ url: string }>(
    `/api/job-cards/${encodeURIComponent(jobCardId)}/photos?${q.toString()}`,
    fd
  );
  return data.url;
}

/**
 * Re-fetch job cards from the API and sync the matching card into the store.
 * Used before Inspection → In Service so validation reads persisted photos.
 */
export async function refreshJobCardFromServer(jobCardId: string): Promise<JobCard | null> {
  const data = await apiGet<{ items?: JobCard[] }>("/api/job-cards");
  const items = Array.isArray(data?.items) ? data.items : [];
  const found = items.find((j) => j.id === jobCardId) ?? null;
  if (!found) return null;

  useJobCardStore.setState((state) => {
    const exists = state.jobCards.some((j) => j.id === jobCardId);
    return {
      jobCards: exists
        ? state.jobCards.map((j) => (j.id === jobCardId ? found : j))
        : [found, ...state.jobCards],
    };
  });
  return found;
}
