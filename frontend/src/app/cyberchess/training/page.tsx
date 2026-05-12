"use client";

// AEVION CyberChess Training Hub — ежедневный план тренировок,
// собранный из CPI weak factor + Coach SR reminders + daily variant.
// Zone: aevion-core/main owns frontend/src/app/cyberchess/**

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";

const C = {
  bg: "#0f172a",
  panel: "#1e293b",
  border: "#334155",
  text: "#f1f5f9",
  dim: "#94a3b8",
  faint: "#64748b",
  purple: "#a78bfa",
  green: "#34d399",
  red: "#ef4444",
  yellow: "#fbbf24",
  cyan: "#22d3ee",
  gold: "#facc15",
  orange: "#fb923c",
};

// Fallback CPI types — re-import from cpi.ts when available
type CPIState = { v: 1; cpi: number; history: Array<{ date: string; delta: number; gameId?: string; breakdown: Record<string, number>; result: "w" | "l" | "d" }> };

function ldCPIState(): CPIState {
  try {
    const r = JSON.parse(localStorage.getItem("aevion_cyberchess_cpi_v1") || "");
    if (r?.v === 1) return r;
  } catch {}
  return { v: 1, cpi: 1200, history: [] };
}

function ldReminders(): Array<{ entryId: string; milestone: 1 | 3 | 7 }> {
  try {
    const raw = localStorage.getItem("aevion_coach_reminders_v1");
    if (!raw) return [];
    const s = JSON.parse(raw);
    if (s?.v !== 1) return [];
    const now = Date.now();
    const out: Array<{ entryId: string; milestone: 1 | 3 | 7 }> = [];
    for (const [entryId, info] of Object.entries(s.entries as Record<string, { firstStudyAt: string; dismissed: number[] }>)) {
      const days = (now - new Date(info.firstStudyAt).getTime()) / 86400000;
      for (const ms of [1, 3, 7] as const) {
        if (days >= ms && !info.dismissed.includes(ms)) out.push({ entryId, milestone: ms });
      }
    }
    return out;
  } catch { return [] }
}

const FACTOR_DRILLS: Record<string, { name: string; emoji: string; drillName: string; href: string; reps: string }> = {
  E:  { name: "Точность ходов",  emoji: "🎯", drillName: "Slow training (15+10)",    href: "/cyberchess?train=slow",      reps: "1 партия" },
  T:  { name: "Время",            emoji: "⏱",  drillName: "Blitz (3+0)",              href: "/cyberchess?train=blitz",     reps: "3 партии" },
  O:  { name: "Дебюты",           emoji: "📖", drillName: "Opening Trainer",          href: "/cyberchess?train=openings",  reps: "10 линий" },
  B1: { name: "Лучшая линия",     emoji: "①",  drillName: "Analysis review",          href: "/cyberchess?tab=analysis",    reps: "Последняя партия" },
  M1: { name: "Мат-1 зрение",     emoji: "💀", drillName: "Puzzle Rush — mate-1",     href: "/cyberchess?train=mate1",     reps: "20 пазлов" },
  M2: { name: "Мат-2 зрение",     emoji: "💀💀", drillName: "Puzzle Rush — mate-2", href: "/cyberchess?train=mate2",   reps: "15 пазлов" },
  M3: { name: "Мат-3 зрение",     emoji: "💀💀💀", drillName: "Mate-in-3 пазлы",     href: "/cyberchess?train=mate3",     reps: "10 пазлов" },
  H:  { name: "Зевки",            emoji: "💥", drillName: "Defensive puzzles",        href: "/cyberchess?train=defense",   reps: "15 пазлов" },
  Br: { name: "Бриллианты",       emoji: "💎", drillName: "Masters tab — изучай шедевры", href: "/cyberchess?tab=masters", reps: "5 партий" },
};

