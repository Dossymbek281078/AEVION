"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, Badge, Btn, Tooltip, Icon, SectionHeader } from "./ui";
import { COLOR as CC, SPACE, RADIUS, SHADOW, MOTION } from "./theme";

/* ══════════════════════════════════════════════════════════════════════
   Daily Mission — killer #2B
   4 daily targets. Track activity (puzzles solved, games played, daily
   puzzle, coach used). Reward Chessy on each completion + bonus on full.
   Streak counter (consecutive days completed). Reset midnight local time.
   ══════════════════════════════════════════════════════════════════════ */

type DailyState = {
  v: 1;
  date: string;          // YYYY-M-D local
  puzzles: number;
  games: number;
  dailyPuzzle: boolean;
  coach: boolean;
  // Track which mission rewards already paid out (so we don't double-pay)
  paid: string[];
  bonusPaid: boolean;
  streak: number;
  lastCompleteDate?: string;
};

const KEY = "aevion_daily_mission_v1";
const EVENT = "aevion:daily-bump";

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function yesterdayKey(): string {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

const FRESH = (date: string, prevStreak = 0): DailyState => ({
  v: 1, date, puzzles: 0, games: 0, dailyPuzzle: false, coach: false, paid: [], bonusPaid: false, streak: prevStreak,
});

export function loadDaily(): DailyState {
  if (typeof window === "undefined") return FRESH(todayKey());
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as DailyState;
      if (s && s.v === 1) {
        const tk = todayKey();
        if (s.date === tk) return s;
        // New day — reset; preserve streak only if yesterday was completed
        const yk = yesterdayKey();
        const carryStreak = s.lastCompleteDate === yk ? s.streak : 0;
        return FRESH(tk, carryStreak);
      }
    }
  } catch {}
  return FRESH(todayKey());
}

function saveDaily(s: DailyState) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

/** Public bumper — call from anywhere when an activity happens. */
export function bumpDaily(key: "puzzle" | "game" | "daily-puzzle" | "coach") {
  const cur = loadDaily();
  const next = { ...cur };
  if (key === "puzzle") next.puzzles = cur.puzzles + 1;
  else if (key === "game") next.games = cur.games + 1;
  else if (key === "daily-puzzle") next.dailyPuzzle = true;
  else if (key === "coach") next.coach = true;
  saveDaily(next);
  try { window.dispatchEvent(new CustomEvent(EVENT, { detail: next })); } catch {}
}

type MissionDef = {
  id: string;
  emoji: string;
  label: string;
  reward: number;
  ctaLabel: string;
  ctaTab?: "play" | "puzzles" | "analysis" | "coach";
  ctaScroll?: "daily-puzzle";
  current: (s: DailyState) => number;
  target: number;
};

const MISSIONS: MissionDef[] = [
  { id: "puzzles3", emoji: "📚", label: "Реши 3 задачи", reward: 10, ctaTab: "puzzles", ctaLabel: "К пазлам",       current: s => Math.min(3, s.puzzles), target: 3 },
  { id: "game1",    emoji: "♔", label: "Сыграй партию", reward: 15, ctaTab: "play",    ctaLabel: "Играть",         current: s => Math.min(1, s.games),   target: 1 },
  { id: "daily",    emoji: "⭐", label: "Реши пазл дня", reward: 50, ctaTab: "puzzles", ctaScroll: "daily-puzzle", ctaLabel: "Открыть",         current: s => s.dailyPuzzle ? 1 : 0, target: 1 },
  { id: "coach",    emoji: "🎓", label: "Спроси Coach",   reward: 5,  ctaTab: "coach",   ctaLabel: "К тренеру",     current: s => s.coach ? 1 : 0,        target: 1 },
];

type Props = {
  onReward: (n: number, reason: string) => void;
  onNavigate?: (tab: "play" | "puzzles" | "analysis" | "coach") => void;
};

