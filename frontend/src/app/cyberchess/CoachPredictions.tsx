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

  // Compact one-line strip — chips inline, no vertical column.
  return (
    <div style={{
      borderRadius: RADIUS.md, border: `1px solid ${CC.accent}33`,
      background: `linear-gradient(90deg, ${CC.accentSoft}, rgba(255,255,255,0.55))`,
      padding: "5px 9px", display: "flex", alignItems: "center", gap: SPACE[2],
      flexWrap: "wrap", boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      animation: `cc-fade-in ${MOTION.base} ${MOTION.ease}`,
    }}>
      <span style={{ fontSize: 11, fontWeight: 900, color: CC.accent, letterSpacing: 0.5, textTransform: "uppercase", flexShrink: 0 }}>
        🔮 Предсказания
      </span>
      {loading && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: CC.textDim, fontSize: 11 }}>
          <Spinner size={10} /> думаю…
        </span>
      )}
      {!loading && predictions && predictions.length > 0 && predictions.map(p => {
        const isMatch = actualMove === p.uci;
        const wasShown = !!actualMove;
        return (
          <span key={p.uci} style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "2px 7px 2px 4px", borderRadius: 999,
            background: isMatch ? "rgba(5,150,105,0.18)" : "#fff",
            border: `1px solid ${isMatch ? CC.brand : "rgba(0,0,0,0.08)"}`,
            opacity: wasShown && !isMatch ? 0.45 : 1,
            fontSize: 11, fontFamily: "ui-monospace, SFMono-Regular, monospace", fontWeight: 800,
            color: CC.text, flexShrink: 0,
          }}>
            <span style={{
              width: 14, height: 14, borderRadius: 7,
              background: p.rank === 1 ? CC.gold : p.rank === 2 ? "#94a3b8" : "#cbd0db",
              color: "#fff", fontSize: 9, fontWeight: 900,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>{p.rank}</span>
            {p.san}
            <span style={{ color: CC.textDim, fontWeight: 600, fontSize: 10, marginLeft: 2 }}>
              {fmtEval(p.cp, p.mate)}
            </span>
            {isMatch && <span style={{ color: CC.brand, fontWeight: 900, fontSize: 12, marginLeft: 2 }}>✓</span>}
          </span>
        );
      })}
      {!loading && (!predictions || predictions.length === 0) && (
        <span style={{ fontSize: 11, color: CC.textDim, fontStyle: "italic" }}>
          {isOpponentTurn ? "жду движок…" : "жду ход соперника"}
        </span>
      )}
      <span style={{ flex: 1 }} />
      {stats.total > 0 && (
        <Tooltip label={`${stats.correct}/${stats.total} угаданы`}>
          <Badge tone="accent" size="xs">{accuracy}%</Badge>
        </Tooltip>
      )}
      <Tooltip label="Выключить предсказания">
        <button onClick={onToggle}
          style={{ background: "transparent", border: "none", color: CC.textDim, cursor: "pointer", fontSize: 13, padding: "0 2px", lineHeight: 1, flexShrink: 0 }}>
          ✕
        </button>
      </Tooltip>
      {actualMove && matchedRank === null && (
        <span style={{
          padding: "2px 7px", borderRadius: 999, background: "rgba(217,119,6,0.12)",
          border: `1px dashed ${CC.gold}`, fontSize: 10, color: "#92400e", fontWeight: 800,
        }}>
          сюрприз: {uciToSan(predictedFor || fen, actualMove)}
        </span>
      )}
    </div>
  );
}
