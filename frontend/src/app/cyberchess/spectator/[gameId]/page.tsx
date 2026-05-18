"use client";

import { useEffect, useState, use as reactUse } from "react";
import Link from "next/link";

const T = {
  bg: "#0a0e1a",
  surface: "#141826",
  surfaceAlt: "#1a1f33",
  border: "#2a3047",
  accent: "#10b981",
  accentDim: "#059669",
  accentSoft: "rgba(16,185,129,0.12)",
  text: "#e5e7eb",
  textDim: "#9ca3af",
  textMute: "#6b7280",
  danger: "#ef4444",
  warn: "#f59e0b",
  light: "#ebecd0",
  dark: "#739552",
  highlight: "rgba(255, 235, 59, 0.45)",
};

type SpectatorState = {
  fen?: string;
  hist?: string[];
  evalCp?: number | null;
  evalMate?: number | null;
  lastSan?: string;
  lastMove?: { from?: string; to?: string } | string | null;
  hostName?: string;
  aiLevel?: number | string;
  rating?: number;
  viewers?: number;
  result?: string | null;
  whiteToMove?: boolean;
};

const PIECE_MAP: Record<string, string> = {
  K: "♔",
  Q: "♕",
  R: "♖",
  B: "♗",
  N: "♘",
  P: "♙",
  k: "♚",
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
  p: "♟",
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function parseFen(fen?: string): {
  board: (string | null)[][];
  whiteToMove: boolean;
} {
  const f = (fen && fen.trim()) || START_FEN;
  const parts = f.split(/\s+/);
  const placement = parts[0] ?? "";
  const turn = parts[1] ?? "w";
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
  return { board, whiteToMove: turn === "w" };
}

function deriveLastMoveSquares(
  lastMove: SpectatorState["lastMove"],
  lastSan?: string,
): { from: string | null; to: string | null } {
  if (lastMove && typeof lastMove === "object") {
    return {
      from: lastMove.from?.toLowerCase() ?? null,
      to: lastMove.to?.toLowerCase() ?? null,
    };
  }
  if (typeof lastMove === "string" && lastMove.length >= 4) {
    return {
      from: lastMove.slice(0, 2).toLowerCase(),
      to: lastMove.slice(2, 4).toLowerCase(),
    };
  }
  // try parsing UCI from SAN — best-effort: pick trailing square
  if (lastSan) {
    const m = lastSan.match(/([a-h][1-8])(?!.*[a-h][1-8])/);
    if (m) return { from: null, to: m[1] };
  }
  return { from: null, to: null };
}

function sqName(r: number, c: number): string {
  // r=0 is rank 8 (top), r=7 is rank 1 (bottom)
  return FILES[c] + (8 - r);
}

function evalLabel(cp?: number | null, mate?: number | null): string {
  if (mate !== null && mate !== undefined) {
    return `M${mate > 0 ? mate : Math.abs(mate)}`;
  }
  if (cp === null || cp === undefined) return "0.0";
  const v = cp / 100;
  return (v >= 0 ? "+" : "") + v.toFixed(1);
}

function evalWhiteRatio(cp?: number | null, mate?: number | null): number {
  if (mate !== null && mate !== undefined) {
    return mate > 0 ? 0.97 : 0.03;
  }
  if (cp === null || cp === undefined) return 0.5;
  const capped = Math.max(-500, Math.min(500, cp));
  // 0 cp -> 0.5, +500 -> 0.95, -500 -> 0.05
  return 0.5 + (capped / 500) * 0.45;
}

interface Props {
  params: { gameId: string } | Promise<{ gameId: string }>;
}

export default function SpectatorViewerPage(props: Props) {
  // Support both Next 14 sync and Next 15 Promise params
  const rawParams = props.params as any;
  const params =
    rawParams && typeof rawParams.then === "function"
      ? reactUse(rawParams as Promise<{ gameId: string }>)
      : (rawParams as { gameId: string });

  const gameId = params?.gameId ?? "";

  const [state, setState] = useState<SpectatorState>({});
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gameId) return;
    const url = `/api/cyberchess-spectator/${encodeURIComponent(gameId)}`;
    const es = new EventSource(url);

    es.onopen = () => {
      setConnected(true);
      setError(null);
    };

    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        setState((prev) => ({ ...prev, ...data }));
      } catch {
        // ignore
      }
    };

    es.onerror = () => {
      setConnected(false);
      setError("Соединение разорвано · переподключение…");
    };

    // Named events (in case server emits them)
    const handleNamed = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data);
        setState((prev) => ({ ...prev, ...data }));
      } catch {
        // ignore
      }
    };
    es.addEventListener("state", handleNamed as any);
    es.addEventListener("move", handleNamed as any);
    es.addEventListener("update", handleNamed as any);

    return () => {
      es.removeEventListener("state", handleNamed as any);
      es.removeEventListener("move", handleNamed as any);
      es.removeEventListener("update", handleNamed as any);
      es.close();
    };
  }, [gameId]);

  const { board, whiteToMove } = parseFen(state.fen);
  const { from: lmFrom, to: lmTo } = deriveLastMoveSquares(
    state.lastMove,
    state.lastSan,
  );
  const hist = Array.isArray(state.hist) ? state.hist : [];
  const lastIdx = hist.length - 1;
  const recentHist = hist.slice(Math.max(0, hist.length - 20));
  const recentOffset = Math.max(0, hist.length - 20);
  const wRatio = evalWhiteRatio(state.evalCp, state.evalMate);
  const finished = !!state.result;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.bg,
        color: T.text,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: "20px 16px 80px",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Breadcrumb */}
        <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
          <Link
            href="/cyberchess/spectator"
            style={{
              color: T.textDim,
              textDecoration: "none",
              fontSize: 13,
              padding: "6px 10px",
              borderRadius: 6,
              border: `1px solid ${T.border}`,
              background: T.surface,
            }}
          >
            ← все трансляции
          </Link>
          <Link
            href="/cyberchess"
            style={{
              color: T.textDim,
              textDecoration: "none",
              fontSize: 13,
              padding: "6px 10px",
              borderRadius: 6,
              border: `1px solid ${T.border}`,
              background: T.surface,
            }}
          >
            к шахматам
          </Link>
        </div>

        {/* Layout: board + sidebar */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 360px",
            gap: 20,
            alignItems: "start",
          }}
        >
          {/* LEFT: Board + eval */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "28px 1fr",
              gap: 10,
              alignItems: "stretch",
              minWidth: 0,
            }}
          >
            {/* Eval bar */}
            <div
              style={{
                width: 28,
                background: "#000",
                border: `1px solid ${T.border}`,
                borderRadius: 4,
                position: "relative",
                overflow: "hidden",
                minHeight: 400,
              }}
              title={`Eval: ${evalLabel(state.evalCp, state.evalMate)}`}
            >
              {/* white portion (top) */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: `${(1 - wRatio) * 100}%`,
                  background: "#1a1a1a",
                  transition: "height 0.3s ease",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: `${wRatio * 100}%`,
                  background: "#f5f5f5",
                  transition: "height 0.3s ease",
                }}
              />
              {/* center line */}
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: 0,
                  right: 0,
                  height: 1,
                  background: T.accent,
                  opacity: 0.6,
                }}
              />
              {/* label */}
              <div
                style={{
                  position: "absolute",
                  bottom: 4,
                  left: 0,
                  right: 0,
                  textAlign: "center",
                  fontSize: 9,
                  color: wRatio > 0.5 ? "#222" : "#eee",
                  fontWeight: 700,
                  fontFamily: "monospace",
                }}
              >
                {evalLabel(state.evalCp, state.evalMate)}
              </div>
            </div>

            {/* Board */}
            <div
              style={{
                aspectRatio: "1 / 1",
                display: "grid",
                gridTemplateColumns: "repeat(8, 1fr)",
                gridTemplateRows: "repeat(8, 1fr)",
                border: `1px solid ${T.border}`,
                borderRadius: 6,
                overflow: "hidden",
                boxShadow: "0 4px 30px rgba(0,0,0,0.6)",
                minWidth: 0,
              }}
            >
              {board.map((row, r) =>
                row.map((piece, c) => {
                  const sq = sqName(r, c);
                  const isLight = (r + c) % 2 === 0;
                  const isLm = sq === lmFrom || sq === lmTo;
                  return (
                    <div
                      key={`${r}-${c}`}
                      style={{
                        background: isLight ? T.light : T.dark,
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "min(7vw, 56px)",
                        lineHeight: 1,
                        userSelect: "none",
                        color:
                          piece && piece === piece.toUpperCase()
                            ? "#fafafa"
                            : "#1a1a1a",
                        textShadow:
                          piece && piece === piece.toUpperCase()
                            ? "0 1px 2px rgba(0,0,0,0.55)"
                            : "0 1px 1px rgba(255,255,255,0.25)",
                      }}
                    >
                      {isLm && (
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            background: T.highlight,
                            pointerEvents: "none",
                          }}
                        />
                      )}
                      {/* file label on bottom rank */}
                      {r === 7 && (
                        <div
                          style={{
                            position: "absolute",
                            bottom: 1,
                            right: 3,
                            fontSize: 9,
                            fontWeight: 700,
                            color: isLight ? T.dark : T.light,
                            opacity: 0.7,
                          }}
                        >
                          {FILES[c]}
                        </div>
                      )}
                      {/* rank label on left file */}
                      {c === 0 && (
                        <div
                          style={{
                            position: "absolute",
                            top: 1,
                            left: 3,
                            fontSize: 9,
                            fontWeight: 700,
                            color: isLight ? T.dark : T.light,
                            opacity: 0.7,
                          }}
                        >
                          {8 - r}
                        </div>
                      )}
                      <span style={{ position: "relative", zIndex: 1 }}>
                        {piece ? PIECE_MAP[piece] ?? "" : ""}
                      </span>
                    </div>
                  );
                }),
              )}
            </div>
          </div>

          {/* RIGHT: Sidebar */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              minWidth: 0,
            }}
          >
            {/* Header card */}
            <div
              style={{
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                padding: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                {!finished && connected ? (
                  <>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: T.danger,
                        boxShadow: `0 0 8px ${T.danger}`,
                        animation: "live-pulse 1.4s ease-in-out infinite",
                      }}
                    />
                    <span
                      style={{
                        color: T.danger,
                        fontWeight: 700,
                        fontSize: 11,
                        letterSpacing: 1,
                      }}
                    >
                      LIVE
                    </span>
                  </>
                ) : finished ? (
                  <span
                    style={{
                      color: T.textMute,
                      fontWeight: 700,
                      fontSize: 11,
                      letterSpacing: 1,
                    }}
                  >
                    FINISHED
                  </span>
                ) : (
                  <span
                    style={{
                      color: T.warn,
                      fontWeight: 700,
                      fontSize: 11,
                      letterSpacing: 1,
                    }}
                  >
                    {connected ? "CONNECTING…" : "OFFLINE"}
                  </span>
                )}
                <span style={{ marginLeft: "auto", color: T.textDim, fontSize: 12 }}>
                  👁 {state.viewers ?? 0} зрителей
                </span>
              </div>
              <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 2 }}>
                {state.hostName || "Аноним"}
              </div>
              <div style={{ fontSize: 12, color: T.textDim }}>
                {state.aiLevel !== undefined && state.aiLevel !== null
                  ? `AI ${state.aiLevel}`
                  : "AI ?"}
                {" · "}рейтинг {state.rating ?? "—"}
                {" · "}ход {whiteToMove ? "белых" : "чёрных"}
              </div>
            </div>

            {/* Result */}
            {finished && (
              <div
                style={{
                  padding: 14,
                  background: T.accentSoft,
                  border: `1px solid ${T.accent}`,
                  borderRadius: 10,
                  color: T.accent,
                  fontWeight: 600,
                  fontSize: 14,
                  textAlign: "center",
                }}
              >
                🏁 Игра завершена: {state.result}
              </div>
            )}

            {/* Error */}
            {error && !finished && (
              <div
                style={{
                  padding: 10,
                  background: "rgba(245,158,11,0.08)",
                  border: `1px solid ${T.warn}`,
                  borderRadius: 8,
                  color: T.warn,
                  fontSize: 12,
                }}
              >
                ⚠ {error}
              </div>
            )}

            {/* Move list */}
            <div
              style={{
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                padding: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600 }}>Ходы</div>
                <div style={{ fontSize: 11, color: T.textMute }}>
                  {hist.length} всего
                </div>
              </div>
              {hist.length === 0 ? (
                <div
                  style={{
                    fontSize: 12,
                    color: T.textMute,
                    textAlign: "center",
                    padding: "16px 0",
                  }}
                >
                  ходов пока нет
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr 1fr",
                    gap: "4px 8px",
                    fontSize: 13,
                    fontFamily: "monospace",
                    maxHeight: 280,
                    overflowY: "auto",
                  }}
                >
                  {(() => {
                    const rows: React.ReactNode[] = [];
                    for (let i = 0; i < recentHist.length; i += 2) {
                      const globalIdxW = recentOffset + i;
                      const globalIdxB = recentOffset + i + 1;
                      const moveNo = Math.floor(globalIdxW / 2) + 1;
                      const w = recentHist[i];
                      const b = recentHist[i + 1];
                      rows.push(
                        <div
                          key={`n-${globalIdxW}`}
                          style={{ color: T.textMute }}
                        >
                          {moveNo}.
                        </div>,
                        <div
                          key={`w-${globalIdxW}`}
                          style={{
                            color: globalIdxW === lastIdx ? T.accent : T.text,
                            fontWeight: globalIdxW === lastIdx ? 700 : 400,
                            background:
                              globalIdxW === lastIdx ? T.accentSoft : "transparent",
                            padding: "1px 5px",
                            borderRadius: 3,
                          }}
                        >
                          {w}
                        </div>,
                        <div
                          key={`b-${globalIdxB}`}
                          style={{
                            color:
                              globalIdxB === lastIdx
                                ? T.accent
                                : b
                                  ? T.text
                                  : T.textMute,
                            fontWeight: globalIdxB === lastIdx ? 700 : 400,
                            background:
                              globalIdxB === lastIdx ? T.accentSoft : "transparent",
                            padding: "1px 5px",
                            borderRadius: 3,
                          }}
                        >
                          {b ?? "…"}
                        </div>,
                      );
                    }
                    return rows;
                  })()}
                </div>
              )}
            </div>

            {/* Spectator notice */}
            <div
              style={{
                fontSize: 11,
                color: T.textMute,
                textAlign: "center",
                padding: "4px 8px",
                lineHeight: 1.5,
              }}
            >
              режим наблюдателя · ходы недоступны · обновляется через SSE
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes live-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        @media (max-width: 900px) {
          [data-spectator-grid] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
