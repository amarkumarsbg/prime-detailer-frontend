import { apiGet, apiPostForm } from "./api-client";
import {
  mergeInspectionPhotosById,
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
 *
 * IMPORTANT: Inspection photos are MERGED (local wins by photo ID) so that a
 * stale server response (e.g. the background secureToken refresh that fires
 * right after addJobCard, before the check-in PUT completes) never wipes photos
 * that have already been saved locally or are already in the store.
 */
export async function refreshJobCardFromServer(jobCardId: string): Promise<JobCard | null> {
  const data = await apiGet<{ items?: JobCard[] }>("/api/job-cards");
  const items = Array.isArray(data?.items) ? data.items : [];
  const found = items.find((j) => j.id === jobCardId) ?? null;
  if (!found) return null;

  useJobCardStore.setState((state) => {
    const existing = state.jobCards.find((j) => j.id === jobCardId);
    const remotePhotos = found.inspectionPhotos ?? [];
    const localPhotos = existing?.inspectionPhotos ?? [];

    let merged: JobCard;
    if (localPhotos.length === 0) {
      merged = found;
    } else if (remotePhotos.length === 0) {
      // Server response predates the check-in PUT — keep all local photos.
      merged = { ...found, inspectionPhotos: localPhotos };
    } else {
      // Both sides have photos: union by id, remote metadata wins for shared ids.
      merged = {
        ...found,
        inspectionPhotos: mergeInspectionPhotosById(remotePhotos, localPhotos),
      };
    }

    if (!existing) {
      return { jobCards: [merged, ...state.jobCards] };
    }
    return {
      jobCards: state.jobCards.map((j) => (j.id === jobCardId ? merged : j)),
    };
  });

  // Return the merged version so callers (e.g. the INSPECTION → In Service
  // validation) see the authoritative photo list, not the bare server snapshot.
  return useJobCardStore.getState().jobCards.find((j) => j.id === jobCardId) ?? found;
}
