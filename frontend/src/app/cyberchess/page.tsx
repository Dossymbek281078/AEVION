"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Chess, type Square, type PieceSymbol, type Color as ChessColor, type Move } from "chess.js";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { Wave1Nav } from "@/components/Wave1Nav";

/* ═══ CONSTANTS ═══ */
const FILES = "abcdefgh";
const PIECE_MAP: Record<string, string> = {
  wk: "♔", wq: "♕", wr: "♖", wb: "♗", wn: "♘", wp: "♙",
  bk: "♚", bq: "♛", br: "♜", bb: "♝", bn: "♞", bp: "♟",
};

type TimeControl = { name: string; initial: number; increment: number; label: string };
type AILevel = { name: string; elo: number; depth: number; label: string; color: string; randomness: number };

const TIME_CONTROLS: TimeControl[] = [
  { name: "1+0", initial: 60, increment: 0, label: "Bullet 1min" },
  { name: "3+0", initial: 180, increment: 0, label: "Blitz 3min" },
  { name: "3+2", initial: 180, increment: 2, label: "Blitz 3+2" },
  { name: "5+0", initial: 300, increment: 0, label: "Blitz 5min" },
  { name: "5+3", initial: 300, increment: 3, label: "Blitz 5+3" },
  { name: "10+0", initial: 600, increment: 0, label: "Rapid 10min" },
  { name: "10+5", initial: 600, increment: 5, label: "Rapid 10+5" },
  { name: "15+10", initial: 900, increment: 10, label: "Rapid 15+10" },
  { name: "30+0", initial: 1800, increment: 0, label: "Classical 30min" },
  { name: "∞", initial: 0, increment: 0, label: "No limit" },
];

const AI_LEVELS: AILevel[] = [
  { name: "Beginner", elo: 400, depth: 1, label: "Новичок", color: "#94a3b8", randomness: 200 },
  { name: "Casual", elo: 800, depth: 2, label: "Любитель", color: "#10b981", randomness: 80 },
  { name: "Club", elo: 1200, depth: 3, label: "Клубный", color: "#3b82f6", randomness: 30 },
  { name: "Advanced", elo: 1600, depth: 4, label: "Продвинутый", color: "#8b5cf6", randomness: 12 },
  { name: "Expert", elo: 2000, depth: 5, label: "Эксперт", color: "#ef4444", randomness: 5 },
  { name: "Master", elo: 2400, depth: 6, label: "Мастер", color: "#f59e0b", randomness: 2 },
];

const RANKS = [
  { min: 0, t: "Beginner", i: "●" }, { min: 600, t: "Novice", i: "◆" },
  { min: 900, t: "Amateur", i: "■" }, { min: 1200, t: "Club", i: "▲" },
  { min: 1500, t: "Tournament", i: "★" }, { min: 1800, t: "CM", i: "✦" },
  { min: 2000, t: "FM", i: "✧" }, { min: 2200, t: "IM", i: "✪" },
  { min: 2400, t: "GM", i: "♛" },
];

