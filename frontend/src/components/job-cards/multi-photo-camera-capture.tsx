"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CapturedShot = {
  id: string;
  previewUrl: string;
  file: File;
};

export type MultiPhotoCameraCaptureProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Header title, e.g. "Take After Photos" */
  title: string;
  /** Called with JPEG files when user taps Done. */
  onComplete: (files: File[]) => void | Promise<void>;
  maxPhotos?: number;
  /**
   * Optional stream (or promise) started in the same user-gesture click that opened
   * this sheet. Required for reliable live preview on iOS Safari (HTTPS only).
   */
  streamPromise?: Promise<MediaStream> | null;
};

type LegacyGetUserMedia = (
  constraints: MediaStreamConstraints,
  success: (stream: MediaStream) => void,
  error: (err: Error) => void
) => void;

function resolveGetUserMedia(): ((constraints: MediaStreamConstraints) => Promise<MediaStream>) | null {
  if (typeof navigator === "undefined") return null;

  if (navigator.mediaDevices?.getUserMedia) {
    return (constraints) => navigator.mediaDevices.getUserMedia(constraints);
  }

  const legacy =
    (navigator as Navigator & { getUserMedia?: LegacyGetUserMedia }).getUserMedia ||
    (navigator as Navigator & { webkitGetUserMedia?: LegacyGetUserMedia }).webkitGetUserMedia ||
    (navigator as Navigator & { mozGetUserMedia?: LegacyGetUserMedia }).mozGetUserMedia;

  if (!legacy) return null;

  return (constraints) =>
    new Promise((resolve, reject) => {
      legacy.call(navigator, constraints, resolve, reject);
    });
}

const VIDEO_CONSTRAINT_CANDIDATES: MediaStreamConstraints[] = [
  { audio: false, video: { facingMode: { ideal: "environment" } } },
  { audio: false, video: { facingMode: "environment" } },
  { audio: false, video: { facingMode: "user" } },
  { audio: false, video: true },
];

/** Live in-app preview requires HTTPS (or localhost). LAN IPs over HTTP cannot use getUserMedia. */
export function canUseLiveCameraPreview(): boolean {
  if (typeof window === "undefined") return false;
  if (!window.isSecureContext) return false;
  return resolveGetUserMedia() !== null;
}

/**
 * Start the camera during a click/tap handler so iOS treats it as a user gesture.
 * Only call when `canUseLiveCameraPreview()` is true; otherwise use native capture mode.
 */
export async function requestCameraStream(): Promise<MediaStream> {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    throw new Error(
      "Live camera preview needs HTTPS. On this network address, use the shutter to open your phone camera instead."
    );
  }

  const getUserMedia = resolveGetUserMedia();
  if (!getUserMedia) {
    throw new Error("Camera is not available in this browser. Use the shutter or gallery instead.");
  }

  let lastError: unknown;
  for (const constraints of VIDEO_CONSTRAINT_CANDIDATES) {
    try {
      return await getUserMedia(constraints);
    } catch (e) {
      lastError = e;
    }
  }

  if (lastError instanceof DOMException && lastError.name === "NotAllowedError") {
    throw new Error("Camera permission denied. Allow camera access and try again.");
  }
  if (lastError instanceof DOMException && lastError.name === "NotFoundError") {
    throw new Error("No camera was found on this device.");
  }
  if (lastError instanceof Error && lastError.message) {
    throw lastError;
  }
  throw new Error("Could not open camera.");
}

/**
 * In-app multi-shot camera. On HTTPS: live preview. On HTTP LAN: native device camera via capture input.
 */
