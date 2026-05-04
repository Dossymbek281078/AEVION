"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { buildApi, type BuildVacancy } from "@/lib/build/api";

// Header search box: debounced typeahead against /vacancies. Click on
// a result jumps to the vacancy page; pressing Enter or "See all"
// goes to /build/vacancies?q=… so the user keeps the query.
export function HeaderSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<BuildVacancy[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!q.trim() || q.trim().length < 2) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const handle = setTimeout(() => {
      buildApi
        .listVacancies({ q: q.trim(), status: "OPEN", limit: 6 })
        .then((r) => {
          if (cancelled) return;
          setItems(r.items.slice(0, 6));
        })
        .catch(() => {
          if (!cancelled) setItems([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [q]);

  // Close dropdown when clicking outside or pressing Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    router.push(`/build/vacancies?q=${encodeURIComponent(q.trim())}`);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-xs">
      <form onSubmit={submit}>
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (e.target.value.trim().length >= 2) setOpen(true);
          }}
          onFocus={() => {
            if (q.trim().length >= 2) setOpen(true);
          }}
          placeholder="Search vacancies…"
          className="w-full rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none"
          aria-label="Search vacancies"
          aria-autocomplete="list"
          aria-expanded={open}
        />
      </form>
      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-white/10 bg-slate-900 shadow-2xl">
          {loading && (
            <div className="px-3 py-2 text-xs text-slate-400">Searching…</div>
          )}
          {!loading && items.length === 0 && (
            <div className="px-3 py-2 text-xs text-slate-500">No vacancies match.</div>
          )}
          {!loading && items.length > 0 && (
            <ul role="listbox">
              {items.map((v) => (
                <li key={v.id}>
                  <Link
                    href={`/build/vacancy/${encodeURIComponent(v.id)}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-white/5"
                  >
                    <span className="min-w-0 flex-1 truncate text-slate-200">{v.title}</span>
                    {v.salary > 0 && (
                      <span className="shrink-0 text-emerald-300">${v.salary.toLocaleString()}</span>
                    )}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href={`/build/vacancies?q=${encodeURIComponent(q.trim())}`}
                  onClick={() => setOpen(false)}
                  className="block border-t border-white/5 px-3 py-2 text-center text-xs font-semibold text-emerald-300 hover:bg-white/5"
                >
                  See all results →
                </Link>
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
