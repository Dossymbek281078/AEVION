"use client";

import { useEffect, useState } from "react";
import { buildApi } from "@/lib/build/api";
import { useBuildAuth } from "@/lib/build/auth";

// Tiny client-side cache so we don't refetch the entire bookmarks list
// every time a card mounts. Refreshed on first toggle. Module-scoped.
let savedSet: Set<string> | null = null;
let inflight: Promise<Set<string>> | null = null;

function key(kind: "VACANCY" | "CANDIDATE", targetId: string) {
  return `${kind}:${targetId}`;
}

async function getSavedSet(): Promise<Set<string>> {
  if (savedSet) return savedSet;
  if (inflight) return inflight;
  inflight = (async () => {
    const r = await buildApi.listBookmarks();
    const s = new Set<string>(r.items.map((b) => key(b.kind, b.targetId)));
    savedSet = s;
    return s;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export function BookmarkButton({
  kind,
  targetId,
  className = "",
}: {
  kind: "VACANCY" | "CANDIDATE";
  targetId: string;
  className?: string;
}) {
  const token = useBuildAuth((s) => s.token);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getSavedSet()
      .then((set) => {
        if (cancelled) return;
        setSaved(set.has(key(kind, targetId)));
        setHydrated(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token, kind, targetId]);

  if (!token) return null;

  return (
    <button
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (busy) return;
        setBusy(true);
        try {
          const r = await buildApi.toggleBookmark({ kind, targetId });
          setSaved(r.saved);
          // Mutate the module-level cache so other cards repaint correctly.
          if (savedSet) {
            const k = key(kind, targetId);
            if (r.saved) savedSet.add(k);
            else savedSet.delete(k);
          }
        } catch {}
        finally {
          setBusy(false);
        }
      }}
      title={saved ? "Remove from saved" : "Save"}
      aria-label={saved ? "Remove from saved" : "Save"}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md border text-sm transition disabled:opacity-50 ${
        saved
          ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
          : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-amber-200"
      } ${className}`}
    >
      {hydrated || saved ? (saved ? "★" : "☆") : "☆"}
    </button>
  );
}
