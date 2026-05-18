"use client";

/**
 * CyberChess — Replay viewer
 *
 * Renders a finished game from the spectator archive with playback controls,
 * move list, eval bar, share button. Pure CSS chessboard from FEN snapshots —
 * same parsing model as the spectator viewer so we don't pull chess.js.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

function resultColor(r: string): string {
  const cls = classifyResult(r);
  if (cls === "win") return "text-emerald-300 border-emerald-500/40 bg-emerald-500/10";
  if (cls === "loss") return "text-rose-300 border-rose-500/40 bg-rose-500/10";
  if (cls === "draw") return "text-amber-200 border-amber-500/40 bg-amber-500/10";
  return "text-slate-300 border-slate-500/40 bg-slate-500/10";
}

// Eval bar height % for white-perspective.
function evalToWhitePct(cp: number): number {
  const clamped = Math.max(-1000, Math.min(1000, cp));
  // sigmoid-ish — looks nicer than linear
  const norm = clamped / 1000;
  const pct = 50 + 50 * Math.tanh(norm * 2);
  return Math.max(2, Math.min(98, pct));
}

// ----- API -----

const API_BASE = "/api/cyberchess-spectator";

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
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
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
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-3xl px-4 py-16">
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-6 text-rose-200">
            <div className="text-sm font-medium">Replay недоступен</div>
            <div className="mt-1 text-xs text-rose-300/80">{error}</div>
            <div className="mt-4">
              <Link
                href="/cyberchess/replays"
                className="inline-flex items-center gap-1.5 rounded-md border border-rose-400/40 px-3 py-1.5 text-xs text-rose-100 hover:bg-rose-500/20"
              >
                ← Назад к архиву
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!replay) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="h-72 animate-pulse rounded-xl border border-slate-800 bg-slate-900/40" />
        </div>
      </main>
    );
  }

  const moves = replay.hist;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Replay · CyberChess
            </div>
            <h1 className="mt-1 truncate text-2xl font-semibold sm:text-3xl">
              {replay.hostName || "Аноним"}{" "}
              <span className="text-slate-500">vs</span>{" "}
              {replay.aiLevel ? `AI ${replay.aiLevel}` : "AI"}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span
                className={[
                  "rounded-md border px-2 py-0.5",
                  resultColor(replay.result),
                ].join(" ")}
              >
                {resultLabel(replay.result)} · {replay.result}
              </span>
              <span>Длительность: {fmtDuration(replay.duration)}</span>
              <span>Ходы: {moves.length}</span>
              {replay.rating ? <span>Rating: {replay.rating}</span> : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onShare}
              className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-sm text-cyan-200 transition hover:border-cyan-400 hover:bg-cyan-500/20"
            >
              {copied ? "Скопировано ✓" : "Поделиться replay"}
            </button>
            <Link
              href="/cyberchess/replays"
              className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-sm text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
            >
              ← Архив
            </Link>
          </div>
        </header>

        {/* Main grid */}
        <div className="grid gap-6 lg:grid-cols-[auto_1fr_320px]">
          {/* Eval bar */}
          <div className="hidden lg:flex">
            <div className="relative h-[480px] w-6 overflow-hidden rounded-md border border-slate-700 bg-slate-900">
              <div
                className="absolute inset-x-0 top-0 bg-slate-200 transition-all duration-300"
                style={{ height: `${100 - evalToWhitePct(currentEval)}%` }}
              />
              <div
                className="absolute inset-x-0 bottom-0 bg-slate-700 transition-all duration-300"
                style={{ height: `${evalToWhitePct(currentEval)}%` }}
              />
              <div className="absolute inset-x-0 top-1/2 h-px bg-cyan-400/60" />
              <div className="absolute inset-x-0 -bottom-px py-1 text-center text-[10px] text-slate-400">
                {currentEval > 0 ? "+" : ""}
                {(currentEval / 100).toFixed(2)}
              </div>
            </div>
          </div>

          {/* Board + controls */}
          <section className="flex flex-col">
            <div className="aspect-square w-full max-w-[560px] self-center overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-lg">
              <div className="grid h-full w-full grid-cols-8 grid-rows-8">
                {board.map((row, rIdx) =>
                  row.map((piece, cIdx) => {
                    const dark = (rIdx + cIdx) % 2 === 1;
                    return (
                      <div
                        key={`${rIdx}-${cIdx}`}
                        className={[
                          "flex items-center justify-center text-3xl sm:text-4xl md:text-5xl",
                          dark ? "bg-slate-700/70" : "bg-slate-300/90",
                        ].join(" ")}
                      >
                        {piece ? (
                          <span
                            className={
                              piece.color === "white"
                                ? "text-white drop-shadow-[0_1px_0_rgba(0,0,0,0.5)]"
                                : "text-slate-900"
                            }
                          >
                            {piece.glyph}
                          </span>
                        ) : null}
                      </div>
                    );
                  }),
                )}
              </div>
            </div>

            {/* Playback bar */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => setCurrentPly(0)}
                className="rounded-md border border-slate-700 bg-slate-900/60 px-2.5 py-1.5 text-sm text-slate-200 hover:border-slate-500"
                title="К началу (Home)"
              >
                ◀◀
              </button>
              <button
                onClick={() => setCurrentPly((p) => Math.max(0, p - 1))}
                className="rounded-md border border-slate-700 bg-slate-900/60 px-2.5 py-1.5 text-sm text-slate-200 hover:border-slate-500"
                title="Назад (←)"
              >
                ◀
              </button>
              <button
                onClick={() => setIsPlaying((x) => !x)}
                className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-sm font-medium text-cyan-200 hover:bg-cyan-500/20"
                title="Play / Pause (Space)"
              >
                {isPlaying ? "⏸ Пауза" : "▶ Играть"}
              </button>
              <button
                onClick={() => setCurrentPly((p) => Math.min(maxPly, p + 1))}
                className="rounded-md border border-slate-700 bg-slate-900/60 px-2.5 py-1.5 text-sm text-slate-200 hover:border-slate-500"
                title="Вперёд (→)"
              >
                ▶
              </button>
              <button
                onClick={() => setCurrentPly(maxPly)}
                className="rounded-md border border-slate-700 bg-slate-900/60 px-2.5 py-1.5 text-sm text-slate-200 hover:border-slate-500"
                title="В конец (End)"
              >
                ▶▶
              </button>

              <div className="ml-3 flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900/60 p-0.5">
                {([0.5, 1, 2, 4] as Speed[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    className={[
                      "rounded px-2 py-0.5 text-xs transition",
                      speed === s
                        ? "bg-cyan-500/20 text-cyan-200"
                        : "text-slate-400 hover:text-slate-200",
                    ].join(" ")}
                  >
                    ×{s}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrubber */}
            <div className="mt-3">
              <input
                type="range"
                min={0}
                max={maxPly}
                value={currentPly}
                onChange={(e) => setCurrentPly(Number(e.target.value))}
                className="w-full accent-cyan-500"
              />
              <div className="mt-1 flex justify-between text-[11px] text-slate-500">
                <span>Ход {currentPly} / {maxPly}</span>
                <span>
                  {currentEval > 0 ? "+" : ""}
                  {(currentEval / 100).toFixed(2)} cp
                </span>
              </div>
            </div>
          </section>

          {/* Move list */}
          <aside className="flex h-[560px] flex-col rounded-xl border border-slate-800 bg-slate-900/40">
            <div className="border-b border-slate-800 px-3 py-2 text-xs uppercase tracking-wider text-slate-400">
              Ходы
            </div>
            <div
              ref={moveListRef}
              className="flex-1 overflow-y-auto px-2 py-2"
            >
              <button
                data-active={currentPly === 0 ? "true" : "false"}
                onClick={() => setCurrentPly(0)}
                className={[
                  "block w-full rounded px-2 py-1 text-left text-xs transition",
                  currentPly === 0
                    ? "bg-cyan-500/15 text-cyan-200"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200",
                ].join(" ")}
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
                  <div
                    key={pairIdx}
                    className="mt-0.5 grid grid-cols-[2.2rem_1fr_1fr] items-center gap-1 px-1 py-0.5 text-xs"
                  >
                    <span className="text-slate-500">{pairIdx + 1}.</span>
                    <button
                      data-active={currentPly === whitePly ? "true" : "false"}
                      onClick={() => setCurrentPly(whitePly)}
                      className={[
                        "rounded px-2 py-1 text-left transition",
                        currentPly === whitePly
                          ? "bg-cyan-500/15 text-cyan-200"
                          : "text-slate-300 hover:bg-slate-800/60 hover:text-slate-100",
                      ].join(" ")}
                    >
                      {whiteSan}
                    </button>
                    {blackSan ? (
                      <button
                        data-active={currentPly === blackPly ? "true" : "false"}
                        onClick={() => setCurrentPly(blackPly)}
                        className={[
                          "rounded px-2 py-1 text-left transition",
                          currentPly === blackPly
                            ? "bg-cyan-500/15 text-cyan-200"
                            : "text-slate-300 hover:bg-slate-800/60 hover:text-slate-100",
                        ].join(" ")}
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
                <div className="px-2 py-4 text-center text-xs text-slate-500">
                  В этой партии нет ходов.
                </div>
              )}
            </div>
            <div className="border-t border-slate-800 px-3 py-2 text-[10px] text-slate-500">
              Подсказки: ← → перемотка, Space — play/pause, Home/End — границы.
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
