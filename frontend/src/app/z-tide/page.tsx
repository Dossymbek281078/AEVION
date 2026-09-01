"use client";

import Link from "next/link";
import { getAuthToken } from "@/lib/auth";
import { useCallback, useEffect, useMemo, useState } from "react";
import MvpConceptBoard from "@/components/MvpConceptBoard";
import { apiUrl } from "@/lib/apiBase";
import ModulePricingChip from "@/components/ModulePricingChip";
import TideCharts from "./TideCharts";

/**
 * Z-Tide — adaptive reputation / contribution layer.
 * Backend: /api/ztide (score, ranks, events, leaderboard, stats).
 * This page combines the research landing with the live score UI.
 */

type Rank = { id: string; label: string; min: number; next: number | null };

type MeResponse = {
  userId: string;
  score: number;
  eventCount: number;
  lastEventAt: string | null;
  rank: Rank;
  recentEvents: Array<{
    id: string; kind: string; sourceModule: string; weight: number;
    meta: Record<string, unknown>; createdAt: string;
  }>;
};

type LeaderRow = {
  position: number; userId: string; score: number;
  eventCount: number; rank: string; lastEventAt: string | null;
};

type Stats = {
  active_users: number; total_events: number;
  total_weight: number; top_score: number | null;
};

const RANKS = [
  { id: "seedling", label: "Seedling", min: 0,     emoji: "🌱" },
  { id: "current",  label: "Current",  min: 50,    emoji: "💧" },
  { id: "wave",     label: "Wave",     min: 200,   emoji: "🌊" },
  { id: "stream",   label: "Stream",   min: 750,   emoji: "🏞️" },
  { id: "tide",     label: "Tide",     min: 2500,  emoji: "🌀" },
  { id: "river",    label: "River",    min: 8000,  emoji: "🏔️" },
  { id: "ocean",    label: "Ocean",    min: 25000, emoji: "🌌" },
];

const KIND_LABELS: Record<string, string> = {
  "login-streak": "Login streak", "helpful-comment": "Helpful comment",
  "bureau-cert": "Bureau cert", "build-hire": "Build hire",
  "qgood-donation": "QGood donation", "qcontract-share": "QContract share",
  "qsign-sign": "QSign signature", "qright-protect": "QRight protect",
  "qpaynet-payout": "QPayNet payout", "referral-success": "Referral",
};

function bearer(): HeadersInit {
  if (typeof window === "undefined") return {};
  const t = getAuthToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}
function hasToken(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(getAuthToken());
}
function shortId(id: string): string {
  return id.length <= 10 ? id : id.slice(0, 6) + "…" + id.slice(-4);
}

