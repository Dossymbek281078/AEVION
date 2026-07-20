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
  const stroke = up ? "#2f8f5b" : "#b0453f";
  const fillC = up ? "rgba(47,143,91,0.12)" : "rgba(176,69,63,0.12)";
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
    <div className="planet-root">
      <div className="planet-wrap" style={{ paddingTop: 32, paddingBottom: 48 }}>
        <div style={{ marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="planet-eyebrow" style={{ marginBottom: 6 }}>Онлайн-матчи</div>
            <h1 className="planet-h1">История матчей</h1>
            {matches.length > 0 && (
              <p className="planet-muted" style={{ marginTop: 6, fontSize: 13.5 }}>
                {matches.length} партий · <span style={{ color: "var(--pl-live)" }}>{stats.w}</span> побед ·{" "}
                <span style={{ color: "var(--pl-danger)" }}>{stats.l}</span> поражений · {stats.d} ничьих
              </p>
            )}
          </div>
          <div style={{ display: "flex", flexShrink: 0, gap: 8 }}>
            <Link href="/cyberchess/leaderboard" className="planet-btn">Лидерборд</Link>
            <Link href="/cyberchess" className="planet-btn">← к шахматам</Link>
          </div>
        </div>

        {loading ? (
          <div className="planet-card planet-empty">Загрузка…</div>
        ) : error ? (
          <div className="planet-card planet-empty" style={{ color: "var(--pl-danger)" }}>{error}</div>
        ) : matches.length === 0 ? (
          <div className="planet-card planet-empty">
            Пока нет сыгранных онлайн-матчей.
            <br />
            <Link href="/cyberchess/matchmaking" style={{ marginTop: 8, display: "inline-block", color: "var(--pl-gold)" }}>
              Найти соперника →
            </Link>
          </div>
        ) : (
          <>
            {trends.length > 0 && (
              <div style={{ marginBottom: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
                {trends.map((t) => {
                  const first = t.pts[0];
                  const last = t.pts[t.pts.length - 1];
                  const delta = last - first;
                  const peak = Math.max(...t.pts);
                  return (
                    <div key={t.speed} className="planet-card" style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{SPEED_LABEL[t.speed] || t.speed}</span>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                          <span className="planet-num" style={{ fontFamily: "var(--pl-mono)", fontSize: 17, fontWeight: 700 }}>{last}</span>
                          <span
                            className="planet-num"
                            style={{ fontFamily: "var(--pl-mono)", fontSize: 11, fontWeight: 700, color: delta > 0 ? "var(--pl-live)" : delta < 0 ? "var(--pl-danger)" : "var(--pl-muted)" }}
                          >
                            {delta > 0 ? "+" : ""}{delta}
                          </span>
                        </div>
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <Sparkline pts={t.pts} />
                      </div>
                      <div className="planet-muted" style={{ marginTop: 4, display: "flex", justifyContent: "space-between", fontSize: 10.5 }}>
                        <span>{t.pts.length} партий</span>
                        <span>пик {peak}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
                  ? { label: "Победа", color: "var(--pl-live)" }
                  : outcome === "loss"
                    ? { label: "Поражение", color: "var(--pl-danger)" }
                    : { label: "Ничья", color: "var(--pl-muted)" };
              const sanLine = uciToSan(m.movesSan);
              return (
                <div key={m.id} className="planet-card" style={{ display: "flex", alignItems: "stretch", gap: 0, overflow: "hidden" }}>
                  <div style={{ width: 4, flexShrink: 0, background: oc.color }} />
                  <div style={{ minWidth: 0, flex: 1, padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: oc.color }}>{oc.label}</span>
                        <span className="planet-muted" style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>vs {oppName}</span>
                      </div>
                      <div style={{ display: "flex", flexShrink: 0, alignItems: "center", gap: 8 }}>
                        {delta != null && (
                          <span
                            className="planet-num"
                            style={{ fontFamily: "var(--pl-mono)", fontSize: 11, fontWeight: 700, color: delta > 0 ? "var(--pl-live)" : delta < 0 ? "var(--pl-danger)" : "var(--pl-muted)" }}
                          >
                            {delta > 0 ? "+" : ""}{delta}
                          </span>
                        )}
                        {myAfter != null && (
                          <span className="planet-num planet-muted" style={{ fontFamily: "var(--pl-mono)", fontSize: 11 }}>→ {Math.round(myAfter)}</span>
                        )}
                      </div>
                    </div>
                    <div className="planet-muted" style={{ marginTop: 2, display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                      <span>{m.timeControl}</span>
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
                      <div className="planet-muted" style={{ marginTop: 4, fontFamily: "var(--pl-mono)", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={sanLine}>
                        {sanLine}
                      </div>
                    )}
                  </div>
                  <Link
                    href={`/cyberchess/matchmaking?tc=${encodeURIComponent(m.timeControl)}`}
                    style={{ display: "flex", flexShrink: 0, alignItems: "center", borderLeft: "1px solid var(--pl-line)", padding: "0 14px", fontSize: 11.5, fontWeight: 700, color: "var(--pl-gold)" }}
                  >
                    Реванш
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
