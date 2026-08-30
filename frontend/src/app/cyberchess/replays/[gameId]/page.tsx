"use client";

/**
 * CyberChess — Replay viewer
 *
 * Renders a finished game from the spectator archive with playback controls,
 * move list, eval bar, share button. Pure CSS chessboard from FEN snapshots —
 * same parsing model as the spectator viewer so we don't pull chess.js.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

// ----- Types -----

type ReplayGame = {
  gameId: string;
  hostName?: string;
  hist: string[];
  fenSnapshots: string[];
  evalCpHistory: number[];
  lastSan?: string;
  aiLevel?: string;
  rating?: number;
  result: string;
  startedAt: number;
  endedAt: number;
  duration: number;
};

type Speed = 0.5 | 1 | 2 | 4;

// ----- FEN -> board parsing -----

type Piece = {
  glyph: string;
  color: "white" | "black";
};

const PIECE_GLYPHS: Record<string, Piece> = {
  K: { glyph: "♔", color: "white" },
  Q: { glyph: "♕", color: "white" },
  R: { glyph: "♖", color: "white" },
  B: { glyph: "♗", color: "white" },
  N: { glyph: "♘", color: "white" },
  P: { glyph: "♙", color: "white" },
  k: { glyph: "♚", color: "black" },
  q: { glyph: "♛", color: "black" },
  r: { glyph: "♜", color: "black" },
  b: { glyph: "♝", color: "black" },
  n: { glyph: "♞", color: "black" },
  p: { glyph: "♟", color: "black" },
};

function parseFenBoard(fen: string): (Piece | null)[][] {
  // returns 8x8 (rank 8 first), each cell null or piece
  const parts = fen.trim().split(/\s+/);
  const board: (Piece | null)[][] = [];
  const rows = (parts[0] ?? "").split("/");
  for (let r = 0; r < 8; r++) {
    const row: (Piece | null)[] = [];
    const src = rows[r] ?? "";
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (ch >= "1" && ch <= "8") {
        const n = Number(ch);
        for (let k = 0; k < n; k++) row.push(null);
      } else if (PIECE_GLYPHS[ch]) {
        row.push(PIECE_GLYPHS[ch]);
      }
    }
    while (row.length < 8) row.push(null);
    board.push(row.slice(0, 8));
  }
  while (board.length < 8) {
    board.push(Array.from({ length: 8 }, () => null));
  }
  return board;
}

// ----- Helpers -----

function fmtDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m < 1) return `${sec}s`;
  if (m < 60) return `${m}m ${sec.toString().padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${(m % 60).toString().padStart(2, "0")}m`;
}

function classifyResult(r: string): "win" | "loss" | "draw" | "other" {
  if (r === "1-0") return "win";
  if (r === "0-1") return "loss";
  if (r === "1/2-1/2" || r === "draw" || r === "0.5-0.5") return "draw";
  return "other";
}

function resultLabel(r: string): string {
  const cls = classifyResult(r);
  if (cls === "win") return "Победа";
  if (cls === "loss") return "Поражение";
  if (cls === "draw") return "Ничья";
  return r || "—";
}

function resultBadgeClass(r: string): string {
  const cls = classifyResult(r);
  if (cls === "win") return "planet-badge live";
  if (cls === "loss") return "planet-badge danger";
  if (cls === "draw") return "planet-badge gold";
  return "planet-badge muted";
}

// Board square + piece colors — tie into the planet palette instead of a
// generic slate board, so the viewer matches the rest of the reskinned
// CyberChess pages (leaderboard/matchmaking/history/replay-hub).
const LIGHT_SQUARE = "var(--pl-surface)";
const DARK_SQUARE = "color-mix(in srgb, var(--pl-gold) 30%, var(--pl-surface-2))";
const WHITE_PIECE_STYLE: CSSProperties = {
  color: "var(--pl-surface)",
  textShadow:
    "0 1px 1px var(--pl-text), 0 -1px 1px var(--pl-text), 1px 0 1px var(--pl-text), -1px 0 1px var(--pl-text)",
};
const BLACK_PIECE_STYLE: CSSProperties = { color: "var(--pl-text)" };

// Eval bar height % for white-perspective.
function evalToWhitePct(cp: number): number {
  const clamped = Math.max(-1000, Math.min(1000, cp));
  // sigmoid-ish — looks nicer than linear
  const norm = clamped / 1000;
  const pct = 50 + 50 * Math.tanh(norm * 2);
  return Math.max(2, Math.min(98, pct));
}

// ----- API -----

const API_BASE = "/api-backend/api/cyberchess-spectator";

async function fetchReplay(gameId: string): Promise<ReplayGame> {
  const res = await fetch(`${API_BASE}/replays/${encodeURIComponent(gameId)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { ok: boolean; replay: ReplayGame };
  if (!data.ok) throw new Error("API returned ok=false");
  return data.replay;
}

// ----- Page -----

const STARTING_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export default function ReplayViewerPage() {
  const params = useParams<{ gameId: string }>();
  const gameId = String(params?.gameId ?? "");

  const [replay, setReplay] = useState<ReplayGame | null>(null);
  const [error, setError] = useState<string | null>(null);

  // currentPly = index into fenSnapshots (0 = starting position).
  const [currentPly, setCurrentPly] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [copied, setCopied] = useState(false);

  const moveListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!gameId) return;
    let alive = true;
    setError(null);
    fetchReplay(gameId)
      .then((r) => {
        if (!alive) return;
        setReplay(r);
        setCurrentPly(0);
        // Increment replay views counter (achievement counter, см. cyberchess/page.tsx)
        try {
          const cur = parseInt(localStorage.getItem("cc_replay_views_v1") || "0") || 0;
          localStorage.setItem("cc_replay_views_v1", String(cur + 1));
          window.dispatchEvent(new StorageEvent("storage", { key: "cc_replay_views_v1" }));
        } catch {}
      })
      .catch((e: unknown) => {
        // Человеку — человеческое, технику — в консоль. Сюда попадали
        // «HTTP 500» и «API returned ok=false»: язык разработчика, из которого
        // человек не понимает ни что случилось, ни что делать.
        if (!alive) return;
        console.warn("[replay] не удалось загрузить партию:", e);
        setError("Не удалось загрузить партию. Попробуйте обновить страницу.");
      });
    return () => {
      alive = false;
    };
  }, [gameId]);

  const fenTrail = useMemo(() => {
    if (!replay) return [STARTING_FEN];
    const snaps = replay.fenSnapshots;
    if (!snaps || snaps.length === 0) return [STARTING_FEN];
    // If we only got a single final FEN, synthesise a trail with starting + final
    // so the prev/next still feel reasonable.
    if (snaps.length === 1) {
      // Build a trail of plies; intermediate plies fall back to starting until the last.
      const plies = replay.hist.length;
      if (plies === 0) return [snaps[0]];
      const trail: string[] = [STARTING_FEN];
      for (let i = 1; i < plies; i++) trail.push(STARTING_FEN);
      trail.push(snaps[0]);
      return trail;
    }
    return snaps;
  }, [replay]);

  const maxPly = Math.max(0, fenTrail.length - 1);

  // Clamp ply when trail changes.
  useEffect(() => {
    if (currentPly > maxPly) setCurrentPly(maxPly);
  }, [maxPly, currentPly]);

  // Autoplay loop.
  useEffect(() => {
    if (!isPlaying) return;
    if (currentPly >= maxPly) {
      setIsPlaying(false);
      return;
    }
    const intervalMs = 1500 / speed;
    const t = setTimeout(() => {
      setCurrentPly((p) => Math.min(p + 1, maxPly));
    }, intervalMs);
    return () => clearTimeout(t);
  }, [isPlaying, currentPly, maxPly, speed]);

  // Keyboard shortcuts: ← → home end space
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrentPly((p) => Math.max(0, p - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setCurrentPly((p) => Math.min(maxPly, p + 1));
      } else if (e.key === "Home") {
        e.preventDefault();
        setCurrentPly(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setCurrentPly(maxPly);
      } else if (e.key === " ") {
        e.preventDefault();
        setIsPlaying((x) => !x);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [maxPly]);

  // Auto-scroll move list to active item.
  useEffect(() => {
    const container = moveListRef.current;
    if (!container) return;
    const active = container.querySelector<HTMLElement>("[data-active='true']");
    if (active) {
      active.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [currentPly]);

  const board = useMemo(
    () => parseFenBoard(fenTrail[Math.min(currentPly, fenTrail.length - 1)] ?? STARTING_FEN),
    [fenTrail, currentPly],
  );

  const currentEval = useMemo(() => {
    if (!replay) return 0;
    const arr = replay.evalCpHistory;
    if (!arr || arr.length === 0) return 0;
    // ply 0 == starting; eval entries usually align with hist[i] (post-move).
    if (currentPly === 0) return 0;
    return arr[Math.min(currentPly - 1, arr.length - 1)] ?? 0;
  }, [replay, currentPly]);

  const onShare = useCallback(() => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/cyberchess/replays/${encodeURIComponent(gameId)}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(url)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        })
        .catch(() => {
          window.prompt("Скопируй ссылку:", url);
        });
    } else {
      window.prompt("Скопируй ссылку:", url);
    }
  }, [gameId]);

  // ----- Render -----

  if (error) {
    return (
      <main className="planet-root">
        <div className="planet-wrap" style={{ paddingTop: 36, paddingBottom: 48, maxWidth: 640 }}>
          <div className="planet-card" style={{ padding: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--pl-danger)" }}>Повтор недоступен</div>
            <div className="planet-muted" style={{ marginTop: 6, fontSize: 12 }}>{error}</div>
            <div style={{ marginTop: 16 }}>
              <Link href="/cyberchess/replays" className="planet-btn">← Назад к архиву</Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!replay) {
    return (
      <main className="planet-root">
        <div className="planet-wrap" style={{ paddingTop: 36, paddingBottom: 48 }}>
          <div className="planet-card" style={{ height: 288, opacity: 0.5 }} />
        </div>
      </main>
    );
  }

  const moves = replay.hist;

  return (
    <main className="planet-root">
      <div className="planet-wrap" style={{ paddingTop: 36, paddingBottom: 48 }}>
        {/* Header */}
        <header style={{ marginBottom: 24, display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div style={{ minWidth: 0 }}>
            <div className="planet-eyebrow">Replay · CyberChess</div>
            <h1 className="planet-h1" style={{ marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {replay.hostName || "Аноним"}{" "}
              <span className="planet-muted" style={{ fontWeight: 400 }}>vs</span>{" "}
              {replay.aiLevel ? `AI ${replay.aiLevel}` : "AI"}
            </h1>
            <div className="planet-muted" style={{ marginTop: 8, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, fontSize: 12 }}>
              <span className={resultBadgeClass(replay.result)}>{resultLabel(replay.result)} · {replay.result}</span>
              <span>Длительность: {fmtDuration(replay.duration)}</span>
              <span>Ходы: {moves.length}</span>
              {replay.rating ? <span>Rating: {replay.rating}</span> : null}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <button onClick={onShare} className="planet-btn active">
              {copied ? "Скопировано ✓" : "Поделиться повтором"}
            </button>
            <Link href="/cyberchess/replays" className="planet-btn">← Архив</Link>
          </div>
        </header>

        {/* Main grid */}
        <div style={{ display: "grid", gap: 20, gridTemplateColumns: "1fr", alignItems: "start" }}>
          <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit,minmax(min(320px,100%),1fr))", alignItems: "start" }}>
            {/* Board + eval bar + controls */}
            <section style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", gap: 12 }}>
                {/* Eval bar */}
                <div className="planet-card" style={{ position: "relative", width: 22, height: 480, overflow: "hidden", flexShrink: 0 }}>
                  <div style={{ position: "absolute", inset: "0 0 auto 0", background: "var(--pl-text)", height: `${100 - evalToWhitePct(currentEval)}%`, transition: "height .3s ease" }} />
                  <div style={{ position: "absolute", inset: "auto 0 0 0", background: "var(--pl-surface)", height: `${evalToWhitePct(currentEval)}%`, transition: "height .3s ease" }} />
                  <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 1, background: "var(--pl-gold)", opacity: 0.6 }} />
                  <div className="planet-muted" style={{ position: "absolute", left: 0, right: 0, bottom: -18, textAlign: "center", fontSize: 10, fontFamily: "var(--pl-mono)" }}>
                    {currentEval > 0 ? "+" : ""}{(currentEval / 100).toFixed(2)}
                  </div>
                </div>

                <div className="planet-card" style={{ flex: 1, aspectRatio: "1 / 1", maxWidth: 560, overflow: "hidden" }}>
                  <div style={{ display: "grid", height: "100%", width: "100%", gridTemplateColumns: "repeat(8,1fr)", gridTemplateRows: "repeat(8,1fr)" }}>
                    {board.map((row, rIdx) =>
                      row.map((piece, cIdx) => {
                        const dark = (rIdx + cIdx) % 2 === 1;
                        return (
                          <div
                            key={`${rIdx}-${cIdx}`}
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: "clamp(20px,4.5vw,40px)",
                              background: dark ? DARK_SQUARE : LIGHT_SQUARE,
                            }}
                          >
                            {piece ? <span style={piece.color === "white" ? WHITE_PIECE_STYLE : BLACK_PIECE_STYLE}>{piece.glyph}</span> : null}
                          </div>
                        );
                      }),
                    )}
                  </div>
                </div>
              </div>

              {/* Playback bar */}
              <div style={{ marginTop: 18, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <button onClick={() => setCurrentPly(0)} className="planet-btn" title="К началу (Home)">◀◀</button>
                <button onClick={() => setCurrentPly((p) => Math.max(0, p - 1))} className="planet-btn" title="Назад (←)">◀</button>
                <button onClick={() => setIsPlaying((x) => !x)} className="planet-btn active" title="Играть / пауза (пробел)">
                  {isPlaying ? "⏸ Пауза" : "▶ Играть"}
                </button>
                <button onClick={() => setCurrentPly((p) => Math.min(maxPly, p + 1))} className="planet-btn" title="Вперёд (→)">▶</button>
                <button onClick={() => setCurrentPly(maxPly)} className="planet-btn" title="В конец (End)">▶▶</button>

                <div style={{ marginLeft: 8, display: "flex", alignItems: "center", gap: 2, borderRadius: 9, border: "1px solid var(--pl-line)", padding: 2 }}>
                  {([0.5, 1, 2, 4] as Speed[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSpeed(s)}
                      className="planet-btn"
                      style={{
                        border: "none", padding: "4px 8px",
                        background: speed === s ? "var(--pl-gold)" : "transparent",
                        color: speed === s ? "#1a1205" : "var(--pl-muted)",
                      }}
                    >
                      ×{s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scrubber */}
              <div style={{ marginTop: 14 }}>
                <input
                  type="range"
                  min={0}
                  max={maxPly}
                  value={currentPly}
                  onChange={(e) => setCurrentPly(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "var(--pl-gold)" }}
                />
                <div className="planet-muted" style={{ marginTop: 4, display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                  <span>Ход {currentPly} / {maxPly}</span>
                  <span>{currentEval > 0 ? "+" : ""}{(currentEval / 100).toFixed(2)} cp</span>
                </div>
              </div>
            </section>

            {/* Move list */}
            <aside className="planet-card" style={{ display: "flex", flexDirection: "column", height: 560 }}>
              <div className="planet-eyebrow" style={{ padding: "10px 14px", borderBottom: "1px solid var(--pl-line)" }}>Ходы</div>
              <div ref={moveListRef} style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
                <button
                  data-active={currentPly === 0 ? "true" : "false"}
                  onClick={() => setCurrentPly(0)}
                  className="planet-btn"
                  style={{
                    display: "block", width: "100%", textAlign: "left", border: "none", padding: "6px 8px",
                    background: currentPly === 0 ? "color-mix(in srgb,var(--pl-gold) 15%,transparent)" : "transparent",
                    color: currentPly === 0 ? "var(--pl-gold)" : "var(--pl-muted)",
                  }}
                >
                  Начальная позиция
                </button>
                {/* Pair moves into numbered rows */}
                {Array.from({ length: Math.ceil(moves.length / 2) }).map((_, pairIdx) => {
                  const whitePly = pairIdx * 2 + 1;
                  const blackPly = pairIdx * 2 + 2;
                  const whiteSan = moves[pairIdx * 2];
                  const blackSan = moves[pairIdx * 2 + 1];
                  return (
                    <div key={pairIdx} style={{ marginTop: 2, display: "grid", gridTemplateColumns: "2.2rem 1fr 1fr", alignItems: "center", gap: 4, padding: "2px 4px", fontSize: 12.5 }}>
                      <span className="planet-muted">{pairIdx + 1}.</span>
                      <button
                        data-active={currentPly === whitePly ? "true" : "false"}
                        onClick={() => setCurrentPly(whitePly)}
                        className="planet-btn"
                        style={{
                          border: "none", textAlign: "left", padding: "4px 8px",
                          background: currentPly === whitePly ? "color-mix(in srgb,var(--pl-gold) 15%,transparent)" : "transparent",
                          color: currentPly === whitePly ? "var(--pl-gold)" : "var(--pl-text)",
                        }}
                      >
                        {whiteSan}
                      </button>
                      {blackSan ? (
                        <button
                          data-active={currentPly === blackPly ? "true" : "false"}
                          onClick={() => setCurrentPly(blackPly)}
                          className="planet-btn"
                          style={{
                            border: "none", textAlign: "left", padding: "4px 8px",
                            background: currentPly === blackPly ? "color-mix(in srgb,var(--pl-gold) 15%,transparent)" : "transparent",
                            color: currentPly === blackPly ? "var(--pl-gold)" : "var(--pl-text)",
                          }}
                        >
                          {blackSan}
                        </button>
                      ) : (
                        <span />
                      )}
                    </div>
                  );
                })}
                {moves.length === 0 && (
                  <div className="planet-muted" style={{ padding: "16px 8px", textAlign: "center", fontSize: 12 }}>
                    В этой партии нет ходов.
                  </div>
                )}
              </div>
              <div className="planet-muted" style={{ borderTop: "1px solid var(--pl-line)", padding: "8px 14px", fontSize: 10 }}>
                Подсказки: ← → перемотка, Space — play/pause, Home/End — границы.
              </div>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}