export default function ZTidePage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [authed, setAuthed] = useState(false);
  const [claimMsg, setClaimMsg] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);

  const loadMe = useCallback(async () => {
    if (!hasToken()) { setAuthed(false); return; }
    try {
      const r = await fetch(apiUrl("/api/ztide/me"), { headers: bearer(), cache: "no-store" });
      if (r.status === 401) { setAuthed(false); return; }
      if (r.ok) { setMe(await r.json()); setAuthed(true); }
    } catch { /* ignore */ }
  }, []);
  const loadLeaderboard = useCallback(async () => {
    try {
      const r = await fetch(apiUrl("/api/ztide/leaderboard?limit=20"), { cache: "no-store" });
      if (r.ok) { const j = await r.json(); setLeaderboard(j.leaderboard ?? []); }
    } catch { /* ignore */ }
  }, []);
  const loadStats = useCallback(async () => {
    try {
      const r = await fetch(apiUrl("/api/ztide/stats"), { cache: "no-store" });
      if (r.ok) setStats(await r.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void loadMe(); void loadLeaderboard(); void loadStats(); }, [loadMe, loadLeaderboard, loadStats]);

  const claimStreak = async () => {
    setClaiming(true); setClaimMsg(null);
    try {
      const r = await fetch(apiUrl("/api/ztide/me/login-streak"), {
        method: "POST", headers: { "Content-Type": "application/json", ...bearer() },
      });
      const j = await r.json();
      if (r.status === 429) {
        const next = j.nextAvailableAt ? new Date(j.nextAvailableAt).toLocaleString() : "позже";
        setClaimMsg(`Уже отмечено. Следующий: ${next}`);
      } else if (r.ok) {
        setClaimMsg(`+${j.weight} к приливу! Счёт: ${j.score}`);
        await loadMe(); await loadLeaderboard(); await loadStats();
      } else setClaimMsg("Нужна авторизация.");
    } catch { setClaimMsg("Ошибка сети."); }
    finally { setClaiming(false); }
  };

  const currentRankIdx = useMemo(
    () => (me ? Math.max(0, RANKS.findIndex((r) => r.id === me.rank.id)) : 0),
    [me],
  );
  const progressPct = useMemo(() => {
    if (!me || me.rank.next === null) return 100;
    const cur = RANKS[currentRankIdx];
    const span = me.rank.next - cur.min;
    return span <= 0 ? 100 : Math.min(100, Math.max(0, ((me.score - cur.min) / span) * 100));
  }, [me, currentRankIdx]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-violet-950/30 to-slate-950 text-slate-100">
      <header
        // Полоса раздела прилипает ПОД шапкой сайта: у шапки тоже sticky
        // top:0, но слой 50 против 30 — при прокрученной странице она
        // закрывала кнопку «Купить» и строку цены. Замер прода 28.08.2026.
        style={{ top: "var(--aevion-header-h, 0px)" }}
        className="border-b border-slate-800/60 px-5 py-3 backdrop-blur sticky top-0 z-30 bg-slate-950/60">
        <div className="mx-auto max-w-6xl flex flex-wrap items-center justify-between gap-2">
          <Link href="/" className="text-sm text-slate-400 hover:text-white">← AEVION</Link>
          <div className="flex items-center gap-3">
            <ModulePricingChip moduleId="z-tide" theme="dark" />
            <div className="text-xs font-mono tracking-[0.2em] text-violet-300">Z·TIDE</div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 pt-14 pb-8">
        <div className="inline-block rounded-full bg-violet-500/15 border border-violet-500/40 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-violet-200 mb-5">
          Adaptive reputation · Energy-anchored
        </div>
        <h1 className="text-4xl sm:text-5xl font-light leading-tight tracking-tight mb-4">
          Твой{" "}
          <span className="bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent font-semibold">
            прилив
          </span>{" "}
          в экосистеме
        </h1>
        <p className="text-slate-400 max-w-2xl text-base sm:text-lg leading-relaxed">
          Z-Tide — мягкая репутация, не токен. Каждое полезное действие (вход, помощь,
          сертификат, найм, донат) поднимает прилив. 7 рангов от Seedling до Ocean.
          Очки не торгуются и не выводятся — только репутация, аудируемая через QSign.
        </p>
      </section>

      {/* Stats strip */}
      {stats && (
        <section className="mx-auto max-w-6xl px-5 pb-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ["Активных", stats.active_users],
              ["Событий", stats.total_events],
              ["Суммарный вес", Number(stats.total_weight)],
              ["Топ-счёт", stats.top_score ?? 0],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-center backdrop-blur">
                <div className="text-2xl font-bold text-violet-300 font-mono">{Number(value).toLocaleString()}</div>
                <div className="text-xs text-slate-500 mt-1">{label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Dashboard charts — rank distribution, top-tide bars, user lookup */}
      <TideCharts />

      {/* My Tide + Rank ladder */}
      <section className="mx-auto max-w-6xl px-5 pb-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* My Tide */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur">
          <div className="text-sm font-semibold text-violet-200 mb-4">🌊 Мой прилив</div>
          {!authed ? (
            <div className="text-center py-6">
              <p className="text-slate-400 mb-3">Войди, чтобы отслеживать свой прилив.</p>
              <Link href="/auth" className="inline-block px-5 py-2 rounded-lg bg-violet-500 text-slate-950 font-bold hover:bg-violet-400">
                Войти →
              </Link>
            </div>
          ) : me ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-4xl font-bold text-violet-300 font-mono leading-none">{me.score.toLocaleString()}</div>
                  <div className="text-xs text-slate-500 mt-1">{me.eventCount} событий</div>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-3xl">{RANKS[currentRankIdx]?.emoji}</span>
                  <span className="font-bold text-fuchsia-300">{me.rank.label}</span>
                </div>
              </div>
              {me.rank.next !== null ? (
                <div className="mt-4">
                  <div className="flex justify-between text-xs font-mono mb-1.5">
                    <span>{me.score.toLocaleString()}</span>
                    <span className="text-slate-500">до {RANKS[currentRankIdx + 1]?.label}: {(me.rank.next - me.score).toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-violet-400 to-fuchsia-400 transition-all" style={{ width: `${progressPct}%` }} />
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-fuchsia-300 font-semibold">🌌 Ocean — вершина прилива.</div>
              )}
              <button type="button" onClick={claimStreak} disabled={claiming}
                className="mt-4 w-full py-3 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 text-slate-950 font-bold disabled:opacity-50">
                {claiming ? "…" : "💧 Отметить вход (+1)"}
              </button>
              {claimMsg && <div className="mt-2 text-sm text-violet-300 text-center">{claimMsg}</div>}
              {me.recentEvents.length > 0 && (
                <div className="mt-5">
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Недавние события</div>
                  <ul className="flex flex-col gap-1.5">
                    {me.recentEvents.slice(0, 8).map((e) => (
                      <li key={e.id} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center text-sm py-1.5 border-b border-white/5">
                        <span>{KIND_LABELS[e.kind] ?? e.kind}</span>
                        <span className="text-slate-500 text-xs">{e.sourceModule}</span>
                        <span className="text-violet-300 font-bold">+{e.weight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="text-slate-500 text-center py-6">Загрузка…</div>
          )}
        </div>

        {/* Rank ladder */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur">
          <div className="text-sm font-semibold text-violet-200 mb-4">🪜 Лестница рангов</div>
          <ul className="flex flex-col gap-1.5">
            {RANKS.map((r) => {
              const reached = me ? me.score >= r.min : false;
              const isCurrent = me ? me.rank.id === r.id : false;
              return (
                <li key={r.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${isCurrent ? "bg-violet-500/10 border border-violet-400/40" : "border border-transparent"} ${reached || !me ? "opacity-100" : "opacity-45"}`}>
                  <span className="text-xl">{r.emoji}</span>
                  <span className="font-bold text-violet-200 flex-1">{r.label}</span>
                  <span className="text-slate-500 text-xs">{r.min.toLocaleString()}+</span>
                  {isCurrent && <span className="text-[10px] bg-violet-400 text-slate-950 px-2 py-0.5 rounded-full font-bold">ты здесь</span>}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Leaderboard */}
      <section className="mx-auto max-w-6xl px-5 pb-8">
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold text-violet-200">🏆 Лидерборд</div>
            <Link href="/z-tide/leaderboard" className="text-xs text-slate-400 hover:text-white">весь топ-50 →</Link>
          </div>
          {leaderboard.length === 0 ? (
            <div className="text-slate-500 text-center py-6">Пока пусто — стань первым приливом.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-violet-500/20 text-slate-500 text-xs">
                  <th className="py-2 px-2.5">#</th>
                  <th className="py-2 px-2.5 text-left">User</th>
                  <th className="py-2 px-2.5">Rank</th>
                  <th className="py-2 px-2.5 text-right">Score</th>
                  <th className="py-2 px-2.5 text-right">Events</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row) => {
                  const rk = RANKS.find((r) => r.id === row.rank);
                  const isMe = me?.userId === row.userId;
                  return (
                    <tr key={row.userId} className={`border-b border-white/5 ${isMe ? "bg-violet-500/8" : ""}`}>
                      <td className={`py-2.5 px-2.5 text-center font-bold ${row.position <= 3 ? "text-amber-400" : "text-slate-500"}`}>{row.position}</td>
                      <td className="py-2.5 px-2.5 text-left font-mono">{shortId(row.userId)}{isMe && <span className="text-violet-300 ml-1.5">(ты)</span>}</td>
                      <td className="py-2.5 px-2.5 text-center">{rk?.emoji} {rk?.label}</td>
                      <td className="py-2.5 px-2.5 text-right font-bold text-violet-300">{row.score.toLocaleString()}</td>
                      <td className="py-2.5 px-2.5 text-right text-slate-500">{row.eventCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Concept board (preserved from landing) */}
      <MvpConceptBoard
        moduleId="ztide"
        noun="concept/messages"
        accent="violet"
        sectionTitle="Concept board"
        sectionHint="Поделись идеей: какой вклад/действие должно повышать tide-score? Что должно его обнулять?"
        titleField="idea"
        summaryField="rationale"
        fields={[
          { key: "idea", label: "Идея / вклад", placeholder: "напр.: помощь open-source > 8h/нед", required: true },
          { key: "rationale", label: "Почему это считается вкладом", type: "textarea", placeholder: "Кому это полезно, как это измеряется" },
          { key: "author", label: "Псевдоним (необязательно)", placeholder: "anon" },
        ]}
      />

      <footer className="border-t border-slate-800/60 px-5 py-6 mt-8">
        <div className="mx-auto max-w-6xl text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1 justify-between">
          <span>AEVION · Z-Tide · мягкая репутация · очки не выводятся</span>
          <span className="font-mono">/api/ztide</span>
        </div>
      </footer>
    </div>
  );
}
