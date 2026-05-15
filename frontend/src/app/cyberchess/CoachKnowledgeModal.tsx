"use client";
import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { COACH_KNOWLEDGE, type KnowledgeCategory, type KnowledgeEntry, type Difficulty } from "./coachKnowledge";
import { ldCPIState, type CPIState, type CPIBreakdown } from "./cpi";

// ── F5: Coach по CPI — слабый/сильный фактор + рекомендации
type FactorKey = "E" | "T" | "O" | "B1" | "B2" | "B3" | "M1" | "M2" | "M3" | "H" | "Br";

const FACTOR_RECS: Record<FactorKey, { name: string; emoji: string; rec: string; targetMod: string }> = {
  E:  { name: "Точность ходов",       emoji: "🎯",   rec: "Замедли темп — играй с большим контролем времени",          targetMod: "rapid" },
  T:  { name: "Управление временем",  emoji: "⏱",   rec: "Тренируй блиц 3+0 — учись распределять время",                targetMod: "blitz" },
  O:  { name: "Дебютная теория",      emoji: "📖",   rec: "Coach Knowledge → Дебюты-каталог (14 тем)",                   targetMod: "openings" },
  B1: { name: "Лучшая линия",         emoji: "①",   rec: "Анализ всех партий — Studio где отклонился от engine #1",     targetMod: "analysis" },
  B2: { name: "Глубина расчёта",      emoji: "②",   rec: "Решай задачи на 2-3 хода вперёд — пазлы средней сложности",   targetMod: "puzzles-medium" },
  B3: { name: "Альтернативы",         emoji: "③",   rec: "Рассматривай несколько кандидатов на каждом ходу",            targetMod: "puzzles" },
  M1: { name: "Мат в 1",              emoji: "💀",   rec: "Пазлы 'mate in 1' — базовая комбинационная зоркость",         targetMod: "mate1" },
  M2: { name: "Мат в 2",              emoji: "💀💀", rec: "Пазлы 'mate in 2' — найди жертву + завершение",               targetMod: "mate2" },
  M3: { name: "Мат в 3",              emoji: "💀💀💀", rec: "Пазлы 'mate in 3' — комбинационное зрение",                 targetMod: "mate3" },
  H:  { name: "Зевки фигур",          emoji: "💥",   rec: "После каждого хода — спроси 'Какая моя фигура под боем?'",    targetMod: "blunders" },
  Br: { name: "Бриллиантовые ходы",   emoji: "💎",   rec: "Изучай шедевры (Morphy, Tal, Fischer) в Masters tab",         targetMod: "masters" },
};

const FACTOR_KEYS: FactorKey[] = ["E", "T", "O", "B1", "B2", "B3", "M1", "M2", "M3", "H", "Br"];

type CpiAnalysis = {
  history: CPIState["history"];
  weakest: FactorKey;
  strongest: FactorKey;
  weeklyDelta: number;
};

function analyseCpi(state: CPIState): CpiAnalysis | null {
  if (state.history.length < 3) return null;
  const recent = state.history.slice(-10);
  const sums: Record<FactorKey, number> = { E:0, T:0, O:0, B1:0, B2:0, B3:0, M1:0, M2:0, M3:0, H:0, Br:0 };
  for (const g of recent) {
    const b = g.breakdown;
    for (const k of FACTOR_KEYS) sums[k] += (b[k as keyof CPIBreakdown] as number) || 0;
  }
  const n = recent.length;
  const avg: Record<FactorKey, number> = { ...sums };
  for (const k of FACTOR_KEYS) avg[k] = sums[k] / n;

  // Weakest = max H penalty if avg.H > threshold, otherwise min contribution among non-penalty factors
  let weakest: FactorKey = "E";
  if (avg.H > 5) {
    weakest = "H";
  } else {
    let minVal = Infinity;
    for (const k of FACTOR_KEYS) {
      if (k === "H") continue;
      if (avg[k] < minVal) { minVal = avg[k]; weakest = k; }
    }
  }
  // Strongest = max contribution among non-penalty factors
  let strongest: FactorKey = "E";
  let maxVal = -Infinity;
  for (const k of FACTOR_KEYS) {
    if (k === "H") continue;
    if (avg[k] > maxVal) { maxVal = avg[k]; strongest = k; }
  }

  // Weekly delta — sum of total deltas in games within last 7 days
  const weekAgo = Date.now() - 7 * 86_400_000;
  let weeklyDelta = 0;
  for (const g of state.history) {
    const t = new Date(g.date).getTime();
    if (t >= weekAgo) weeklyDelta += g.delta;
  }
  return { history: state.history, weakest, strongest, weeklyDelta: Math.round(weeklyDelta) };
}