const PUZZLES = [
  { fen: "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2", sol: ["d8h4"], name: "Fool's Mate", r: 200, theme: "Checkmate" },
  { fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4", sol: ["h5f7"], name: "Scholar's Mate", r: 400, theme: "Checkmate" },
  { fen: "r1bqkbnr/pppppppp/2n5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 2", sol: ["d2d4"], name: "Center Control", r: 500, theme: "Opening" },
  { fen: "rnbqkb1r/pppp1ppp/5n2/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 2 3", sol: ["c4f7"], name: "Italian Game Trap", r: 600, theme: "Tactics" },
  { fen: "r1b1k2r/ppppqppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 5", sol: ["c4f7"], name: "Fork Trick", r: 700, theme: "Fork" },
  { fen: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", sol: ["d2d4"], name: "Open Center", r: 800, theme: "Opening" },
  { fen: "rnb1kbnr/pppp1ppp/8/4p3/5PPq/8/PPPPP2P/RNBQKBNR w KQkq - 1 3", sol: ["g2g3"], name: "Block the Check", r: 850, theme: "Defense" },
  { fen: "r2qk2r/ppp2ppp/2n1bn2/2b1p3/4P3/1BP2N2/PP1P1PPP/RNBQK2R w KQkq - 6 6", sol: ["d1a4"], name: "Pin Attack", r: 1000, theme: "Pin" },
  { fen: "r1bqk2r/pppp1Bpp/2n2n2/2b1p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 4", sol: ["e8f7"], name: "Recapture Decision", r: 1100, theme: "Tactics" },
  { fen: "r1b1kb1r/ppppqppp/2n5/1B2p3/4n3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 5", sol: ["b5c6"], name: "Discovered Attack", r: 1200, theme: "Discovery" },
  { fen: "r1bqr1k1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQR1K1 w - - 0 8", sol: ["c3d5"], name: "Knight Outpost", r: 1400, theme: "Positional" },
  { fen: "2rq1rk1/pp1bppbp/2np1np1/8/2BNP3/2N1BP2/PPPQ2PP/R4RK1 w - - 0 11", sol: ["d4f5"], name: "Sacrifice Attack", r: 1600, theme: "Sacrifice" },
  { fen: "r1b2rk1/2q1bppp/p2p1n2/np2p3/3PP3/2N2N1P/PPB2PP1/R1BQR1K1 w - - 0 13", sol: ["d4d5"], name: "Space Advantage", r: 1800, theme: "Strategy" },
  { fen: "r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10", sol: ["c3d5"], name: "Central Domination", r: 2000, theme: "Positional" },
  { fen: "r2q1rk1/ppp1ppbp/2np1np1/8/2PPP1b1/2N2N2/PP2BPPP/R1BQ1RK1 w - - 0 8", sol: ["d4d5"], name: "Pawn Storm", r: 2200, theme: "Attack" },
];

/* ═══ AI ENGINE (minimax with alpha-beta) ═══ */
const PIECE_VALUES: Record<PieceSymbol, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

const PST_P = [0,0,0,0,0,0,0,0,50,50,50,50,50,50,50,50,10,10,20,30,30,20,10,10,5,5,10,25,25,10,5,5,0,0,0,20,20,0,0,0,5,-5,-10,0,0,-10,-5,5,5,10,10,-20,-20,10,10,5,0,0,0,0,0,0,0,0];
const PST_N = [-50,-40,-30,-30,-30,-30,-40,-50,-40,-20,0,0,0,0,-20,-40,-30,0,10,15,15,10,0,-30,-30,5,15,20,20,15,5,-30,-30,0,15,20,20,15,0,-30,-30,5,10,15,15,10,5,-30,-40,-20,0,5,5,0,-20,-40,-50,-40,-30,-30,-30,-30,-40,-50];
const PST_B = [-20,-10,-10,-10,-10,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,10,10,5,0,-10,-10,5,5,10,10,5,5,-10,-10,0,10,10,10,10,0,-10,-10,10,10,10,10,10,10,-10,-10,5,0,0,0,0,5,-10,-20,-10,-10,-10,-10,-10,-10,-20];
const PST_R = [0,0,0,0,0,0,0,0,5,10,10,10,10,10,10,5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,0,0,0,5,5,0,0,0];
const PST_Q = [-20,-10,-10,-5,-5,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,5,5,5,0,-10,-5,0,5,5,5,5,0,-5,0,0,5,5,5,5,0,-5,-10,5,5,5,5,5,0,-10,-10,0,5,0,0,0,0,-10,-20,-10,-10,-5,-5,-10,-10,-20];
const PST_K = [20,30,10,0,0,10,30,20,20,20,0,0,0,0,20,20,-10,-20,-20,-20,-20,-20,-20,-10,-20,-30,-30,-40,-40,-30,-30,-20,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30];
const PST: Record<PieceSymbol, number[]> = { p: PST_P, n: PST_N, b: PST_B, r: PST_R, q: PST_Q, k: PST_K };

function evaluate(chess: Chess): number {
  let score = 0;
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = board[r][c];
      if (!sq) continue;
      const idx = sq.color === "w" ? r * 8 + c : (7 - r) * 8 + c;
      const val = PIECE_VALUES[sq.type] + (PST[sq.type]?.[idx] || 0);
      score += sq.color === "w" ? val : -val;
    }
  }
  return score;
}

