"use client";

import { useMemo, useState } from "react";
import { fideConfidenceInterval, nearestAnchor, RATING_ANCHORS } from "./ratingCalibration";

/**
 * Player Stats Dashboard — visual summary накопленной статистики игрока.
 *
 * Источники данных (всё уже хранится в page.tsx state):
 *   - savedGames: SavedGame[] — последние 200 партий
 *   - sts: {w,l,d} — total record
 *   - rat: number — текущий рейтинг
 *   - pzSolvedCount, chessy, achievements
 *
 * Computed metrics (всё pure-functional, без external deps):
 *   - W/L/D %, current streak, longest streak
 *   - Performance per AI level + per time control
 *   - Top-5 openings + win rate per opening
 *   - Time-of-day распределение (24h heatmap-style)
 *   - Recent rating trend (last 20 games sparkline)
 */

type SavedGame = {
  id: string; date: string; moves: string[]; result: string;
  playerColor: "w" | "b"; aiLevel: string; rating: number;
  tc: string; category: "Bullet" | "Blitz" | "Rapid" | "Classical";
  opening?: string;
};

type Stats = { w: number; l: number; d: number };

type Tab = "overview" | "openings" | "timing" | "trend" | "calibration";

type Props = {
  open: boolean;
  onClose: () => void;
  savedGames: SavedGame[];
  stats: Stats;
  rating: number;
  pzSolvedCount: number;
  achievementsUnlocked: number;
  achievementsTotal: number;
  loginStreak: number;
  surface1: string;
  surface2: string;
  border: string;
  text: string;
  textDim: string;
  textMute: string;
  brand: string;
};

function isWin(g: SavedGame): boolean {
  // SavedGame.result строки типа "Checkmate! You win!", "AI wins", "You win", etc.
  const r = g.result.toLowerCase();
  return r.includes("you win") || r.includes("ai timed out") || r.includes("resigned!");
}
function isLoss(g: SavedGame): boolean {
  const r = g.result.toLowerCase();
  return r.includes("ai win") || r.includes("time out") && !r.includes("ai timed");
}