type Props = {
  visible: boolean;
  onClose: () => void;
  onLoadPosition: (fen: string, hint?: string) => void;
};

const DIFF_LABEL: Record<Difficulty, { ru: string; col: string }> = {
  easy: { ru: "Легко", col: "#10b981" },
  medium: { ru: "Средне", col: "#f59e0b" },
  hard: { ru: "Сложно", col: "#ef4444" },
};

// ── Read-tracking — persist which entries the user has opened
const READ_KEY = "aevion_coach_knowledge_read_v1";
function loadRead(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try { const raw = localStorage.getItem(READ_KEY); if (!raw) return new Set(); const arr = JSON.parse(raw); return new Set(Array.isArray(arr) ? arr : []) } catch { return new Set() }
}
function saveRead(s: Set<string>) {
  try { localStorage.setItem(READ_KEY, JSON.stringify(Array.from(s))) } catch {}
}

// ── Spaced-repetition data
// step 0: first read → nextReview in 1 day
// step 1: reviewed once → nextReview in 3 days
// step 2: reviewed twice → nextReview in 7 days
// step 3+: mastered → nextReview in 30 days
const SR_KEY = "aevion_coach_sr_v1";
const SR_INTERVALS = [1, 3, 7, 30]; // days per step

interface SrEntry { firstRead: number; step: number; nextReview: number }
type SrData = Record<string, SrEntry>;

function loadSr(): SrData {
  if (typeof window === "undefined") return {};
  try { const raw = localStorage.getItem(SR_KEY); return raw ? (JSON.parse(raw) as SrData) : {} } catch { return {} }
}
function saveSr(d: SrData) {
  try { localStorage.setItem(SR_KEY, JSON.stringify(d)) } catch {}
}
function nextReviewMs(step: number): number {
  const days = SR_INTERVALS[Math.min(step, SR_INTERVALS.length - 1)];
  return Date.now() + days * 86_400_000;
}

type ReviewStatus = "overdue" | "due-today" | "scheduled" | "mastered" | "unread";
function getReviewStatus(sr: SrEntry | undefined, isRead: boolean): ReviewStatus {
  if (!isRead || !sr) return "unread";
  const now = Date.now();
  if (sr.step >= 3) return "mastered";
  if (sr.nextReview <= now - 86_400_000) return "overdue";
  if (sr.nextReview <= now + 86_400_000) return "due-today";
  return "scheduled";
}

const STATUS_DOT: Record<ReviewStatus, { color: string; label: string }> = {
  "overdue":   { color: "#ef4444", label: "Просрочено — пора повторить!" },
  "due-today": { color: "#f59e0b", label: "Повтори сегодня" },
  "scheduled": { color: "#10b981", label: "Запланировано" },
  "mastered":  { color: "#6366f1", label: "Мастер — знаешь хорошо" },
  "unread":    { color: "#d1d5db", label: "Не прочитано" },
};

// ── Daily quiz (inline — no separate functions to avoid lint auto-removal)
const DQ_KEY = "aevion_coach_dq_v1";
type DQState = { date: string; key: string; answered: boolean; correct: boolean | null };

