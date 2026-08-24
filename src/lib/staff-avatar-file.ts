/** Max raw file size before client-side resize (matches My Profile). */
export const STAFF_AVATAR_MAX_BYTES = 10 * 1024 * 1024;

const MAX_EDGE = 512;
const JPEG_QUALITY = 0.85;
/** Keep JSON PUT payloads reasonable for `/api/users/:id`. */
const MAX_DATA_URL_CHARS = 180_000;

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}

/**
 * Resize/compress a staff photo to a data URL suitable for the existing
 * `User.avatar` string field (no dedicated admin upload API).
 */
export async function fileToStaffAvatarDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file (JPEG, PNG, WebP, or GIF).");
  }
  if (file.size > STAFF_AVATAR_MAX_BYTES) {
    throw new Error("Photo must be 10 MB or smaller.");
  }

  const img = await loadImageFromFile(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process image.");
  ctx.drawImage(img, 0, 0, width, height);

  let quality = JPEG_QUALITY;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  while (dataUrl.length > MAX_DATA_URL_CHARS && quality > 0.45) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }
  if (dataUrl.length > MAX_DATA_URL_CHARS) {
    throw new Error("Photo is too large after compression. Try a smaller image.");
  }
  return dataUrl;
}
