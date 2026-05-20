"use client";

/**
 * CyberChess — OBS Streaming Overlay
 *
 * Transparent/customizable board overlay for streamers via OBS Browser Source.
 *
 * URL: /cyberchess/obs/[gameId]?bg=transparent&eval=1&clock=1&size=480&theme=dark
 *
 * Query params:
 *   bg        transparent | green | black | dark (default: transparent)
 *   eval      0|1 — show eval bar (default: 1)
 *   clock     0|1 — show move counter + whose turn (default: 1)
 *   size      board size in px (default: 480)
 *   theme     dark | light (default: dark)
 *   flip      0|1 — flip board (default: 0)
 *   voice     0|1 — show voice commentary bubble (default: 1)
 *
 * In OBS: Add Browser Source → set URL → check "Transparent background" if bg=transparent.
 */

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

type Piece = string | null;
type Board = Piece[][];

type SSEState = {
  fen?: string;
  hist?: string[];
  evalCp?: number;
  evalMate?: number;
  lastSan?: string;
  lastMove?: { from?: string; to?: string } | string | null;
  whiteToMove?: boolean;
  result?: string | null;
  hostName?: string;
  aiLevel?: string;
};

type VoiceMsg = { text: string; ts: number };

// ── FEN parser ────────────────────────────────────────────────────────────────

const PIECE_GLYPHS: Record<string, string> = {
  K:"♔",Q:"♕",R:"♖",B:"♗",N:"♘",P:"♙",
  k:"♚",q:"♛",r:"♜",b:"♝",n:"♞",p:"♟",
};

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function parseFen(fen?: string): { board: Board; whiteToMove: boolean } {
  const f = fen?.trim() || START_FEN;
  const [placement, turn = "w"] = f.split(/\s+/);
  const ranks = placement.split("/");
  const board: Board = [];
  for (let r = 0; r < 8; r++) {
    const row: Piece[] = [];
    for (const ch of (ranks[r] ?? "8")) {
      if (/\d/.test(ch)) for (let i = 0; i < parseInt(ch); i++) row.push(null);
      else row.push(ch);
    }
    while (row.length < 8) row.push(null);
    board.push(row.slice(0, 8));
  }
  return { board, whiteToMove: turn === "w" };
}

function deriveLastMove(lm: SSEState["lastMove"]): { from: string; to: string } | null {
  if (!lm) return null;
  if (typeof lm === "string" && lm.length >= 4) return { from: lm.slice(0, 2), to: lm.slice(2, 4) };
  if (typeof lm === "object" && lm.from && lm.to) return { from: lm.from, to: lm.to };
  return null;
}

function evalLabel(cp?: number, mate?: number): string {
  if (mate !== undefined && mate !== 0) return mate > 0 ? `M${mate}` : `-M${Math.abs(mate)}`;
  if (cp === undefined) return "0.0";
  return (cp > 0 ? "+" : "") + (cp / 100).toFixed(1);
}

