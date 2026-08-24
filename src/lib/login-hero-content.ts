export type LoginHeroFeature = {
  title: string;
  description: string;
};

export type LoginHeroContent = {
  heading: string;
  description: string;
  features: LoginHeroFeature[];
};

export const LOGIN_HERO_MAX_FEATURES = 3;

export const DEFAULT_LOGIN_HERO_HEADING = "Manage your business smarter, not harder.";

export const DEFAULT_LOGIN_HERO_DESCRIPTION =
  "The all-in-one platform to streamline operations, track services, and grow your automotive business.";

export const DEFAULT_LOGIN_HERO_FEATURES: LoginHeroFeature[] = [
  {
    title: "Vehicle Tracking",
    description: "Complete service history at your fingertips",
  },
  {
    title: "Real-time Dashboard",
    description: "Monitor KPIs and daily operations live",
  },
  {
    title: "Secure & Reliable",
    description: "Enterprise-grade data protection",
  },
];

/** Normalize a features payload: max 3, string fields only. */
export function normalizeLoginHeroFeatures(raw: unknown): LoginHeroFeature[] {
  if (!Array.isArray(raw)) return [];
  const out: LoginHeroFeature[] = [];
  for (const item of raw) {
    if (out.length >= LOGIN_HERO_MAX_FEATURES) break;
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title.trim() : "";
    const description = typeof o.description === "string" ? o.description.trim() : "";
    out.push({ title, description });
  }
  return out;
}

/**
 * Resolve display-ready hero copy.
 * - Empty heading/description → product defaults
 * - `features === undefined` / null (unset) → default feature list
 * - `features === []` → hide features (empty array)
 * - Otherwise use provided features (trimmed; rows with empty title omitted on display)
 */
export function resolveLoginHeroContent(partial: {
  heading?: string | null;
  description?: string | null;
  features?: LoginHeroFeature[] | null;
}): LoginHeroContent {
  const heading = String(partial.heading ?? "").trim() || DEFAULT_LOGIN_HERO_HEADING;
  const description =
    String(partial.description ?? "").trim() || DEFAULT_LOGIN_HERO_DESCRIPTION;

  let features: LoginHeroFeature[];
  if (partial.features === undefined || partial.features === null) {
    features = DEFAULT_LOGIN_HERO_FEATURES;
  } else {
    features = partial.features
      .map((f) => ({
        title: String(f.title ?? "").trim(),
        description: String(f.description ?? "").trim(),
      }))
      .filter((f) => f.title.length > 0)
      .slice(0, LOGIN_HERO_MAX_FEATURES);
  }

  return { heading, description, features };
}
