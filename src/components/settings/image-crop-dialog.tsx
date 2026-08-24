"use client";

import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { getCroppedImageFile } from "@/lib/crop-image";
import { cn } from "@/lib/utils";

type ImageCropDialogProps = {
  open: boolean;
  imageSrc: string | null;
  title?: string;
  description?: string;
  /** Crop aspect ratio. Default 1 (square logo). */
  aspect?: number;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (file: File) => void | Promise<void>;
};

export function ImageCropDialog({
  open,
  imageSrc,
  title = "Adjust image",
  description = "Drag to reposition. Use zoom to frame the part you want to keep.",
  aspect = 1,
  confirmLabel = "Use this crop",
  onCancel,
  onConfirm,
}: ImageCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setBusy(false);
  }, [open, imageSrc]);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleConfirm = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setBusy(true);
    try {
      const file = await getCroppedImageFile(imageSrc, croppedAreaPixels, {
        fileName: "company-logo",
        mimeType: "image/jpeg",
        quality: 0.92,
      });
      await onConfirm(file);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-lg gap-0 p-0 overflow-hidden">
        <DialogHeader className="space-y-1 border-b border-border px-4 py-3 sm:px-5">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="relative h-[min(52vh,360px)] w-full bg-neutral-950">
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              showGrid
              objectFit="contain"
            />
          ) : null}
        </div>

        <div className="space-y-2 border-t border-border px-4 py-3 sm:px-5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="logo-crop-zoom" className="text-xs text-muted-foreground">
              Zoom
            </Label>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {zoom.toFixed(1)}×
            </span>
          </div>
          <input
            id="logo-crop-zoom"
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className={cn(
              "w-full accent-primary",
              "h-2 cursor-pointer appearance-none rounded-full bg-muted"
            )}
            disabled={busy || !imageSrc}
          />
        </div>

        <DialogFooter className="border-t border-border px-4 py-3 sm:px-5">
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy || !croppedAreaPixels}
            onClick={() => void handleConfirm()}
          >
            {busy ? "Saving…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