function minimax(chess: Chess, depth: number, alpha: number, beta: number, maximizing: boolean): number {
  if (depth === 0) return evaluate(chess);
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) {
    if (chess.isCheckmate()) return maximizing ? -100000 : 100000;
    return 0; // stalemate/draw
  }
  if (maximizing) {
    let best = -Infinity;
    for (const m of moves) {
      chess.move(m);
      best = Math.max(best, minimax(chess, depth - 1, alpha, beta, false));
      chess.undo();
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of moves) {
      chess.move(m);
      best = Math.min(best, minimax(chess, depth - 1, alpha, beta, true));
      chess.undo();
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
}

function findBestMove(chess: Chess, depth: number, randomness: number): Move | null {
  const moves = chess.moves({ verbose: true });
  if (!moves.length) return null;
  const scored = moves.map((m) => {
    chess.move(m);
    const sc = minimax(chess, Math.min(depth, 4) - 1, -Infinity, Infinity, chess.turn() === "w");
    chess.undo();
    return { move: m, score: sc + (Math.random() - 0.5) * randomness };
  });
  scored.sort((a, b) => chess.turn() === "w" ? b.score - a.score : a.score - b.score);
  return scored[0].move;
}

/* ═══ SOUND ═══ */
function playSound(type: "move" | "capture" | "check" | "castle" | "gameover") {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = 0.05;
    const freqs = { move: 600, capture: 300, check: 800, castle: 500, gameover: 200 };
    const types: Record<string, OscillatorType> = { move: "sine", capture: "sawtooth", check: "square", castle: "sine", gameover: "triangle" };
    osc.frequency.value = freqs[type];
    osc.type = types[type];
    osc.start();
    osc.stop(ctx.currentTime + (type === "gameover" ? 0.3 : 0.08));
  } catch {}
}

/* ═══ RATING STORAGE ═══ */
const RK = "aevion_chess_rating_v2";
const SK = "aevion_chess_stats_v2";
function loadRating(): number { try { return parseInt(localStorage.getItem(RK) || "800"); } catch { return 800; } }
function saveRating(r: number) { try { localStorage.setItem(RK, String(Math.round(r))); } catch {} }
function loadStats(): { w: number; l: number; d: number } { try { return JSON.parse(localStorage.getItem(SK) || '{"w":0,"l":0,"d":0}'); } catch { return { w: 0, l: 0, d: 0 }; } }
function saveStats(s: { w: number; l: number; d: number }) { try { localStorage.setItem(SK, JSON.stringify(s)); } catch {} }
function getRank(elo: number) { return [...RANKS].reverse().find((t) => elo >= t.min) || RANKS[0]; }

/* ═══ TIMER HOOK ═══ */
function useTimer(initial: number, increment: number, active: boolean, onTimeout: () => void) {
  const [time, setTime] = useState(initial);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => { setTime(initial); }, [initial]);
  useEffect(() => {
    if (ref.current) clearInterval(ref.current);
    if (active && initial > 0) {
      ref.current = setInterval(() => {
        setTime((t) => { if (t <= 1) { if (ref.current) clearInterval(ref.current); onTimeout(); return 0; } return t - 1; });
      }, 1000);
    }
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [active, initial > 0]);
  const addInc = useCallback(() => { if (increment > 0) setTime((t) => t + increment); }, [increment]);
  const reset = useCallback(() => { setTime(initial); }, [initial]);
  return { time, addInc, reset };
}

