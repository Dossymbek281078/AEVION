"use client";
// Replay hub — force Vercel rebuild 2026-05-19 (stale CDN cache от пред-fix эпохи)

/**
 * CyberChess — Replay hub
 *
 * Lists finished games stored in the spectator backend's LRU archive.
 * Filter by outcome (all / wins / losses / draws) and sort by
 * latest / longest / shortest. Click "Watch" to open the replay viewer.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

// ----- Types -----

type ReplayItem = {
  gameId: string;
  hostName?: string;
  aiLevel?: string;
  rating?: number;
  result: string; // "1-0" | "0-1" | "1/2-1/2" | "*"
  duration: number; // ms
  plyCount: number;
  endedAt: number; // ms epoch
  startedAt: number;
};

type Filter = "all" | "wins" | "losses" | "draws";
type Sort = "latest" | "longest" | "shortest";

// ----- Helpers -----

function classifyResult(r: string): "win" | "loss" | "draw" | "other" {
  // Host viewpoint: assume host plays White (typical for CyberChess vs AI).
  // Backend doesn't record orientation explicitly yet — TODO: pass color.
  if (r === "1-0") return "win";
  if (r === "0-1") return "loss";
  if (r === "1/2-1/2" || r === "draw" || r === "0.5-0.5") return "draw";
  return "other";
}

function fmtDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m < 1) return `${sec}s`;
  if (m < 60) return `${m}m ${sec.toString().padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${(m % 60).toString().padStart(2, "0")}m`;
}

function fmtRelative(ts: number): string {
  if (!Number.isFinite(ts)) return "—";
  const diff = Math.max(0, Date.now() - ts);
  const s = Math.floor(diff / 1000);
  if (s < 30) return "только что";
  if (s < 60) return `${s} сек назад`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  return `${d} дн назад`;
}

function resultLabel(r: string): string {
  const cls = classifyResult(r);
  if (cls === "win") return "Победа";
  if (cls === "loss") return "Поражение";
  if (cls === "draw") return "Ничья";
  return r || "—";
}

function resultColor(r: string): string {
  const cls = classifyResult(r);
  if (cls === "win") return "text-emerald-300 border-emerald-500/40 bg-emerald-500/10";
  if (cls === "loss") return "text-rose-300 border-rose-500/40 bg-rose-500/10";
  if (cls === "draw") return "text-amber-200 border-amber-500/40 bg-amber-500/10";
  return "text-slate-300 border-slate-500/40 bg-slate-500/10";
}

// ----- API -----

const API_BASE = "/api/cyberchess-spectator";

async function fetchReplays(limit = 50): Promise<ReplayItem[]> {
  const res = await fetch(`${API_BASE}/replays?limit=${limit}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { ok: boolean; replays: ReplayItem[] };
  if (!data.ok) throw new Error("API returned ok=false");
  return data.replays;
}

// ----- Page -----

export default function ReplayHubPage() {
  const [items, setItems] = useState<ReplayItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("latest");
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(null);
    fetchReplays(50)
      .then((rs) => {
        if (alive) setItems(rs);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      alive = false;
    };
  }, [refreshTick]);

  // Auto-refresh every 30s — replays appear when games end.
  useEffect(() => {
    const t = setInterval(() => setRefreshTick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    if (!items) return [];
    const f = items.filter((r) => {
      if (filter === "all") return true;
      const cls = classifyResult(r.result);
      if (filter === "wins") return cls === "win";
      if (filter === "losses") return cls === "loss";
      if (filter === "draws") return cls === "draw";
      return true;
    });
    const sorted = f.slice();
    if (sort === "latest") sorted.sort((a, b) => b.endedAt - a.endedAt);
    else if (sort === "longest") sorted.sort((a, b) => b.duration - a.duration);
    else if (sort === "shortest") sorted.sort((a, b) => a.duration - b.duration);
    return sorted;
  }, [items, filter, sort]);

  const counts = useMemo(() => {
    if (!items) return { all: 0, wins: 0, losses: 0, draws: 0 };
    let wins = 0;
    let losses = 0;
    let draws = 0;
    for (const r of items) {
      const c = classifyResult(r.result);
      if (c === "win") wins += 1;
      else if (c === "loss") losses += 1;
      else if (c === "draw") draws += 1;
    }
    return { all: items.length, wins, losses, draws };
  }, [items]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
              CyberChess
            </div>
            <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">
              Архив трансляций
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Завершённые партии, доступные для пересмотра с покадровой
              навигацией и графиком оценки. Хранится до 50 последних трансляций.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/cyberchess/spectator"
              className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-sm text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
            >
              Live трансляции
            </Link>
            <Link
              href="/cyberchess"
              className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-sm text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
            >
              На главную
            </Link>
          </div>
        </header>

        {/* Filter + sort controls */}
        <section className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { key: "all", label: "Все", n: counts.all },
                { key: "wins", label: "Победы", n: counts.wins },
                { key: "losses", label: "Поражения", n: counts.losses },
                { key: "draws", label: "Ничьи", n: counts.draws },
              ] as { key: Filter; label: string; n: number }[]
            ).map((chip) => {
              const active = filter === chip.key;
              return (
                <button
                  key={chip.key}
                  onClick={() => setFilter(chip.key)}
                  className={[
                    "rounded-full border px-3 py-1 text-xs transition",
                    active
                      ? "border-cyan-400 bg-cyan-500/15 text-cyan-200"
                      : "border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-500",
                  ].join(" ")}
                >
                  {chip.label}
                  <span className="ml-1.5 text-[10px] text-slate-400">
                    {chip.n}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Сортировка:</label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 outline-none focus:border-cyan-500"
            >
              <option value="latest">Сначала новые</option>
              <option value="longest">Самые длинные</option>
              <option value="shortest">Самые короткие</option>
            </select>
            <button
              onClick={() => setRefreshTick((x) => x + 1)}
              className="rounded-lg border border-slate-700 bg-slate-900/60 px-2.5 py-1 text-xs text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
              title="Обновить"
            >
              Обновить
            </button>
          </div>
        </section>

        {/* List */}
        {error && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
            Не удалось загрузить архив: {error}
          </div>
        )}

        {!error && items === null && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-36 animate-pulse rounded-xl border border-slate-800 bg-slate-900/40"
              />
            ))}
          </div>
        )}

        {!error && items !== null && filtered.length === 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-400">
            {items.length === 0
              ? "Пока нет завершённых трансляций. Заверши партию — она появится здесь автоматически."
              : "Под текущий фильтр ничего не подходит."}
          </div>
        )}

        {!error && filtered.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((r) => (
              <li
                key={r.gameId}
                className="group flex flex-col rounded-xl border border-slate-800 bg-slate-900/40 p-4 transition hover:border-cyan-500/50 hover:bg-slate-900/60"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-base font-medium text-slate-100">
                      {r.hostName || "Аноним"}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      {fmtRelative(r.endedAt)}
                    </div>
                  </div>
                  <span
                    className={[
                      "shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium",
                      resultColor(r.result),
                    ].join(" ")}
                  >
                    {resultLabel(r.result)}
                  </span>
                </div>

                <div className="mb-3 grid grid-cols-3 gap-2 text-[11px]">
                  <div className="rounded-md bg-slate-800/60 px-2 py-1.5">
                    <div className="text-slate-500">Длительность</div>
                    <div className="mt-0.5 font-medium text-slate-200">
                      {fmtDuration(r.duration)}
                    </div>
                  </div>
                  <div className="rounded-md bg-slate-800/60 px-2 py-1.5">
                    <div className="text-slate-500">Ходы</div>
                    <div className="mt-0.5 font-medium text-slate-200">
                      {r.plyCount}
                    </div>
                  </div>
                  <div className="rounded-md bg-slate-800/60 px-2 py-1.5">
                    <div className="text-slate-500">AI</div>
                    <div className="mt-0.5 truncate font-medium text-slate-200">
                      {r.aiLevel || (r.rating ? String(r.rating) : "—")}
                    </div>
                  </div>
                </div>

                <Link
                  href={`/cyberchess/replays/${encodeURIComponent(r.gameId)}`}
                  className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-200 transition hover:border-cyan-400 hover:bg-cyan-500/20"
                >
                  <span aria-hidden>▶</span>
                  Смотреть
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