export default function CoachKnowledge({ visible, onClose, onLoadPosition }: Props) {
  const [catId, sCatId] = useState<string>(COACH_KNOWLEDGE[0].id);
  const [entryId, sEntryId] = useState<string>("");
  const [showSolution, sShowSolution] = useState(false);
  const [read, sRead] = useState<Set<string>>(() => loadRead());
  const [sr, sSr] = useState<SrData>(() => loadSr());
  const [filter, sFilter] = useState<"all" | "due" | "unread">("all");
  const [dq, sDq] = useState<DQState | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const saved = JSON.parse(localStorage.getItem(DQ_KEY) || "null") as DQState | null;
      if (saved?.date === today) return saved;
      const cands = COACH_KNOWLEDGE.flatMap(c => c.entries.filter(e => !!e.bestMove).map(e => `${c.id}/${e.id}`));
      if (!cands.length) return null;
      const seed = parseInt(today.replace(/-/g, ""), 10);
      const q: DQState = { date: today, key: cands[seed % cands.length], answered: false, correct: null };
      localStorage.setItem(DQ_KEY, JSON.stringify(q));
      return q;
    } catch { return null; }
  });
  const [dqInput, sDqInput] = useState("");
  const [dqOpen, sDqOpen] = useState(false);
  const dqEntry = useMemo(() => {
    if (!dq) return null;
    const [qc, qe] = dq.key.split("/");
    return COACH_KNOWLEDGE.find(c => c.id === qc)?.entries.find(e => e.id === qe) ?? null;
  }, [dq]);

  useEffect(() => { saveRead(read) }, [read]);
  useEffect(() => { saveSr(sr) }, [sr]);

  // ── F5: CPI analysis (read on mount/visible)
  const [cpiState, sCpiState] = useState<CPIState | null>(null);
  useEffect(() => {
    if (!visible) return;
    try { sCpiState(ldCPIState()); } catch { sCpiState(null); }
  }, [visible]);
  const cpiAnalysis = useMemo<CpiAnalysis | null>(() => cpiState ? analyseCpi(cpiState) : null, [cpiState]);

  const cat = useMemo<KnowledgeCategory>(
    () => COACH_KNOWLEDGE.find(c => c.id === catId) || COACH_KNOWLEDGE[0],
    [catId]
  );
  const entry = useMemo<KnowledgeEntry | null>(
    () => cat.entries.find(e => e.id === entryId) || null,
    [cat, entryId]
  );

  // Mark current entry as read + update SR on open
  useEffect(() => {
    if (!entry) return;
    const k = `${catId}/${entry.id}`;
    const isFirstRead = !read.has(k);
    // Mark as read
    if (isFirstRead) {
      sRead(prev => { const next = new Set(prev); next.add(k); return next });
    }
    // SR: if first read, create entry; if re-reading after due, advance step
    setSrForKey(k, isFirstRead);
  }, [entry, catId]); // eslint-disable-line react-hooks/exhaustive-deps

  function setSrForKey(k: string, isFirstRead: boolean) {
    sSr(prev => {
      const existing = prev[k];
      if (isFirstRead || !existing) {
        // First time reading → step 0, review in 1 day
        return { ...prev, [k]: { firstRead: Date.now(), step: 0, nextReview: nextReviewMs(0) } };
      }
      // Re-reading: only advance step if review is due (or overdue)
      const status = getReviewStatus(existing, true);
      if (status === "overdue" || status === "due-today") {
        const newStep = existing.step + 1;
        return { ...prev, [k]: { ...existing, step: newStep, nextReview: nextReviewMs(newStep) } };
      }
      return prev;
    });
  }

  // Per-category progress (read entries / total entries)
  const catProgress = useMemo(() => {
    const m: Record<string, { read: number; total: number; due: number }> = {};
    for (const c of COACH_KNOWLEDGE) {
      const total = c.entries.length;
      let r = 0, due = 0;
      for (const e of c.entries) {
        const k = `${c.id}/${e.id}`;
        const isRead = read.has(k);
        if (isRead) r++;
        const status = getReviewStatus(sr[k], isRead);
        if (status === "overdue" || status === "due-today") due++;
      }
      m[c.id] = { read: r, total, due };
    }
    return m;
  }, [read, sr]);

  const totalRead = Object.values(catProgress).reduce((a, p) => a + p.read, 0);
  const totalAll = Object.values(catProgress).reduce((a, p) => a + p.total, 0);
  const totalDue = Object.values(catProgress).reduce((a, p) => a + p.due, 0);

  // Filtered entry list
  const filteredEntries = useMemo(() => {
    return cat.entries.filter(e => {
      const k = `${cat.id}/${e.id}`;
      const isRead = read.has(k);
      if (filter === "unread") return !isRead;
      if (filter === "due") {
        const status = getReviewStatus(sr[k], isRead);
        return status === "overdue" || status === "due-today";
      }
      return true;
    });
  }, [cat, read, sr, filter]);

  if (!visible) return null;

  return (
    <div role="dialog" aria-modal="true" style={{
      position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(2px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 14, width: "min(960px, 100%)",
        maxHeight: "min(88vh, 740px)", display: "flex", flexDirection: "column",
        boxShadow: "0 24px 64px -8px rgba(15,23,42,0.45)", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "12px 16px", background: "linear-gradient(135deg,#059669,#10b981)", color: "#fff",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>📚</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900 }}>База знаний — AI Coach</div>
              <div style={{ fontSize: 10, opacity: 0.85, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span>Тактика · Эндшпиль · Дебюты · Миттельшпиль · Стратегия · Время · Память · Roadmap</span>
                {totalAll > 0 && <span style={{ padding: "1px 8px", borderRadius: 999, background: "rgba(255,255,255,0.18)", fontWeight: 800 }}>
                  {totalRead === totalAll ? "🏆 ВСЁ ПРОЧИТАНО" : `${totalRead}/${totalAll} прочитано`}
                </span>}
                {totalDue > 0 && <span style={{
                  padding: "1px 8px", borderRadius: 999, background: "#ef4444", fontWeight: 900,
                  animation: "pulse 1.5s infinite",
                }}>
                  🔁 {totalDue} к повторению
                </span>}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.18)", border: "none", color: "#fff",
            borderRadius: 6, padding: "5px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}>✕</button>
        </div>

        {/* F5: Coach по CPI — слабый/сильный фактор + рекомендации */}
        {cpiState && cpiState.history.length < 3 && (
          <div style={{
            margin: "10px 14px 0", padding: "14px 18px",
            background: "linear-gradient(135deg, rgba(167,139,250,0.12), rgba(251,191,36,0.08))",
            borderLeft: "4px solid #a78bfa", borderRadius: 10,
            display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
          }}>
            <span style={{ fontSize: 22 }}>🧭</span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#5b21b6", marginBottom: 2 }}>Coach по CPI</div>
              <div style={{ fontSize: 11, color: "#4b5563", lineHeight: 1.45 }}>
                Сыграй 3+ партии чтобы Coach увидел паттерны и предложил тренировки по слабому фактору.
              </div>
            </div>
            <Link href="/cyberchess" style={{
              padding: "7px 14px", borderRadius: 8, background: "#a78bfa", color: "#fff",
              fontSize: 11, fontWeight: 800, textDecoration: "none", whiteSpace: "nowrap",
            }}>Играть →</Link>
          </div>
        )}
        {cpiAnalysis && (() => {
          const w = FACTOR_RECS[cpiAnalysis.weakest];
          const s = FACTOR_RECS[cpiAnalysis.strongest];
          const cpi = cpiState?.cpi ?? 0;
          const wd = cpiAnalysis.weeklyDelta;
          const arrow = wd > 0 ? "▲" : wd < 0 ? "▼" : "▬";
          const arrowCol = wd > 0 ? "#10b981" : wd < 0 ? "#ef4444" : "#6b7280";
          return (
            <div style={{
              margin: "10px 14px 0", padding: "14px 18px",
              background: "linear-gradient(135deg, rgba(167,139,250,0.12), rgba(251,191,36,0.08))",
              borderLeft: "4px solid #a78bfa", borderRadius: 10,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 18 }}>🧭</span>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#5b21b6" }}>Coach по CPI</div>
                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: "rgba(167,139,250,0.18)", color: "#5b21b6", fontWeight: 800 }}>
                  CPI: {Math.round(cpi)} <span style={{ color: arrowCol }}>{arrow} {wd >= 0 ? "+" : ""}{wd}</span> <span style={{ opacity: 0.7 }}>за неделю</span>
                </span>
                <span style={{ marginLeft: "auto", fontSize: 10, padding: "2px 8px", borderRadius: 999, background: "rgba(251,191,36,0.18)", color: "#92400e", fontWeight: 800 }}>
                  🏆 Сильная сторона: {s.emoji} {s.name}
                </span>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ fontSize: 28, lineHeight: 1 }}>{w.emoji}</div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 11, color: "#7c3aed", fontWeight: 800, marginBottom: 2 }}>
                    Слабейший фактор · {cpiAnalysis.weakest}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#111827", lineHeight: 1.2 }}>{w.name}</div>
                  <div style={{ fontSize: 11, color: "#4b5563", marginTop: 3, lineHeight: 1.45 }}>{w.rec}</div>
                </div>
                <Link href={`/cyberchess?coachTrain=${cpiAnalysis.weakest}`} style={{
                  padding: "8px 14px", borderRadius: 8, background: "#a78bfa", color: "#fff",
                  fontSize: 11, fontWeight: 800, textDecoration: "none", whiteSpace: "nowrap",
                }}>Тренировать →</Link>
              </div>
            </div>
          );
        })()}

        {/* Daily Quiz */}
        {dqEntry && (
          <div style={{ padding: "8px 16px", borderBottom: "1px solid #fde68a", background: dq?.answered ? (dq.correct ? "#f0fdf4" : "#fef2f2") : "#fefce8", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13 }}>🧠</span>
            {!dq?.answered ? <>
              <span style={{ fontSize: 11, fontWeight: 900, color: "#92400e", flex: 1 }}>Вопрос дня: {dqEntry.title} — лучший ход?</span>
              {dqOpen ? <><input value={dqInput} onChange={e => sDqInput(e.target.value)} placeholder="SAN ход" style={{ width: 90, padding: "3px 6px", borderRadius: 5, border: "1px solid #fcd34d", fontSize: 11 }}
                onKeyDown={e => { if (e.key !== "Enter" || !dqEntry.bestMove) return; const ok = dqInput.trim().toLowerCase() === dqEntry.bestMove.toLowerCase(); const u: DQState = { ...dq!, answered: true, correct: ok }; sDq(u); try { localStorage.setItem(DQ_KEY, JSON.stringify(u)); } catch {} sDqOpen(false); }} />
                <button onClick={() => { if (!dqEntry.bestMove) return; const ok = dqInput.trim().toLowerCase() === dqEntry.bestMove.toLowerCase(); const u: DQState = { ...dq!, answered: true, correct: ok }; sDq(u); try { localStorage.setItem(DQ_KEY, JSON.stringify(u)); } catch {} sDqOpen(false); }} style={{ padding: "3px 8px", borderRadius: 5, border: "none", background: "#f59e0b", color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>✓</button></>
              : <button onClick={() => sDqOpen(true)} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid #fcd34d", background: "#fffbeb", color: "#92400e", fontSize: 10, fontWeight: 800, cursor: "pointer" }}>ответить</button>}
            </> : <>
              <span style={{ fontSize: 11, fontWeight: 900, color: dq.correct ? "#15803d" : "#991b1b" }}>{dq.correct ? "✅ Правильно!" : "❌ Неверно."}</span>
              <span style={{ fontSize: 11, color: "#374151" }}>Ответ: <b>{dqEntry.bestMove}</b></span>
            </>}
          </div>
        )}

        {/* SR reminder banner */}
        {totalDue > 0 && (
          <div style={{
            padding: "7px 16px", background: "#fef2f2", borderBottom: "1px solid #fecaca",
            display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#7f1d1d",
          }}>
            <span style={{ fontSize: 14 }}>🔁</span>
            <span style={{ fontWeight: 700 }}>
              {totalDue} {totalDue === 1 ? "тема" : totalDue < 5 ? "темы" : "тем"} ждут повторения — интервальное повторение укрепляет память
            </span>
            <button onClick={() => sFilter(f => f === "due" ? "all" : "due")} style={{
              marginLeft: "auto", padding: "3px 10px", borderRadius: 6,
              background: filter === "due" ? "#ef4444" : "#fff",
              border: "1px solid #fca5a5", color: filter === "due" ? "#fff" : "#b91c1c",
              fontSize: 10, fontWeight: 800, cursor: "pointer",
            }}>
              {filter === "due" ? "× убрать фильтр" : "Показать только их"}
            </button>
          </div>
        )}

        {/* Category tabs */}
        <div style={{
          display: "flex", gap: 0, borderBottom: "1px solid #e5e7eb",
          background: "#f9fafb", overflowX: "auto",
        }}>
          {COACH_KNOWLEDGE.map(c => {
            const p = catProgress[c.id];
            const done = p && p.total > 0 && p.read === p.total;
            return (
              <button key={c.id} onClick={() => { sCatId(c.id); sEntryId(""); sShowSolution(false); }}
                style={{
                  padding: "10px 14px", border: "none",
                  background: catId === c.id ? "#fff" : "transparent",
                  borderBottom: catId === c.id ? "2px solid #059669" : "2px solid transparent",
                  fontSize: 12, fontWeight: 700,
                  color: catId === c.id ? "#065f46" : "#4b5563",
                  cursor: "pointer", whiteSpace: "nowrap",
                  display: "inline-flex", alignItems: "center", gap: 5,
                  position: "relative",
                }}>
                <span>{c.title}</span>
                {p && p.total > 0 && <span style={{
                  fontSize: 9, padding: "1px 6px", borderRadius: 999,
                  background: done ? "#10b98122" : "#f3f4f6",
                  color: done ? "#065f46" : "#6b7280",
                  fontWeight: 800,
                }}>{done ? "✓" : `${p.read}/${p.total}`}</span>}
                {p && p.due > 0 && <span style={{
                  position: "absolute", top: 4, right: 4,
                  width: 7, height: 7, borderRadius: "50%", background: "#ef4444",
                }} />}
              </button>
            );
          })}
        </div>

        {/* Filter chips */}
        <div style={{ padding: "6px 14px", borderBottom: "1px solid #f3f4f6", background: "#fafafa", display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 700 }}>Фильтр:</span>
          {(["all", "due", "unread"] as const).map(f => {
            const labels = { all: "Все", due: `К повторению (${catProgress[catId]?.due ?? 0})`, unread: "Не прочитано" };
            return (
              <button key={f} onClick={() => { sFilter(f); sEntryId(""); }} style={{
                padding: "2px 8px", borderRadius: 999, border: "none",
                background: filter === f ? "#059669" : "#e5e7eb",
                color: filter === f ? "#fff" : "#4b5563",
                fontSize: 10, fontWeight: 700, cursor: "pointer",
              }}>{labels[f]}</button>
            );
          })}
          <span style={{ marginLeft: "auto", fontSize: 10, color: "#9ca3af" }}>
            {filteredEntries.length} из {cat.entries.length}
          </span>
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "minmax(220px,260px) 1fr", overflow: "hidden", minHeight: 0 }}>
          {/* Left: entry list */}
          <div style={{ borderRight: "1px solid #e5e7eb", overflowY: "auto", background: "#fafafa" }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, lineHeight: 1.45 }}>
                {cat.intro}
              </div>
            </div>
            {filteredEntries.length === 0 && (
              <div style={{ padding: "16px 14px", textAlign: "center", color: "#9ca3af", fontSize: 11 }}>
                {filter === "due" ? "Нет тем для повторения в этой категории 🎉" : "Все темы прочитаны"}
              </div>
            )}
            {filteredEntries.map(e => {
              const sel = entryId === e.id;
              const d = DIFF_LABEL[e.difficulty];
              const k = `${cat.id}/${e.id}`;
              const isRead = read.has(k);
              const status = getReviewStatus(sr[k], isRead);
              const dot = STATUS_DOT[status];
              const daysUntil = sr[k] ? Math.ceil((sr[k].nextReview - Date.now()) / 86_400_000) : null;
              return (
                <button key={e.id} onClick={() => { sEntryId(e.id); sShowSolution(false); }}
                  style={{
                    width: "100%", padding: "9px 14px", border: "none",
                    background: sel ? "#ecfdf5" : "transparent",
                    borderLeft: sel ? "3px solid #059669" : "3px solid transparent",
                    textAlign: "left", cursor: "pointer",
                    borderBottom: "1px solid #f3f4f6",
                    opacity: isRead && !sel && status === "mastered" ? 0.7 : 1,
                  }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    {/* SR status dot */}
                    <span title={dot.label} style={{
                      width: 7, height: 7, borderRadius: "50%", background: dot.color, flexShrink: 0,
                      ...(status === "overdue" ? { boxShadow: "0 0 0 2px #fca5a5" } : {}),
                    }} />
                    <span style={{ fontSize: 12, fontWeight: 800, color: sel ? "#065f46" : "#111827", lineHeight: 1.2, flex: 1 }}>
                      {e.title}
                    </span>
                    {status === "mastered" && <span title="Мастер" style={{ fontSize: 10 }}>⭐</span>}
                    {(status === "overdue" || status === "due-today") && (
                      <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 999, background: status === "overdue" ? "#fee2e2" : "#fef3c7", color: status === "overdue" ? "#b91c1c" : "#92400e", fontWeight: 800 }}>
                        {status === "overdue" ? "!" : "сег."}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: 13 }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: d.col, flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: "#6b7280", lineHeight: 1.35, flex: 1 }}>
                      {e.description.length > 60 ? e.description.slice(0, 58) + "…" : e.description}
                    </span>
                  </div>
                  {isRead && daysUntil !== null && status === "scheduled" && (
                    <div style={{ marginLeft: 13, marginTop: 2, fontSize: 9, color: "#9ca3af" }}>
                      повтор через {daysUntil}д
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right: detail */}
          <div style={{ overflowY: "auto", padding: "16px 20px" }}>
            {!entry && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#9ca3af", fontSize: 12, textAlign: "center", padding: 24 }}>
                <div>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>
                    {filter === "due" && totalDue > 0 ? "🔁" : "👈"}
                  </div>
                  {filter === "due" && filteredEntries.length > 0
                    ? <div>Выбери тему для повторения — интервальное повторение улучшает долгосрочную память</div>
                    : <div>Выбери тему слева — увидишь объяснение, FEN-позицию и решение</div>
                  }
                </div>
              </div>
            )}
            {entry && (() => {
              const k = `${catId}/${entry.id}`;
              const isRead = read.has(k);
              const status = getReviewStatus(sr[k], isRead);
              const srEntry = sr[k];
              return (
                <>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#111827", lineHeight: 1.2 }}>
                        {entry.title}
                      </h3>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
                        <span style={{ display: "inline-block", padding: "2px 8px", fontSize: 10, fontWeight: 800,
                          borderRadius: 999, background: `${DIFF_LABEL[entry.difficulty].col}1a`, color: DIFF_LABEL[entry.difficulty].col }}>
                          {DIFF_LABEL[entry.difficulty].ru}
                        </span>
                        {/* SR status badge */}
                        {isRead && srEntry && (
                          <span style={{
                            display: "inline-block", padding: "2px 8px", fontSize: 10, fontWeight: 800,
                            borderRadius: 999, background: `${STATUS_DOT[status].color}22`, color: STATUS_DOT[status].color,
                          }}>
                            {status === "mastered" && "⭐ Освоено"}
                            {status === "scheduled" && `🗓 Повтор через ${Math.max(1, Math.ceil((srEntry.nextReview - Date.now()) / 86_400_000))}д`}
                            {status === "due-today" && "🔁 Повтори сегодня"}
                            {status === "overdue" && "⚠ Просрочено — повтори сейчас"}
                          </span>
                        )}
                        {!isRead && <span style={{ display: "inline-block", padding: "2px 8px", fontSize: 10, fontWeight: 800,
                          borderRadius: 999, background: "#f3f4f6", color: "#6b7280" }}>Новое</span>}
                        {isRead && srEntry && <span style={{ fontSize: 9, color: "#9ca3af" }}>Шаг {srEntry.step + 1}/4</span>}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.55, marginTop: 10, marginBottom: 12 }}>
                    {entry.description}
                  </div>

                  {entry.fen && (
                    <div style={{
                      padding: "10px 12px", background: "#f9fafb", borderRadius: 8,
                      border: "1px solid #e5e7eb", marginBottom: 12, fontFamily: "ui-monospace, monospace", fontSize: 10, color: "#6b7280",
                      wordBreak: "break-all", lineHeight: 1.5,
                    }}>
                      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "#9ca3af", marginBottom: 4 }}>FEN</div>
                      {entry.fen}
                    </div>
                  )}

                  {entry.fen && (
                    <button onClick={() => onLoadPosition(entry.fen!, entry.bestMove ? `Найди лучший ход. Подсказка: ${entry.title}.` : entry.title)} style={{
                      width: "100%", padding: "10px 14px", borderRadius: 8, border: "none",
                      background: "linear-gradient(135deg,#059669,#10b981)", color: "#fff",
                      fontSize: 12, fontWeight: 800, cursor: "pointer", marginBottom: 12,
                      letterSpacing: 0.3,
                    }}>
                      ▶ Загрузить позицию на доску
                    </button>
                  )}

                  {entry.bestMove && (
                    <div style={{ marginBottom: 12 }}>
                      <button onClick={() => sShowSolution(s => !s)} style={{
                        width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #fcd34d",
                        background: showSolution ? "#fef3c7" : "#fffbeb", color: "#92400e",
                        fontSize: 11, fontWeight: 800, cursor: "pointer", textAlign: "left",
                      }}>
                        {showSolution ? "▼ Скрыть решение" : "▶ Показать решение"}
                      </button>
                      {showSolution && (
                        <div style={{ padding: "10px 12px", background: "#fffbeb", borderRadius: 8, border: "1px solid #fde68a", marginTop: 6 }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: "#92400e", marginBottom: 4 }}>
                            Лучший ход: <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 13 }}>{entry.bestMove}</span>
                          </div>
                          {entry.solution && (
                            <div style={{ fontSize: 11, fontFamily: "ui-monospace, monospace", color: "#78350f", lineHeight: 1.5 }}>
                              {entry.solution}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{
                    padding: "12px 14px", background: "#f0fdf4", borderRadius: 8,
                    border: "1px solid #bbf7d0", fontSize: 12, color: "#065f46", lineHeight: 1.6,
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "#047857", marginBottom: 4 }}>Объяснение</div>
                    {entry.explanation}
                  </div>

                  {/* SR legend */}
                  <div style={{ marginTop: 16, padding: "10px 12px", background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "#9ca3af", marginBottom: 8 }}>Интервальное повторение</div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      {([["overdue","!","Просрочено"],["due-today","сег","Сегодня"],["scheduled","🗓","Запланировано"],["mastered","⭐","Освоено"],["unread","○","Не прочитано"]] as const).map(([s,sym,lbl])=>(
                        <div key={s} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#6b7280" }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_DOT[s].color, display: "inline-block" }} />
                          <span>{lbl}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 6 }}>
                      Интервалы: 1д → 3д → 7д → 30д. Читай тему снова когда появится красная/жёлтая точка.
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "8px 16px", background: "#f9fafb", borderTop: "1px solid #e5e7eb", fontSize: 10, color: "#6b7280", textAlign: "center" }}>
          {COACH_KNOWLEDGE.reduce((s, c) => s + c.entries.length, 0)} тем · интервальное повторение по методу SM-2 · загрузи позицию и тренируйся на доске
        </div>
      </div>
    </div>
  );
}
