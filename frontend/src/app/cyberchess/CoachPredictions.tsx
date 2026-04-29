"use client";

import { useEffect, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { COLOR as CC, SPACE, RADIUS, SHADOW, MOTION } from "./theme";
import { Badge, Spinner, Tooltip } from "./ui";

/* ══════════════════════════════════════════════════════════════════════
   Coach Predictions — killer #2A
   When it's the opponent's turn, ask Stockfish for top-3 candidate moves
   and display them so you can guess what the opponent will play (trains
   intuition). After they actually move, mark which prediction matched.
   ══════════════════════════════════════════════════════════════════════ */

type PVLine = { pv: number; cp: number; mate: number; depth: number; moves: string[] };

type Prediction = { uci: string; san: string; cp: number; mate: number; rank: number };

type Props = {
  fen: string;
  opponentColor: "w" | "b";
  isOpponentTurn: boolean;
  lastMoveUci: string | null;
  enabled: boolean;
  onToggle: () => void;
  runEngine: (fen: string, depth: number, pvCount: number) => Promise<PVLine[]>;
};

function uciToSan(fen: string, uci: string): string {
  try {
    const g = new Chess(fen);
    const m = g.move({ from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square, promotion: uci.length > 4 ? (uci[4] as any) : undefined });
    return m?.san || uci;
  } catch { return uci; }
}

function fmtEval(cp: number, mate: number): string {
  if (mate !== 0) return `M${Math.abs(mate)}${mate > 0 ? "" : ""}`;
  return (cp >= 0 ? "+" : "") + (cp / 100).toFixed(2);
}

export default function CoachPredictions({
  fen, opponentColor, isOpponentTurn, lastMoveUci, enabled, onToggle, runEngine,
}: Props) {
  const [predictions, setPredictions] = useState<Prediction[] | null>(null);
  const [predictedFor, setPredictedFor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [actualMove, setActualMove] = useState<string | null>(null);
  const [stats, setStats] = useState<{ correct: number; total: number }>(() => {
    if (typeof window === "undefined") return { correct: 0, total: 0 };
    try {
      const raw = localStorage.getItem("aevion_coach_pred_stats_v1");
      if (raw) return JSON.parse(raw);
    } catch {}
    return { correct: 0, total: 0 };
  });
  const cancelRef = useRef(false);

  // Persist stats
  useEffect(() => {
    try { localStorage.setItem("aevion_coach_pred_stats_v1", JSON.stringify(stats)); } catch {}
  }, [stats]);

  // Trigger prediction when opponent's turn and we don't have one for this fen
  useEffect(() => {
    if (!enabled) return;
    if (!isOpponentTurn) return;
    if (predictedFor === fen) return;
    cancelRef.current = false;
    setLoading(true);
    setActualMove(null);
    setPredictions(null);
    runEngine(fen, 14, 3)
      .then((lines) => {
        if (cancelRef.current) return;
        const turn = fen.split(" ")[1] as "w" | "b";
        const sign = turn === "w" ? 1 : -1;
        const preds: Prediction[] = lines.slice(0, 3).map((l, i) => {
          const uci = l.moves[0] || "";
          return {
            uci,
            san: uciToSan(fen, uci),
            cp: l.cp * sign,
            mate: l.mate * sign,
            rank: i + 1,
          };
        }).filter(p => p.uci.length >= 4);
        setPredictions(preds);
        setPredictedFor(fen);
      })
      .catch(() => { if (!cancelRef.current) setPredictions([]); })
      .finally(() => { if (!cancelRef.current) setLoading(false); });
    return () => { cancelRef.current = true; };
  }, [enabled, isOpponentTurn, fen, predictedFor, runEngine]);

  // After opponent moves: detect actual move + tally accuracy
  useEffect(() => {
    if (!enabled) return;
    if (!predictions || predictions.length === 0) return;
    if (!lastMoveUci) return;
    if (isOpponentTurn) return; // still their turn — no move yet
    if (actualMove === lastMoveUci) return; // already counted
    setActualMove(lastMoveUci);
    const matched = predictions.some(p => p.uci === lastMoveUci);
    setStats(s => ({ correct: s.correct + (matched ? 1 : 0), total: s.total + 1 }));
  }, [lastMoveUci, isOpponentTurn, predictions, enabled, actualMove]);

  // Don't render anything if user hasn't enabled — show only the toggle
  if (!enabled) {
    return (
      <button onClick={onToggle} className="cc-focus-ring"
        style={{
          padding: "8px 12px", borderRadius: RADIUS.md,
          border: `1px dashed ${CC.accent}`, background: CC.accentSoft,
          color: CC.accent, fontSize: 12, fontWeight: 800, cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: 6,
          width: "100%", justifyContent: "center",
        }}>
        🔮 Включить предсказания соперника
      </button>
    );
  }

  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
  const matchedRank = actualMove && predictions ? predictions.find(p => p.uci === actualMove)?.rank ?? null : null;

  return (
    <div style={{
      borderRadius: RADIUS.lg, border: `1px solid ${CC.accent}40`,
      background: `linear-gradient(135deg, ${CC.accentSoft}, rgba(255,255,255,0.6))`,
      padding: SPACE[3], boxShadow: SHADOW.sm,
      animation: `cc-fade-in ${MOTION.base} ${MOTION.ease}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: SPACE[2], marginBottom: SPACE[2] }}>
        <span style={{ fontSize: 14 }}>🔮</span>
        <div style={{ fontSize: 11, fontWeight: 900, color: CC.accent, letterSpacing: 0.5, textTransform: "uppercase" }}>
          Предсказания соперника
        </div>
        <div style={{ flex: 1 }} />
        {stats.total > 0 && (
          <Tooltip label={`${stats.correct} из ${stats.total} ходов угаданы`}>
            <Badge tone="accent" size="xs">{accuracy}% точность</Badge>
          </Tooltip>
        )}
        <Tooltip label="Выключить">
          <button onClick={onToggle}
            style={{ background: "transparent", border: "none", color: CC.textDim, cursor: "pointer", fontSize: 11, padding: 2 }}>
            ✕
          </button>
        </Tooltip>
      </div>

      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: CC.textDim, fontSize: 12, padding: `${SPACE[2]}px 0` }}>
          <Spinner size={12} /> Stockfish считает что сыграет {opponentColor === "w" ? "белый" : "чёрный"}…
        </div>
      )}

      {!loading && (!predictions || predictions.length === 0) && (
        <div style={{ fontSize: 12, color: CC.textDim, padding: `${SPACE[2]}px 0` }}>
          {isOpponentTurn ? "Жду движок…" : "Жду хода соперника, чтобы предсказать его следующий…"}
        </div>
      )}

      {!loading && predictions && predictions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: SPACE[1] }}>
          {predictions.map(p => {
            const isMatch = actualMove === p.uci;
            const wasShown = !!actualMove;
            return (
              <div key={p.uci} style={{
                display: "flex", alignItems: "center", gap: SPACE[2],
                padding: `${SPACE[1] + 2}px ${SPACE[2]}px`,
                borderRadius: RADIUS.md,
                background: isMatch ? "rgba(5,150,105,0.12)" : wasShown ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.65)",
                border: `1px solid ${isMatch ? CC.brand : "rgba(0,0,0,0.05)"}`,
                opacity: wasShown && !isMatch ? 0.55 : 1,
                transition: `all ${MOTION.fast} ${MOTION.ease}`,
              }}>
                <span style={{
                  width: 20, height: 20, borderRadius: "50%",
                  background: p.rank === 1 ? CC.gold : p.rank === 2 ? CC.textMute : "#cbd0db",
                  color: "#fff", fontSize: 11, fontWeight: 900,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>{p.rank}</span>
                <span style={{ fontSize: 14, fontWeight: 900, color: CC.text, fontFamily: "ui-monospace, monospace", minWidth: 56 }}>
                  {p.san}
                </span>
                <span style={{ fontSize: 11, color: CC.textDim, fontWeight: 700, flex: 1 }}>
                  eval {fmtEval(p.cp, p.mate)}
                </span>
                {isMatch && <Badge tone="brand" size="xs">✓ угадано</Badge>}
              </div>
            );
          })}
          {actualMove && matchedRank === null && (
            <div style={{
              marginTop: SPACE[1], padding: `${SPACE[1] + 2}px ${SPACE[2]}px`,
              borderRadius: RADIUS.md, background: "rgba(217,119,6,0.1)",
              border: `1px dashed ${CC.gold}`,
              fontSize: 12, color: "#92400e", fontWeight: 700,
            }}>
              Сюрприз! Соперник сыграл <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 900 }}>{uciToSan(predictedFor || fen, actualMove)}</span> — этого хода не было в топ-3.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
