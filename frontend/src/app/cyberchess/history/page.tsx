"use client";
/**
 * /cyberchess/history — история онлайн-матчей игрока.
 *
 * Читает GET /api-backend/api/cyberchess/matchmaking/history?userId=X.
 * Ходы в сторе хранятся как UCI (movesSan) — здесь переигрываем их через
 * chess.js и показываем читаемую SAN-запись. Кнопка «Реванш» ведёт на подбор
 * с тем же контролем времени.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Chess } from "chess.js";

interface Match {
  id: string;
  whiteUserId: string;
  whiteName: string | null;
  blackUserId: string;
  blackName: string | null;
  timeControl: string;
  speed: string;
  status: string;
  result: string | null;
  termination: string | null;
  ply: number;
  whiteRatingBefore: number | null;
  blackRatingBefore: number | null;
  whiteRatingAfter: number | null;
  blackRatingAfter: number | null;
  movesSan?: string;
  createdAt: string;
}

const SPEED_ICON: Record<string, string> = {
  bullet: "💨",
  blitz: "⚡",
  rapid: "🕐",
  classical: "♟",
};

const SPEED_ORDER = ["bullet", "blitz", "rapid", "classical"] as const;
const SPEED_LABEL: Record<string, string> = {
  bullet: "Пуля",
  blitz: "Блиц",
  rapid: "Рапид",
  classical: "Классика",
};

// Компактная спарклайн-линия динамики рейтинга (без внешних зависимостей).
function Sparkline({ pts, w = 132, h = 34 }: { pts: number[]; w?: number; h?: number }) {
  if (pts.length < 2) return null;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;
  const pad = 3;
  const stepX = (w - pad * 2) / (pts.length - 1);
  const coords = pts.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (1 - (v - min) / range) * (h - pad * 2);
    return [x, y] as const;
  });
  const line = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const fillPts = `${pad},${(h - pad).toFixed(1)} ${line} ${(w - pad).toFixed(1)},${(h - pad).toFixed(1)}`;
  const up = pts[pts.length - 1] >= pts[0];
  const stroke = up ? "#10b981" : "#f43f5e";
  const fillC = up ? "rgba(16,185,129,0.12)" : "rgba(244,63,94,0.12)";
  const [lx, ly] = coords[coords.length - 1];
  return (
    <svg width={w} height={h} style={{ display: "block", width: "100%" }} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polygon points={fillPts} fill={fillC} stroke="none" />
      <polyline points={line} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r={2.5} fill={stroke} />
    </svg>
  );
}

// Переигрываем UCI-строку ("e2e4 e7e5 g1f3 …") в SAN для читаемой записи.
function uciToSan(uciLine: string | undefined, max = 12): string {
  if (!uciLine) return "";
  const ch = new Chess();
  const sans: string[] = [];
  for (const uci of uciLine.trim().split(/\s+/).filter(Boolean)) {
    if (uci.length < 4) continue;
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promo = uci[4];
    try {
      const mv = ch.move({ from, to, promotion: (promo as "q" | "r" | "b" | "n") || undefined });
      if (!mv) break;
      sans.push(mv.san);
    } catch {
      break;
    }
  }
  const shown = sans.slice(0, max);
  let out = "";
  for (let i = 0; i < shown.length; i++) {
    if (i % 2 === 0) out += `${Math.floor(i / 2) + 1}.`;
    out += `${shown[i]} `;
  }
  if (sans.length > max) out += "…";
  return out.trim();
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }) +
      " " + d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function CyberChessHistoryPage() {
  const [userId, setUserId] = useState<string>("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setUserId(window.localStorage.getItem("cyberchess.userId") || "");
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(async (uid: string) => {
    if (!uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(
        `/api-backend/api/cyberchess/matchmaking/history?userId=${encodeURIComponent(uid)}&limit=50`,
        { cache: "no-store" },
      );
      const data = await r.json();
      if (!data?.ok) throw new Error("bad response");
      setMatches(Array.isArray(data.matches) ? data.matches : []);
    } catch {
      setError("Не удалось загрузить историю. Попробуйте позже.");
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userId) load(userId);
    else setLoading(false);
  }, [userId, load]);

  const stats = useMemo(() => {
    let w = 0, l = 0, d = 0;
    for (const m of matches) {
      const iAmWhite = m.whiteUserId === userId;
      if (m.result === "draw") d++;
      else if ((m.result === "white") === iAmWhite) w++;
      else l++;
    }
    return { w, l, d };
  }, [matches, userId]);

  // Динамика рейтинга по каждой скорости — из «рейтинга-после» игрока в матчах.
  // matches приходят DESC (свежие первыми); разворачиваем в хронологию.
  const trends = useMemo(() => {
    const bySpeed = new Map<string, { pts: number[]; tc: string }>();
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      const iAmWhite = m.whiteUserId === userId;
      const after = iAmWhite ? m.whiteRatingAfter : m.blackRatingAfter;
      if (after == null) continue;
      const cur = bySpeed.get(m.speed) || { pts: [], tc: m.timeControl };
      cur.pts.push(Math.round(after));
      cur.tc = m.timeControl;
      bySpeed.set(m.speed, cur);
    }
    return SPEED_ORDER.map((sp) => ({ speed: sp, ...(bySpeed.get(sp) || { pts: [], tc: "" }) })).filter(
      (t) => t.pts.length >= 2,
    );
  }, [matches, userId]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight">📜 История матчей</h1>
            {matches.length > 0 && (
              <p className="mt-1 text-sm text-slate-400">
                {matches.length} партий · <span className="text-emerald-400">{stats.w}</span> побед ·{" "}
                <span className="text-rose-400">{stats.l}</span> поражений ·{" "}
                <span className="text-slate-400">{stats.d}</span> ничьих
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <Link
              href="/cyberchess/leaderboard"
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800"
            >
              🏆 Лидерборд
            </Link>
            <Link
              href="/cyberchess"
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800"
            >
              ← к шахматам
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-16 text-center text-slate-500">
            Загрузка…
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-16 text-center text-rose-400">
            {error}
          </div>
        ) : matches.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-16 text-center text-slate-500">
            Пока нет сыгранных онлайн-матчей.
            <br />
            <Link href="/cyberchess/matchmaking" className="mt-2 inline-block text-indigo-400 hover:underline">
              Найти соперника →
            </Link>
          </div>
        ) : (
          <>
            {trends.length > 0 && (
              <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {trends.map((t) => {
                  const first = t.pts[0];
                  const last = t.pts[t.pts.length - 1];
                  const delta = last - first;
                  const peak = Math.max(...t.pts);
                  return (
                    <div
                      key={t.speed}
                      className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-300">
                          {SPEED_ICON[t.speed] || "♟"} {SPEED_LABEL[t.speed] || t.speed}
                        </span>
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-mono text-lg font-black text-slate-100">{last}</span>
                          <span
                            className={`font-mono text-xs font-bold ${
                              delta > 0 ? "text-emerald-400" : delta < 0 ? "text-rose-400" : "text-slate-500"
                            }`}
                          >
                            {delta > 0 ? "+" : ""}
                            {delta}
                          </span>
                        </div>
                      </div>
                      <div className="mt-1.5">
                        <Sparkline pts={t.pts} />
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                        <span>{t.pts.length} партий</span>
                        <span>пик {peak}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="space-y-2">
            {matches.map((m) => {
              const iAmWhite = m.whiteUserId === userId;
              const oppName = (iAmWhite ? m.blackName : m.whiteName) || "Соперник";
              const myBefore = iAmWhite ? m.whiteRatingBefore : m.blackRatingBefore;
              const myAfter = iAmWhite ? m.whiteRatingAfter : m.blackRatingAfter;
              const delta =
                myBefore != null && myAfter != null ? Math.round(myAfter - myBefore) : null;
              const outcome =
                m.result === "draw" ? "draw" : (m.result === "white") === iAmWhite ? "win" : "loss";
              const oc =
                outcome === "win"
                  ? { label: "Победа", clr: "text-emerald-400", bar: "bg-emerald-500" }
                  : outcome === "loss"
                    ? { label: "Поражение", clr: "text-rose-400", bar: "bg-rose-500" }
                    : { label: "Ничья", clr: "text-slate-400", bar: "bg-slate-500" };
              const sanLine = uciToSan(m.movesSan);
              return (
                <div
                  key={m.id}
                  className="flex items-stretch gap-3 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50"
                >
                  <div className={`w-1 ${oc.bar}`} />
                  <div className="min-w-0 flex-1 py-2.5 pr-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 truncate">
                        <span className={`text-sm font-bold ${oc.clr}`}>{oc.label}</span>
                        <span className="truncate text-sm text-slate-300">vs {oppName}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {delta != null && (
                          <span
                            className={`font-mono text-xs font-bold ${
                              delta > 0 ? "text-emerald-400" : delta < 0 ? "text-rose-400" : "text-slate-500"
                            }`}
                          >
                            {delta > 0 ? "+" : ""}
                            {delta}
                          </span>
                        )}
                        {myAfter != null && (
                          <span className="font-mono text-xs text-slate-400">→ {Math.round(myAfter)}</span>
                        )}
                      </div>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                      <span>
                        {SPEED_ICON[m.speed] || "♟"} {m.timeControl}
                      </span>
                      <span>·</span>
                      <span>{m.ply} пол-ходов</span>
                      {m.termination && (
                        <>
                          <span>·</span>
                          <span>{m.termination}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>{fmtDate(m.createdAt)}</span>
                    </div>
                    {sanLine && (
                      <div className="mt-1 truncate font-mono text-xs text-slate-600" title={sanLine}>
                        {sanLine}
                      </div>
                    )}
                  </div>
                  <Link
                    href={`/cyberchess/matchmaking?tc=${encodeURIComponent(m.timeControl)}`}
                    className="flex shrink-0 items-center border-l border-slate-800 px-3 text-xs font-semibold text-indigo-400 transition hover:bg-indigo-500/10"
                  >
                    ⚔ Реванш
                  </Link>
                </div>
              );
            })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