// Daily variant — deterministic per day (mirrors variants.ts dailyVariant logic)
const VARIANT_POOL = [
  { id: "fischer960", name: "Fischer 960", emoji: "🎲", desc: "Случайный бэкранк" },
  { id: "atomic", name: "Atomic", emoji: "💥", desc: "Взятие = взрыв 3×3" },
  { id: "kingofthehill", name: "King of the Hill", emoji: "⛰", desc: "Король в центр = победа" },
  { id: "threecheck", name: "Three-Check", emoji: "⚡", desc: "3 шаха = победа" },
  { id: "crazyhouse", name: "Crazyhouse", emoji: "🏚", desc: "Дроп каждый ход" },
  { id: "twinkings", name: "Twin Kings", emoji: "👑", desc: "Ферзь = второй король" },
  { id: "knightriders", name: "Knight Riders", emoji: "🐎", desc: "Только кони + пешки" },
];

function todaysVariant() {
  const days = Math.floor(Date.now() / 86400000);
  let h = days * 2654435761; h = (h ^ (h >>> 16)) >>> 0;
  return VARIANT_POOL[h % VARIANT_POOL.length];
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export default function TrainingHubPage() {
  const [cpiState, setCpiState] = useState<CPIState | null>(null);
  const [reminders, setReminders] = useState<Array<{ entryId: string; milestone: 1 | 3 | 7 }>>([]);
  const [dailyClaimed, setDailyClaimed] = useState(false);

  useEffect(() => {
    setCpiState(ldCPIState());
    setReminders(ldReminders());
    try {
      const last = localStorage.getItem("aevion_cyberchess_training_daily_claimed_v1");
      setDailyClaimed(last === todayKey());
    } catch {}
  }, []);

  const weakFactor = useMemo(() => {
    if (!cpiState || cpiState.history.length < 3) return null;
    const recent = cpiState.history.slice(-10);
    const sums: Record<string, number> = {};
    const counts: Record<string, number> = {};
    for (const h of recent) {
      for (const [k, v] of Object.entries(h.breakdown || {})) {
        if (typeof v !== "number" || k === "result") continue;
        sums[k] = (sums[k] || 0) + v;
        counts[k] = (counts[k] || 0) + 1;
      }
    }
    let weakest = "E";
    let lowest = Infinity;
    // H is a penalty (negative contribution stored as positive) — invert logic
    for (const [k, sum] of Object.entries(sums)) {
      const avg = sum / (counts[k] || 1);
      // For factors other than H, lower avg = weaker
      // For H, higher avg = worse (more hangs)
      const score = k === "H" ? -avg : avg;
      if (score < lowest) { lowest = score; weakest = k }
    }
    return weakest;
  }, [cpiState]);

  const dailyVariant = useMemo(() => todaysVariant(), []);
  const drill = weakFactor ? FACTOR_DRILLS[weakFactor] || FACTOR_DRILLS.E : FACTOR_DRILLS.E;

  const claimDaily = () => {
    try { localStorage.setItem("aevion_cyberchess_training_daily_claimed_v1", todayKey()) } catch {}
    setDailyClaimed(true);
    // In production, this would POST /api/cyberchess/training/daily-bonus
    alert("✨ +25 Chessy зачислено на твой счёт");
  };

  return (
    <main style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "system-ui, sans-serif", padding: "32px 16px" }}>
      <style>{`
        @media (max-width: 640px) {
          h1 { font-size: 22px !important; }
          h2 { font-size: 16px !important; }
          button, a[role="button"] { min-height: 44px; }
          table { font-size: 11px; }
          pre { font-size: 11px !important; }
        }
      `}</style>
      <article style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: 12, color: C.faint, marginBottom: 16 }}>
          <Link href="/cyberchess" style={{ color: C.dim, textDecoration: "none" }}>CyberChess</Link>
          {" / "}<span style={{ color: C.text }}>Training Hub</span>
        </div>

        {/* Hero */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 8px", lineHeight: 1.15 }}>
            Training Hub
          </h1>
          <p style={{ fontSize: 14, color: C.dim, lineHeight: 1.65, margin: 0, maxWidth: 640 }}>
            Твой персональный ежедневный план. Основан на CPI weak factor, due Coach reminders,
            и daily-variant ротации.
          </p>
        </div>

        {/* Today's plan */}
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", marginBottom: 28 }}>
          {/* Card 1: Weak factor drill */}
          <div style={{
            background: `linear-gradient(135deg, rgba(167,139,250,0.10), rgba(34,211,238,0.05))`,
            border: `1px solid ${C.purple}40`,
            borderLeft: `4px solid ${C.purple}`,
            borderRadius: 12,
            padding: "16px 18px",
          }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: C.purple, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
              💪 Твоя слабая зона
            </div>
            {weakFactor ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 22 }}>{drill.emoji}</span>
                  <span>{drill.name}</span>
                </div>
                <div style={{ fontSize: 13, color: C.dim, marginBottom: 12, lineHeight: 1.5 }}>
                  Тренируй: <strong style={{ color: C.text }}>{drill.drillName}</strong>{" "}
                  <span style={{ color: C.cyan }}>({drill.reps})</span>
                </div>
                <Link href={drill.href} style={{
                  display: "inline-block",
                  background: C.purple, color: "#fff", padding: "8px 14px", borderRadius: 8,
                  fontSize: 12, fontWeight: 800, textDecoration: "none",
                }}>
                  Начать тренировку →
                </Link>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, color: C.dim, marginBottom: 10, lineHeight: 1.5 }}>
                  Сыграй 3+ партии чтобы Coach определил твою слабую зону.
                </div>
                <Link href="/cyberchess" style={{
                  display: "inline-block",
                  background: C.purple, color: "#fff", padding: "8px 14px", borderRadius: 8,
                  fontSize: 12, fontWeight: 800, textDecoration: "none",
                }}>
                  Сыграть партию →
                </Link>
              </>
            )}
          </div>

          {/* Card 2: Daily variant */}
          <div style={{
            background: `linear-gradient(135deg, rgba(251,146,60,0.10), rgba(252,211,77,0.05))`,
            border: `1px solid ${C.orange}40`,
            borderLeft: `4px solid ${C.orange}`,
            borderRadius: 12,
            padding: "16px 18px",
          }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: C.orange, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
              🎲 Вариант дня
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 22 }}>{dailyVariant.emoji}</span>
              <span>{dailyVariant.name}</span>
            </div>
            <div style={{ fontSize: 13, color: C.dim, marginBottom: 12, lineHeight: 1.5 }}>
              {dailyVariant.desc}. Победа = <strong style={{ color: C.gold }}>+50 Chessy</strong> bonus
            </div>
            <Link href={`/cyberchess?variant=${dailyVariant.id}`} style={{
              display: "inline-block",
              background: C.orange, color: "#fff", padding: "8px 14px", borderRadius: 8,
              fontSize: 12, fontWeight: 800, textDecoration: "none",
            }}>
              Играть {dailyVariant.name} →
            </Link>
          </div>

          {/* Card 3: SR reminders */}
          <div style={{
            background: `linear-gradient(135deg, rgba(52,211,153,0.10), rgba(34,211,238,0.05))`,
            border: `1px solid ${C.green}40`,
            borderLeft: `4px solid ${C.green}`,
            borderRadius: 12,
            padding: "16px 18px",
          }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: C.green, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
              🎓 Coach Review
            </div>
            {reminders.length > 0 ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 4 }}>
                  {reminders.length} тем{reminders.length === 1 ? "а" : "ы"} ждут повторения
                </div>
                <div style={{ fontSize: 12, color: C.dim, marginBottom: 10, lineHeight: 1.5 }}>
                  По системе spaced-repetition (1/3/7 дней). Повтори чтобы закрепить.
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
                  {[1, 3, 7].map((ms) => {
                    const count = reminders.filter(r => r.milestone === ms).length;
                    if (count === 0) return null;
                    return (
                      <span key={ms} style={{
                        fontSize: 10, padding: "2px 7px", borderRadius: 999,
                        background: "rgba(52,211,153,0.18)", color: C.green, fontWeight: 800,
                      }}>{ms}d × {count}</span>
                    );
                  })}
                </div>
                <Link href="/cyberchess?tab=coach&modal=knowledge" style={{
                  display: "inline-block",
                  background: C.green, color: "#fff", padding: "8px 14px", borderRadius: 8,
                  fontSize: 12, fontWeight: 800, textDecoration: "none",
                }}>
                  Открыть базу знаний →
                </Link>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, color: C.dim, marginBottom: 10, lineHeight: 1.5 }}>
                  Нет тем для повторения сегодня. Открой Coach Knowledge чтобы изучить новые.
                </div>
                <Link href="/cyberchess?tab=coach&modal=knowledge" style={{
                  display: "inline-block",
                  background: C.green, color: "#fff", padding: "8px 14px", borderRadius: 8,
                  fontSize: 12, fontWeight: 800, textDecoration: "none",
                }}>
                  Открыть знания →
                </Link>
              </>
            )}
          </div>

          {/* Card 4: Daily Chessy bonus */}
          <div style={{
            background: `linear-gradient(135deg, rgba(250,204,21,0.10), rgba(251,191,36,0.05))`,
            border: `1px solid ${C.gold}40`,
            borderLeft: `4px solid ${C.gold}`,
            borderRadius: 12,
            padding: "16px 18px",
          }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: C.gold, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
              🪙 Daily Chessy
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 4 }}>
              {dailyClaimed ? "Сегодня забрано ✓" : "Заберать ежедневный бонус"}
            </div>
            <div style={{ fontSize: 13, color: C.dim, marginBottom: 12, lineHeight: 1.5 }}>
              <strong style={{ color: C.gold }}>+25 AEV</strong> за визит в training hub. Используй в Economy для аукциона или аренды тренера.
            </div>
            <button
              onClick={claimDaily}
              disabled={dailyClaimed}
              style={{
                background: dailyClaimed ? "rgba(148,163,184,0.18)" : C.gold,
                color: dailyClaimed ? C.dim : "#0f172a",
                padding: "8px 14px", borderRadius: 8,
                fontSize: 12, fontWeight: 800,
                border: "none",
                cursor: dailyClaimed ? "default" : "pointer",
              }}
            >
              {dailyClaimed ? "✓ Получено" : "Забрать +25 AEV"}
            </button>
          </div>
        </div>

        {/* CPI progress strip */}
        {cpiState && (
          <div style={{
            background: C.panel,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: "14px 18px",
            marginBottom: 24,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.faint, textTransform: "uppercase", letterSpacing: 0.6 }}>Текущий CPI</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: C.purple, fontFamily: "ui-monospace, monospace" }}>{cpiState.cpi}</div>
            </div>
            <div style={{ fontSize: 12, color: C.dim }}>
              Партий сыграно: <strong style={{ color: C.text }}>{cpiState.history.length}</strong>
            </div>
            <Link href="/cyberchess/cpi/dashboard" style={{
              fontSize: 12, color: C.purple, textDecoration: "none", fontWeight: 700,
            }}>
              📊 Открыть дашборд →
            </Link>
          </div>
        )}

        {/* Resources strip */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.faint, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
            Ресурсы
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: 10 }}>
            {[
              { href: "/cyberchess/cpi/leaderboard", emoji: "🏆", label: "CPI Leaderboard", desc: "Топ-15 по композитному рейтингу" },
              { href: "/cyberchess/economy", emoji: "🪙", label: "Economy", desc: "Аукцион, тренеры, стримеры" },
              { href: "/cyberchess/cpi", emoji: "📐", label: "CPI Spec", desc: "Полная формула + примеры" },
              { href: "/cyberchess", emoji: "♞", label: "Играть", desc: "Главная — играть партии" },
            ].map((r) => (
              <Link key={r.href} href={r.href} style={{
                background: C.panel,
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: "12px 14px",
                textDecoration: "none",
                color: C.text,
                display: "block",
              }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>{r.emoji}</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 2 }}>{r.label}</div>
                <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.4 }}>{r.desc}</div>
              </Link>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 32, fontSize: 11, color: C.faint, textAlign: "center" }}>
          Hub обновляется ежедневно · CPI-данные подгружаются из localStorage
        </div>
      </article>
    </main>
  );
}
