"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { Wave1Nav } from "@/components/Wave1Nav";

type Piece = { type: string; color: "w" | "b" } | null;
type Board = Piece[][];

const PIECES: Record<string, string> = {
  wK: "♔", wQ: "♕", wR: "♖", wB: "♗", wN: "♘", wP: "♙",
  bK: "♚", bQ: "♛", bR: "♜", bB: "♝", bN: "♞", bP: "♟",
};

function pieceChar(p: Piece): string {
  if (!p) return "";
  return PIECES[`${p.color}${p.type}`] || "?";
}

function initBoard(): Board {
  const b: Board = Array.from({ length: 8 }, () => Array(8).fill(null));
  const back = ["R", "N", "B", "Q", "K", "B", "N", "R"];
  for (let c = 0; c < 8; c++) {
    b[0][c] = { type: back[c], color: "b" };
    b[1][c] = { type: "P", color: "b" };
    b[6][c] = { type: "P", color: "w" };
    b[7][c] = { type: back[c], color: "w" };
  }
  return b;
}

function cloneBoard(b: Board): Board {
  return b.map((row) => row.map((p) => (p ? { ...p } : null)));
}

function isInBounds(r: number, c: number) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function getMoves(board: Board, r: number, c: number): [number, number][] {
  const p = board[r][c];
  if (!p) return [];
  const moves: [number, number][] = [];
  const enemy = p.color === "w" ? "b" : "w";

  const addIfValid = (nr: number, nc: number) => {
    if (!isInBounds(nr, nc)) return false;
    const target = board[nr][nc];
    if (target && target.color === p.color) return false;
    moves.push([nr, nc]);
    return !target;
  };

  const slide = (dr: number, dc: number) => {
    for (let i = 1; i < 8; i++) {
      if (!addIfValid(r + dr * i, c + dc * i)) break;
    }
  };

  switch (p.type) {
    case "P": {
      const dir = p.color === "w" ? -1 : 1;
      const start = p.color === "w" ? 6 : 1;
      if (isInBounds(r + dir, c) && !board[r + dir][c]) {
        moves.push([r + dir, c]);
        if (r === start && !board[r + dir * 2][c]) moves.push([r + dir * 2, c]);
      }
      for (const dc of [-1, 1]) {
        const nr = r + dir, nc = c + dc;
        if (isInBounds(nr, nc) && board[nr][nc]?.color === enemy) moves.push([nr, nc]);
      }
      break;
    }
    case "N":
      for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]])
        addIfValid(r + dr, c + dc);
      break;
    case "B": slide(-1,-1); slide(-1,1); slide(1,-1); slide(1,1); break;
    case "R": slide(-1,0); slide(1,0); slide(0,-1); slide(0,1); break;
    case "Q": slide(-1,-1); slide(-1,1); slide(1,-1); slide(1,1); slide(-1,0); slide(1,0); slide(0,-1); slide(0,1); break;
    case "K":
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++)
          if (dr || dc) addIfValid(r + dr, c + dc);
      break;
  }
  return moves;
}

function getAllMoves(board: Board, color: "w" | "b"): { from: [number, number]; to: [number, number] }[] {
  const all: { from: [number, number]; to: [number, number] }[] = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c]?.color === color)
        for (const [tr, tc] of getMoves(board, r, c))
          all.push({ from: [r, c], to: [tr, tc] });
  return all;
}

function evalBoard(board: Board): number {
  const vals: Record<string, number> = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };
  let score = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p) score += (p.color === "w" ? 1 : -1) * (vals[p.type] || 0);
    }
  return score;
}

function aiMove(board: Board): { from: [number, number]; to: [number, number] } | null {
  const moves = getAllMoves(board, "b");
  if (!moves.length) return null;
  let best = moves[0];
  let bestScore = Infinity;
  for (const m of moves) {
    const nb = cloneBoard(board);
    nb[m.to[0]][m.to[1]] = nb[m.from[0]][m.from[1]];
    nb[m.from[0]][m.from[1]] = null;
    const s = evalBoard(nb);
    const noise = (Math.random() - 0.5) * 0.5;
    if (s + noise < bestScore) {
      bestScore = s + noise;
      best = m;
    }
  }
  return best;
}

