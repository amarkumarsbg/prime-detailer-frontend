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
