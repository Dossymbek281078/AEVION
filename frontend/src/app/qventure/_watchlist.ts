// QVenture watchlist — a per-investor saved-deals list.
//
// Two-tier store:
//   • localStorage — the instant, offline source of truth for rendering. Every
//     read/write hits it first so the UI never waits on the network and works
//     signed-out or offline.
//   • backend (/api/qventure/watchlist) — durable, cross-device persistence for
//     signed-in users. Writes mirror to the server best-effort; on sign-in,
//     syncWatchlist() unions the two and migrates any browser-only items up.
//
// The analyses themselves already persist server-side (POST /analyze); the
// watchlist only keeps a curated set of their ids plus a lightweight summary.

import { apiUrl } from "@/lib/apiBase";
import { getAuthHeaders, isAuthenticated } from "@/lib/auth";

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
  // Mirror to the server for signed-in users (best-effort; localStorage already
  // reflects the change, so a failed call never blocks or breaks the UI).
  if (isAuthenticated()) {
    void fetch(apiUrl("/api/qventure/watchlist"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(item),
    }).catch(() => { /* offline / transient — reconciled on next syncWatchlist() */ });
  }
}

export function removeFromWatchlist(id: string): void {
  write(getWatchlist().filter((x) => x.id !== id));
  if (isAuthenticated()) {
    void fetch(apiUrl(`/api/qventure/watchlist/${encodeURIComponent(id)}`), {
      method: "DELETE",
      headers: { ...getAuthHeaders() },
    }).catch(() => { /* best-effort */ });
  }
}

export function toggleWatchlist(item: WatchlistItem): boolean {
  if (isSaved(item.id)) {
    removeFromWatchlist(item.id);
    return false;
  }
  addToWatchlist(item);
  return true;
}

/**
 * Reconcile the local list with the server for a signed-in user:
 *   1. fetch the server list,
 *   2. push any browser-only items up (one-time migration on first sign-in),
 *   3. write the unioned result back to localStorage (server is authoritative
 *      for items it already has; local-only items are the ones being migrated).
 *
 * Signed-out (or on any network error) it simply returns the local list, so the
 * caller can render immediately regardless. Safe to call on every mount.
 */
export async function syncWatchlist(): Promise<WatchlistItem[]> {
  const local = getWatchlist();
  if (typeof window === "undefined" || !isAuthenticated()) return local;
  try {
    const res = await fetch(apiUrl("/api/qventure/watchlist"), {
      headers: { ...getAuthHeaders() },
    });
    if (!res.ok) return local;
    const j = await res.json();
    const server: WatchlistItem[] = Array.isArray(j?.data) ? j.data : [];
    const serverIds = new Set(server.map((x) => x.id));
    const localOnly = local.filter((x) => !serverIds.has(x.id));

    let merged = server;
    if (localOnly.length) {
      // Migrate browser-only items; the POST returns the full merged list.
      const up = await fetch(apiUrl("/api/qventure/watchlist"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ items: localOnly }),
      });
      if (up.ok) {
        const uj = await up.json();
        if (Array.isArray(uj?.data)) merged = uj.data;
      }
    }
    write(merged);
    return merged;
  } catch {
    return local;
  }
}
