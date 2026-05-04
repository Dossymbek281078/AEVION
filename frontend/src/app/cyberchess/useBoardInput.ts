"use client";
/**
 * useBoardInput v8 — chess board input. Clean rewrite.
 *
 * Design:
 *   - One handler per phase (Down / Move / Up / Cancel) wired to the board's React JSX.
 *   - setPointerCapture on press → all subsequent move/up events route to the board even
 *     when the pointer leaves it. We do NOT use window listeners (they were unreliable).
 *   - dragRef is a ref (state would force re-render on every pixel of motion).
 *   - Ghost piece is rendered by page.tsx as a sibling of the board (so overflow:hidden
 *     on the board cannot clip it). We expose ghostFrom (state) + ghostRef (for transform).
 *
 * Tap-to-move semantics (the case the user was missing):
 *   1. Press own piece → set sel + show vm dots. dragRef armed.
 *   2. Release without crossing threshold → KEEP sel; user can now tap a target.
 *   3. Press a legal target with sel set → execute move. (priority-1 in onDown)
 *   4. Press the same selected piece → deselect.
 *   5. Press another own piece → switch sel to it.
 *
 * Premove semantics (during opponent's turn):
 *   - Same flow, but writes to pmSel/pms.
 *   - Legal target list comes from premoveLegalMoves(virtualGame, pCol, from):
 *       pass-1: standard chess.js legal moves (with our color forced to move).
 *       pass-2: own-piece squares this piece could reach IF that own piece were
 *               captured first (per-square removal — king preserved so chess.js
 *               doesn't bail with "game over").
 *
 * Chained premoves work because virtualGame projects every queued premove forward
 * (also via the rescue-fallback) — see page.tsx::virtualGame useMemo.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Chess, type Square, type Color as ChessColor } from "chess.js";

const FILES = ["a","b","c","d","e","f","g","h"] as const;

const THRESHOLD_MOUSE = 4;  // mouse / pen are precise
const THRESHOLD_TOUCH = 8;  // touch jitters more
const RECENT_DRAG_GUARD_MS = 250; // suppress synthetic click after a real drop

type Pre = { from: Square; to: Square; pr?: "q"|"r"|"b"|"n" };

function premoveLegalMoves(virtualGame: Chess, pCol: ChessColor, from: Square): any[] {
  try {
    const fen = virtualGame.fen();
    // Build a board with our color forced to move (chess.js refuses to query
    // moves for the side that is not to-move).
    const buildBoard = (): Chess | null => {
      const g = new Chess(fen);
      const fp = g.fen().split(" "); fp[1] = pCol;
      try { g.load(fp.join(" ")); return g; } catch { return null; }
    };
    const g1 = buildBoard();
    if (!g1) return [];
    const piece = g1.get(from);
    if (!piece || piece.color !== pCol) return [];

    // Pass 1 — standard.
    const pass1: any[] = g1.moves({ square: from, verbose: true });
    const have = new Set(pass1.map(m => m.to));

    // Pass 2 — rescue: per own-piece square, simulate it being captured and
    // see if FROM can now reach it. King preserved (otherwise game-over).
    const board = g1.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p || p.color !== pCol || p.type === "k") continue;
        const sq = (FILES[c] + (8 - r)) as Square;
        if (sq === from || have.has(sq)) continue;
        const g2 = buildBoard(); if (!g2) continue;
        try { g2.remove(sq); } catch { continue; }
        const m = g2.moves({ square: from, verbose: true }).find((x: any) => x.to === sq);
        if (m) { pass1.push(m); have.add(sq); }
      }
    }
    return pass1;
  } catch { return []; }
}

export interface BoardInputOptions {
  game: Chess;
  virtualGame: Chess;
  pCol: ChessColor;
  on: boolean;
  over: string | null;
  flip: boolean;
  tab: string;
  sel: Square | null;
  vm: Set<string>;
  pms: Pre[];
  pmSel: Square | null;
  pmLim: number;
  pmsRef: React.MutableRefObject<Pre[]>;
  pmSelRef: React.MutableRefObject<Square | null>;
  scratchOn: boolean;
  scratchGame: Chess | null;
  autoQueen: boolean;
  hotseat: boolean;
  variant: string;
  dicePieceType: string | null;
  editorMode: boolean;
  exec: (from: Square, to: Square, pr?: "q"|"r"|"b"|"n") => void;
  sSel: (sq: Square | null) => void;
  sVm: (v: Set<string>) => void;
  sPms: (fn: (v: Pre[]) => Pre[]) => void;
  sPmSel: (sq: Square | null) => void;
  sPromo: (p: { from: Square; to: Square } | null) => void;
  sScratchSel: (sq: Square | null) => void;
  sScratchVm: (v: Set<string>) => void;
  sScratchBk: (fn: (k: number) => number) => void;
  sScratchHist: (fn: (h: string[]) => string[]) => void;
  sScratchLm: (v: { from: string; to: string } | null) => void;
  snd: (name: string) => void;
  filterMovesByDice?: (moves: any[], pieceType: string) => any[];
}

type DragState = {
  from: Square;
  sx: number;
  sy: number;
  pid: number;
  ptype: string;
  active: boolean;
  isPM: boolean;
};

export function useBoardInput(opts: BoardInputOptions) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const dragRef  = useRef<DragState | null>(null);
  const ghostPosRef    = useRef({ x: 0, y: 0 });
  const ghostSizeRef   = useRef(0);
  const ghostRafRef    = useRef<number | null>(null);
  const dragHoverIntRef = useRef<Square | null>(null);
  const recentDragRef   = useRef(0);
  const bDownHandledRef = useRef(0);

  const [ghostFrom, setGhostFrom] = useState<Square | null>(null);
  const [dragHover, setDragHover] = useState<Square | null>(null);

  // optsRef gives stable access to the latest props from inside memoized callbacks.
  const optsRef = useRef(opts);
  optsRef.current = opts;

  // ── Hit test (clientX/Y → board square) ─────────────────────────────────
  const sqFromBoard = useCallback((x: number, y: number): Square | null => {
    const el = boardRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0) return null;
    const cw = r.width / 8;
    const fx = Math.floor((x - r.left) / cw);
    const fy = Math.floor((y - r.top)  / cw);
    if (fx < 0 || fx > 7 || fy < 0 || fy > 7) return null;
    const flip = optsRef.current.flip;
    return `${FILES[flip ? 7 - fx : fx]}${(flip ? fy : 7 - fy) + 1}` as Square;
  }, []);

  // ── Ghost rendering (RAF-throttled position update) ──────────────────────
  const flushGhostPos = useCallback(() => {
    ghostRafRef.current = null;
    const el = ghostRef.current;
    if (!el) return;
    const { x, y } = ghostPosRef.current;
    el.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
  }, []);

  const showGhost = useCallback((from: Square, x: number, y: number) => {
    ghostPosRef.current = { x, y };
    setGhostFrom(from);
    if (typeof document !== "undefined") document.body.style.cursor = "grabbing";
  }, []);

  const hideGhost = useCallback(() => {
    if (ghostRafRef.current !== null) { cancelAnimationFrame(ghostRafRef.current); ghostRafRef.current = null; }
    setGhostFrom(null);
    setDragHover(null);
    dragHoverIntRef.current = null;
    if (typeof document !== "undefined") document.body.style.cursor = "";
  }, []);

  // ── Apply a move (or queue a premove) ────────────────────────────────────
  const executeDrop = useCallback((from: Square, to: Square, isPM: boolean) => {
    const o = optsRef.current;

    // Scratch board (off-game freeplay)
    if (o.scratchOn && o.scratchGame) {
      const moves = o.scratchGame.moves({ square: from, verbose: true });
      const matched = moves.find(m => m.to === to);
      if (matched) {
        try {
          const mv = o.scratchGame.move({ from, to, promotion: matched.promotion ? "q" : undefined });
          if (mv) {
            o.sScratchHist(h => [...h, mv.san]);
            o.sScratchLm({ from: mv.from, to: mv.to });
            o.sScratchSel(null); o.sScratchVm(new Set()); o.sScratchBk(k => k + 1);
            o.snd(mv.captured ? "capture" : "move");
          }
        } catch {}
      } else { o.sScratchSel(null); o.sScratchVm(new Set()); }
      return;
    }

    if (isPM) {
      if (o.pmsRef.current.length >= o.pmLim) return;
      const piece = o.virtualGame.get(from);
      if (!piece || piece.color !== o.pCol) { o.sPmSel(null); o.sVm(new Set()); return; }
      const legal = premoveLegalMoves(o.virtualGame, o.pCol, from);
      const matched = legal.find((m: any) => m.to === to);
      if (!matched) { o.sPmSel(null); o.sVm(new Set()); return; }
      const pre: Pre = { from, to };
      if (piece.type === "p" && to[1] === (o.pCol === "w" ? "8" : "1")) pre.pr = "q";
      o.sPms(v => [...v, pre]); o.sPmSel(null); o.sVm(new Set()); o.snd("premove");
      return;
    }

    // Normal move on real board
    const raw = o.game.moves({ square: from, verbose: true });
    const legal = (o.variant === "diceblade" && o.dicePieceType && o.filterMovesByDice)
      ? o.filterMovesByDice(raw, o.dicePieceType) : raw;
    const matched = legal.find((m: any) => m.to === to);
    if (matched) {
      const mp = o.game.get(from);
      if (mp?.type === "p" && (to[1] === "1" || to[1] === "8")) {
        if (o.autoQueen) o.exec(from, to, "q"); else o.sPromo({ from, to });
      } else { o.exec(from, to); }
    } else {
      o.sSel(null); o.sVm(new Set());
    }
  }, []);

  // ── onPointerDown — single entry point for all board taps/drags ─────────
  const onBoardDown = useCallback((e: React.PointerEvent) => {
    // Mouse: only main button. Touch/pen always (button is 0).
    if (e.button !== 0 && e.pointerType === "mouse") return;
    // Re-entry guard against same-event double dispatch.
    if (Date.now() - bDownHandledRef.current < 50) return;

    const sq = sqFromBoard(e.clientX, e.clientY);
    if (!sq) return;
    const o = optsRef.current;
    const boardEl = boardRef.current;
    if (!boardEl) return;

    bDownHandledRef.current = Date.now();

    // ── SCRATCH ──────────────────────────────────────────────────────────
    if (o.scratchOn && o.scratchGame) {
      const p = o.scratchGame.get(sq);
      if (!p || p.color !== o.scratchGame.turn()) {
        o.sScratchSel(null); o.sScratchVm(new Set());
        return;
      }
      e.preventDefault();
      dragRef.current = { from: sq, sx: e.clientX, sy: e.clientY, pid: e.pointerId, ptype: e.pointerType || "mouse", active: false, isPM: false };
      try { boardEl.setPointerCapture(e.pointerId); } catch {}
      o.sScratchSel(sq);
      o.sScratchVm(new Set(o.scratchGame.moves({ square: sq, verbose: true }).map(m => m.to)));
      return;
    }

    const isPM = o.tab !== "analysis" && o.game.turn() !== o.pCol && o.on && !o.over;

    if (!o.over && !o.editorMode) {
      // ── Priority-1: tap-to-move (your turn, you have a selection, this sq is a legal target).
      if (!isPM && o.sel && o.vm.has(sq)) {
        const f = o.sel;
        e.preventDefault();
        const mp = o.game.get(f);
        if (mp?.type === "p" && (sq[1] === "1" || sq[1] === "8")) {
          if (o.autoQueen) o.exec(f, sq, "q"); else o.sPromo({ from: f, to: sq });
        } else { o.exec(f, sq); }
        o.sSel(null); o.sVm(new Set());
        return;
      }

      // ── Priority-2: complete a queued premove selection.
      if (isPM && o.pmSelRef.current && sq !== o.pmSelRef.current && o.pmsRef.current.length < o.pmLim) {
        const f = o.pmSelRef.current;
        const piece = o.virtualGame.get(f);
        if (piece && piece.color === o.pCol) {
          const legal = premoveLegalMoves(o.virtualGame, o.pCol, f);
          const matched = legal.find((m: any) => m.to === sq);
          if (matched) {
            const pre: Pre = { from: f, to: sq };
            if (piece.type === "p" && sq[1] === (o.pCol === "w" ? "8" : "1")) pre.pr = "q";
            e.preventDefault();
            o.sPms(v => [...v, pre]); o.sPmSel(null); o.sVm(new Set()); o.snd("premove");
            return;
          }
        }
        // Premove target was illegal — clear the selection state and continue
        // through to the selection-start branch (so a second tap on a different
        // own piece switches the selection cleanly).
        o.sPmSel(null); o.sVm(new Set());
      }

      // ── Tap same selected piece → deselect.
      if (!isPM && o.sel === sq) {
        e.preventDefault();
        o.sSel(null); o.sVm(new Set());
        return;
      }
    }

    // ── Drag/selection start ─────────────────────────────────────────────
    const checkBoard = isPM ? o.virtualGame : o.game;
    const p = checkBoard.get(sq);
    const side = o.tab === "analysis" ? o.game.turn() : o.pCol;
    const canSelect = !!p && (o.tab === "analysis" || p.color === side) && !o.over;

    if (!canSelect) {
      // Tap empty/opponent square with no premove match → clear stale selection.
      if (!o.editorMode && (o.sel || (isPM && o.pmSelRef.current))) {
        o.sSel(null); o.sVm(new Set()); o.sPmSel(null);
      }
      return;
    }

    e.preventDefault();
    dragRef.current = { from: sq, sx: e.clientX, sy: e.clientY, pid: e.pointerId, ptype: e.pointerType || "mouse", active: false, isPM };
    try { boardEl.setPointerCapture(e.pointerId); } catch {}

    // Show selection + dots immediately (lichess-style on press).
    if (!isPM) {
      o.sSel(sq);
      const all = o.game.moves({ square: sq, verbose: true });
      const filtered = (o.variant === "diceblade" && o.dicePieceType && o.filterMovesByDice)
        ? o.filterMovesByDice(all, o.dicePieceType) : all;
      o.sVm(new Set(filtered.map((m: any) => m.to)));
    } else if (o.on) {
      o.sPmSel(sq);
      o.sVm(new Set(premoveLegalMoves(o.virtualGame, o.pCol, sq).map((m: any) => m.to)));
    }
  }, [sqFromBoard]);

  // ── onPointerMove — drag tracking. Fires on the board element thanks to setPointerCapture.
  const onBoardMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pid !== e.pointerId) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    const threshold = d.ptype === "touch" ? THRESHOLD_TOUCH : THRESHOLD_MOUSE;
    if (!d.active && Math.hypot(dx, dy) > threshold) {
      d.active = true;
      ghostPosRef.current = { x: e.clientX, y: e.clientY };
      showGhost(d.from, e.clientX, e.clientY);
    }
    if (d.active) {
      e.preventDefault();
      ghostPosRef.current = { x: e.clientX, y: e.clientY };
      if (ghostRafRef.current === null)
        ghostRafRef.current = requestAnimationFrame(flushGhostPos);
      const hover = sqFromBoard(e.clientX, e.clientY);
      const target = hover && hover !== d.from ? hover : null;
      if (target !== dragHoverIntRef.current) {
        dragHoverIntRef.current = target;
        setDragHover(target);
      }
    }
  }, [showGhost, flushGhostPos, sqFromBoard]);

  // ── onPointerUp — drop or close out a tap.
  const onBoardUp = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pid !== e.pointerId) return;
    const boardEl = boardRef.current;
    if (boardEl) { try { boardEl.releasePointerCapture(e.pointerId); } catch {} }

    dragRef.current = null;
    const wasActive = d.active;
    hideGhost();

    // Tap (no drag activated) → onBoardDown already set the selection. Nothing else to do.
    if (!wasActive) return;

    // Drag drop.
    recentDragRef.current = Date.now();
    const to = sqFromBoard(e.clientX, e.clientY);
    // Drop on origin (or off-board) → KEEP sel so click-to-move still works.
    if (!to || to === d.from) return;
    executeDrop(d.from, to, d.isPM);
  }, [executeDrop, hideGhost, sqFromBoard]);

  const onBoardCancel = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pid !== e.pointerId) return;
    if (d.active) {
      const { x, y } = ghostPosRef.current;
      const to = sqFromBoard(x, y);
      if (to && to !== d.from) { recentDragRef.current = Date.now(); executeDrop(d.from, to, d.isPM); }
    }
    dragRef.current = null;
    hideGhost();
  }, [executeDrop, hideGhost, sqFromBoard]);

  // ── Window safety net — ONLY for pointerup/cancel, in case capture was lost
  // (e.g., devtools paused, or user lifted finger outside window).
  useEffect(() => {
    const onWinUp = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pid !== e.pointerId) return;
      dragRef.current = null;
      const wasActive = d.active;
      hideGhost();
      if (!wasActive) return;
      recentDragRef.current = Date.now();
      const to = sqFromBoard(e.clientX, e.clientY);
      if (!to || to === d.from) return;
      executeDrop(d.from, to, d.isPM);
    };
    const onWinCancel = (_e: PointerEvent) => {
      if (!dragRef.current) return;
      dragRef.current = null;
      hideGhost();
    };
    window.addEventListener("pointerup", onWinUp);
    window.addEventListener("pointercancel", onWinCancel);
    return () => {
      window.removeEventListener("pointerup", onWinUp);
      window.removeEventListener("pointercancel", onWinCancel);
    };
  }, [executeDrop, hideGhost, sqFromBoard]);

  return {
    boardRef,
    ghostRef,
    ghostFrom,
    dragHover,
    ghostPosRef,
    ghostSizeRef,
    recentDragRef,
    bDownHandledRef,
    onBoardDown,
    onBoardMove,
    onBoardUp,
    onBoardCancel,
    sqFromBoard,
    RECENT_DRAG_GUARD_MS,
  };
}
