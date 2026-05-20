"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";

const PIECE_MAP: Record<string, string> = {
  K:"♔",Q:"♕",R:"♖",B:"♗",N:"♘",P:"♙",
  k:"♚",q:"♛",r:"♜",b:"♝",n:"♞",p:"♟",
};
const FILES = ["a","b","c","d","e","f","g","h"];
const CELL = 52;
const TOTAL = CELL * 8;
const TIME_LIMIT = 30;
const PUZZLES_PER_SESSION = 10;

type Props = {
  open: boolean;
  onClose: () => void;
  puzzles: Array<{ fen: string; solution: string; id?: string; theme?: string }>;
  surface1: string; surface2: string; border: string;
  text: string; textDim: string; accent: string;
};

function parseFen(fen: string): (string | null)[][] {
  const parts = (fen && fen.trim()) || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const placement = (typeof parts === "string" ? parts : "").split(/\s+/)[0] ?? "";
  const ranks = placement.split("/");
  const board: (string | null)[][] = [];
  for (let r = 0; r < 8; r++) {
    const row: (string | null)[] = [];
    const rankStr = ranks[r] ?? "8";
    for (const ch of rankStr) {
      if (/\d/.test(ch)) {
        const n = parseInt(ch, 10);
        for (let i = 0; i < n; i++) row.push(null);
      } else {
        row.push(ch);
      }
    }
    while (row.length < 8) row.push(null);
    board.push(row.slice(0, 8));
  }
  while (board.length < 8) board.push(Array(8).fill(null));
  return board;
}

function uciToCoords(uci: string): { fr: number; fc: number; tr: number; tc: number } | null {
  if (!uci || uci.length < 4) return null;
  const fc = FILES.indexOf(uci[0]);
  const fr = 8 - parseInt(uci[1], 10);
  const tc = FILES.indexOf(uci[2]);
  const tr = 8 - parseInt(uci[3], 10);
  if (fc < 0 || fr < 0 || tc < 0 || tr < 0) return null;
  return { fr, fc, tr, tc };
}

function squareToUci(row: number, col: number): string {
  return FILES[col] + String(8 - row);
}

