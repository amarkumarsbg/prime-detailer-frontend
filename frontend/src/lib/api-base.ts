/**
 * Resolves the URL for the Express API (`/api/...` on the backend).
 * - If `NEXT_PUBLIC_API_URL` is set, requests go there (production / explicit dev).
 * - Otherwise in the browser, use `/backend-api/...` so Next can proxy to the PC
 *   running the API (fixes LAN / phone testing where `localhost:4000` is wrong).
 */
export function buildApiUrl(apiPath: string): string {
  const path = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  if (!path.startsWith("/api/")) {
    throw new Error(`buildApiUrl: path must start with /api/, got ${path}`);
  }
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, "");
  /** Paths already include `/api/…`; strip accidental `/api` suffix so `…onrender.com/api` doesn't become `/api/api/…`. */
  const env = raw?.replace(/\/api$/i, "") ?? "";
  if (env) {
    return `${env}${path}`;
  }
  if (typeof window !== "undefined") {
    /** Dev-only: Next.js rewrites `/backend-api/*` → local Express. On Vercel prod there is no local API — must set `NEXT_PUBLIC_API_URL`. */
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "NEXT_PUBLIC_API_URL is not set. In Vercel → Project → Settings → Environment Variables, add NEXT_PUBLIC_API_URL = https://your-service.onrender.com (no trailing slash, no /api), save, then Redeploy."
      );
    }
    return `/backend-api${path.slice("/api".length)}`;
  }
  return `http://127.0.0.1:4000${path}`;
}

const ABS_URL_RE = /^https?:\/\//i;

/**
 * Stored user avatar paths from the API (`/uploads/avatars/...`) must be turned into a URL the browser can load.
 * Absolute URLs are returned as-is (legacy rows). Matches {@link buildApiUrl} host logic including `/backend-uploads` in dev.
 */
export function resolveUploadsPublicUrl(stored: string | undefined | null): string | undefined {
  if (stored == null || stored.trim() === "") return undefined;
  const s = stored.trim();
  if (ABS_URL_RE.test(s)) return s;
  /** Inline avatars saved via staff profile edit (no separate upload API). */
  if (s.startsWith("data:") || s.startsWith("blob:")) return s;
  const path = s.startsWith("/") ? s : `/${s}`;
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, "");
  const envBase = raw?.replace(/\/api$/i, "") ?? "";
  if (envBase) {
    return `${envBase}${path}`;
  }
  if (typeof window !== "undefined") {
    if (process.env.NODE_ENV === "production") {
      return undefined;
    }
    const rest = path.replace(/^\/uploads\/?/, "");
    return `/backend-uploads/${rest}`;
  }
  return `http://127.0.0.1:4000${path}`;
}