export default function PlayerStatsDashboard({
  open, onClose,
  savedGames, stats, rating, pzSolvedCount,
  achievementsUnlocked, achievementsTotal, loginStreak,
  surface1, surface2, border, text, textDim, textMute, brand,
}: Props) {
  const [tab, setTab] = useState<Tab>("overview");

  const metrics = useMemo(() => {
    const total = stats.w + stats.l + stats.d;
    const winPct = total > 0 ? Math.round((stats.w / total) * 100) : 0;
    const drawPct = total > 0 ? Math.round((stats.d / total) * 100) : 0;
    const lossPct = total > 0 ? Math.round((stats.l / total) * 100) : 0;

    // Current streak (W/L count from latest backwards)
    let currentStreak = 0;
    let streakKind: "W" | "L" | "D" | null = null;
    for (const g of savedGames) {
      const w = isWin(g), l = isLoss(g);
      const k = w ? "W" : l ? "L" : "D";
      if (streakKind === null) { streakKind = k as "W"|"L"|"D"; currentStreak = 1; continue; }
      if (k === streakKind) currentStreak++;
      else break;
    }

    // Longest streak (max consecutive Ws)
    let longestWinStreak = 0, run = 0;
    for (let i = savedGames.length - 1; i >= 0; i--) {
      if (isWin(savedGames[i])) { run++; longestWinStreak = Math.max(longestWinStreak, run); }
      else run = 0;
    }

    // Per time category
    const byCat: Record<string, {w: number; l: number; d: number}> = {};
    for (const g of savedGames) {
      if (!byCat[g.category]) byCat[g.category] = {w: 0, l: 0, d: 0};
      if (isWin(g)) byCat[g.category].w++;
      else if (isLoss(g)) byCat[g.category].l++;
      else byCat[g.category].d++;
    }

    // Per AI level
    const byAi: Record<string, {w: number; total: number}> = {};
    for (const g of savedGames) {
      if (!byAi[g.aiLevel]) byAi[g.aiLevel] = {w: 0, total: 0};
      byAi[g.aiLevel].total++;
      if (isWin(g)) byAi[g.aiLevel].w++;
    }

    // Top openings
    const byOpening: Record<string, {w: number; total: number}> = {};
    for (const g of savedGames) {
      const op = g.opening || "Стандарт";
      if (!byOpening[op]) byOpening[op] = {w: 0, total: 0};
      byOpening[op].total++;
      if (isWin(g)) byOpening[op].w++;
    }
    const topOpenings = Object.entries(byOpening)
      .filter(([, v]) => v.total >= 2)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 8);

    // Time of day (hour → count)
    const byHour: number[] = Array(24).fill(0);
    for (const g of savedGames) {
      try {
        const h = new Date(g.date).getHours();
        if (h >= 0 && h < 24) byHour[h]++;
      } catch {}
    }
    const peakHour = byHour.indexOf(Math.max(...byHour));

    // Rating sparkline (last 30 games)
    const ratingHistory = savedGames.slice(0, 30).map(g => g.rating).reverse();

    // Avg game length
    const avgPlies = total > 0
      ? Math.round(savedGames.reduce((s, g) => s + g.moves.length, 0) / Math.max(1, savedGames.length))
      : 0;

    return {
      total, winPct, drawPct, lossPct,
      currentStreak, streakKind, longestWinStreak,
      byCat, byAi, topOpenings, byHour, peakHour,
      ratingHistory, avgPlies,
    };
  }, [savedGames, stats]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 280,
        background: "rgba(15,23,42,0.62)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 820, maxHeight: "92vh",
          background: surface1, color: text,
          borderRadius: 14, boxShadow: "0 24px 64px rgba(0,0,0,0.36)",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: `1px solid ${border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: text }}>
              📊 Статистика игрока
            </h2>
            <div style={{ fontSize: 12, color: textDim, marginTop: 4 }}>
              {metrics.total} партий · рейтинг {rating} · {pzSolvedCount} пазлов · {achievementsUnlocked}/{achievementsTotal} ачивок
            </div>
          </div>
          <button onClick={onClose} aria-label="Close"
            style={{
              width: 32, height: 32, border: `1px solid ${border}`,
              borderRadius: 8, background: surface2, color: text,
              cursor: "pointer", fontSize: 16,
            }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex", borderBottom: `1px solid ${border}`,
        }}>
          {([
            ["overview", "Обзор"],
            ["openings", "Дебюты"],
            ["timing", "Время"],
            ["trend", "Тренд"],
            ["calibration", "FIDE"],
          ] as [Tab, string][]).map(([id, label]) => {
            const active = tab === id;
            return (
              <button key={id} onClick={() => setTab(id)}
                style={{
                  flex: 1, padding: "10px 12px",
                  background: active ? `${brand}10` : "transparent",
                  border: "none",
                  borderBottom: active ? `2px solid ${brand}` : "2px solid transparent",
                  color: active ? brand : textDim,
                  fontSize: 12, fontWeight: active ? 900 : 700, cursor: "pointer",
                  transition: "all 150ms",
                }}>{label}</button>
            );
          })}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {tab === "overview" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
              <Card label="Победы" value={stats.w} pct={metrics.winPct} color="#10b981" surface={surface2} border={border} dim={textDim} />
              <Card label="Поражения" value={stats.l} pct={metrics.lossPct} color="#ef4444" surface={surface2} border={border} dim={textDim} />
              <Card label="Ничьи" value={stats.d} pct={metrics.drawPct} color="#f59e0b" surface={surface2} border={border} dim={textDim} />
              <Card label="Текущая серия"
                value={metrics.currentStreak > 0 ? `${metrics.currentStreak}${metrics.streakKind === "W" ? "🏆" : metrics.streakKind === "L" ? "💔" : "🤝"}` : "—"}
                color={metrics.streakKind === "W" ? "#10b981" : metrics.streakKind === "L" ? "#ef4444" : textMute}
                surface={surface2} border={border} dim={textDim} />
              <Card label="Лучшая серия побед" value={metrics.longestWinStreak} color="#a78bfa" surface={surface2} border={border} dim={textDim} />
              <Card label="Login streak" value={`${loginStreak} 📅`} color="#f59e0b" surface={surface2} border={border} dim={textDim} />
              <Card label="Средняя длина" value={`${metrics.avgPlies} ходов`} color={textMute} surface={surface2} border={border} dim={textDim} />
              <Card label="Пиковый час" value={metrics.peakHour >= 0 ? `${metrics.peakHour}:00` : "—"} color={textMute} surface={surface2} border={border} dim={textDim} />
            </div>
          )}

          {tab === "openings" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {metrics.topOpenings.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: textMute, fontSize: 12 }}>
                  Сыграй больше 2 партий с одинаковыми дебютами для статистики
                </div>
              ) : metrics.topOpenings.map(([opening, v]) => {
                const winRate = Math.round((v.w / v.total) * 100);
                return (
                  <div key={opening} style={{
                    padding: "10px 12px", borderRadius: 8,
                    background: surface2, border: `1px solid ${border}`,
                    display: "flex", alignItems: "center", gap: 10,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {opening}
                      </div>
                      <div style={{ fontSize: 10, color: textDim, marginTop: 2 }}>
                        {v.total} партий · {v.w} побед
                      </div>
                    </div>
                    <div style={{
                      fontSize: 16, fontWeight: 900,
                      color: winRate >= 60 ? "#10b981" : winRate >= 40 ? "#f59e0b" : "#ef4444",
                      minWidth: 50, textAlign: "right" as const,
                    }}>
                      {winRate}%
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === "timing" && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: textDim, marginBottom: 6, letterSpacing: 0.4, textTransform: "uppercase" as const }}>
                Активность по часам (UTC)
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(24, 1fr)", gap: 2, marginBottom: 16 }}>
                {metrics.byHour.map((count, h) => {
                  const max = Math.max(...metrics.byHour, 1);
                  const pct = count / max;
                  return (
                    <div key={h} style={{
                      height: 60, display: "flex", flexDirection: "column", justifyContent: "flex-end",
                      gap: 2, alignItems: "center",
                    }}>
                      <div style={{ fontSize: 8, color: textMute, fontFamily: "ui-monospace, monospace" }}>{count || ""}</div>
                      <div style={{
                        width: "100%",
                        height: `${pct * 100}%`,
                        background: pct > 0 ? `${brand}${Math.round(40 + pct * 215).toString(16).padStart(2, "0")}` : "rgba(255,255,255,0.05)",
                        borderRadius: 2, minHeight: 2,
                      }}/>
                      <div style={{ fontSize: 8, color: h === metrics.peakHour ? brand : textMute, fontFamily: "ui-monospace, monospace", fontWeight: h === metrics.peakHour ? 900 : 400 }}>
                        {h}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ fontSize: 11, fontWeight: 800, color: textDim, marginBottom: 6, letterSpacing: 0.4, textTransform: "uppercase" as const }}>
                По формату времени
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Object.entries(metrics.byCat).map(([cat, v]) => {
                  const total = v.w + v.l + v.d;
                  if (total === 0) return null;
                  const winPct = Math.round((v.w / total) * 100);
                  return (
                    <div key={cat} style={{
                      padding: "8px 12px", borderRadius: 8,
                      background: surface2, border: `1px solid ${border}`,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: text }}>{cat}</span>
                        <span style={{ fontSize: 11, color: textDim, fontFamily: "ui-monospace, monospace" }}>
                          {v.w}/{v.d}/{v.l} · {winPct}%
                        </span>
                      </div>
                      <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden", display: "flex" }}>
                        <div style={{ flex: v.w, background: "#10b981" }}/>
                        <div style={{ flex: v.d, background: "#f59e0b" }}/>
                        <div style={{ flex: v.l, background: "#ef4444" }}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {tab === "trend" && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: textDim, marginBottom: 6, letterSpacing: 0.4, textTransform: "uppercase" as const }}>
                Рейтинг (последние {metrics.ratingHistory.length} партий)
              </div>
              {metrics.ratingHistory.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: textMute, fontSize: 12 }}>
                  Сыграй несколько партий для отображения тренда
                </div>
              ) : (() => {
                const min = Math.min(...metrics.ratingHistory);
                const max = Math.max(...metrics.ratingHistory);
                const range = Math.max(1, max - min);
                const w = 720, h = 200, pad = 10;
                const pts = metrics.ratingHistory.map((r, i) => {
                  const x = pad + (i / Math.max(1, metrics.ratingHistory.length - 1)) * (w - 2 * pad);
                  const y = h - pad - ((r - min) / range) * (h - 2 * pad);
                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                });
                const change = metrics.ratingHistory[metrics.ratingHistory.length - 1] - metrics.ratingHistory[0];
                return (
                  <div>
                    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 200, background: surface2, borderRadius: 8, border: `1px solid ${border}` }}>
                      <polyline points={pts.join(" ")} fill="none" stroke={brand} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                      {pts.length > 0 && (() => {
                        const lastPt = pts[pts.length - 1].split(",");
                        return <circle cx={lastPt[0]} cy={lastPt[1]} r={4} fill={brand}/>;
                      })()}
                    </svg>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: textDim }}>
                      <span>min: {min}</span>
                      <span style={{ color: change > 0 ? "#10b981" : change < 0 ? "#ef4444" : textMute, fontWeight: 800 }}>
                        Δ {change >= 0 ? "+" : ""}{change}
                      </span>
                      <span>max: {max}</span>
                    </div>
                  </div>
                );
              })()}

              <div style={{ fontSize: 11, fontWeight: 800, color: textDim, marginTop: 16, marginBottom: 6, letterSpacing: 0.4, textTransform: "uppercase" as const }}>
                По уровню AI
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {Object.entries(metrics.byAi)
                  .sort((a, b) => b[1].total - a[1].total)
                  .slice(0, 8)
                  .map(([ai, v]) => {
                    const winPct = Math.round((v.w / v.total) * 100);
                    return (
                      <div key={ai} style={{
                        padding: "6px 10px", borderRadius: 6,
                        background: surface2, border: `1px solid ${border}`,
                        display: "flex", alignItems: "center", gap: 10,
                      }}>
                        <span style={{ flex: 1, fontSize: 11, fontWeight: 800, color: text }}>{ai}</span>
                        <span style={{ fontSize: 10, color: textDim, fontFamily: "ui-monospace, monospace" }}>{v.total} партий</span>
                        <span style={{
                          fontSize: 12, fontWeight: 900,
                          color: winPct >= 50 ? "#10b981" : winPct >= 30 ? "#f59e0b" : "#ef4444",
                          minWidth: 38, textAlign: "right" as const,
                        }}>{winPct}%</span>
                      </div>
                    );
                  })}
              </div>
            </>
          )}

          {tab === "calibration" && (() => {
            const ci = fideConfidenceInterval(rating, metrics.total);
            const anchor = nearestAnchor(rating);
            return (
              <>
                <div style={{
                  padding: 20, borderRadius: 12,
                  background: `linear-gradient(135deg, ${surface2}, rgba(167,139,250,0.05))`,
                  border: `1px solid ${border}`,
                  marginBottom: 16,
                  textAlign: "center" as const,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: textDim, letterSpacing: 0.6, textTransform: "uppercase" as const, marginBottom: 6 }}>
                    Ваша оценка по FIDE-шкале
                  </div>
                  <div style={{ fontSize: 40, fontWeight: 900, color: brand, lineHeight: 1, marginBottom: 6 }}>
                    {anchor.badge} {ci.fide}
                  </div>
                  <div style={{ fontSize: 13, color: text, fontWeight: 800, marginBottom: 4 }}>
                    {anchor.title}
                  </div>
                  <div style={{ fontSize: 11, color: textDim, fontFamily: "ui-monospace, monospace" }}>
                    диапазон: {ci.low}–{ci.high} · по {ci.samples} партиям
                  </div>
                  <div style={{ fontSize: 11, color: textDim, marginTop: 10, lineHeight: 1.4 }}>
                    {anchor.desc}
                  </div>
                </div>

                <div style={{ fontSize: 11, fontWeight: 800, color: textDim, marginBottom: 8, letterSpacing: 0.4, textTransform: "uppercase" as const }}>
                  Шкала AEVION ↔ FIDE
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {RATING_ANCHORS.map(a => {
                    const isMe = a.title === anchor.title;
                    return (
                      <div key={a.title} style={{
                        padding: "6px 12px", borderRadius: 6,
                        background: isMe ? `${brand}15` : surface2,
                        border: `1px solid ${isMe ? brand : border}`,
                        display: "flex", alignItems: "center", gap: 10,
                      }}>
                        <span style={{ fontSize: 16, width: 28, textAlign: "center" as const }}>{a.badge}</span>
                        <span style={{ flex: 1, fontSize: 11, fontWeight: isMe ? 900 : 700, color: isMe ? brand : text }}>
                          {a.title}
                        </span>
                        <span style={{ fontSize: 10, color: textDim, fontFamily: "ui-monospace, monospace" }}>
                          AEV {a.internal}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 800, color: isMe ? brand : textMute, minWidth: 60, textAlign: "right" as const, fontFamily: "ui-monospace, monospace" }}>
                          FIDE {a.fide}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div style={{ fontSize: 10, color: textMute, marginTop: 12, lineHeight: 1.5, padding: "8px 12px", background: surface2, borderRadius: 6 }}>
                  Калибровка приблизительная — построена на anchor-точках уровней.
                  По мере набора партий (100+) оценка стабилизируется до ±50 ELO.
                  Полная калибровка через CPI factor regression появится после corpus dataset.
                </div>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

function Card({
  label, value, pct, color, surface, border, dim,
}: {
  label: string;
  value: number | string;
  pct?: number;
  color: string;
  surface: string;
  border: string;
  dim: string;
}) {
  return (
    <div style={{
      padding: "12px 14px", borderRadius: 10,
      background: surface, border: `1px solid ${border}`,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: dim, letterSpacing: 0.4, textTransform: "uppercase" as const, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1.1 }}>
        {value}
      </div>
      {typeof pct === "number" && (
        <div style={{ fontSize: 10, color: dim, marginTop: 2, fontFamily: "ui-monospace, monospace" }}>
          {pct}%
        </div>
      )}
    </div>
  );
}
