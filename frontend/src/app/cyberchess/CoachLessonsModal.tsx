"use client";
/**
 * CoachLessonsModal — structured curriculum browser.
 * Lichess-style: 14 lessons across beginner → advanced, each with 2-4 steps
 * (theory + position + exercise). Progress tracked in localStorage; current
 * step persists across sessions until lesson is completed.
 */
import { useState, useEffect, useMemo } from "react";
import {
  LESSONS,
  loadLessons,
  saveLessons,
  isLessonComplete,
  lessonProgress,
  totalCompleted,
  type Lesson,
  type LessonsState,
} from "./coachLessons";

type Props = {
  open: boolean;
  onClose: () => void;
  onLoadPosition: (fen: string, hint?: string) => void;
};

const RATING_LABEL: Record<Lesson["rating"], { ru: string; col: string; bg: string }> = {
  beginner: { ru: "Новичок · 800-1200", col: "#10b981", bg: "rgba(16,185,129,0.10)" },
  intermediate: { ru: "Средний · 1200-1800", col: "#f59e0b", bg: "rgba(245,158,11,0.10)" },
  advanced: { ru: "Продвинутый · 1800+", col: "#dc2626", bg: "rgba(220,38,38,0.10)" },
};

const CATEGORY_EMOJI: Record<Lesson["category"], string> = {
  fundamentals: "🌱",
  openings: "📖",
  tactics: "⚡",
  endgames: "🏁",
  strategy: "🧠",
};

