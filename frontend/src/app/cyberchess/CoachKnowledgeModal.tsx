"use client";
import { useState, useMemo } from "react";
import { COACH_KNOWLEDGE, type KnowledgeCategory, type KnowledgeEntry, type Difficulty } from "./coachKnowledge";

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

export default function CoachKnowledge({ visible, onClose, onLoadPosition }: Props) {
  const [catId, sCatId] = useState<string>(COACH_KNOWLEDGE[0].id);
  const [entryId, sEntryId] = useState<string>("");
  const [showSolution, sShowSolution] = useState(false);

  const cat = useMemo<KnowledgeCategory>(
    () => COACH_KNOWLEDGE.find(c => c.id === catId) || COACH_KNOWLEDGE[0],
    [catId]
  );
  const entry = useMemo<KnowledgeEntry | null>(
    () => cat.entries.find(e => e.id === entryId) || null,
    [cat, entryId]
  );

  if (!visible) return null;

  return (
    <div role="dialog" aria-modal="true" style={{
      position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(2px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 14, width: "min(940px, 100%)",
        maxHeight: "min(86vh, 720px)", display: "flex", flexDirection: "column",
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
              <div style={{ fontSize: 14, fontWeight: 900 }}>База знаний — Тренер</div>
              <div style={{ fontSize: 10, opacity: 0.85 }}>Тактика · Эндшпиль · Дебюты · Стратегия</div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.18)", border: "none", color: "#fff",
            borderRadius: 6, padding: "5px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}>✕</button>
        </div>

        {/* Category tabs */}
        <div style={{
          display: "flex", gap: 0, borderBottom: "1px solid #e5e7eb",
          background: "#f9fafb", overflowX: "auto",
        }}>
          {COACH_KNOWLEDGE.map(c => (
            <button key={c.id} onClick={() => { sCatId(c.id); sEntryId(""); sShowSolution(false); }}
              style={{
                padding: "10px 16px", border: "none",
                background: catId === c.id ? "#fff" : "transparent",
                borderBottom: catId === c.id ? "2px solid #059669" : "2px solid transparent",
                fontSize: 12, fontWeight: 700,
                color: catId === c.id ? "#065f46" : "#4b5563",
                cursor: "pointer", whiteSpace: "nowrap",
              }}>{c.title}</button>
          ))}
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
            {cat.entries.map(e => {
              const sel = entryId === e.id;
              const d = DIFF_LABEL[e.difficulty];
              return (
                <button key={e.id} onClick={() => { sEntryId(e.id); sShowSolution(false); }}
                  style={{
                    width: "100%", padding: "9px 14px", border: "none",
                    background: sel ? "#ecfdf5" : "transparent",
                    borderLeft: sel ? "3px solid #059669" : "3px solid transparent",
                    textAlign: "left", cursor: "pointer",
                    borderBottom: "1px solid #f3f4f6",
                  }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: "50%", background: d.col, flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 12, fontWeight: 800, color: sel ? "#065f46" : "#111827", lineHeight: 1.2 }}>
                      {e.title}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: "#6b7280", lineHeight: 1.35, marginLeft: 12 }}>
                    {e.description}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right: detail */}
          <div style={{ overflowY: "auto", padding: "16px 20px" }}>
            {!entry && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#9ca3af", fontSize: 12, textAlign: "center", padding: 24 }}>
                <div>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>👈</div>
                  <div>Выбери тему слева — увидишь объяснение, FEN-позицию и решение</div>
                </div>
              </div>
            )}
            {entry && <>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#111827", lineHeight: 1.2 }}>
                    {entry.title}
                  </h3>
                  <div style={{ display: "inline-block", marginTop: 6, padding: "2px 8px", fontSize: 10, fontWeight: 800,
                    borderRadius: 999, background: `${DIFF_LABEL[entry.difficulty].col}1a`, color: DIFF_LABEL[entry.difficulty].col }}>
                    {DIFF_LABEL[entry.difficulty].ru}
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
            </>}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "8px 16px", background: "#f9fafb", borderTop: "1px solid #e5e7eb", fontSize: 10, color: "#6b7280", textAlign: "center" }}>
          {COACH_KNOWLEDGE.reduce((s, c) => s + c.entries.length, 0)} тем · загрузи позицию и тренируйся прямо на доске
        </div>
      </div>
    </div>
  );
}