export default function ClockPressureDrill({ open, onClose, puzzles, surface1, surface2, border, text, textDim, accent }: Props) {
  const [puzzleIdx, setPuzzleIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<"idle" | "correct" | "wrong" | "timeout">("idle");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [phase, setPhase] = useState<"playing" | "done">("playing");
  const [showSolution, setShowSolution] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const session = puzzles.length > 0
    ? puzzles.slice(0, PUZZLES_PER_SESSION)
    : [];

  const currentPuzzle = session[puzzleIdx] ?? null;

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const stopAdvance = useCallback(() => {
    if (advanceRef.current) { clearTimeout(advanceRef.current); advanceRef.current = null; }
  }, []);

  const advanceToNext = useCallback((delay: number) => {
    stopAdvance();
    advanceRef.current = setTimeout(() => {
      setPuzzleIdx(prev => {
        const next = prev + 1;
        if (next >= PUZZLES_PER_SESSION || next >= session.length) {
          setPhase("done");
          return prev;
        }
        return next;
      });
      setTimeLeft(TIME_LIMIT);
      setSelected(null);
      setResult("idle");
      setShowSolution(false);
    }, delay);
  }, [stopAdvance, session.length]);

  const handleTimeout = useCallback(() => {
    stopTimer();
    setResult("timeout");
    setShowSolution(true);
    setStreak(0);
    advanceToNext(1500);
  }, [stopTimer, advanceToNext]);

  // Timer
  useEffect(() => {
    if (!open || phase !== "playing" || result !== "idle") return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => stopTimer();
  }, [open, phase, result, puzzleIdx, handleTimeout, stopTimer]);

  // Reset on open/close
  useEffect(() => {
    if (!open) return;
    setPuzzleIdx(0);
    setTimeLeft(TIME_LIMIT);
    setSelected(null);
    setResult("idle");
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setPhase("playing");
    setShowSolution(false);
  }, [open]);

  // Cleanup on unmount
  useEffect(() => () => { stopTimer(); stopAdvance(); }, [stopTimer, stopAdvance]);

  const handleCellClick = useCallback((row: number, col: number) => {
    if (result !== "idle" || phase !== "playing" || !currentPuzzle) return;
    const sq = squareToUci(row, col);
    if (selected === null) {
      setSelected(sq);
    } else {
      const move = selected + sq;
      const solution = (currentPuzzle.solution || "").trim().toLowerCase();
      const isCorrect = move === solution;
      stopTimer();
      if (isCorrect) {
        setResult("correct");
        setScore(prev => prev + 1);
        setStreak(prev => {
          const next = prev + 1;
          setBestStreak(b => Math.max(b, next));
          return next;
        });
        advanceToNext(800);
      } else {
        setResult("wrong");
        setShowSolution(true);
        setStreak(0);
        advanceToNext(1500);
      }
      setSelected(null);
    }
  }, [result, phase, currentPuzzle, selected, stopTimer, advanceToNext]);

  const handleRestart = () => {
    stopTimer();
    stopAdvance();
    setPuzzleIdx(0);
    setTimeLeft(TIME_LIMIT);
    setSelected(null);
    setResult("idle");
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setPhase("playing");
    setShowSolution(false);
  };

  if (!open) return null;

  const accuracy = puzzleIdx > 0 ? Math.round((score / (phase === "done" ? PUZZLES_PER_SESSION : puzzleIdx)) * 100) : 0;
  const timerPct = (timeLeft / TIME_LIMIT) * 100;
  const timerColor = timeLeft > 20 ? "#22c55e" : timeLeft > 10 ? "#eab308" : "#ef4444";

  const overlayStyle: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 9999,
    background: "rgba(0,0,0,0.7)",
    display: "flex", alignItems: "center", justifyContent: "center",
  };

  const boxStyle: React.CSSProperties = {
    background: surface1, border: `1px solid ${border}`, borderRadius: 16,
    boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
    padding: "24px 24px 20px", maxWidth: 520, width: "100%",
    display: "flex", flexDirection: "column", gap: 16,
    maxHeight: "95vh", overflowY: "auto",
  };

  // Done screen
  if (phase === "done") {
    const finalAccuracy = Math.round((score / PUZZLES_PER_SESSION) * 100);
    return (
      <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div style={boxStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 900, fontSize: 18, color: text }}>⏱ Clock Pressure Drill</span>
            <button onClick={onClose} style={{ background: "none", border: "none", color: textDim, fontSize: 20, cursor: "pointer", lineHeight: 1 }}>✕</button>
          </div>
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <div style={{ fontSize: 56, fontWeight: 900, color: accent, lineHeight: 1 }}>{score}<span style={{ fontSize: 24, color: textDim }}>/10</span></div>
            <div style={{ fontSize: 14, color: textDim, marginTop: 6 }}>Правильных ответов</div>
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <div style={{ background: surface2, borderRadius: 10, padding: "10px 18px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: finalAccuracy >= 70 ? "#22c55e" : finalAccuracy >= 40 ? "#eab308" : "#ef4444" }}>{finalAccuracy}%</div>
              <div style={{ fontSize: 11, color: textDim }}>Точность</div>
            </div>
            <div style={{ background: surface2, borderRadius: 10, padding: "10px 18px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: text }}>🔥{bestStreak}</div>
              <div style={{ fontSize: 11, color: textDim }}>Лучшая серия</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 4 }}>
            <button onClick={handleRestart} style={{ background: accent, color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Заново</button>
            <button onClick={onClose} style={{ background: surface2, color: text, border: `1px solid ${border}`, borderRadius: 8, padding: "10px 24px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Закрыть</button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentPuzzle) {
    return (
      <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div style={boxStyle}>
          <div style={{ color: textDim, textAlign: "center", padding: 32 }}>Пазлы не загружены. Загрузите базу пазлов.</div>
          <button onClick={onClose} style={{ background: surface2, color: text, border: `1px solid ${border}`, borderRadius: 8, padding: "8px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer", alignSelf: "center" }}>Закрыть</button>
        </div>
      </div>
    );
  }

  const board = parseFen(currentPuzzle.fen);
  const solCoords = uciToCoords(currentPuzzle.solution || "");
  const selCoords = selected ? { col: FILES.indexOf(selected[0]), row: 8 - parseInt(selected[1], 10) } : null;

  const flashBg = result === "correct" ? "rgba(0,200,0,0.12)" : result === "wrong" || result === "timeout" ? "rgba(200,0,0,0.10)" : "transparent";

  return (
    <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={boxStyle}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 900, fontSize: 16, color: text }}>⏱ Clock Pressure Drill</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: textDim, fontSize: 20, cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>

        {/* Score bar */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13, fontWeight: 700 }}>
          <span style={{ color: text }}>Score: {score}/{PUZZLES_PER_SESSION}</span>
          <span style={{ color: streak > 0 ? "#f97316" : textDim }}>🔥{streak}</span>
          <span style={{ marginLeft: "auto", color: timerColor, minWidth: 44, textAlign: "right" }}>⏱ {timeLeft}s</span>
        </div>

        {/* Timer bar */}
        <div style={{ height: 6, borderRadius: 4, background: surface2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${timerPct}%`, background: timerColor, borderRadius: 4, transition: "width 1s linear, background 0.5s" }} />
        </div>

        {/* Puzzle meta */}
        {currentPuzzle.theme && (
          <div style={{ fontSize: 11, color: textDim }}>
            Тема: <span style={{ color: accent, fontWeight: 700 }}>{currentPuzzle.theme}</span>
            <span style={{ marginLeft: 10 }}>#{puzzleIdx + 1}/{Math.min(PUZZLES_PER_SESSION, session.length)}</span>
          </div>
        )}

        {/* Board */}
        <div style={{ position: "relative", background: flashBg, borderRadius: 8, transition: "background 0.3s", alignSelf: "center" }}>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(8, ${CELL}px)`, gridTemplateRows: `repeat(8, ${CELL}px)`, width: TOTAL, height: TOTAL, borderRadius: 6, overflow: "hidden", border: `2px solid ${border}` }}>
            {board.map((row, ri) =>
              row.map((piece, ci) => {
                const isLight = (ri + ci) % 2 === 0;
                let cellBg = isLight ? "#f0d9b5" : "#b58863";

                const isSel = selCoords && selCoords.row === ri && selCoords.col === ci;
                if (isSel) cellBg = "rgba(20,85,30,0.5)";

                const isFromSol = showSolution && solCoords && solCoords.fr === ri && solCoords.fc === ci;
                const isToSol = showSolution && solCoords && solCoords.tr === ri && solCoords.tc === ci;
                if (isFromSol || isToSol) {
                  cellBg = result === "correct" ? "rgba(0,200,0,0.4)" : "rgba(200,0,0,0.4)";
                }

                return (
                  <div
                    key={`${ri}-${ci}`}
                    onClick={() => handleCellClick(ri, ci)}
                    style={{
                      width: CELL, height: CELL,
                      background: cellBg,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: CELL * 0.7,
                      lineHeight: 1,
                      cursor: result === "idle" ? "pointer" : "default",
                      userSelect: "none",
                      transition: "background 0.15s",
                      boxSizing: "border-box",
                      outline: isSel ? `2px solid rgba(20,85,30,0.8)` : "none",
                    }}
                  >
                    {piece ? (PIECE_MAP[piece] ?? piece) : ""}
                  </div>
                );
              })
            )}
          </div>
          {/* Rank labels */}
          <div style={{ position: "absolute", left: -16, top: 0, height: TOTAL, display: "flex", flexDirection: "column" }}>
            {[8,7,6,5,4,3,2,1].map(n => (
              <div key={n} style={{ height: CELL, display: "flex", alignItems: "center", fontSize: 9, color: textDim }}>{n}</div>
            ))}
          </div>
          <div style={{ position: "absolute", bottom: -14, left: 0, width: TOTAL, display: "flex" }}>
            {FILES.map(f => (
              <div key={f} style={{ width: CELL, textAlign: "center", fontSize: 9, color: textDim }}>{f}</div>
            ))}
          </div>
        </div>

        {/* Status message */}
        <div style={{ textAlign: "center", fontWeight: 700, fontSize: 14, minHeight: 20, marginTop: 8 }}>
          {result === "idle" && !selected && <span style={{ color: textDim }}>Выберите фигуру и ход</span>}
          {result === "idle" && selected && <span style={{ color: accent }}>Выбрано: {selected} → кликните цель</span>}
          {result === "correct" && <span style={{ color: "#22c55e" }}>✓ Верно! +1</span>}
          {result === "wrong" && <span style={{ color: "#ef4444" }}>✗ Неверно. Правильно: {currentPuzzle.solution}</span>}
          {result === "timeout" && <span style={{ color: "#ef4444" }}>⏱ Время вышло! Ответ: {currentPuzzle.solution}</span>}
        </div>
      </div>
    </div>
  );
}
