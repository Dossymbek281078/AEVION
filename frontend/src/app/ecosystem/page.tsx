"use client";

/**
 * /ecosystem — cross-module hub.
 *
 * Two surfaces in one page:
 *
 *   1. Activity Feed — merged stream of qsocial posts, qmedia tracks, qnews
 *      articles, qright registrations, planet submissions, and the current
 *      user's earnings ledger. Driven by GET /api/ecosystem/activity. A row of
 *      filter chips toggles per-source visibility client-side (server still
 *      returns the full merged list so chip counters stay stable); the "mine
 *      only" toggle re-fetches with `?mine=1` because that semantically
 *      requires server-side filtering (we don't ship other users' rows).
 *
 *   2. Module health-matrix — every module from the registry rendered as a
 *      table coloured by tier, with a "user touch" indicator for modules
 *      where the current user has earnings activity. Driven by
 *      GET /api/ecosystem/graph (we use .matrix + .byHealth + .userTouchedCount).
 *
 * Auth: the ecosystem router requires Bearer. We pull the token from the same
 * localStorage key the rest of the app uses (aevion_auth_token_v1).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";

const TOKEN_KEY = "aevion_auth_token_v1";

type ActivityItem = {
  id: string;
  module:
    | "qsocial"
    | "qmedia-track"
    | "qmedia-video"
    | "qnews"
    | "qright"
    | "planet"
    | "earnings";
  kind: string;
  title: string;
  summary: string | null;
  href: string | null;
  actorId: string | null;
  at: string;
  meta: Record<string, unknown>;
};

type ActivityResponse = {
  generatedAt: string;
  total: number;
  returned: number;
  bySource: Record<string, number>;
  filter: { sources: string[]; mine: boolean; limit: number };
  items: ActivityItem[];
};

type MatrixRow = {
  id: string;
  code: string;
  name: string;
  tier: string;
  status: string;
  apiCount: number;
  primaryPath: string | null;
  health: "live" | "api" | "portal" | "unknown";
  userTouch: number;
};

type GraphResponse = {
  generatedAt: string;
  moduleCount: number;
  apiCount: number;
  edgeCount: number;
  byHealth: Record<string, number>;
  userTouchedCount: number;
  matrix: MatrixRow[];
};

const SOURCE_LABEL: Record<ActivityItem["module"], string> = {
  qsocial: "Social",
  "qmedia-track": "Media",
  "qmedia-video": "Video",
  qnews: "News",
  qright: "QRight",
  planet: "Planet",
  earnings: "Earnings",
};

const SOURCE_ACCENT: Record<ActivityItem["module"], string> = {
  qsocial: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
  "qmedia-track": "bg-pink-500/15 text-pink-300 border-pink-500/30",
  "qmedia-video": "bg-rose-500/15 text-rose-300 border-rose-500/30",
  qnews: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  qright: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  planet: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  earnings: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
};

const HEALTH_LABEL: Record<MatrixRow["health"], string> = {
  live: "MVP live",
  api: "Platform API",
  portal: "Portal only",
  unknown: "Unknown",
};

const HEALTH_ACCENT: Record<MatrixRow["health"], string> = {
  live: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  api: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  portal: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  unknown: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
};

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  const diff = Date.now() - t;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(iso).toISOString().slice(0, 10);
}

function readToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export default function EcosystemPage() {
  // Activity feed state.
  const [feed, setFeed] = useState<ActivityResponse | null>(null);
  const [feedErr, setFeedErr] = useState<string | null>(null);
  const [feedLoading, setFeedLoading] = useState(true);
  const [mineOnly, setMineOnly] = useState(false);
  const [enabledSources, setEnabledSources] = useState<Set<string>>(
    new Set<string>([
      "qsocial",
      "qmedia-track",
      "qmedia-video",
      "qnews",
      "qright",
      "planet",
      "earnings",
    ])
  );

  // Health-matrix state.
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [graphErr, setGraphErr] = useState<string | null>(null);
  const [graphLoading, setGraphLoading] = useState(true);
  const [matrixFilter, setMatrixFilter] = useState<"all" | "live" | "api" | "portal" | "touched">("all");

  // Tab.
  const [tab, setTab] = useState<"feed" | "matrix">("feed");

  const fetchFeed = useCallback(
    async (mine: boolean) => {
      setFeedLoading(true);
      setFeedErr(null);
      try {
        const token = readToken();
        if (!token) {
          setFeedErr("Sign in to view the cross-module feed.");
          setFeedLoading(false);
          return;
        }
        const qs = new URLSearchParams({ limit: "60" });
        if (mine) qs.set("mine", "1");
        const r = await fetch(apiUrl(`/api/ecosystem/activity?${qs.toString()}`), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) {
          const txt = await r.text().catch(() => "");
          throw new Error(`HTTP ${r.status} ${txt.slice(0, 80)}`);
        }
        const data = (await r.json()) as ActivityResponse;
        setFeed(data);
      } catch (e: unknown) {
        setFeedErr(e instanceof Error ? e.message : "Failed to load feed");
      } finally {
        setFeedLoading(false);
      }
    },
    []
  );

  const fetchGraph = useCallback(async () => {
    setGraphLoading(true);
    setGraphErr(null);
    try {
      const token = readToken();
      if (!token) {
        setGraphErr("Sign in to view the module map.");
        setGraphLoading(false);
        return;
      }
      const r = await fetch(apiUrl("/api/ecosystem/graph"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        throw new Error(`HTTP ${r.status} ${txt.slice(0, 80)}`);
      }
      const data = (await r.json()) as GraphResponse;
      setGraph(data);
    } catch (e: unknown) {
      setGraphErr(e instanceof Error ? e.message : "Failed to load matrix");
    } finally {
      setGraphLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed(mineOnly);
  }, [fetchFeed, mineOnly]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  const toggleSource = (src: string) => {
    setEnabledSources((prev) => {
      const next = new Set(prev);
      if (next.has(src)) next.delete(src);
      else next.add(src);
      return next;
    });
  };

  const visibleItems = useMemo(() => {
    if (!feed) return [];
    return feed.items.filter((it) => enabledSources.has(it.module));
  }, [feed, enabledSources]);

  const matrixRows = useMemo(() => {
    if (!graph) return [];
    if (matrixFilter === "all") return graph.matrix;
    if (matrixFilter === "touched") return graph.matrix.filter((m) => m.userTouch > 0);
    return graph.matrix.filter((m) => m.health === matrixFilter);
  }, [graph, matrixFilter]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8 border-b border-zinc-800 pb-6">
          <div className="flex items-baseline gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Ecosystem
            </h1>
            <span className="text-sm font-medium text-zinc-500">
              cross-module hub
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            What's happening across the 27 AEVION modules, in one feed — plus a
            live health-matrix of every node. Earnings, posts, registrations,
            submissions blend into the same stream.
          </p>

          {/* Tabs */}
          <nav className="mt-6 flex gap-1 border-b border-zinc-800">
            <button
              type="button"
              onClick={() => setTab("feed")}
              className={`relative -mb-px border-b-2 px-4 py-2 text-sm font-semibold transition ${
                tab === "feed"
                  ? "border-emerald-400 text-emerald-300"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Activity feed
              {feed ? (
                <span className="ml-2 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">
                  {feed.total}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => setTab("matrix")}
              className={`relative -mb-px border-b-2 px-4 py-2 text-sm font-semibold transition ${
                tab === "matrix"
                  ? "border-emerald-400 text-emerald-300"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Module map
              {graph ? (
                <span className="ml-2 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">
                  {graph.moduleCount}
                </span>
              ) : null}
            </button>
          </nav>
        </header>

        {tab === "feed" ? (
          <section aria-labelledby="feed-h">
            <h2 id="feed-h" className="sr-only">
              Cross-module activity
            </h2>

            {/* Controls */}
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-zinc-700">
                <input
                  type="checkbox"
                  checked={mineOnly}
                  onChange={(e) => setMineOnly(e.target.checked)}
                  className="h-4 w-4 cursor-pointer accent-emerald-500"
                />
                Mine only
              </label>
              <button
                type="button"
                onClick={() => fetchFeed(mineOnly)}
                className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-white"
              >
                Refresh
              </button>
              {feedLoading ? (
                <span className="text-xs text-zinc-500">loading…</span>
              ) : feed ? (
                <span className="text-xs text-zinc-500">
                  {formatRelative(feed.generatedAt)}
                </span>
              ) : null}
            </div>

            {/* Source chips — colour-coded, click to toggle visibility */}
            {feed ? (
              <div className="mb-6 flex flex-wrap gap-2">
                {(
                  [
                    "qsocial",
                    "qmedia-track",
                    "qmedia-video",
                    "qnews",
                    "qright",
                    "planet",
                    "earnings",
                  ] as const
                ).map((src) => {
                  const count = feed.bySource[src] || 0;
                  const on = enabledSources.has(src);
                  return (
                    <button
                      key={src}
                      type="button"
                      onClick={() => toggleSource(src)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        on
                          ? SOURCE_ACCENT[src]
                          : "border-zinc-800 bg-zinc-900/40 text-zinc-600"
                      }`}
                      aria-pressed={on}
                    >
                      {SOURCE_LABEL[src]}
                      <span className="rounded bg-black/30 px-1 font-mono text-[10px]">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {feedErr ? (
              <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
                {feedErr}
              </div>
            ) : null}

            {/* Feed list */}
            {!feedErr ? (
              <ol className="space-y-2">
                {visibleItems.length === 0 && !feedLoading ? (
                  <li className="rounded-lg border border-dashed border-zinc-800 px-4 py-12 text-center text-sm text-zinc-500">
                    {feed && feed.total === 0
                      ? "No activity yet — be the first across the ecosystem."
                      : "Nothing matches the current filters."}
                  </li>
                ) : null}
                {visibleItems.map((it) => {
                  const accent = SOURCE_ACCENT[it.module];
                  const content = (
                    <div className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3 transition hover:border-zinc-700 hover:bg-zinc-900/70">
                      <span
                        className={`mt-0.5 shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${accent}`}
                      >
                        {SOURCE_LABEL[it.module]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <p className="truncate text-sm font-medium text-zinc-100">
                            {it.title}
                          </p>
                          <span className="shrink-0 text-[10px] font-mono text-zinc-500">
                            {formatRelative(it.at)}
                          </span>
                        </div>
                        {it.summary ? (
                          <p className="mt-0.5 line-clamp-2 text-xs text-zinc-400">
                            {it.summary}
                          </p>
                        ) : null}
                        <p className="mt-1 text-[10px] uppercase tracking-wide text-zinc-600">
                          {it.kind}
                        </p>
                      </div>
                    </div>
                  );
                  return (
                    <li key={it.id}>
                      {it.href ? (
                        <Link href={it.href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40">
                          {content}
                        </Link>
                      ) : (
                        content
                      )}
                    </li>
                  );
                })}
              </ol>
            ) : null}
          </section>
        ) : (
          <section aria-labelledby="matrix-h">
            <h2 id="matrix-h" className="sr-only">
              Module health-matrix
            </h2>

            {/* Rollup tiles */}
            {graph ? (
              <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <RollupTile
                  label="Modules"
                  value={graph.moduleCount}
                  hint={`${graph.apiCount} APIs · ${graph.edgeCount} edges`}
                />
                <RollupTile
                  label="MVP live"
                  value={graph.byHealth.live || 0}
                  accent="emerald"
                />
                <RollupTile
                  label="Platform API"
                  value={graph.byHealth.api || 0}
                  accent="blue"
                />
                <RollupTile
                  label="You're active in"
                  value={graph.userTouchedCount}
                  hint="modules with your activity"
                  accent="yellow"
                />
              </div>
            ) : null}

            {/* Filter pills */}
            <div className="mb-4 flex flex-wrap gap-2">
              {(
                [
                  ["all", "All"],
                  ["live", "MVP live"],
                  ["api", "Platform API"],
                  ["portal", "Portal only"],
                  ["touched", "You touched"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMatrixFilter(key as typeof matrixFilter)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    matrixFilter === key
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                      : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {graphErr ? (
              <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
                {graphErr}
              </div>
            ) : null}

            {graphLoading && !graph ? (
              <p className="text-sm text-zinc-500">loading…</p>
            ) : null}

            {/* Matrix table */}
            {matrixRows.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-zinc-800">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-900/80">
                    <tr className="border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-500">
                      <th className="px-3 py-2 font-semibold">Module</th>
                      <th className="px-3 py-2 font-semibold">Code</th>
                      <th className="px-3 py-2 font-semibold">Tier</th>
                      <th className="hidden px-3 py-2 font-semibold sm:table-cell">Status</th>
                      <th className="hidden px-3 py-2 text-right font-semibold md:table-cell">APIs</th>
                      <th className="px-3 py-2 text-right font-semibold">Your activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrixRows.map((m) => (
                      <tr
                        key={m.id}
                        className="border-b border-zinc-900 transition hover:bg-zinc-900/60"
                      >
                        <td className="px-3 py-2">
                          {m.primaryPath ? (
                            <Link
                              href={m.primaryPath}
                              className="font-medium text-zinc-100 hover:text-emerald-300"
                            >
                              {m.name}
                            </Link>
                          ) : (
                            <span className="font-medium text-zinc-300">{m.name}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-zinc-500">
                          {m.code}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${HEALTH_ACCENT[m.health]}`}
                          >
                            {HEALTH_LABEL[m.health]}
                          </span>
                        </td>
                        <td className="hidden px-3 py-2 text-xs text-zinc-500 sm:table-cell">
                          {m.status}
                        </td>
                        <td className="hidden px-3 py-2 text-right font-mono text-xs text-zinc-400 md:table-cell">
                          {m.apiCount}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {m.userTouch > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded bg-yellow-500/15 px-2 py-0.5 text-xs font-bold text-yellow-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
                              {m.userTouch}
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-700">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : graph ? (
              <p className="rounded-lg border border-dashed border-zinc-800 px-4 py-12 text-center text-sm text-zinc-500">
                No modules match this filter.
              </p>
            ) : null}
          </section>
        )}
      </div>
    </div>
  );
}

function RollupTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number;
  hint?: string;
  accent?: "emerald" | "blue" | "yellow";
}) {
  const accentClass =
    accent === "emerald"
      ? "text-emerald-300"
      : accent === "blue"
        ? "text-blue-300"
        : accent === "yellow"
          ? "text-yellow-300"
          : "text-zinc-100";
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-bold ${accentClass}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-zinc-500">{hint}</p> : null}
    </div>
  );
}
