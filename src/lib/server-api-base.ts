/** Express API origin for Next.js route handlers (server-side only). */
export function getServerApiOrigin(): string {
  return (
    process.env.BACKEND_PROXY_TARGET?.replace(/\/+$/, "") ??
    process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/api$/i, "").replace(/\/+$/, "") ??
    "http://127.0.0.1:4000"
  );
}

export function serverApiUrl(apiPath: string): string {
  const path = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  return `${getServerApiOrigin()}${path}`;
}
