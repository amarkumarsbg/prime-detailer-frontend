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
  const env = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "");
  if (env) {
    return `${env}${path}`;
  }
  if (typeof window !== "undefined") {
    return `/backend-api${path.slice("/api".length)}`;
  }
  return `http://127.0.0.1:4000${path}`;
}
