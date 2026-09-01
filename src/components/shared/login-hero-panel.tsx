"use client";

import { Car, Gauge, Shield, Wrench, type LucideIcon } from "lucide-react";
import type { LoginHeroFeature } from "@/lib/login-hero-content";

const FEATURE_ICONS: LucideIcon[] = [Car, Gauge, Shield];

export type LoginHeroPanelProps = {
  businessName: string;
  logoUrl?: string;
  backgroundUrl?: string;
  heading: string;
  description: string;
  features: LoginHeroFeature[];
  /** Compact preview for settings (smaller type / padding). */
  compact?: boolean;
  className?: string;
};

/**
 * Left login hero: background (image or gradient) + dark overlay + brand + copy.
 * Shared by the real login page and Branding & Theme live preview.
 */
export function LoginHeroPanel({
  businessName,
  logoUrl,
  backgroundUrl,
  heading,
  description,
  features,
  compact = false,
  className,
}: LoginHeroPanelProps) {
  const pad = compact ? "p-4 pb-4" : "p-10 pb-8";
  const titleClass = compact
    ? "text-base font-semibold leading-snug tracking-tight"
    : "text-2xl xl:text-3xl font-semibold leading-snug tracking-tight";
  const descClass = compact
    ? "text-white/75 text-xs leading-relaxed"
    : "text-white/75 text-sm leading-relaxed max-w-md";
  const brandText = compact ? "text-sm font-semibold tracking-tight" : "text-base font-semibold tracking-tight";
  const logoSize = compact ? "h-7 w-7 rounded-md" : "h-9 w-9 rounded-lg";
  const iconWrap = compact ? "w-7 h-7 rounded-md" : "w-8 h-8 rounded-lg";
  const iconSize = compact ? "w-3.5 h-3.5" : "w-4 h-4";

  return (
    <div
      className={`relative overflow-hidden bg-linear-to-br from-teal-500 via-teal-600 to-teal-700 text-white ${className ?? ""}`}
    >
      {backgroundUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={backgroundUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Light overall dim + stronger bottom scrim so copy stays readable */}
          <div className="absolute inset-0 bg-black/20" aria-hidden />
          <div
            className="absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-t from-black/80 via-black/35 to-transparent"
            aria-hidden
          />
        </>
      ) : (
        <>
          <div className="absolute inset-0">
            <div className="absolute top-1/4 -left-20 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-teal-300/20 rounded-full blur-3xl" />
          </div>
          <div className="absolute inset-0 opacity-[0.04] bg-grid-light" />
        </>
      )}

      <div className={`relative z-10 flex flex-col justify-between h-full min-h-0 ${pad}`}>
        <div className="flex items-center gap-3 shrink-0">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className={`${logoSize} object-cover`} />
          ) : (
            <div
              className={`flex items-center justify-center ${logoSize} bg-white/15 backdrop-blur-sm`}
            >
              <Wrench className={iconSize} />
            </div>
          )}
          <span className={brandText}>{businessName}</span>
        </div>

        <div className={`mt-auto max-w-lg ${compact ? "space-y-2" : "space-y-2.5"}`}>
          <h2 className={titleClass}>{heading}</h2>
          <p className={descClass}>{description}</p>

          {features.length > 0 ? (
            <div className={`grid grid-cols-1 ${compact ? "gap-1.5 pt-0.5" : "gap-2 pt-1"}`}>
              {features.map((feature, index) => {
                const Icon = FEATURE_ICONS[index % FEATURE_ICONS.length]!;
                return (
                  <div
                    key={`${feature.title}-${index}`}
                    className={`flex items-start gap-2.5 rounded-xl bg-white/[0.07] backdrop-blur-sm border border-white/10 ${
                      compact ? "p-2" : "p-2.5"
                    }`}
                  >
                    <div
                      className={`flex items-center justify-center ${iconWrap} bg-white/10 shrink-0`}
                    >
                      <Icon className={`${iconSize} text-white/80`} />
                    </div>
                    <div className="min-w-0">
                      <p className={`font-medium ${compact ? "text-[11px]" : "text-xs"}`}>
                        {feature.title}
                      </p>
                      {feature.description ? (
                        <p className={`text-white/65 mt-0.5 ${compact ? "text-[10px]" : "text-xs"}`}>
                          {feature.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          <p className={`text-white/50 ${compact ? "text-[10px] pt-0.5" : "text-xs pt-1"}`}>
            &copy; {new Date().getFullYear()} {businessName}
          </p>
        </div>
      </div>
    </div>
  );
}
