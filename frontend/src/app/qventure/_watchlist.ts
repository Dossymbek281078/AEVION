// QVenture watchlist — a per-investor saved-deals list.
//
// Store: localStorage (source of truth), so the list is private to this browser.
// We deliberately do NOT persist the watchlist server-side: this module has no
// per-user auth, so a backend list would be a single shared global list leaking
// everyone's deals together. The analyses themselves already persist in the
// backend (POST /analyze); the watchlist only keeps a curated set of their ids
// plus a lightweight summary so the table renders with zero network calls.

export interface WatchlistItem {
  id: string;
  name: string;
  sector: string;
  stage: string;
  composite: number;
  verdict: string;
  savedAt: string; // ISO
}

const KEY = "qventure:watchlist";
const MAX = 200;

export function getWatchlist(): WatchlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as WatchlistItem[]) : [];
  } catch {
    return [];
  }
}

function write(items: WatchlistItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
    // Notify listeners in the same tab (storage event only fires cross-tab).
    window.dispatchEvent(new Event("qventure:watchlist"));
  } catch {
    /* quota / private mode — non-fatal */
  }
}

export function isSaved(id: string): boolean {
  return getWatchlist().some((x) => x.id === id);
}

export function addToWatchlist(item: WatchlistItem): void {
  const items = getWatchlist().filter((x) => x.id !== item.id);
  items.unshift(item);
  write(items);
}

export function removeFromWatchlist(id: string): void {
  write(getWatchlist().filter((x) => x.id !== id));
}

export function toggleWatchlist(item: WatchlistItem): boolean {
  if (isSaved(item.id)) {
    removeFromWatchlist(item.id);
    return false;
  }
  addToWatchlist(item);
  return true;
}
