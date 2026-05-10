"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  readCompare,
  writeCompare,
  type CompareEntry,
} from "@/lib/build/compareList";

export function CompareBar() {
  const [items, setItems] = useState<CompareEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(readCompare());
    setHydrated(true);
    function refresh() {
      setItems(readCompare());
    }
    window.addEventListener("qbuild-compare-change", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("qbuild-compare-change", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  if (!hydrated || items.length === 0) return null;

  function remove(id: string) {
    const next = items.filter((i) => i.id !== id);
    writeCompare(next);
    setItems(next);
  }

  function clear() {
    writeCompare([]);
    setItems([]);
  }

  const ids = items.map((i) => i.id).join(",");

  return (
    <div className="fixed bottom-4 left-1/2 z-40 w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 p-3 shadow-xl backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-fuchsia-200">
          Compare ({items.length}/3)
        </span>
        {items.map((it) => (
          <span
            key={it.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-2.5 py-0.5 text-xs text-slate-100"
          >
            <span className="max-w-[140px] truncate" title={it.title}>{it.title}</span>
            <button
              type="button"
              onClick={() => remove(it.id)}
              aria-label={`Remove ${it.title}`}
              className="text-fuchsia-200/70 hover:text-fuchsia-100"
            >
              ×
            </button>
          </span>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={clear}
            className="text-[11px] text-slate-400 hover:text-slate-200"
          >
            Clear
          </button>
          {items.length >= 2 ? (
            <Link
              href={`/build/compare?ids=${encodeURIComponent(ids)}`}
              className="rounded-md bg-fuchsia-500/30 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-fuchsia-500/50"
            >
              Compare →
            </Link>
          ) : (
            <span className="text-[11px] text-slate-400">Pick 2-3 to compare</span>
          )}
        </div>
      </div>
    </div>
  );
}
