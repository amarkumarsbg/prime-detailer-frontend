import type { Area } from "react-easy-crop";

/** Load an image from a blob/object URL. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", () => reject(new Error("Could not load image")));
    img.crossOrigin = "anonymous";
    img.src = src;
  });
}

/**
 * Crop the source image to `pixelCrop` and return a JPEG/PNG File.
 */
export async function getCroppedImageFile(
  imageSrc: string,
  pixelCrop: Area,
  opts?: { fileName?: string; mimeType?: string; quality?: number }
): Promise<File> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const width = Math.max(1, Math.round(pixelCrop.width));
  const height = Math.max(1, Math.round(pixelCrop.height));
  canvas.width = width;
  canvas.height = height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    width,
    height
  );

  const mimeType = opts?.mimeType ?? "image/jpeg";
  const quality = opts?.quality ?? 0.92;
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to crop image"))),
      mimeType,
      quality
    );
  });

  const base = (opts?.fileName ?? "logo").replace(/\.[^.]+$/, "") || "logo";
  const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  return new File([blob], `${base}-cropped.${ext}`, { type: mimeType });
}
