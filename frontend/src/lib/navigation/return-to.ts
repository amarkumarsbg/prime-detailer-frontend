/** Safe in-app path for back navigation (blocks open redirects). */
export function safeReturnTo(from: string | null | undefined): string | null {
  if (!from || !from.startsWith("/") || from.startsWith("//")) return null;
  return from;
}

export function partyDetailReturnPath(partyId: string, tab: string): string {
  return `/parties/${encodeURIComponent(partyId)}?tab=${encodeURIComponent(tab)}`;
}

/** Append `?from=` so detail pages can navigate back to the caller. */
export function appendReturnTo(href: string, returnTo: string): string {
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}from=${encodeURIComponent(returnTo)}`;
}