export default function DailyMission({ onReward, onNavigate }: Props) {
  const [state, setState] = useState<DailyState>(() => loadDaily());

  // Re-read state on the bump event from anywhere in the app
  useEffect(() => {
    const onEv = (e: Event) => {
      const detail = (e as CustomEvent).detail as DailyState | undefined;
      if (detail) setState(detail);
      else setState(loadDaily());
    };
    window.addEventListener(EVENT, onEv);
    // Also re-check on focus (in case day changed while tab was background)
    const onFocus = () => setState(loadDaily());
    window.addEventListener("focus", onFocus);
    return () => { window.removeEventListener(EVENT, onEv); window.removeEventListener("focus", onFocus); };
  }, []);

  // Auto-pay rewards when missions complete (idempotent — tracked in `paid`)
  useEffect(() => {
    let dirty = false;
    let s = state;
    for (const m of MISSIONS) {
      const done = m.current(s) >= m.target;
      if (done && !s.paid.includes(m.id)) {
        onReward(m.reward, `daily · ${m.label}`);
        s = { ...s, paid: [...s.paid, m.id] };
        dirty = true;
      }
    }
    // Bonus on completing all 4
    const allDone = MISSIONS.every(m => m.current(s) >= m.target);
    if (allDone && !s.bonusPaid) {
      onReward(50, "daily · все цели · BONUS");
      s = { ...s, bonusPaid: true, lastCompleteDate: s.date, streak: s.streak + 1 };
      dirty = true;
    }
    if (dirty) { saveDaily(s); setState(s); }
  }, [state, onReward]);

  const totalReward = MISSIONS.reduce((sum, m) => sum + m.reward, 0) + 50;
  const earnedReward = MISSIONS.filter(m => state.paid.includes(m.id)).reduce((sum, m) => sum + m.reward, 0) + (state.bonusPaid ? 50 : 0);
  const completedCount = MISSIONS.filter(m => m.current(state) >= m.target).length;
  const allDone = completedCount === MISSIONS.length;

  return (
    <Card padding={SPACE[4]} elevation="md" style={{
      background: allDone
        ? "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)"
        : "linear-gradient(135deg, #faf5ff 0%, #f5f3ff 100%)",
      border: `1px solid ${allDone ? "#6ee7b7" : "#e9d5ff"}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: SPACE[2], marginBottom: SPACE[3] }}>
        <span style={{ fontSize: 20 }}>{allDone ? "🎉" : "🎯"}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: allDone ? "#065f46" : CC.accent, letterSpacing: 0.5, textTransform: "uppercase" }}>
            Дневные цели · {completedCount}/{MISSIONS.length}
          </div>
          <div style={{ fontSize: 11, color: CC.textDim, marginTop: 1 }}>
            {allDone ? "Все цели выполнены — отличный день!" : `Сегодня можно заработать +${totalReward - earnedReward} Chessy`}
          </div>
        </div>
        {state.streak > 0 && (
          <Tooltip label={`${state.streak} ${state.streak === 1 ? "день подряд" : "дней подряд"} выполнял все цели`}>
            <Badge tone="danger" size="md">🔥 {state.streak}</Badge>
          </Tooltip>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ height: 6, borderRadius: 3, background: "rgba(0,0,0,0.06)", overflow: "hidden", marginBottom: SPACE[3] }}>
        <div style={{
          height: "100%",
          width: `${(completedCount / MISSIONS.length) * 100}%`,
          background: allDone
            ? "linear-gradient(90deg, #10b981, #059669)"
            : "linear-gradient(90deg, #a78bfa, #7c3aed)",
          transition: `width ${MOTION.slow} ${MOTION.easeSpring}`,
        }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: SPACE[2] }}>
        {MISSIONS.map(m => {
          const cur = m.current(state);
          const done = cur >= m.target;
          return (
            <div key={m.id} style={{
              display: "flex", alignItems: "center", gap: SPACE[2],
              padding: `${SPACE[2]}px ${SPACE[3]}px`,
              borderRadius: RADIUS.md,
              background: done ? "rgba(5,150,105,0.08)" : CC.surface1,
              border: `1px solid ${done ? CC.brand : CC.border}`,
              transition: `all ${MOTION.fast} ${MOTION.ease}`,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: done ? CC.brand : "rgba(124,58,237,0.12)",
                color: done ? "#fff" : CC.accent,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, flexShrink: 0,
              }}>{done ? "✓" : m.emoji}</div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: CC.text, textDecoration: done ? "line-through" : undefined, opacity: done ? 0.7 : 1 }}>
                  {m.label}
                </div>
                <div style={{ fontSize: 11, color: CC.textDim, fontWeight: 600 }}>
                  {cur} / {m.target} · +{m.reward} <Icon.Coin width={9} height={9}/>
                </div>
              </div>

              {!done && onNavigate && m.ctaTab && (
                <Btn size="xs" variant="ghost" onClick={() => onNavigate(m.ctaTab!)} style={{ color: CC.accent, fontWeight: 800 }}>
                  {m.ctaLabel} →
                </Btn>
              )}
            </div>
          );
        })}
      </div>

      {allDone && !state.bonusPaid && (
        <div style={{ marginTop: SPACE[3], textAlign: "center", fontSize: 12, color: "#065f46", fontWeight: 700 }}>
          💎 Бонус +50 Chessy выдан · streak +1
        </div>
      )}
    </Card>
  );
}
