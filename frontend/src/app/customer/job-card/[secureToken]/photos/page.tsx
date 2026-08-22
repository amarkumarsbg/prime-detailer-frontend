"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiGet } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Car,
  User,
  FileText,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  Maximize2,
  X,
  Sliders,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PublicJobCardPhotosData {
  jobCard: {
    id: string;
    jobNumber: string;
    customerName: string;
    vehicleMakeModel: string;
    vehicleRegNumber: string;
    status: string;
    inspectionPhotos: Array<{
      id: string;
      type: "BEFORE" | "AFTER" | "before" | "after";
      url: string;
      caption?: string;
      uploadedAt: string;
    }>;
  };
  businessSettings: {
    businessName: string;
    logoUrl: string | null;
  };
}

export default function CustomerPhotosPage() {
  const params = useParams();
  const secureToken = params.secureToken as string;

  const [data, setData] = useState<PublicJobCardPhotosData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active tab: "before" | "after" | "compare"
  const [activeTab, setActiveTab] = useState<"before" | "after" | "compare">("before");

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxPhotos, setLightboxPhotos] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Comparison state
  const [sliderPos, setSliderPos] = useState(50);
  const [selectedBeforeIndex, setSelectedBeforeIndex] = useState(0);
  const [selectedAfterIndex, setSelectedAfterIndex] = useState(0);

  useEffect(() => {
    if (!secureToken) return;
    setLoading(true);
    setError(null);
    apiGet<PublicJobCardPhotosData>(`/api/public/job-cards/${secureToken}/photos`)
      .then((res) => {
        setData(res);
        setLoading(false);
        
        // Auto-switch to "after" or "compare" if before is empty but after has photos
        const beforeCount = (res.jobCard.inspectionPhotos ?? []).filter(
          (p) => p.type.toLowerCase() === "before"
        ).length;
        const afterCount = (res.jobCard.inspectionPhotos ?? []).filter(
          (p) => p.type.toLowerCase() === "after"
        ).length;
        
        if (beforeCount === 0 && afterCount > 0) {
          setActiveTab("after");
        } else if (beforeCount > 0 && afterCount > 0) {
          setActiveTab("compare");
        }
      })
      .catch((err) => {
        console.error("Public job card photos fetch error", err);
        setError("Photos link is invalid, expired, or failed to load.");
        setLoading(false);
      });
  }, [secureToken]);

  // Filter photos
  const beforePhotos = useMemo(() => {
    if (!data) return [];
    return (data.jobCard.inspectionPhotos ?? []).filter(
      (p) => p.type.toLowerCase() === "before"
    );
  }, [data]);

  const afterPhotos = useMemo(() => {
    if (!data) return [];
    return (data.jobCard.inspectionPhotos ?? []).filter(
      (p) => p.type.toLowerCase() === "after"
    );
  }, [data]);

  const openLightbox = (photos: string[], index: number) => {
    setLightboxPhotos(photos);
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const handlePrevLightbox = () => {
    setLightboxIndex((prev) => (prev === 0 ? lightboxPhotos.length - 1 : prev - 1));
  };

  const handleNextLightbox = () => {
    setLightboxIndex((prev) => (prev === lightboxPhotos.length - 1 ? 0 : prev + 1));
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="mt-4 text-sm font-medium text-muted-foreground">Loading vehicle photos...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 text-center dark:bg-slate-950">
        <div className="rounded-full bg-rose-100 p-3 text-rose-600 dark:bg-rose-950/50">
          <X className="h-8 w-8" />
        </div>
        <h1 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">Link Invalid or Expired</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {error || "The requested vehicle photos could not be loaded. Please contact the workshop."}
        </p>
      </div>
    );
  }

  const { jobCard, businessSettings } = data;

  const statusColors: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
    PENDING: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
    IN_PROGRESS: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
    READY: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
    DELIVERED: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300",
    CANCELLED: "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300",
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-12 dark:bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            {businessSettings.logoUrl ? (
              <img
                src={businessSettings.logoUrl}
                alt={businessSettings.businessName}
                className="h-8 w-8 rounded-md object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Sparkles className="h-4.5 w-4.5" />
              </div>
            )}
            <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
              {businessSettings.businessName}
            </span>
          </div>
          <span className="text-xs font-semibold text-muted-foreground">Vehicle Gallery</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-6">
        {/* Hero Card */}
        <Card className="border-none bg-white shadow-sm dark:bg-slate-900">
          <CardContent className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                    {jobCard.vehicleMakeModel}
                  </h1>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {jobCard.vehicleRegNumber}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Customer: <span className="font-semibold text-slate-800 dark:text-slate-200">{jobCard.customerName}</span>
                </p>
              </div>
              <div className="flex items-center gap-2.5 self-start sm:self-center">
                <div className="text-right sm:block hidden">
                  <p className="text-[11px] text-muted-foreground">Job Card</p>
                  <p className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                    {jobCard.jobNumber}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold",
                    statusColors[jobCard.status] || "bg-slate-100 text-slate-800"
                  )}
                >
                  {jobCard.status === "READY" || jobCard.status === "DELIVERED" ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <Clock className="h-3.5 w-3.5" />
                  )}
                  {jobCard.status}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="mt-6 flex rounded-lg bg-slate-200/60 p-1 dark:bg-slate-800/60">
          <button
            onClick={() => setActiveTab("before")}
            className={cn(
              "flex-1 rounded-md py-2 text-center text-xs font-bold transition-all",
              activeTab === "before"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                : "text-muted-foreground hover:text-slate-900 dark:hover:text-white"
            )}
          >
            Before Photos ({beforePhotos.length})
          </button>
          <button
            onClick={() => setActiveTab("after")}
            className={cn(
              "flex-1 rounded-md py-2 text-center text-xs font-bold transition-all",
              activeTab === "after"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                : "text-muted-foreground hover:text-slate-900 dark:hover:text-white"
            )}
          >
            After Photos ({afterPhotos.length})
          </button>
          <button
            onClick={() => setActiveTab("compare")}
            className={cn(
              "flex-1 rounded-md py-2 text-center text-xs font-bold transition-all",
              activeTab === "compare"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                : "text-muted-foreground hover:text-slate-900 dark:hover:text-white"
            )}
          >
            Compare Before/After
          </button>
        </div>

        {/* Tab Contents */}
        <div className="mt-6">
          {activeTab === "before" && (
            <div>
              {beforePhotos.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-800">
                  <ImageIcon className="h-10 w-10 text-muted-foreground/60" />
                  <p className="mt-3 text-sm font-medium text-muted-foreground">No Before photos uploaded yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {beforePhotos.map((photo, index) => (
                    <div
                      key={photo.id}
                      onClick={() => openLightbox(beforePhotos.map((p) => p.url), index)}
                      className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-slate-100 border border-slate-200 dark:bg-slate-900 dark:border-slate-800"
                    >
                      <img
                        src={photo.url}
                        alt={photo.caption || "Before photo"}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100 flex items-end p-2">
                        <span className="text-[10px] font-medium text-white line-clamp-1">
                          {photo.caption || "Click to enlarge"}
                        </span>
                      </div>
                      <div className="absolute right-2 top-2 rounded-full bg-black/40 p-1.5 text-white backdrop-blur-sm opacity-80 hover:opacity-100">
                        <Maximize2 className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "after" && (
            <div>
              {afterPhotos.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-800">
                  <ImageIcon className="h-10 w-10 text-muted-foreground/60" />
                  <p className="mt-3 text-sm font-medium text-muted-foreground">No After photos uploaded yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {afterPhotos.map((photo, index) => (
                    <div
                      key={photo.id}
                      onClick={() => openLightbox(afterPhotos.map((p) => p.url), index)}
                      className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-slate-100 border border-slate-200 dark:bg-slate-900 dark:border-slate-800"
                    >
                      <img
                        src={photo.url}
                        alt={photo.caption || "After photo"}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100 flex items-end p-2">
                        <span className="text-[10px] font-medium text-white line-clamp-1">
                          {photo.caption || "Click to enlarge"}
                        </span>
                      </div>
                      <div className="absolute right-2 top-2 rounded-full bg-black/40 p-1.5 text-white backdrop-blur-sm opacity-80 hover:opacity-100">
                        <Maximize2 className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "compare" && (
            <div>
              {beforePhotos.length === 0 || afterPhotos.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-800">
                  <Sliders className="h-10 w-10 text-muted-foreground/60" />
                  <p className="mt-3 text-sm font-medium text-muted-foreground">
                    Requires both Before and After photos to compare.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Image Selectors (if multiple photos exist) */}
                  <div className="grid grid-cols-2 gap-4">
                    {beforePhotos.length > 1 && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Before Image</label>
                        <select
                          value={selectedBeforeIndex}
                          onChange={(e) => setSelectedBeforeIndex(Number(e.target.value))}
                          className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium dark:border-slate-800 dark:bg-slate-900"
                        >
                          {beforePhotos.map((p, idx) => (
                            <option key={p.id} value={idx}>
                              {p.caption || `Before Photo ${idx + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {afterPhotos.length > 1 && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">After Image</label>
                        <select
                          value={selectedAfterIndex}
                          onChange={(e) => setSelectedAfterIndex(Number(e.target.value))}
                          className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium dark:border-slate-800 dark:bg-slate-900"
                        >
                          {afterPhotos.map((p, idx) => (
                            <option key={p.id} value={idx}>
                              {p.caption || `After Photo ${idx + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Comparison Slider */}
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900 select-none">
                    {/* Before Image (Background) */}
                    <img
                      src={beforePhotos[selectedBeforeIndex]?.url}
                      alt="Before"
                      className="absolute inset-0 h-full w-full object-cover"
                      draggable={false}
                    />
                    <div className="absolute left-3 top-3 z-10 rounded bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                      BEFORE
                    </div>

                    {/* After Image (Foreground Overlay) */}
                    <div
                      className="absolute inset-0 overflow-hidden"
                      style={{ width: `${sliderPos}%` }}
                    >
                      <img
                        src={afterPhotos[selectedAfterIndex]?.url}
                        alt="After"
                        className="absolute inset-0 h-full w-full object-cover"
                        style={{ width: "100%", maxWidth: "none" }}
                        draggable={false}
                      />
                      <div className="absolute left-3 top-3 z-10 rounded bg-emerald-600/90 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                        AFTER
                      </div>
                    </div>

                    {/* Slider Line & Handle */}
                    <div
                      className="absolute bottom-0 top-0 w-1 bg-white shadow-[0_0_10px_rgba(0,0,0,0.3)]"
                      style={{ left: `${sliderPos}%` }}
                    >
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary p-1.5 text-white shadow-lg">
                        <Sliders className="h-3.5 w-3.5 rotate-90" />
                      </div>
                    </div>

                    {/* Invisible Range Input for Drag Control */}
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={sliderPos}
                      onChange={(e) => setSliderPos(Number(e.target.value))}
                      className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
                    />
                  </div>

                  <p className="text-center text-xs text-muted-foreground">
                    Drag or touch-slide left/right on the image to compare Before & After results.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm">
          {/* Close button */}
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Photo container */}
          <div className="flex flex-1 items-center justify-center p-4">
            <img
              src={lightboxPhotos[lightboxIndex]}
              alt="Enlarged view"
              className="max-h-[80vh] max-w-full rounded-lg object-contain"
            />

            {/* Navigation buttons */}
            {lightboxPhotos.length > 1 && (
              <>
                <button
                  onClick={handlePrevLightbox}
                  className="absolute left-4 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  onClick={handleNextLightbox}
                  className="absolute right-4 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}
          </div>

          {/* Caption / Index indicator */}
          <div className="p-6 text-center text-white">
            <p className="text-sm font-semibold">
              Photo {lightboxIndex + 1} of {lightboxPhotos.length}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
