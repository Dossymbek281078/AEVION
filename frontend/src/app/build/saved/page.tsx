"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi, type HydratedBookmark } from "@/lib/build/api";
import { Skeleton } from "@/components/build/Skeleton";

type Tab = "VACANCY" | "CANDIDATE";

export default function SavedPage() {
  return (
    <BuildShell>
      <RequireAuth>
        <SavedBody />
      </RequireAuth>
    </BuildShell>
  );
}

function SavedBody() {
  const [tab, setTab] = useState<Tab>("VACANCY");
  const [items, setItems] = useState<HydratedBookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    buildApi
      .listBookmarks(tab)
      .then((r) => {
        if (!cancelled) setItems(r.items);
      })
      .catch((e) => !cancelled && setError((e as Error).message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const counts = { VACANCY: 0, CANDIDATE: 0 } as Record<Tab, number>;
  // Don't pre-fetch counts (would need a 2nd request); show only the
  // count for the active tab. /build/saved is a low-traffic page anyway.

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Saved</h1>
        <p className="mt-1 text-sm text-slate-400">
          Bookmarked vacancies and candidates. ★ on any card to add or remove.
        </p>
      </div>

      <div className="mb-5 inline-flex rounded-full border border-white/10 bg-white/5 p-1 text-xs">
        <button
          onClick={() => setTab("VACANCY")}
          className={`rounded-full px-4 py-1.5 ${
            tab === "VACANCY" ? "bg-emerald-500 text-emerald-950 font-semibold" : "text-slate-300"
          }`}
        >
          Vacancies {tab === "VACANCY" && counts.VACANCY ? `· ${items.length}` : ""}
        </button>
        <button
          onClick={() => setTab("CANDIDATE")}
          className={`rounded-full px-4 py-1.5 ${
            tab === "CANDIDATE" ? "bg-emerald-500 text-emerald-950 font-semibold" : "text-slate-300"
          }`}
        >
          Candidates {tab === "CANDIDATE" && counts.CANDIDATE ? `· ${items.length}` : ""}
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}

      {loading && (
        <div className="grid gap-3 sm:grid-cols-2" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <Skeleton width="60%" height={14} />
              <Skeleton width="40%" height={11} className="mt-2" />
              <div className="mt-3 flex justify-between">
                <Skeleton width={60} height={11} />
                <Skeleton width={80} height={11} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-10 text-center">
          <div className="text-5xl">{tab === "VACANCY" ? "🔖" : "👥"}</div>
          <p className="mt-3 text-sm text-slate-300">
            No saved {tab === "VACANCY" ? "vacancies" : "candidates"} yet.
          </p>
          <p className="mt-1.5 text-xs text-slate-500">
            ★ on any card to bookmark it for later.
          </p>
          <Link
            href={tab === "VACANCY" ? "/build/vacancies" : "/build/talent"}
            className="mt-4 inline-block rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold text-emerald-950 hover:bg-emerald-400"
          >
            {tab === "VACANCY" ? "Browse vacancies →" : "Browse talent →"}
          </Link>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((b) => (
            <SavedRow key={b.id} bookmark={b} />
          ))}
        </div>
      )}
    </>
  );
}

function SavedRow({ bookmark }: { bookmark: HydratedBookmark }) {
  const t = bookmark.target as Record<string, unknown> | null;
  if (!t) {
    return (
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-xs text-rose-200">
        Target not available — may have been removed.{" "}
        <button
          onClick={async () => {
            await buildApi.toggleBookmark({
              kind: bookmark.kind,
              targetId: bookmark.targetId,
            });
            window.location.reload();
          }}
          className="underline"
        >
          Remove
        </button>
      </div>
    );
  }

  if (bookmark.kind === "VACANCY") {
    const v = t as { id: string; title: string; salary: number; status: string; projectTitle?: string; projectCity?: string; createdAt: string };
    return (
      <Link
        href={`/build/vacancy/${v.id}`}
        className="block rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 transition hover:border-amber-500/60"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-semibold text-white">{v.title}</div>
            {v.projectTitle && (
              <div className="truncate text-xs text-slate-400">
                {v.projectTitle}
                {v.projectCity ? ` · ${v.projectCity}` : ""}
              </div>
            )}
          </div>
          <div className="shrink-0 text-right text-sm font-semibold text-emerald-300">
            {v.salary > 0 ? `$${v.salary.toLocaleString()}` : "—"}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
          <span>{v.status}</span>
          <span>★ saved {new Date(bookmark.createdAt).toLocaleDateString()}</span>
        </div>
      </Link>
    );
  }

  const c = t as {
    userId: string;
    name: string;
    title: string | null;
    city: string | null;
    skills: string[];
    experienceYears: number;
    photoUrl: string | null;
    openToWork: boolean;
    verifiedAt: string | null;
  };
  const initials = c.name
    .split(/\s+/)
    .map((s) => s.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <Link
      href={`/build/u/${encodeURIComponent(c.userId)}`}
      className="block rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 transition hover:border-amber-500/60"
    >
      <div className="flex items-start gap-3">
        {c.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={c.photoUrl}
            alt={c.name}
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-200">
            {initials || "?"}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate font-semibold text-white">{c.name}</div>
            {c.verifiedAt && (
              <span className="rounded-full bg-sky-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-sky-200">
                ✓
              </span>
            )}
            {c.openToWork && (
              <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-200">
                open
              </span>
            )}
          </div>
          {c.title && <div className="truncate text-xs text-emerald-200/80">{c.title}</div>}
          <div className="mt-0.5 text-xs text-slate-400">
            {c.city || "—"} · {c.experienceYears}y
          </div>
        </div>
      </div>
      <div className="mt-2 text-xs text-slate-500">
        ★ saved {new Date(bookmark.createdAt).toLocaleDateString()}
      </div>
    </Link>
  );
}