export default function CoachLessonsModal({ open, onClose, onLoadPosition }: Props) {
  const [state, setState] = useState<LessonsState>(() => loadLessons());
  const [activeLesson, setActiveLesson] = useState<string | null>(null);
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => { saveLessons(state); }, [state]);

  const lesson = useMemo(() => LESSONS.find(l => l.id === activeLesson) || null, [activeLesson]);
  const completed = totalCompleted(state);

  if (!open) return null;

  // ─── Lesson detail view ──────────────────────────────────────
  if (lesson) {
    const step = lesson.steps[stepIdx];
    const isLastStep = stepIdx === lesson.steps.length - 1;

    const advance = () => {
      if (isLastStep) {
        // Mark complete
        setState(s => ({
          ...s,
          byId: {
            ...s.byId,
            [lesson.id]: {
              id: lesson.id,
              startedAt: s.byId[lesson.id]?.startedAt || Date.now(),
              completedAt: Date.now(),
              stepsCompleted: lesson.steps.length,
            },
          },
        }));
        setActiveLesson(null);
        setStepIdx(0);
      } else {
        // Next step + persist progress
        setState(s => ({
          ...s,
          byId: {
            ...s.byId,
            [lesson.id]: {
              id: lesson.id,
              startedAt: s.byId[lesson.id]?.startedAt || Date.now(),
              stepsCompleted: Math.max(s.byId[lesson.id]?.stepsCompleted || 0, stepIdx + 1),
            },
          },
        }));
        setStepIdx(stepIdx + 1);
      }
    };

    return (
      <div role="dialog" aria-modal="true" onClick={() => { setActiveLesson(null); setStepIdx(0); }}
        style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}>
        <div onClick={e => e.stopPropagation()} style={{
          background: "#fff", borderRadius: 14, width: "min(820px, 100%)",
          maxHeight: "min(86vh, 720px)", display: "flex", flexDirection: "column",
          boxShadow: "0 24px 64px -8px rgba(15,23,42,0.45)", overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{ padding: "12px 16px", background: "linear-gradient(135deg,#1e40af,#3b82f6)", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22 }}>{lesson.emoji}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 900 }}>Урок {lesson.num}: {lesson.title}</div>
                <div style={{ fontSize: 10, opacity: 0.85 }}>
                  Шаг {stepIdx + 1} из {lesson.steps.length} · {RATING_LABEL[lesson.rating].ru}
                </div>
              </div>
            </div>
            <button onClick={() => { setActiveLesson(null); setStepIdx(0); }}
              style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "#fff", borderRadius: 6, padding: "5px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✕</button>
          </div>

          {/* Progress bar */}
          <div style={{ height: 4, background: "#e5e7eb" }}>
            <div style={{ height: "100%", width: `${((stepIdx + 1) / lesson.steps.length) * 100}%`, background: "linear-gradient(90deg,#1e40af,#3b82f6)", transition: "width 0.3s ease" }} />
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
            <div style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, background: "#e0e7ff", color: "#3730a3", fontSize: 10, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>
              {step.kind === "theory" ? "Теория" : step.kind === "position" ? "Позиция" : "Упражнение"}
            </div>
            <h3 style={{ margin: "4px 0 12px", fontSize: 18, fontWeight: 900, color: "#0f172a", lineHeight: 1.25 }}>{step.title}</h3>
            <div style={{ fontSize: 13, color: "#1e293b", lineHeight: 1.65, whiteSpace: "pre-line" }}>{step.body}</div>

            {step.fen && (
              <div style={{ marginTop: 16, padding: "10px 14px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "#64748b", marginBottom: 6 }}>FEN-позиция</div>
                <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#475569", marginBottom: 8, wordBreak: "break-all", lineHeight: 1.5 }}>{step.fen}</div>
                <button onClick={() => { onLoadPosition(step.fen!, step.bestMove ? `Найди лучший ход${step.bestMove ? ` (ответ: ${step.bestMove})` : ""}` : step.title); }}
                  style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#1e40af,#3b82f6)", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer", letterSpacing: 0.3 }}>
                  ▶ Загрузить позицию на доску
                </button>
                {step.kind === "exercise" && step.bestMove && (
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#7c2d12" }}>💡 Показать ответ</summary>
                    <div style={{ marginTop: 4, padding: "5px 10px", borderRadius: 5, background: "#fef3c7", color: "#7c2d12", fontFamily: "monospace", fontSize: 13, fontWeight: 800 }}>
                      Правильный ход: {step.bestMove}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: "10px 16px", borderTop: "1px solid #e5e7eb", background: "#f9fafb", display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
            <button onClick={() => stepIdx > 0 && setStepIdx(stepIdx - 1)} disabled={stepIdx === 0}
              style={{ padding: "7px 14px", borderRadius: 7, border: "1px solid #e5e7eb", background: stepIdx === 0 ? "#f3f4f6" : "#fff", color: stepIdx === 0 ? "#9ca3af" : "#374151", fontSize: 12, fontWeight: 700, cursor: stepIdx === 0 ? "default" : "pointer" }}>← Назад</button>
            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700 }}>
              {isLastStep ? "Завершить урок ↓" : `Шаг ${stepIdx + 1} / ${lesson.steps.length}`}
            </div>
            <button onClick={advance}
              style={{ padding: "7px 16px", borderRadius: 7, border: "none", background: isLastStep ? "linear-gradient(135deg,#10b981,#34d399)" : "linear-gradient(135deg,#1e40af,#3b82f6)", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer", letterSpacing: 0.3, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
              {isLastStep ? "✓ Завершить" : "Далее →"}
            </button>
          </div>

          {isLastStep && (
            <div style={{ padding: "10px 16px", background: "linear-gradient(135deg,#ecfdf5,#d1fae5)", borderTop: "1px solid #a7f3d0", fontSize: 12, color: "#065f46", lineHeight: 1.55 }}>
              <span style={{ fontWeight: 900 }}>🎓 Итог урока:</span> {lesson.closing}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Lessons list view ────────────────────────────────────────
  return (
    <div role="dialog" aria-modal="true" onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 14, width: "min(940px, 100%)",
        maxHeight: "min(86vh, 720px)", display: "flex", flexDirection: "column",
        boxShadow: "0 24px 64px -8px rgba(15,23,42,0.45)", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "12px 16px", background: "linear-gradient(135deg,#1e40af,#3b82f6)", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>📖</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900 }}>Курс CyberChess Coach</div>
              <div style={{ fontSize: 10, opacity: 0.85 }}>
                {LESSONS.length} уроков · {completed === LESSONS.length ? "🏆 ПРОЙДЕНО ВСЁ" : `${completed}/${LESSONS.length} завершено`}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "#fff", borderRadius: 6, padding: "5px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✕</button>
        </div>

        {/* Lessons grid */}
        <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          {LESSONS.map(l => {
            const done = isLessonComplete(state, l.id);
            const progress = lessonProgress(state, l.id);
            const ratingMeta = RATING_LABEL[l.rating];
            return (
              <button key={l.id} onClick={() => { setActiveLesson(l.id); setStepIdx(state.byId[l.id]?.stepsCompleted || 0); }}
                style={{
                  textAlign: "left", padding: "12px 14px", borderRadius: 10,
                  border: done ? "2px solid #10b981" : `1px solid ${ratingMeta.col}33`,
                  background: done ? "linear-gradient(135deg,#ecfdf5,#d1fae5)" : ratingMeta.bg,
                  cursor: "pointer", display: "flex", flexDirection: "column", gap: 5,
                  position: "relative", transition: "all 0.15s ease",
                }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)"}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.transform = "none"}>
                {done && <span style={{ position: "absolute", top: 8, right: 8, fontSize: 12, fontWeight: 900, color: "#10b981" }}>✓</span>}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 22 }}>{l.emoji}</span>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 900, color: ratingMeta.col, letterSpacing: 0.5, textTransform: "uppercase" }}>
                      {CATEGORY_EMOJI[l.category]} Урок {l.num}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", lineHeight: 1.2 }}>{l.title}</div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.45, flex: 1 }}>{l.description}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "#64748b", fontWeight: 700 }}>
                  <span>⏱ {l.estMinutes} мин</span>
                  <span>·</span>
                  <span>{l.steps.length} шагов</span>
                </div>
                {progress > 0 && progress < 100 && (
                  <div style={{ height: 4, background: "#e5e7eb", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${progress}%`, background: ratingMeta.col, transition: "width 0.3s ease" }} />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: "10px 16px", borderTop: "1px solid #e5e7eb", background: "#f9fafb", fontSize: 11, color: "#6b7280", lineHeight: 1.5 }}>
          💡 Уроки с Lichess-style теорией + позициями + упражнениями. Прогресс сохраняется в браузере. Шаги 1-3 (новичок) → 4-6 (тактика) → 7-12 (стратегия) → 13-14 (продвинутые).
        </div>
      </div>
    </div>
  );
}
