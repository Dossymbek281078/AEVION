"use client";
import { useState, useRef, useEffect } from "react";

type Msg = { role: "user" | "assistant"; content: string };
type Props = {
  fen: string;
  moves: string[];
  evalCp: number;
  evalMate: number;
  opening?: { eco: string; name: string; desc: string } | null;
  playerColor: "w" | "b";
  visible: boolean;
  onClose: () => void;
};

const SYSTEM = `You are Shachik (Шахик) — a friendly, expert AI chess coach built into CyberChess by AEVION. 
You analyze positions, explain ideas, suggest plans, and teach chess concepts.
Rules:
- Always respond in the same language the user writes in (Russian, English, or Kazakh)
- Be encouraging but honest about mistakes
- Use algebraic notation for moves (e4, Nf3, etc.)
- Keep responses concise (2-4 paragraphs max)
- Reference the current position/evaluation when relevant
- Suggest concrete moves with brief explanations
- If asked about openings, reference ECO codes when possible`;

const BACKEND = "https://aevion-production-a70c.up.railway.app";

export default function AiCoach({ fen, moves, evalCp, evalMate, opening, playerColor, visible, onClose }: Props) {
  const [msgs, sMsgs] = useState<Msg[]>([]);
  const [input, sInput] = useState("");
  const [loading, sLoading] = useState(false);
  const [error, sError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  const buildContext = () => {
    const evalStr = evalMate !== 0 ? `Mate in ${Math.abs(evalMate)} for ${evalMate > 0 ? "White" : "Black"}` : `${(evalCp / 100).toFixed(2)} (positive = White advantage)`;
    const moveStr = moves.length > 0 ? moves.map((m, i) => (i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ${m}` : m)).join(" ") : "Starting position";
    const openStr = opening ? `${opening.eco} ${opening.name}: ${opening.desc}` : "Not yet identified";
    return `Current position (FEN): ${fen}
Moves played: ${moveStr}
Evaluation: ${evalStr}
Opening: ${openStr}
Player plays: ${playerColor === "w" ? "White" : "Black"}
Move number: ${Math.ceil(moves.length / 2)}`;
  };

  const send = async (text?: string) => {
    const userMsg = text || input.trim();
    if (!userMsg && msgs.length === 0) return;

    const newMsgs: Msg[] = [...msgs];
    if (userMsg) {
      newMsgs.push({ role: "user", content: userMsg });
      sMsgs(newMsgs);
      sInput("");
    }

    sLoading(true);
    sError("");

    try {
      // Build messages array with chess context in first user message
      const apiMsgs: { role: "user" | "assistant"; content: string }[] = [];
      for (let i = 0; i < newMsgs.length; i++) {
        const m = newMsgs[i];
        if (i === 0 && m.role === "user") {
          apiMsgs.push({ role: "user", content: `[Chess Position Context]\n${buildContext()}\n\n${m.content}` });
        } else {
          apiMsgs.push({ role: m.role, content: m.content });
        }
      }

      const res = await fetch(`${BACKEND}/api/coach/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: SYSTEM,
          messages: apiMsgs,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errData.error || `Server error: ${res.status}`);
      }

      const data = await res.json();
      const reply = data.content?.map((c: any) => c.text || "").join("") || "No response";
      sMsgs([...newMsgs, { role: "assistant", content: reply }]);
    } catch (e: any) {
      sError(e.message || "Failed to connect to AI Coach");
    } finally {
      sLoading(false);
    }
  };

  const quickActions = [
    { label: "📊 Анализ позиции", prompt: "Проанализируй текущую позицию. Кто стоит лучше и почему? Какой план для каждой стороны?" },
    { label: "💡 Лучший ход", prompt: "Какой лучший ход в текущей позиции и почему? Объясни идею." },
    { label: "⚠️ Мои ошибки", prompt: "Посмотри на сыгранные ходы. Были ли ошибки? Что можно было сделать лучше?" },
    { label: "📚 Дебют", prompt: "Расскажи про дебют который мы играем. Какие основные идеи и типовые планы?" },
    { label: "🎯 План игры", prompt: "Предложи конкретный план на ближайшие 5-7 ходов с объяснениями." },
    { label: "🏰 Стратегия", prompt: "Объясни стратегические особенности позиции: пешечная структура, слабые поля, открытые линии." },
  ];

  if (!visible) return null;

  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: 500 }}>
      {/* Header */}
      <div style={{ padding: "10px 14px", background: "linear-gradient(135deg,#059669,#10b981)", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>🤖</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 900 }}>Shachik AI Coach</div>
            <div style={{ fontSize: 9, opacity: 0.8 }}>Powered by Claude · AEVION</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✕</button>
      </div>

      {/* Quick actions */}
      {msgs.length === 0 && (
        <div style={{ padding: "10px 12px", borderBottom: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, marginBottom: 6 }}>Быстрые действия</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {quickActions.map((a, i) => (
              <button key={i} onClick={() => send(a.prompt)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#f9fafb", fontSize: 10, fontWeight: 600, color: "#374151", cursor: "pointer" }}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "10px 12px", minHeight: 100, maxHeight: 300 }}>
        {msgs.length === 0 && !loading && (
          <div style={{ textAlign: "center", padding: "20px 0", color: "#9ca3af", fontSize: 11 }}>
            Выбери действие выше или задай вопрос
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} style={{ marginBottom: 10, display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              padding: "8px 12px", borderRadius: 10, maxWidth: "90%", fontSize: 12, lineHeight: 1.5,
              background: m.role === "user" ? "#059669" : "#f3f4f6",
              color: m.role === "user" ? "#fff" : "#111827",
              borderBottomRightRadius: m.role === "user" ? 2 : 10,
              borderBottomLeftRadius: m.role === "assistant" ? 2 : 10,
              whiteSpace: "pre-wrap",
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#059669", fontSize: 11, fontWeight: 700 }}>
            <span style={{ animation: "pulse 1s infinite" }}>●</span> Shachik думает...
          </div>
        )}
        {error && (
          <div style={{ padding: "6px 10px", borderRadius: 6, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 10, marginTop: 4 }}>
            {error}
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: "8px 12px", borderTop: "1px solid #e5e7eb", display: "flex", gap: 6 }}>
        <input
          value={input}
          onChange={e => sInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !loading) send() }}
          placeholder="Задай вопрос о позиции..."
          style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12, outline: "none" }}
        />
        <button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: loading ? "#9ca3af" : "#059669", color: "#fff", fontSize: 12, fontWeight: 800, cursor: loading ? "default" : "pointer" }}>
          →
        </button>
      </div>
    </div>
  );
}