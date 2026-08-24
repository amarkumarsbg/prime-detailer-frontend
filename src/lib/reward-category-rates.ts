/**
 * Staff / mechanic reward (incentive) % linked to Service Management categories.
 * Category rates from Settings → Rewards override the per-service catalog default
 * when set; otherwise the service's own `incentivePercent` is used.
 */

export type RewardCategoryIncentivePercents = Record<string, number>;

export function normalizeRewardCategoryIncentivePercents(
  raw: unknown
): RewardCategoryIncentivePercents {
  if (!raw || typeof raw !== "object") return {};
  const out: RewardCategoryIncentivePercents = {};
  for (const [key, v] of Object.entries(raw as Record<string, unknown>)) {
    const id = key.trim();
    if (!id) continue;
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    if (!Number.isFinite(n)) continue;
    out[id] = Math.min(100, Math.max(0, Math.round(n * 100) / 100));
  }
  return out;
}

export function clampIncentivePercent(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(100, Math.max(0, Math.round(value * 100) / 100));
}

/**
 * Resolve reward % for a catalog service.
 * 1) Category rate from settings (when defined for `service.category`)
 * 2) Else the service's own `incentivePercent`
 * 3) Else `fallbackPercent` (global default)
 */
export function resolveServiceRewardPercent(
  service: { category?: string; incentivePercent?: number; isHighEnd?: boolean },
  categoryRates: RewardCategoryIncentivePercents,
  opts?: { fallbackPercent?: number; highEndPercent?: number }
): number {
  const fallback = clampIncentivePercent(opts?.fallbackPercent ?? 0);
  const highEnd = clampIncentivePercent(opts?.highEndPercent ?? fallback, fallback);

  if (service.isHighEnd === true) {
    const catId = service.category?.trim();
    if (catId && categoryRates[catId] != null) {
      return clampIncentivePercent(categoryRates[catId]!, highEnd);
    }
    return highEnd;
  }

  const catId = service.category?.trim();
  if (catId && categoryRates[catId] != null) {
    return clampIncentivePercent(categoryRates[catId]!, fallback);
  }

  if (service.incentivePercent != null && Number.isFinite(service.incentivePercent)) {
    return clampIncentivePercent(service.incentivePercent, fallback);
  }

  return fallback;
}

/** Average reward % across selected catalog services (equal weight per line). */
export function averageServiceRewardPercent(
  services: { category?: string; incentivePercent?: number; isHighEnd?: boolean }[],
  categoryRates: RewardCategoryIncentivePercents,
  opts?: { fallbackPercent?: number; highEndPercent?: number }
): number {
  if (services.length === 0) return clampIncentivePercent(opts?.fallbackPercent ?? 0);
  const sum = services.reduce(
    (acc, s) => acc + resolveServiceRewardPercent(s, categoryRates, opts),
    0
  );
  return clampIncentivePercent(sum / services.length);
}
