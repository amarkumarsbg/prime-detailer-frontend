const STORAGE_KEY = "prime-detailer-recent-nav";
const MAX_ITEMS = 4;

export type RecentNavEntry = {
  href: string;
  label: string;
};

function readEntries(): RecentNavEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is RecentNavEntry =>
        !!e &&
        typeof e === "object" &&
        typeof (e as RecentNavEntry).href === "string" &&
        typeof (e as RecentNavEntry).label === "string"
    );
  } catch {
    return [];
  }
}

function writeEntries(entries: RecentNavEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ITEMS)));
  } catch {
    /* ignore quota */
  }
}

/** Record a visited nav destination (deduped, most recent first). */
export function trackRecentNav(href: string, label: string) {
  const normalized = href.split("?")[0];
  if (!normalized || normalized === "/login") return;
  const existing = readEntries().filter((e) => e.href !== normalized);
  writeEntries([{ href: normalized, label }, ...existing]);
}

export function getRecentNav(): RecentNavEntry[] {
  return readEntries();
}