export default function CyberChessPage() {
  const { showToast } = useToast();
  const [board, setBoard] = useState<Board>(initBoard);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [validMoves, setValidMoves] = useState<Set<string>>(new Set());
  const [turn, setTurn] = useState<"w" | "b">("w");
  const [gameOver, setGameOver] = useState<string | null>(null);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [thinking, setThinking] = useState(false);
  const [capturedW, setCapturedW] = useState<string[]>([]);
  const [capturedB, setCapturedB] = useState<string[]>([]);

  const handleClick = useCallback(
    (r: number, c: number) => {
      if (gameOver || turn !== "w" || thinking) return;
      const piece = board[r][c];

      if (selected) {
        const key = `${r},${c}`;
        if (validMoves.has(key)) {
          const nb = cloneBoard(board);
          const captured = nb[r][c];
          nb[r][c] = nb[selected[0]][selected[1]];
          nb[selected[0]][selected[1]] = null;
          if (nb[r][c]?.type === "P" && (r === 0 || r === 7)) nb[r][c] = { type: "Q", color: nb[r][c]!.color };
          if (captured) setCapturedB((p) => [...p, pieceChar(captured)]);
          const cols = "abcdefgh";
          setMoveHistory((h) => [...h, `${cols[selected[1]]}${8 - selected[0]}→${cols[c]}${8 - r}`]);
          setBoard(nb);
          setSelected(null);
          setValidMoves(new Set());
          setTurn("b");
          return;
        }
        if (piece?.color === "w") {
          setSelected([r, c]);
          setValidMoves(new Set(getMoves(board, r, c).map(([mr, mc]) => `${mr},${mc}`)));
          return;
        }
        setSelected(null);
        setValidMoves(new Set());
        return;
      }

      if (piece?.color === "w") {
        setSelected([r, c]);
        setValidMoves(new Set(getMoves(board, r, c).map(([mr, mc]) => `${mr},${mc}`)));
      }
    },
    [board, selected, validMoves, turn, gameOver, thinking],
  );

  useEffect(() => {
    if (turn !== "b" || gameOver) return;
    setThinking(true);
    const timer = setTimeout(() => {
      const move = aiMove(board);
      if (!move) {
        setGameOver("Вы победили!");
        showToast("Шах и мат! Вы победили!", "success");
        setThinking(false);
        return;
      }
      const nb = cloneBoard(board);
      const captured = nb[move.to[0]][move.to[1]];
      nb[move.to[0]][move.to[1]] = nb[move.from[0]][move.from[1]];
      nb[move.from[0]][move.from[1]] = null;
      if (nb[move.to[0]][move.to[1]]?.type === "P" && (move.to[0] === 0 || move.to[0] === 7))
        nb[move.to[0]][move.to[1]] = { type: "Q", color: "b" };
      if (captured) setCapturedW((p) => [...p, pieceChar(captured)]);
      const cols = "abcdefgh";
      setMoveHistory((h) => [...h, `${cols[move.from[1]]}${8 - move.from[0]}→${cols[move.to[1]]}${8 - move.to[0]}`]);
      setBoard(nb);
      setTurn("w");
      setThinking(false);
      if (!getAllMoves(nb, "w").length) {
        setGameOver("ИИ победил.");
        showToast("Шах и мат. ИИ победил.", "error");
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [turn, board, gameOver, showToast]);

  const resetGame = () => {
    setBoard(initBoard());
    setSelected(null);
    setValidMoves(new Set());
    setTurn("w");
    setGameOver(null);
    setMoveHistory([]);
    setCapturedW([]);
    setCapturedB([]);
    showToast("Новая партия", "info");
  };

  return (
    <main>
      <ProductPageShell maxWidth={960}>
        <Wave1Nav />

        <div style={{ borderRadius: 20, overflow: "hidden", marginBottom: 24 }}>
          <div
            style={{
              background: "linear-gradient(135deg, #1c1917 0%, #292524 40%, #44403c 100%)",
              padding: "28px 24px 20px",
              color: "#fff",
            }}
          >
            <div
              style={{
                display: "inline-block",
                padding: "4px 12px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase" as const,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.08)",
                marginBottom: 14,
              }}
            >
              CyberChess by AEVION
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 900, margin: "0 0 6px", letterSpacing: "-0.03em" }}>
              Шахматы нового поколения
            </h1>
            <p style={{ margin: 0, fontSize: 14, opacity: 0.85, lineHeight: 1.5 }}>
              Играйте против ИИ прямо в браузере. Античит, рейтинг и турниры — скоро.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
          {/* Board */}
          <div style={{ flexShrink: 0 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(8, 1fr)",
                width: "min(420px, calc(100vw - 60px))",
                aspectRatio: "1",
                borderRadius: 12,
                overflow: "hidden",
                border: "2px solid #292524",
              }}
            >
              {board.flatMap((row, r) =>
                row.map((piece, c) => {
                  const isLight = (r + c) % 2 === 0;
                  const isSelected = selected?.[0] === r && selected?.[1] === c;
                  const isValid = validMoves.has(`${r},${c}`);
                  const isCapture = isValid && piece !== null;

                  let bg = isLight ? "#e8dcc8" : "#a38b6e";
                  if (isSelected) bg = "rgba(59,130,246,0.45)";
                  else if (isCapture) bg = "rgba(220,38,38,0.35)";
                  else if (isValid) bg = "rgba(16,185,129,0.35)";

                  return (
                    <div
                      key={`${r}-${c}`}
                      onClick={() => handleClick(r, c)}
                      style={{
                        aspectRatio: "1",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "clamp(28px, 5vw, 42px)",
                        background: bg,
                        cursor: turn === "w" && !gameOver && !thinking ? "pointer" : "default",
                        userSelect: "none",
                        position: "relative",
                        lineHeight: 1,
                      }}
                    >
                      {isValid && !piece ? (
                        <div
                          style={{
                            width: "22%",
                            height: "22%",
                            borderRadius: "50%",
                            background: "rgba(16,185,129,0.5)",
                            position: "absolute",
                          }}
                        />
                      ) : null}
                      {piece ? pieceChar(piece) : ""}
                    </div>
                  );
                }),
              )}
            </div>

            {/* File labels */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(8, 1fr)",
                width: "min(420px, calc(100vw - 60px))",
                marginTop: 4,
              }}
            >
              {"abcdefgh".split("").map((l) => (
                <div key={l} style={{ textAlign: "center", fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>
                  {l}
                </div>
              ))}
            </div>
          </div>

          {/* Side panel */}
          <div style={{ flex: "1 1 240px", minWidth: 200 }}>
            {/* Status */}
            <div
              style={{
                padding: "12px 16px",
                borderRadius: 12,
                border: `1px solid ${gameOver ? "rgba(220,38,38,0.25)" : thinking ? "rgba(245,158,11,0.3)" : "rgba(16,185,129,0.25)"}`,
                background: gameOver ? "rgba(220,38,38,0.06)" : thinking ? "rgba(245,158,11,0.06)" : "rgba(16,185,129,0.06)",
                marginBottom: 14,
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 14 }}>
                {gameOver ? gameOver : thinking ? "ИИ думает..." : "Ваш ход (белые)"}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <button
                onClick={resetGame}
                style={{
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: "none",
                  background: "#0f172a",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Новая игра
              </button>
            </div>

            {/* Captured */}
            {capturedB.length > 0 ? (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginBottom: 2 }}>Взяты вами</div>
                <div style={{ fontSize: 22, letterSpacing: 2 }}>{capturedB.join("")}</div>
              </div>
            ) : null}
            {capturedW.length > 0 ? (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginBottom: 2 }}>Взяты ИИ</div>
                <div style={{ fontSize: 22, letterSpacing: 2 }}>{capturedW.join("")}</div>
              </div>
            ) : null}

            {/* Move history */}
            <div
              style={{
                border: "1px solid rgba(15,23,42,0.1)",
                borderRadius: 12,
                padding: 12,
                maxHeight: 280,
                overflowY: "auto",
              }}
            >
              <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700, marginBottom: 6 }}>
                Ходы ({moveHistory.length})
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {moveHistory.map((m, i) => (
                  <span
                    key={i}
                    style={{
                      padding: "3px 7px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontFamily: "monospace",
                      background: i % 2 === 0 ? "rgba(15,23,42,0.06)" : "rgba(124,58,237,0.08)",
                      color: i % 2 === 0 ? "#334155" : "#4c1d95",
                      fontWeight: 600,
                    }}
                  >
                    {Math.floor(i / 2) + 1}{i % 2 === 0 ? "." : "..."}{m}
                  </span>
                ))}
              </div>
            </div>

            {/* AEVION integration hint */}
            <div
              style={{
                marginTop: 14,
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid rgba(15,118,110,0.2)",
                background: "rgba(15,118,110,0.04)",
                fontSize: 12,
                color: "#475569",
                lineHeight: 1.5,
              }}
            >
              CyberChess будет связан с AEVION Bank: турниры с призовым фондом, рейтинг на Planet, 
              Trust Score античе, и стриминг через социальный слой.
            </div>
          </div>
        </div>
      </ProductPageShell>
    </main>
  );
}
