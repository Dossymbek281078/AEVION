"use client";

/**
 * Z-Tide dashboard visualisations — built entirely from the public backend
 * endpoints (`/api/ztide/leaderboard`, `/api/ztide/stats`, `/api/ztide/rank/:id`),
 * no backend changes. Adds the visual depth the table-only landing lacked:
 *   1. Rank distribution — how the tide population splits across the 7 ranks
 *      (bucketed client-side from the leaderboard sample).
 *   2. Top-tide score bars — the score spread of the leaders, as scaled bars.
 *   3. Tide lookup — check any userId's score, rank and progress to next rank
 *      (works without login, unlike "My Tide").
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/apiBase";

const RANKS = [
  { id: "seedling", label: "Seedling", min: 0,     emoji: "🌱", bar: "from-emerald-400 to-emerald-500" },
  { id: "current",  label: "Current",  min: 50,    emoji: "💧", bar: "from-sky-400 to-sky-500" },
  { id: "wave",     label: "Wave",     min: 200,   emoji: "🌊", bar: "from-cyan-400 to-cyan-500" },
  { id: "stream",   label: "Stream",   min: 750,   emoji: "🏞️", bar: "from-violet-400 to-violet-500" },
  { id: "tide",     label: "Tide",     min: 2500,  emoji: "🌀", bar: "from-fuchsia-400 to-fuchsia-500" },
  { id: "river",    label: "River",    min: 8000,  emoji: "🏔️", bar: "from-amber-400 to-amber-500" },
  { id: "ocean",    label: "Ocean",    min: 25000, emoji: "🌌", bar: "from-rose-400 to-rose-500" },
];

type LeaderRow = { position: number; userId: string; score: number; eventCount: number; rank: string };
type LookupResult = { userId: string; score: number; eventCount: number; rank: { id: string; label: string; min: number; next: number | null } } | null;

function shortId(id: string): string {
  return id.length <= 12 ? id : id.slice(0, 6) + "…" + id.slice(-4);
}

export default function TideCharts() {
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [sampleTotal, setSampleTotal] = useState(0);

  const load = useCallback(async () => {
    try {
      const r = await fetch(apiUrl("/api/ztide/leaderboard?limit=200"), { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        const lb: LeaderRow[] = j.leaderboard ?? [];
        setRows(lb);
        setSampleTotal(typeof j.total === "number" ? j.total : lb.length);
      }
    } catch { /* charts just stay empty */ }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // Rank distribution over the sample.
  const distribution = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const rk of RANKS) counts[rk.id] = 0;
    for (const row of rows) {
      // Bucket by score (independent of the row's stored rank string).
      let bucket = RANKS[0].id;
      for (const rk of RANKS) if (row.score >= rk.min) bucket = rk.id;
      counts[bucket] += 1;
    }
    const max = Math.max(1, ...Object.values(counts));
    return RANKS.map((rk) => ({ ...rk, count: counts[rk.id], pct: (counts[rk.id] / max) * 100 }));
  }, [rows]);

  const topBars = useMemo(() => {
    const top = rows.slice(0, 15);
    const max = Math.max(1, ...top.map((r) => r.score));
    return top.map((r) => ({ ...r, pct: (r.score / max) * 100 }));
  }, [rows]);

  if (rows.length === 0) {
    return (
      <section className="mx-auto max-w-6xl px-5 pb-8">
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-center text-slate-500 backdrop-blur">
          Дашборд появится, когда в приливе будут участники.
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-5 pb-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Rank distribution */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold text-violet-200">📊 Распределение по рангам</div>
          <div className="text-[10px] text-slate-500">по топ-{sampleTotal.toLocaleString()}</div>
        </div>
        <ul className="flex flex-col gap-2.5">
          {distribution.map((d) => (
            <li key={d.id} className="grid grid-cols-[92px_1fr_34px] items-center gap-2">
              <span className="text-xs text-slate-300 flex items-center gap-1.5">
                <span>{d.emoji}</span>{d.label}
              </span>
              <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                <div className={`h-full bg-gradient-to-r ${d.bar} transition-all`} style={{ width: `${d.pct}%` }} />
              </div>
              <span className="text-xs font-mono text-slate-400 text-right">{d.count}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Top tide score bars */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur">
        <div className="text-sm font-semibold text-violet-200 mb-4">🌊 Топ приливов — размах очков</div>
        <ul className="flex flex-col gap-2">
          {topBars.map((r) => {
            const rk = RANKS.find((x) => x.id === r.rank) ?? RANKS[0];
            return (
              <li key={r.userId} className="grid grid-cols-[74px_1fr_58px] items-center gap-2">
                <span className="text-[11px] font-mono text-slate-400 truncate" title={r.userId}>
                  <span className={`${r.position <= 3 ? "text-amber-400" : "text-slate-500"} font-bold`}>#{r.position}</span>{" "}{shortId(r.userId)}
                </span>
                <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full bg-gradient-to-r ${rk.bar} transition-all`} style={{ width: `${r.pct}%` }} />
                </div>
                <span className="text-[11px] font-mono text-violet-300 text-right font-bold">{r.score.toLocaleString()}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Tide lookup — spans full width below on large screens */}
      <div className="lg:col-span-2">
        <TideLookup />
      </div>
    </section>
  );
}

function TideLookup() {
  const [q, setQ] = useState("");
  const [result, setResult] = useState<LookupResult>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    const id = q.trim();
    if (!id || busy) return;
    setBusy(true); setErr(null); setResult(null);
    try {
      const r = await fetch(apiUrl(`/api/ztide/rank/${encodeURIComponent(id)}`), { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setResult(await r.json());
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  const rk = result ? (RANKS.find((x) => x.id === result.rank.id) ?? RANKS[0]) : null;
  const progressPct = useMemo(() => {
    if (!result || result.rank.next === null) return 100;
    const span = result.rank.next - result.rank.min;
    return span <= 0 ? 100 : Math.min(100, Math.max(0, ((result.score - result.rank.min) / span) * 100));
  }, [result]);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur">
      <div className="text-sm font-semibold text-violet-200 mb-3">🔎 Проверить прилив по userId</div>
      <form onSubmit={lookup} className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="userId (публичный поиск, без входа)"
          className="flex-1 min-w-[220px] px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-600 focus:border-violet-500 outline-none"
        />
        <button type="submit" disabled={busy}
          className="px-5 py-2 rounded-lg bg-violet-500 text-slate-950 font-bold text-sm disabled:opacity-50">
          {busy ? "…" : "Найти"}
        </button>
      </form>
      {err && <div className="mt-3 text-sm text-rose-400">Не найдено: {err}</div>}
      {result && rk && (
        <div className="mt-4 flex flex-wrap items-center gap-5">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{rk.emoji}</span>
            <div>
              <div className="text-2xl font-bold text-violet-300 font-mono leading-none">{result.score.toLocaleString()}</div>
              <div className="text-xs text-slate-500 mt-1">{rk.label} · {result.eventCount} событий</div>
            </div>
          </div>
          <div className="flex-1 min-w-[200px]">
            {result.rank.next !== null ? (
              <>
                <div className="flex justify-between text-[11px] font-mono text-slate-500 mb-1">
                  <span>{result.rank.label}</span>
                  <span>до след.: {(result.rank.next - result.score).toLocaleString()}</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full bg-gradient-to-r ${rk.bar}`} style={{ width: `${progressPct}%` }} />
                </div>
              </>
            ) : (
              <div className="text-fuchsia-300 font-semibold text-sm">🌌 Ocean — вершина прилива.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
