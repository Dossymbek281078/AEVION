"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buildApi, type BuildRole, type TalentRow } from "@/lib/build/api";

const TALENT_SAVED_KEY = "qbuild.talent.savedSearches.v1";
const ALERT_SEEN_KEY = "qbuild.talent.alertSeen.v1";

type Saved = {
  id: string;
  name: string;
  q: string;
  skill: string;
  city: string;
  role: BuildRole | "ALL";
  minExp: string;
  openOnly: boolean;
  verifiedOnly: boolean;
  withRatingOnly: boolean;
};

type SeenMap = Record<string, number>;

function readSeen(): SeenMap {
  try {
    const raw = localStorage.getItem(ALERT_SEEN_KEY);
    return raw ? (JSON.parse(raw) as SeenMap) : {};
  } catch {
    return {};
  }
}
function writeSeen(m: SeenMap): void {
  try { localStorage.setItem(ALERT_SEEN_KEY, JSON.stringify(m)); } catch { /* ignore */ }
}

export function SavedSearchAlerts() {
  const [hits, setHits] = useState<{ search: Saved; matches: TalentRow[] }[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = localStorage.getItem(TALENT_SAVED_KEY);
        if (!raw) {
          if (!cancelled) setHydrated(true);
          return;
        }
        const searches = JSON.parse(raw) as Saved[];
        if (!Array.isArray(searches) || searches.length === 0) {
          if (!cancelled) setHydrated(true);
          return;
        }
        const seen = readSeen();

        // Run each saved search; throttle by limiting parallelism.
        const out: { search: Saved; matches: TalentRow[] }[] = [];
        for (const s of searches) {
          const minExp = s.minExp ? Number(s.minExp) : undefined;
          try {
            const r = await buildApi.searchProfiles({
              q: s.q || undefined,
              skill: s.skill || undefined,
              city: s.city || undefined,
              role: s.role === "ALL" ? undefined : s.role,
              minExp: Number.isFinite(minExp) ? (minExp as number) : undefined,
              openToWork: s.openOnly,
              limit: 50,
            });
            const lastSeenTs = seen[s.id] || Date.now() - 7 * 86400000; // default: last 7d
            const newOnes = r.items.filter((t) => {
              const updated = t.updatedAt ? new Date(t.updatedAt).getTime() : 0;
              if (updated <= lastSeenTs) return false;
              if (s.verifiedOnly && !t.verifiedAt) return false;
              if (s.withRatingOnly && !(t.reviewCount && t.reviewCount > 0)) return false;
              return true;
            });
            if (newOnes.length > 0) out.push({ search: s, matches: newOnes });
          } catch {
            // skip silently — saved-search alerts are advisory
          }
        }
        if (!cancelled) {
          setHits(out);
          setHydrated(true);
        }
      } catch {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function dismiss(searchId: string) {
    const seen = readSeen();
    seen[searchId] = Date.now();
    writeSeen(seen);
    setHits((arr) => arr.filter((h) => h.search.id !== searchId));
  }

  if (!hydrated || hits.length === 0) return null;

  return (
    <div className="rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/10 p-4 text-sm text-fuchsia-100">
      <div className="mb-1 font-semibold text-fuchsia-50">
        ✨ New matches in your saved talent searches
      </div>
      <ul className="mt-2 space-y-2">
        {hits.map((h) => (
          <li
            key={h.search.id}
            className="flex flex-wrap items-center justify-between gap-2 border-t border-fuchsia-300/20 pt-2 text-xs"
          >
            <div className="min-w-0 flex-1">
              <span className="font-semibold text-fuchsia-50">{h.search.name}</span>
              <span className="ml-2 text-fuchsia-200/80">
                {h.matches.length} new candidate{h.matches.length === 1 ? "" : "s"}
              </span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {h.matches.slice(0, 4).map((t) => (
                  <Link
                    key={t.userId}
                    href={`/build/u/${encodeURIComponent(t.userId)}`}
                    className="rounded-full border border-fuchsia-300/30 bg-fuchsia-300/10 px-2 py-0.5 text-fuchsia-50 hover:bg-fuchsia-300/20"
                  >
                    {t.name || "Anonymous"}
                  </Link>
                ))}
                {h.matches.length > 4 && (
                  <span className="text-fuchsia-200/70">+{h.matches.length - 4}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Link
                href="/build/talent"
                className="rounded-md border border-fuchsia-300/40 bg-fuchsia-300/15 px-2.5 py-1 text-fuchsia-50 hover:bg-fuchsia-300/25"
              >
                Open talent →
              </Link>
              <button
                type="button"
                onClick={() => dismiss(h.search.id)}
                className="text-[11px] text-fuchsia-200/70 hover:text-fuchsia-50"
                title="Mark these as seen"
              >
                Dismiss
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
