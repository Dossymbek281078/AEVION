"use client";
import { useState, useRef, useEffect, useCallback } from "react";

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
  lastMoveSan?: string;
  moveNumber?: number;
};

const SYSTEM = `You are an expert AI chess analyst built into CyberChess by AEVION.
Rules:
- Respond in the same language the user writes in (Russian, English, or Kazakh)
- Be encouraging but honest about mistakes
- Use algebraic notation (e4, Nf3, etc.)
- Keep responses concise (2-3 paragraphs max)
- Reference current position and evaluation
- Suggest concrete moves with brief explanations
- Reference ECO codes for openings when relevant`;

const LIVE_SYSTEM = `You are a live chess coach commenting on each move during a game.
Rules:
- Respond in Russian
- Be very concise: 1-2 sentences only
- Comment on the move just played: was it good, bad, or neutral?
- Briefly mention the idea behind the move or what was better
- Use algebraic notation
- If it's an opening move, name the opening
- If there's a tactical threat, warn about it
- Keep energy up — use short punchy phrases`;

const BACKEND = "https://aevion-production-a70c.up.railway.app";

export default function AiCoach({ fen, moves, evalCp, evalMate, opening, playerColor, visible, onClose, lastMoveSan, moveNumber }: Props) {
  const [msgs, sMsgs] = useState<Msg[]>([]);
  const [input, sInput] = useState("");
  const [loading, sLoading] = useState(false);
  const [error, sError] = useState("");
  const [liveMode, sLiveMode] = useState(false);
  const [liveComments, sLiveComments] = useState<{ move: number; san: string; comment: string }[]>([]);
  const [liveLoading, sLiveLoading] = useState(false);
  const lastCommented = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  useEffect(() => {
    liveRef.current?.scrollTo({ top: liveRef.current.scrollHeight, behavior: "smooth" });
  }, [liveComments]);

  const buildContext = useCallback(() => {
    const evalStr = evalMate !== 0 ? `Mate in ${Math.abs(evalMate)} for ${evalMate > 0 ? "White" : "Black"}` : `${(evalCp / 100).toFixed(2)} (positive = White advantage)`;
    const moveStr = moves.length > 0 ? moves.map((m, i) => (i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ${m}` : m)).join(" ") : "Starting position";
    const openStr = opening ? `${opening.eco} ${opening.name}: ${opening.desc}` : "Not yet identified";
    return `FEN: ${fen}\nMoves: ${moveStr}\nEval: ${evalStr}\nOpening: ${openStr}\nPlayer: ${playerColor === "w" ? "White" : "Black"}\nMove#: ${Math.ceil(moves.length / 2)}`;
  }, [fen, moves, evalCp, evalMate, opening, playerColor]);

  // Live Coach: auto-comment on each move
  useEffect(() => {
    if (!liveMode || !visible || moves.length === 0 || moves.length <= lastCommented.current || liveLoading) return;
    const moveIdx = moves.length;
    const san = moves[moves.length - 1];
    const moveNum = Math.ceil(moves.length / 2);
    const side = moves.length % 2 === 1 ? "White" : "Black";
    lastCommented.current = moveIdx;
    sLiveLoading(true);

    const callApi = async () => {
      try {
        const res = await fetch(`${BACKEND}/api/coach/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system: LIVE_SYSTEM,
            messages: [{
              role: "user",
              content: `[Position]\n${buildContext()}\n\nLast move played: ${side} played ${moveNum}${moves.length % 2 === 1 ? "." : "..."} ${san}\nComment on this move briefly.`
            }],
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const comment = data.content?.map((c: any) => c.text || "").join("") || "";
        if (comment) {
          sLiveComments(prev => [...prev, { move: moveNum, san, comment }]);
        }
      } catch (e: any) {
        sLiveComments(prev => [...prev, { move: moveNum, san, comment: `⚠ ${e.message}` }]);
      } finally {
        sLiveLoading(false);
      }
    };
    callApi();
  }, [moves.length, liveMode, visible, liveLoading, buildContext]);

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
      const apiMsgs: { role: "user" | "assistant"; content: string }[] = [];
      for (let i = 0; i < newMsgs.length; i++) {
        const m = newMsgs[i];
        if (i === 0 && m.role === "user") {
          apiMsgs.push({ role: "user", content: `[Position]\n${buildContext()}\n\n${m.content}` });
        } else {
          apiMsgs.push({ role: m.role, content: m.content });
        }
      }

      const res = await fetch(`${BACKEND}/api/coach/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: SYSTEM, messages: apiMsgs }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errData.error || `Server error: ${res.status}`);
      }

      const data = await res.json();
      const reply = data.content?.map((c: any) => c.text || "").join("") || "No response";
      sMsgs([...newMsgs, { role: "assistant", content: reply }]);
    } catch (e: any) {
      sError(e.message || "Connection failed");
    } finally {
      sLoading(false);
    }
  };

  const quickActions = [
    { label: "📊 Анализ", prompt: "Проанализируй текущую позицию. Кто стоит лучше и почему?" },
    { label: "💡 Лучший ход", prompt: "Какой лучший ход и почему?" },
    { label: "⚠️ Ошибки", prompt: "Какие ошибки были допущены в партии?" },
    { label: "📚 Дебют", prompt: "Расскажи про текущий дебют." },
    { label: "🎯 План", prompt: "Предложи план на ближайшие 5 ходов." },
    { label: "🏰 Эндшпиль", prompt: "Объясни принципы эндшпиля для текущей позиции." },
  ];

  if (!visible) return null;

  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: 520 }}>
      {/* Header */}
      <div style={{ padding: "10px 14px", background: "linear-gradient(135deg,#059669,#10b981)", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>♟</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 900 }}>AI Анализ</div>
            <div style={{ fontSize: 9, opacity: 0.8 }}>Powered by Claude · AEVION</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {/* Live mode toggle */}
          <button onClick={() => { sLiveMode(!liveMode); if (!liveMode) { lastCommented.current = 0; sLiveComments([]); } }}
            style={{ background: liveMode ? "#fbbf24" : "rgba(255,255,255,0.2)", border: "none", color: liveMode ? "#111" : "#fff", borderRadius: 6, padding: "4px 10px", fontSize: 10, fontWeight: 800, cursor: "pointer" }}>
            {liveMode ? "🔴 LIVE" : "▶ Live"}
          </button>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✕</button>
        </div>
      </div>

      {/* Live Coach Mode */}
      {liveMode && (
        <div style={{ borderBottom: "1px solid #e5e7eb" }}>
          <div style={{ padding: "6px 12px", background: "#fffbeb", fontSize: 10, fontWeight: 700, color: "#92400e", display: "flex", alignItems: "center", gap: 4 }}>
            🔴 Live Coach — комментирует каждый ход
            {liveLoading && <span style={{ animation: "pulse 1s infinite", marginLeft: 4 }}>⏳</span>}
          </div>
          <div ref={liveRef} style={{ maxHeight: 180, overflowY: "auto", padding: "6px 12px" }}>
            {liveComments.length === 0 && !liveLoading && (
              <div style={{ fontSize: 10, color: "#9ca3af", padding: "8px 0", textAlign: "center" }}>Сделай ход — коуч прокомментирует</div>
            )}
            {liveComments.map((c, i) => (
              <div key={i} style={{ marginBottom: 6, fontSize: 11, lineHeight: 1.4 }}>
                <span style={{ fontWeight: 800, color: "#059669", fontFamily: "monospace" }}>{c.move}. {c.san}</span>
                <span style={{ color: "#374151", marginLeft: 6 }}>{c.comment}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      {!liveMode && msgs.length === 0 && (
        <div style={{ padding: "8px 12px", borderBottom: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {quickActions.map((a, i) => (
              <button key={i} onClick={() => send(a.prompt)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#f9fafb", fontSize: 10, fontWeight: 600, color: "#374151", cursor: "pointer" }}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat Messages */}
      {!liveMode && (
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "8px 12px", minHeight: 80, maxHeight: 260 }}>
          {msgs.length === 0 && !loading && (
            <div style={{ textAlign: "center", padding: "16px 0", color: "#9ca3af", fontSize: 11 }}>
              Выбери действие или задай вопрос
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} style={{ marginBottom: 8, display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
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
              <span style={{ animation: "pulse 1s infinite" }}>●</span> Анализирую...
            </div>
          )}
          {error && (
            <div style={{ padding: "6px 10px", borderRadius: 6, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 10, marginTop: 4 }}>
              {error}
            </div>
          )}
        </div>
      )}

      {/* Input */}
      {!liveMode && (
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
      )}
    </div>
  );
}