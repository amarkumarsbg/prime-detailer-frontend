"use client";

interface FilterBannerProps {
  message: string;
  onDismiss: () => void;
}

export function FilterBanner({ message, onDismiss }: FilterBannerProps) {
  return (
    <div
      className="flex items-center justify-between gap-4 rounded-lg border px-4 py-2.5 text-[13px]"
      style={{
        backgroundColor: "#FFFBEB",
        borderColor: "#FCD34D",
        color: "#92400E",
      }}
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 cursor-pointer font-semibold hover:opacity-80"
        style={{ color: "#92400E" }}
      >
        × Clear filter
      </button>
    </div>
  );
}