export function MultiPhotoCameraCapture({
  open,
  onOpenChange,
  title,
  onComplete,
  maxPhotos = 30,
  streamPromise = null,
}: MultiPhotoCameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nativeCaptureRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [shots, setShots] = useState<CapturedShot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [nativeMode, setNativeMode] = useState(false);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const clearShots = useCallback(() => {
    setShots((prev) => {
      prev.forEach((s) => URL.revokeObjectURL(s.previewUrl));
      return [];
    });
  }, []);

  const attachStream = useCallback(async (stream: MediaStream) => {
    streamRef.current = stream;
    for (let attempt = 0; attempt < 12; attempt++) {
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.muted = true;
        video.setAttribute("playsinline", "true");
        video.setAttribute("webkit-playsinline", "true");
        await video.play().catch(() => undefined);
        return;
      }
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  }, []);

  const enterNativeMode = useCallback((message?: string | null) => {
    stopStream();
    setNativeMode(true);
    setStarting(false);
    setError(message ?? null);
  }, [stopStream]);

  const startCamera = useCallback(
    async (existing?: Promise<MediaStream> | null) => {
      if (!canUseLiveCameraPreview()) {
        enterNativeMode(null);
        return;
      }
      setNativeMode(false);
      setError(null);
      setStarting(true);
      try {
        let stream: MediaStream;
        if (existing) {
          stream = await existing;
          const live = stream.getTracks().some((t) => t.readyState === "live");
          if (!live) {
            stopStream();
            stream = await requestCameraStream();
          } else if (streamRef.current !== stream) {
            stopStream();
          }
        } else {
          stopStream();
          stream = await requestCameraStream();
        }
        await attachStream(stream);
        setNativeMode(false);
      } catch (e) {
        // Fall back to native device camera (works on HTTP LAN / denied preview).
        enterNativeMode(e instanceof Error ? e.message : "Could not open live preview.");
      } finally {
        setStarting(false);
      }
    },
    [attachStream, enterNativeMode, stopStream]
  );

  useEffect(() => {
    if (!open) {
      stopStream();
      setNativeMode(false);
      setError(null);
      return;
    }
    clearShots();
    if (!canUseLiveCameraPreview()) {
      enterNativeMode(null);
      return;
    }
    void startCamera(streamPromise);
    return () => {
      stopStream();
    };
    // Only (re)start when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional open-gated start
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleClose = () => {
    if (submitting) return;
    clearShots();
    stopStream();
    onOpenChange(false);
  };

  const appendFiles = useCallback(
    (list: FileList | null) => {
      if (!list?.length) return;
      const incoming = Array.from(list).filter((f) => f.type.startsWith("image/"));
      if (incoming.length === 0) return;
      setShots((prev) => {
        const room = Math.max(0, maxPhotos - prev.length);
        const toAdd = incoming.slice(0, room).map((file) => {
          const id = `shot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          return { id, previewUrl: URL.createObjectURL(file), file };
        });
        return [...prev, ...toAdd];
      });
    },
    [maxPhotos]
  );

  const handleLiveCapture = () => {
    const video = videoRef.current;
    if (!video || !streamRef.current || error || nativeMode) return;
    if (shots.length >= maxPhotos) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const id = `shot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const file = new File([blob], `photo-${id}.jpg`, { type: "image/jpeg" });
        const previewUrl = URL.createObjectURL(blob);
        setShots((prev) => [...prev, { id, previewUrl, file }]);
      },
      "image/jpeg",
      0.92
    );
  };

  const handleShutter = () => {
    if (submitting || shots.length >= maxPhotos) return;
    if (nativeMode || error) {
      nativeCaptureRef.current?.click();
      return;
    }
    handleLiveCapture();
  };

  const removeShot = (id: string) => {
    setShots((prev) => {
      const next = prev.filter((s) => s.id !== id);
      const removed = prev.find((s) => s.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  };

  const handleDone = async () => {
    if (shots.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const files = shots.map((s) => s.file);
      await onComplete(files);
      clearShots();
      stopStream();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const count = shots.length;
  const showNativeUi = nativeMode || !!error;

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <header className="flex shrink-0 items-center gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Camera className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          <h2 className="truncate text-sm font-semibold tracking-tight">{title}</h2>
        </div>
        {count > 0 ? (
          <span className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold tabular-nums text-primary-foreground">
            {count} captured
          </span>
        ) : null}
        <button
          type="button"
          onClick={handleClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/90 hover:bg-white/10"
          aria-label="Close camera"
          disabled={submitting}
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="relative min-h-0 flex-1 bg-black">
        <video
          ref={videoRef}
          className={cn(
            "absolute inset-0 h-full w-full object-cover",
            showNativeUi ? "invisible" : "visible"
          )}
          playsInline
          muted
          autoPlay
        />

        {showNativeUi ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
              <Camera className="h-8 w-8 text-white/90" />
            </div>
            <div className="space-y-2 max-w-sm">
              <p className="text-sm font-medium text-white">
                {nativeMode && !error
                  ? "Tap the shutter to open your phone camera"
                  : "Live preview unavailable"}
              </p>
              <p className="text-xs text-white/65 leading-relaxed">
                {error && nativeMode
                  ? error
                  : "You’re on HTTP (e.g. a LAN IP). Browsers only allow live camera preview on HTTPS. The shutter still opens the device camera."}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {canUseLiveCameraPreview() ? (
                <Button type="button" variant="secondary" size="sm" onClick={() => void startCamera(null)}>
                  Retry live preview
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-white/30 bg-transparent text-white hover:bg-white/10"
                onClick={() => galleryRef.current?.click()}
              >
                <ImagePlus className="mr-1.5 h-4 w-4" />
                Pick from gallery
              </Button>
            </div>
          </div>
        ) : starting ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm text-white/80">
            Starting camera…
          </div>
        ) : null}

        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
          <button
            type="button"
            onClick={handleShutter}
            disabled={starting || count >= maxPhotos || submitting}
            className={cn(
              "pointer-events-auto flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border-[3px] border-primary bg-white shadow-lg transition-transform active:scale-95",
              "disabled:opacity-40"
            )}
            aria-label={showNativeUi ? "Open device camera" : "Capture photo"}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black text-white">
              <Camera className="h-6 w-6" strokeWidth={2} />
            </span>
          </button>
        </div>

        {/* Native camera — works on HTTP LAN; one shot per open on most phones */}
        <input
          ref={nativeCaptureRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            appendFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => {
            appendFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {count > 0 ? (
        <div className="shrink-0 border-t border-white/10 bg-black/90 px-3 py-2">
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {shots.map((shot) => (
              <div
                key={shot.id}
                className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 border-primary"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={shot.previewUrl} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeShot(shot.id)}
                  className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow"
                  aria-label="Remove photo"
                  disabled={submitting}
                >
                  <X className="h-3 w-3" strokeWidth={3} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="shrink-0 border-t border-white/10 bg-black px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button
          type="button"
          className="h-12 w-full bg-emerald-600 text-base font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
          disabled={count === 0 || submitting}
          onClick={() => void handleDone()}
        >
          <Check className="mr-2 h-5 w-5" />
          {submitting
            ? "Saving…"
            : count === 0
              ? "Capture at least one photo"
              : `Done — Add ${count} photo${count === 1 ? "" : "s"}`}
        </Button>
      </div>
    </div>
  );
}