function evalWhiteRatio(cp?: number, mate?: number): number {
  if (mate !== undefined && mate !== 0) return mate > 0 ? 0.97 : 0.03;
  if (cp === undefined) return 0.5;
  return 0.5 + Math.tanh(cp / 500) * 0.45;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ObsOverlayPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const gameId = typeof params?.gameId === "string" ? params.gameId : Array.isArray(params?.gameId) ? params.gameId[0] : "";

  // Query config
  const bgMode   = searchParams?.get("bg")    ?? "transparent";
  const showEval = searchParams?.get("eval")  !== "0";
  const showInfo = searchParams?.get("clock") !== "0";
  const showVoice= searchParams?.get("voice") !== "0";
  const flip     = searchParams?.get("flip")  === "1";
  const boardSize= Math.min(800, Math.max(240, parseInt(searchParams?.get("size") ?? "480", 10)));
  const theme    = searchParams?.get("theme") ?? "dark";

  // SSE state
  const [state, setState] = useState<SSEState>({});
  const [connected, setConnected] = useState(false);
  const [voiceMsg, setVoiceMsg] = useState<VoiceMsg | null>(null);
  const voiceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!gameId) return;
    const es = new EventSource(`/api/cyberchess-spectator/${gameId}`);

    es.onopen = () => setConnected(true);
    es.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data) as SSEState;
        setState(d);
      } catch {}
    };
    es.addEventListener("state",  (e: MessageEvent) => { try { setState(JSON.parse(e.data)); } catch {} });
    es.addEventListener("move",   (e: MessageEvent) => { try { setState(prev => ({ ...prev, ...JSON.parse(e.data) })); } catch {} });
    es.addEventListener("update", (e: MessageEvent) => { try { setState(prev => ({ ...prev, ...JSON.parse(e.data) })); } catch {} });
    es.addEventListener("voice",  (e: MessageEvent) => {
      try {
        const d = JSON.parse(e.data) as { text?: string; audioUrl?: string };
        if (d.text) {
          setVoiceMsg({ text: d.text, ts: Date.now() });
          if (voiceTimerRef.current) clearTimeout(voiceTimerRef.current);
          voiceTimerRef.current = setTimeout(() => setVoiceMsg(null), 8000);
        }
        if (d.audioUrl && audioRef.current) {
          audioRef.current.src = d.audioUrl;
          audioRef.current.play().catch(() => {});
        }
      } catch {}
    });
    es.addEventListener("ended", () => setState(prev => ({ ...prev, result: prev.result ?? "Game ended" })));
    es.onerror = () => setConnected(false);

    return () => { es.close(); if (voiceTimerRef.current) clearTimeout(voiceTimerRef.current); };
  }, [gameId]);

  // Board render
  const { board, whiteToMove } = parseFen(state.fen);
  const lastMove = deriveLastMove(state.lastMove);
  const cellSize = boardSize / 8;

  // Colors
  const isDark = theme !== "light";
  const lightCell = isDark ? "#b5c4b1" : "#f0d9b5";
  const darkCell  = isDark ? "#5a7a4e" : "#b58863";
  const highlightColor = "rgba(255, 230, 0, 0.55)";
  const infoColor = isDark ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.88)";

  // Background
  const bgStyle: React.CSSProperties =
    bgMode === "transparent" ? { background: "transparent" }
    : bgMode === "green" ? { background: "#00b140" }
    : bgMode === "black" ? { background: "#000" }
    : { background: "#0a0e1a" };

  const boardRows = flip ? [...Array(8)].map((_, i) => 7 - i) : [...Array(8)].map((_, i) => i);
  const boardCols = flip ? [...Array(8)].map((_, i) => 7 - i) : [...Array(8)].map((_, i) => i);

  const evalRatio = evalWhiteRatio(state.evalCp, state.evalMate ?? undefined);

  return (
    <html>
      <head>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background: transparent !important; overflow: hidden; }
          @keyframes obs-voice-in {
            from { opacity: 0; transform: translateY(12px) scale(0.96); }
            to   { opacity: 1; transform: none; }
          }
          @keyframes obs-blink {
            0%,100% { opacity: 1; } 50% { opacity: 0.4; }
          }
        `}</style>
      </head>
      <body style={{ ...bgStyle, display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
        <audio ref={audioRef} style={{ display: "none" }} />

        {/* Info bar — top */}
        {showInfo && (
          <div style={{
            width: boardSize,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "4px 6px", marginBottom: 4,
            background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)",
            borderRadius: 6, color: infoColor, fontSize: Math.max(11, cellSize * 0.28),
            fontFamily: "system-ui, sans-serif", fontWeight: 700, gap: 6,
          }}>
            <span style={{ opacity: 0.85 }}>
              {state.hostName ? `♟ ${state.hostName}` : "♟ AEVION CyberChess"}
            </span>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "2px 8px", borderRadius: 4,
              background: state.result ? "rgba(255,90,90,0.5)" : "rgba(16,185,129,0.4)",
              fontSize: "0.85em",
            }}>
              {state.result
                ? `🏁 ${state.result}`
                : (<>
                    <span style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: "#10b981",
                      animation: connected ? "obs-blink 2s ease-in-out infinite" : "none",
                      display: "inline-block",
                    }}/>
                    {whiteToMove ? "Ход белых" : "Ход чёрных"}
                    {` · ${state.hist?.length ?? 0} ходов`}
                  </>)
              }
            </span>
          </div>
        )}

        {/* Board + eval bar row */}
        <div style={{ display: "flex", alignItems: "stretch", gap: 6 }}>
          {/* Eval bar */}
          {showEval && (
            <div style={{
              width: Math.max(10, cellSize * 0.28),
              height: boardSize,
              background: "#333",
              borderRadius: 4,
              overflow: "hidden",
              position: "relative",
              flexShrink: 0,
            }}>
              {/* White portion (bottom) */}
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                height: `${evalRatio * 100}%`,
                background: "#f5f5f5",
                transition: "height 400ms ease",
              }}/>
              <div style={{
                position: "absolute", top: "50%", left: 0, right: 0,
                height: 1, background: "rgba(100,100,100,0.6)",
              }}/>
              <div style={{
                position: "absolute", bottom: 4, left: 0, right: 0,
                textAlign: "center", fontSize: 9, color: "#333", fontWeight: 800,
                fontFamily: "ui-monospace, monospace",
              }}>
                {evalLabel(state.evalCp, state.evalMate ?? undefined)}
              </div>
            </div>
          )}

          {/* Board */}
          <div style={{
            width: boardSize, height: boardSize,
            display: "grid",
            gridTemplateColumns: `repeat(8, ${cellSize}px)`,
            gridTemplateRows:    `repeat(8, ${cellSize}px)`,
            borderRadius: 4, overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.55)",
          }}>
            {boardRows.map(r =>
              boardCols.map(c => {
                const piece = board[r]?.[c] ?? null;
                const isLight = (r + c) % 2 === 0;
                const sq = `${"abcdefgh"[c]}${8 - r}`;
                const isHighlight = lastMove && (sq === lastMove.from || sq === lastMove.to);
                return (
                  <div key={`${r}-${c}`} style={{
                    width: cellSize, height: cellSize,
                    background: isHighlight ? highlightColor : isLight ? lightCell : darkCell,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: cellSize * 0.78,
                    lineHeight: 1,
                    userSelect: "none",
                    position: "relative",
                  }}>
                    {piece && (
                      <span style={{
                        filter: piece === piece.toLowerCase()
                          ? "drop-shadow(0 1px 2px rgba(255,255,255,0.3))"
                          : "drop-shadow(0 1px 2px rgba(0,0,0,0.5))",
                        display: "block",
                      }}>
                        {PIECE_GLYPHS[piece] ?? piece}
                      </span>
                    )}
                    {/* Rank label */}
                    {c === (flip ? 7 : 0) && (
                      <span style={{
                        position: "absolute", top: 1, left: 2,
                        fontSize: cellSize * 0.18, fontWeight: 800,
                        color: isLight ? darkCell : lightCell, opacity: 0.8,
                        lineHeight: 1, pointerEvents: "none",
                      }}>{8 - r}</span>
                    )}
                    {/* File label */}
                    {r === (flip ? 0 : 7) && (
                      <span style={{
                        position: "absolute", bottom: 1, right: 2,
                        fontSize: cellSize * 0.18, fontWeight: 800,
                        color: isLight ? darkCell : lightCell, opacity: 0.8,
                        lineHeight: 1, pointerEvents: "none",
                      }}>{"abcdefgh"[c]}</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Voice commentary bubble */}
        {showVoice && voiceMsg && (
          <div style={{
            marginTop: 8, width: boardSize,
            padding: "8px 12px",
            background: "rgba(0,0,0,0.72)", backdropFilter: "blur(10px)",
            borderRadius: 8, borderLeft: "3px solid #10b981",
            color: "#e5e7eb", fontSize: Math.max(11, cellSize * 0.25),
            fontFamily: "system-ui, sans-serif",
            animation: "obs-voice-in 300ms ease",
          }}>
            🎙 {voiceMsg.text}
          </div>
        )}
      </body>
    </html>
  );
}
