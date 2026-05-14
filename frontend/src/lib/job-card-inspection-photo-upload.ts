import { apiPostForm } from "./api-client";

export const INSPECTION_PHOTO_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Upload one inspection photo; returns persisted URL/path stored on `InspectionPhoto.url`.
 */
export async function uploadJobInspectionPhoto(
  jobCardId: string,
  type: "BEFORE" | "AFTER",
  file: File,
  photoId: string
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file (JPEG, PNG, WebP, or GIF).");
  }
  if (file.size > INSPECTION_PHOTO_MAX_BYTES) {
    throw new Error("Each photo must be 10 MB or smaller.");
  }
  const fd = new FormData();
  fd.append("photo", file);
  const q = new URLSearchParams({ type, photoId: photoId.slice(0, 96) });
  const data = await apiPostForm<{ url: string }>(
    `/api/job-cards/${encodeURIComponent(jobCardId)}/photos?${q.toString()}`,
    fd
  );
  return data.url;
}