function fmtTime(s: number): string {
  if (s <= 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec < 10 ? "0" : ""}${sec}`;
}

/* ═══ PIECE COMPONENT ═══ */
function getPieceChar(type: PieceSymbol, color: ChessColor): string {
  return PIECE_MAP[`${color}${type}`] || "?";
}

/* ═══ MAIN COMPONENT ═══ */
export default function CyberChessPage() {
  const { showToast } = useToast();

  // Game state
  const [game, setGame] = useState(() => new Chess());
  const [boardKey, setBoardKey] = useState(0); // force re-render
  const [selectedSq, setSelectedSq] = useState<Square | null>(null);
  const [validMoves, setValidMoves] = useState<Set<string>>(new Set());
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [gameOver, setGameOver] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [thinking, setThinking] = useState(false);
  const [capturedW, setCapturedW] = useState<string[]>([]);
  const [capturedB, setCapturedB] = useState<string[]>([]);
  const [promoModal, setPromoModal] = useState<{ from: Square; to: Square } | null>(null);

  // Settings
  const [aiLevelIdx, setAiLevelIdx] = useState(2);
  const [playerColor, setPlayerColor] = useState<ChessColor>("w");
  const [tcIdx, setTcIdx] = useState(9); // no limit
  const [started, setStarted] = useState(false);
  const [showSetup, setShowSetup] = useState(true);
  const [flip, setFlip] = useState(false);
  const [tab, setTab] = useState<"play" | "puzzles">("play");
  const [pzIdx, setPzIdx] = useState(0);

  // Rating
  const [rating, setRating] = useState(800);
  const [stats, setStats] = useState({ w: 0, l: 0, d: 0 });

  const tc = TIME_CONTROLS[tcIdx];
  const lv = AI_LEVELS[aiLevelIdx];
  const rk = getRank(rating);
  const aiColor: ChessColor = playerColor === "w" ? "b" : "w";
  const isPlayerTurn = game.turn() === playerColor;
  const isCheck = game.isCheck();

  // Timers
  const pTimer = useTimer(tc.initial, tc.increment, started && isPlayerTurn && !gameOver && tc.initial > 0, () => { setGameOver("Time out — AI wins"); playSound("gameover"); });
  const aTimer = useTimer(tc.initial, tc.increment, started && !isPlayerTurn && !gameOver && tc.initial > 0, () => { setGameOver("AI ran out of time — you win!"); playSound("gameover"); });

  const hRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setRating(loadRating()); setStats(loadStats()); }, []);
  useEffect(() => { hRef.current?.scrollTo({ top: hRef.current.scrollHeight, behavior: "smooth" }); }, [history]);

  /* ── Execute a move ── */
  const executeMove = useCallback((from: Square, to: Square, promotion?: "q" | "r" | "b" | "n") => {
    const movingPiece = game.get(from);
    if (!movingPiece) return false;

    const move = game.move({ from, to, promotion: promotion || "q" });
    if (!move) return false;

    // Sound
    if (move.captured) playSound("capture");
    else if (move.san.includes("O-")) playSound("castle");
    else if (game.isCheck()) playSound("check");
    else playSound("move");

    // Track captures
    if (move.captured) {
      const capChar = getPieceChar(move.captured, move.color === "w" ? "b" : "w");
      if (move.color === playerColor) setCapturedB((x) => [...x, capChar]);
      else setCapturedW((x) => [...x, capChar]);
    }

    // Timer increment
    if (move.color === playerColor) pTimer.addInc();
    else aTimer.addInc();

    setHistory((h) => [...h, move.san]);
    setLastMove({ from: move.from, to: move.to });
    setSelectedSq(null);
    setValidMoves(new Set());
    setBoardKey((k) => k + 1);

    // Check game over
    if (game.isGameOver()) {
      let result = "";
      if (game.isCheckmate()) {
        const playerWon = game.turn() === aiColor;
        result = playerWon ? "Checkmate! You win! 🏆" : "Checkmate. AI wins.";
        if (playerWon) {
          const nr = Math.min(3000, rating + Math.max(5, Math.round((lv.elo - rating) * 0.1 + 15)));
          setRating(nr); saveRating(nr);
          setStats((s) => { const n = { ...s, w: s.w + 1 }; saveStats(n); return n; });
          showToast(`Checkmate! +${nr - rating} rating`, "success");
        } else {
          const nr = Math.max(100, rating - Math.max(5, Math.round((rating - lv.elo) * 0.1 + 10)));
          setRating(nr); saveRating(nr);
          setStats((s) => { const n = { ...s, l: s.l + 1 }; saveStats(n); return n; });
        }
      } else if (game.isDraw()) {
        if (game.isStalemate()) result = "Stalemate — draw";
        else if (game.isThreefoldRepetition()) result = "Threefold repetition — draw";
        else if (game.isInsufficientMaterial()) result = "Insufficient material — draw";
        else result = "Draw by 50-move rule";
        setStats((s) => { const n = { ...s, d: s.d + 1 }; saveStats(n); return n; });
      }
      setGameOver(result);
      playSound("gameover");
    }

    return true;
  }, [game, rating, lv.elo, playerColor, aiColor, pTimer, aTimer, showToast, boardKey]);

  /* ── AI turn ── */
  useEffect(() => {
    if (game.turn() !== aiColor || gameOver || !started || tab !== "play") return;
    setThinking(true);
    const t = setTimeout(() => {
      const cloned = new Chess(game.fen());
      const best = findBestMove(cloned, lv.depth, lv.randomness);
      if (best) executeMove(best.from as Square, best.to as Square, best.promotion as any);
      setThinking(false);
    }, 80);
    return () => clearTimeout(t);
  }, [boardKey, gameOver, started, tab]);

  /* ── Click handler ── */
  const handleClick = useCallback((sq: Square) => {
    if (gameOver || thinking || game.turn() !== playerColor) return;
    const piece = game.get(sq);

    if (selectedSq) {
      if (validMoves.has(sq)) {
        // Check promotion
        const movingPiece = game.get(selectedSq);
        if (movingPiece?.type === "p" && (sq[1] === "1" || sq[1] === "8")) {
          setPromoModal({ from: selectedSq, to: sq });
          return;
        }
        executeMove(selectedSq, sq);
        return;
      }
      if (piece?.color === playerColor) {
        setSelectedSq(sq);
        const moves = game.moves({ square: sq, verbose: true });
        setValidMoves(new Set(moves.map((m) => m.to)));
        return;
      }
      setSelectedSq(null);
      setValidMoves(new Set());
      return;
    }

    if (piece?.color === playerColor) {
      setSelectedSq(sq);
      const moves = game.moves({ square: sq, verbose: true });
      setValidMoves(new Set(moves.map((m) => m.to)));
    }
  }, [game, selectedSq, validMoves, gameOver, thinking, playerColor, executeMove]);

  /* ── Drag & Drop ── */
  const dragRef = useRef<Square | null>(null);
  const handleDragStart = (sq: Square) => {
    const piece = game.get(sq);
    if (piece?.color === playerColor && game.turn() === playerColor && !gameOver && !thinking) {
      dragRef.current = sq;
      setSelectedSq(sq);
      const moves = game.moves({ square: sq, verbose: true });
      setValidMoves(new Set(moves.map((m) => m.to)));
    }
  };
  const handleDrop = (sq: Square) => {
    if (!dragRef.current) return;
    if (validMoves.has(sq)) {
      const movingPiece = game.get(dragRef.current);
      if (movingPiece?.type === "p" && (sq[1] === "1" || sq[1] === "8")) {
        setPromoModal({ from: dragRef.current, to: sq });
      } else {
        executeMove(dragRef.current, sq);
      }
    } else {
      setSelectedSq(null);
      setValidMoves(new Set());
    }
    dragRef.current = null;
  };

  /* ── New game ── */
  const newGame = (color?: ChessColor) => {
    const c = color || playerColor;
    const g = new Chess();
    setGame(g);
    setBoardKey((k) => k + 1);
    setSelectedSq(null); setValidMoves(new Set()); setLastMove(null);
    setGameOver(null); setHistory([]); setCapturedW([]); setCapturedB([]);
    setPromoModal(null); setThinking(false);
    setPlayerColor(c); setFlip(c === "b"); setStarted(true); setShowSetup(false);
    pTimer.reset(); aTimer.reset();
    showToast(`New game — you play ${c === "w" ? "White" : "Black"}`, "info");
  };

  /* ── Load puzzle ── */
  const loadPuzzle = (idx: number) => {
    const pz = PUZZLES[idx];
    const g = new Chess(pz.fen);
    setGame(g);
    setBoardKey((k) => k + 1);
    setPzIdx(idx);
    setSelectedSq(null); setValidMoves(new Set()); setLastMove(null);
    setGameOver(null); setHistory([]); setCapturedW([]); setCapturedB([]);
    setStarted(true); setShowSetup(false);
    setPlayerColor(g.turn());
    setFlip(g.turn() === "b");
    showToast(`Puzzle: ${pz.name} (${pz.r})`, "info");
  };

  /* ── Board rendering ── */
  const board = game.board();
  const rows = flip ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const cols = flip ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

  const LIGHT = "#f0d9b5";
  const DARK = "#b58863";

  return (
    <main>
      <ProductPageShell maxWidth={1040}>
        <Wave1Nav />

        {/* Header */}
        <div style={{ borderRadius: 20, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ background: "linear-gradient(135deg, #1c1917, #292524, #44403c)", padding: "24px 24px 18px", color: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" as const, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", marginBottom: 8 }}>CyberChess by AEVION</div>
                <h1 style={{ fontSize: 22, fontWeight: 900, margin: "0 0 4px", letterSpacing: "-0.03em" }}>Next-gen Chess Platform</h1>
                <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>chess.js engine · 6 AI levels · 15 puzzles · ELO rating · timers</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>Your rating</div>
                <div style={{ fontSize: 28, fontWeight: 900 }}>{rating}</div>
                <div style={{ fontSize: 12, color: rk.min >= 1500 ? "#f59e0b" : "#10b981" }}>{rk.i} {rk.t}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "inline-flex", borderRadius: 10, border: "1px solid rgba(15,23,42,0.12)", overflow: "hidden", marginBottom: 16 }}>
          {(["play", "puzzles"] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); if (t === "play") setShowSetup(true); else loadPuzzle(pzIdx); }}
              style={{ padding: "8px 18px", border: "none", background: tab === t ? "#0f172a" : "#fff", color: tab === t ? "#fff" : "#64748b", fontWeight: tab === t ? 800 : 600, fontSize: 13, cursor: "pointer" }}>
              {t === "play" ? "♟ Play vs AI" : "🧩 Puzzles"}
            </button>
          ))}
        </div>

        {/* Setup */}
        {showSetup && tab === "play" && (
          <div style={{ border: "1px solid rgba(15,23,42,0.1)", borderRadius: 16, padding: 24, marginBottom: 20, maxWidth: 520 }}>
            <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 14 }}>Game Setup</div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, marginBottom: 6 }}>Play as</div>
              <div style={{ display: "flex", gap: 6 }}>
                {([["w", "♔ White"], ["b", "♚ Black"]] as const).map(([v, l]) => (
                  <button key={v} onClick={() => setPlayerColor(v as ChessColor)} style={{ padding: "8px 16px", borderRadius: 8, border: playerColor === v ? "2px solid #0f172a" : "1px solid rgba(15,23,42,0.15)", background: playerColor === v ? "#0f172a" : "#fff", color: playerColor === v ? "#fff" : "#334155", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{l}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, marginBottom: 6 }}>Time Control</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {TIME_CONTROLS.map((t, i) => (
                  <button key={i} onClick={() => setTcIdx(i)} style={{ padding: "5px 10px", borderRadius: 8, border: tcIdx === i ? "2px solid #0f172a" : "1px solid rgba(15,23,42,0.12)", background: tcIdx === i ? "#0f172a" : "#fff", color: tcIdx === i ? "#fff" : "#64748b", fontSize: 11, fontWeight: tcIdx === i ? 800 : 600, cursor: "pointer" }}>{t.name}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, marginBottom: 6 }}>AI Opponent</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {AI_LEVELS.map((l, i) => (
                  <button key={i} onClick={() => setAiLevelIdx(i)} style={{ padding: "5px 10px", borderRadius: 8, border: aiLevelIdx === i ? `2px solid ${l.color}` : "1px solid rgba(15,23,42,0.12)", background: aiLevelIdx === i ? `${l.color}18` : "#fff", fontSize: 11, fontWeight: aiLevelIdx === i ? 800 : 600, cursor: "pointer", color: aiLevelIdx === i ? l.color : "#64748b" }}>{l.name} ({l.elo})</button>
                ))}
              </div>
            </div>
            <button onClick={() => newGame()} style={{ padding: "12px 28px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#0d9488,#0ea5e9)", color: "#fff", fontWeight: 900, fontSize: 15, cursor: "pointer", boxShadow: "0 4px 14px rgba(13,148,136,0.35)" }}>
              ♟ Start Game
            </button>
          </div>
        )}

        {/* Board + Panel */}
        {(!showSetup || tab === "puzzles") && (
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ flexShrink: 0 }}>
              {/* Timers */}
              {tc.initial > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, width: "min(460px, calc(100vw - 48px))" }}>
                  <div style={{ padding: "6px 14px", borderRadius: 8, background: game.turn() === aiColor ? "#1c1917" : "rgba(15,23,42,0.06)", color: game.turn() === aiColor ? "#fff" : "#64748b", fontWeight: 800, fontSize: 15, fontFamily: "monospace" }}>
                    ♟ AI {fmtTime(aTimer.time)}
                  </div>
                  <div style={{ padding: "6px 14px", borderRadius: 8, background: game.turn() === playerColor ? "#0d9488" : "rgba(15,23,42,0.06)", color: game.turn() === playerColor ? "#fff" : "#64748b", fontWeight: 800, fontSize: 15, fontFamily: "monospace" }}>
                    ♔ You {fmtTime(pTimer.time)}
                  </div>
                </div>
              )}

              {/* Chess Board */}
              <div translate="no" style={{ display: "flex", width: "min(480px, calc(100vw - 32px))" }}>
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-around", paddingRight: 4, width: 18 }}>
                  {rows.map((r) => <div key={r} style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textAlign: "center" }}>{8 - r}</div>)}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", flex: 1, aspectRatio: "1", borderRadius: 8, overflow: "hidden", border: "3px solid #292524", boxShadow: "0 8px 32px rgba(0,0,0,0.15)", touchAction: "none" }}>
                  {rows.flatMap((r) => cols.map((c) => {
                    const sq = `${FILES[c]}${8 - r}` as Square;
                    const piece = board[r][c];
                    const isLight = (r + c) % 2 === 0;
                    const isSel = selectedSq === sq;
                    const isValid = validMoves.has(sq);
                    const isCapture = isValid && piece !== null;
                    const isLast = lastMove && (lastMove.from === sq || lastMove.to === sq);
                    const isCheckSq = isCheck && piece?.type === "k" && piece.color === game.turn();

                    let bg = isLight ? LIGHT : DARK;
                    if (isCheckSq) bg = "rgba(220,38,38,0.6)";
                    else if (isSel) bg = "rgba(59,130,246,0.5)";
                    else if (isCapture) bg = "rgba(220,38,38,0.35)";
                    else if (isValid) bg = isLight ? "rgba(16,185,129,0.35)" : "rgba(16,185,129,0.4)";
                    else if (isLast) bg = isLight ? "rgba(245,158,11,0.3)" : "rgba(245,158,11,0.35)";

                    return (
                      <div key={sq} onClick={() => handleClick(sq)}
                        onDragStart={() => handleDragStart(sq)} onDragOver={(e) => e.preventDefault()} onDrop={() => handleDrop(sq)}
                        draggable={!!piece && piece.color === playerColor && game.turn() === playerColor && !gameOver && !thinking}
                        style={{
                          aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "clamp(28px, 5.5vw, 48px)", background: bg,
                          cursor: !gameOver && !thinking && isPlayerTurn && piece?.color === playerColor ? "grab" : "pointer",
                          userSelect: "none", position: "relative", lineHeight: 1, transition: "background 0.12s ease",
                          boxShadow: isCheckSq ? "inset 0 0 14px rgba(220,38,38,0.8)" : "none",
                        }}>
                        {isValid && !piece && <div style={{ width: "26%", height: "26%", borderRadius: "50%", background: "rgba(16,185,129,0.55)", position: "absolute" }} />}
                        {piece && (
                          <span style={{
                            filter: isCheckSq ? "drop-shadow(0 0 6px rgba(220,38,38,0.9))" : piece.color === "w" ? "drop-shadow(1px 1px 1px rgba(0,0,0,0.3))" : "drop-shadow(1px 1px 1px rgba(0,0,0,0.2))",
                            transition: "transform 0.12s ease", transform: isSel ? "scale(1.12)" : "scale(1)",
                          }}>
                            {getPieceChar(piece.type, piece.color)}
                          </span>
                        )}
                      </div>
                    );
                  }))}
                </div>
              </div>
              {/* File labels */}
              <div style={{ display: "flex", paddingLeft: 22, width: "min(480px, calc(100vw - 32px))" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", flex: 1, marginTop: 3 }}>
                  {cols.map((c) => <div key={c} style={{ textAlign: "center", fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>{FILES[c]}</div>)}
                </div>
              </div>
              {/* Board controls */}
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                <button onClick={() => setFlip(!flip)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", background: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>🔄 Flip</button>
                <button onClick={() => { setShowSetup(true); setStarted(false); setGameOver(null); }} style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "#0f172a", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>♟ New Game</button>
                {gameOver && <button onClick={() => newGame()} style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "#0d9488", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>🔁 Rematch</button>}
              </div>
            </div>

            {/* Side Panel */}
            <div style={{ flex: "1 1 260px", minWidth: 220 }}>
              {/* Status */}
              <div style={{
                padding: gameOver ? "16px 14px" : "10px 14px", borderRadius: gameOver ? 14 : 10, marginBottom: 12,
                border: `1px solid ${gameOver ? (gameOver.includes("You win") ? "rgba(16,185,129,0.4)" : "rgba(220,38,38,0.25)") : isCheck ? "rgba(220,38,38,0.35)" : thinking ? "rgba(245,158,11,0.3)" : "rgba(16,185,129,0.25)"}`,
                background: gameOver ? (gameOver.includes("You win") ? "linear-gradient(135deg,rgba(16,185,129,0.12),rgba(13,148,136,0.08))" : "rgba(220,38,38,0.06)") : isCheck ? "rgba(220,38,38,0.06)" : thinking ? "rgba(245,158,11,0.06)" : "rgba(16,185,129,0.06)",
              }}>
                {gameOver ? (
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 4 }}>{gameOver}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{history.length} moves · Rating: {rating} {rk.i} {rk.t}</div>
                  </div>
                ) : (
                  <div style={{ fontWeight: 800, fontSize: 14 }}>
                    {isCheck ? "⚠️ Check!" : thinking ? "🤔 AI thinking..." : isPlayerTurn ? "Your move" : "AI's move"}
                  </div>
                )}
              </div>

              {/* Puzzles list */}
              {tab === "puzzles" && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, marginBottom: 6 }}>Puzzles ({PUZZLES.length})</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 200, overflowY: "auto", border: "1px solid rgba(15,23,42,0.08)", borderRadius: 10, padding: 6 }}>
                    {PUZZLES.map((pz, i) => (
                      <button key={i} onClick={() => loadPuzzle(i)} style={{
                        padding: "6px 10px", borderRadius: 8,
                        border: pzIdx === i ? "2px solid #7c3aed" : "1px solid rgba(15,23,42,0.08)",
                        background: pzIdx === i ? "rgba(124,58,237,0.08)" : "#fff",
                        fontSize: 12, fontWeight: pzIdx === i ? 800 : 600, cursor: "pointer",
                        color: pzIdx === i ? "#7c3aed" : "#334155", textAlign: "left",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                      }}>
                        <span>{pz.name}</span>
                        <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "rgba(124,58,237,0.1)", color: "#7c3aed" }}>{pz.theme}</span>
                          <span style={{ fontSize: 10, fontWeight: 800, color: pz.r < 600 ? "#059669" : pz.r < 1000 ? "#2563eb" : pz.r < 1500 ? "#7c3aed" : "#dc2626" }}>{pz.r}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Captured pieces */}
              {capturedB.length > 0 && <div style={{ marginBottom: 8 }}><div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>Captured by you</div><div style={{ fontSize: 20, letterSpacing: 1 }} translate="no">{capturedB.join("")}</div></div>}
              {capturedW.length > 0 && <div style={{ marginBottom: 8 }}><div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>Captured by AI</div><div style={{ fontSize: 20, letterSpacing: 1 }} translate="no">{capturedW.join("")}</div></div>}

              {/* Move history */}
              <div ref={hRef} style={{ border: "1px solid rgba(15,23,42,0.1)", borderRadius: 10, padding: 10, maxHeight: 200, overflowY: "auto", marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, marginBottom: 4 }}>Moves ({history.length})</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                  {history.map((m, i) => (
                    <span key={i} style={{ padding: "2px 6px", borderRadius: 5, fontSize: 11, fontFamily: "monospace", background: i % 2 === 0 ? "rgba(15,23,42,0.05)" : "rgba(124,58,237,0.07)", color: i % 2 === 0 ? "#334155" : "#4c1d95", fontWeight: 600 }}>
                      {i % 2 === 0 ? `${Math.floor(i / 2) + 1}.` : ""}{m}
                    </span>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div style={{ border: "1px solid rgba(15,23,42,0.1)", borderRadius: 10, padding: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>Your Stats</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 12, textAlign: "center" }}>
                  <div><div style={{ fontWeight: 900, fontSize: 18, color: "#059669" }}>{stats.w}</div><div style={{ color: "#94a3b8" }}>Wins</div></div>
                  <div><div style={{ fontWeight: 900, fontSize: 18, color: "#dc2626" }}>{stats.l}</div><div style={{ color: "#94a3b8" }}>Losses</div></div>
                  <div><div style={{ fontWeight: 900, fontSize: 18, color: "#64748b" }}>{stats.d}</div><div style={{ color: "#94a3b8" }}>Draws</div></div>
                </div>
              </div>

              {/* Game features */}
              <div style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.08)", background: "rgba(15,23,42,0.02)", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                <strong>Features:</strong> Full chess rules (chess.js) · castling, en passant, promotion · threefold repetition · 50-move draw · insufficient material · drag & drop · click to move · sound effects
              </div>
            </div>
          </div>
        )}

        {/* Promotion modal */}
        {promoModal && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={() => setPromoModal(null)}>
            <div style={{ background: "#fff", borderRadius: 16, padding: 24, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>Promote to:</div>
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }} translate="no">
                {(["q", "r", "b", "n"] as const).map((pt) => (
                  <button key={pt} onClick={() => { executeMove(promoModal.from, promoModal.to, pt); setPromoModal(null); }}
                    style={{ fontSize: 40, padding: "8px 14px", borderRadius: 12, border: "2px solid rgba(15,23,42,0.15)", background: "#fff", cursor: "pointer", transition: "transform 0.1s", lineHeight: 1 }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.15)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}>
                    {getPieceChar(pt, playerColor)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </ProductPageShell>
    </main>
  );
}