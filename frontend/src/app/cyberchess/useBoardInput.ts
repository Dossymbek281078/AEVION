"use client";
/**
 * useBoardInput v7 — chess board input: drag, click, premove, touch.
 *
 * Architecture:
 * - All pointer events go through THE BOARD'S OWN HANDLERS (onPointerDown/Move/Up/Cancel),
 *   not window listeners. We call setPointerCapture on pointerdown so events keep firing
 *   on the board element even when the pointer moves outside the board (per W3C spec).
 *   This is more reliable than window listeners under React/Next dev — no useEffect
 *   timing races, no double-mounted listeners, no stale-closure surprises.
 *
 * - onBoardDown is the only entry point for chess logic. It handles, in order:
 *   1. Scratch-board selection
 *   2. Priority-1: complete an existing selection (sel + vm.has(sq) → exec)
 *   3. Priority-2: complete an existing premove selection
 *   4. Deselect: tap same selected piece
 *   5. New selection: tap own piece → sel + vm dots; also arms drag tracking.
 *
 * - onBoardMove watches the active dragRef. When pointer travels >4px, drag activates
 *   and the ghost piece (rendered as a sibling of the board, position:fixed) starts
 *   following the cursor via RAF.
 *
 * - onBoardUp finishes the gesture: if drag was active → executeDrop on hover square;
 *   if not (it was just a press), we DO NOT execute on same square — that path is
 *   already handled by onBoardDown's priority-1 (the second tap of a tap→tap move).
 *   But cross-square swipes (press, release on different cell, no drag activation —
 *   rare, e.g., very fast taps) do execute.
 *
 * - onClick is a no-op for chess; it only clears arrow/highlight annotations and
 *   forwards to editor mode if active. Guarded by bDownHandledRef and recentDragRef.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Chess, type Square, type Color as ChessColor } from "chess.js";

const FILES = ["a","b","c","d","e","f","g","h"] as const;
// Higher threshold on touch — fingers naturally jitter on press.
// Mouse/pen are precise; touch needs a wider deadzone or every tap turns into a "drag".
const DRAG_THRESHOLD_MOUSE = 4;
const DRAG_THRESHOLD_TOUCH = 9;

type Pre = { from: Square; to: Square; pr?: "q"|"r"|"b"|"n" };

function premoveLegalMoves(virtualGame: Chess, pCol: ChessColor, from: Square): any[] {
  // Premove legality is computed in TWO passes so the user can also premove ONTO
  // their own pieces — this anticipates the opponent capturing those pieces.
  // (Lichess/Chess.com both allow this; if opponent doesn't capture, the premove
  // auto-cancels at exec time as illegal.)
  //
  // Pass 1: standard legal moves on virtualGame with our color forced to move.
  // Pass 2: clone virtualGame with EVERY own piece (except FROM) cleared off the
  //   board, so chess.js no longer blocks moves that would land on own squares.
  //   We merge the new TO squares from pass 2 onto pass 1 (only TOs that weren't
  //   already there). King moves from pass 2 are filtered to remove self-check
  //   (pass 1 already enforces that for all moves; pass 2 is just expanding TOs).
  try {
    const fen = virtualGame.fen();
    const g1 = new Chess(fen);
    {
      const fp = g1.fen().split(" "); fp[1] = pCol;
      try { g1.load(fp.join(" ")); } catch { return []; }
    }
    const piece = g1.get(from);
    if (!piece || piece.color !== pCol) return [];
    const pass1: any[] = g1.moves({ square: from, verbose: true });

    // Pass 2 — strip own pieces (except FROM) so chess.js sees those squares as empty.
    const g2 = new Chess(fen);
    {
      const fp = g2.fen().split(" "); fp[1] = pCol;
      try { g2.load(fp.join(" ")); } catch { return pass1; }
    }
    const board = g2.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = (FILES[c] + (8 - r)) as Square;
        const p = board[r][c];
        if (p && p.color === pCol && sq !== from) {
          try { g2.remove(sq); } catch {}
        }
      }
    }
    const pass2: any[] = g2.moves({ square: from, verbose: true });

    const have = new Set(pass1.map(m => m.to));
    for (const m of pass2) if (!have.has(m.to)) pass1.push(m);
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

type BRect = { l: number; t: number; cw: number; flip: boolean };
type DragState = { from: Square; sx: number; sy: number; pid: number; active: boolean; bRect: BRect; ptype: string };

export function useBoardInput(opts: BoardInputOptions) {
  const boardRef   = useRef<HTMLDivElement | null>(null);
  const ghostRef   = useRef<HTMLDivElement | null>(null);
  const dragRef    = useRef<DragState | null>(null);
  const recentDragRef  = useRef<number>(0);
  const ghostPosRef    = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const ghostRafRef    = useRef<number | null>(null);
  const dragHoverIntRef = useRef<Square | null>(null);
  // Signals to onClick that onBoardDown already handled this pointer event.
  const bDownHandledRef = useRef<number>(0);

  const [ghostFrom, setGhostFrom] = useState<Square | null>(null);
  const [dragHover, setDragHover] = useState<Square | null>(null);

  const optsRef = useRef(opts);
  optsRef.current = opts;

  // ── Hit-test ────────────────────────────────────────────────────────────
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
    return `${FILES[flip ? 7-fx : fx]}${(flip ? fy : 7-fy) + 1}` as Square;
  }, []);

  const sqFromRect = useCallback((x: number, y: number, b: BRect): Square | null => {
    const fx = Math.floor((x - b.l) / b.cw);
    const fy = Math.floor((y - b.t) / b.cw);
    if (fx < 0 || fx > 7 || fy < 0 || fy > 7) return null;
    return `${FILES[b.flip ? 7-fx : fx]}${(b.flip ? fy : 7-fy) + 1}` as Square;
  }, []);

  // ── Ghost helpers ────────────────────────────────────────────────────────
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
    const board = boardRef.current;
    if (board) board.dataset.dragFrom = from;
    if (typeof document !== "undefined") document.body.style.cursor = "grabbing";
  }, []);

  const hideGhost = useCallback(() => {
    if (ghostRafRef.current !== null) { cancelAnimationFrame(ghostRafRef.current); ghostRafRef.current = null; }
    setGhostFrom(null);
    setDragHover(null);
    dragHoverIntRef.current = null;
    const board = boardRef.current;
    if (board) { delete board.dataset.dragFrom; delete board.dataset.hoverSq; }
    if (typeof document !== "undefined") document.body.style.cursor = "";
  }, []);

  // ── Drop execution ───────────────────────────────────────────────────────
  const executeDrop = useCallback((from: Square, to: Square) => {
    const o = optsRef.current;
    // Scratch board
    if (o.scratchOn && o.scratchGame) {
      const moves = o.scratchGame.moves({ square: from, verbose: true });
      const matched = moves.find(m => m.to === to);
      if (matched) {
        try {
          const mv = o.scratchGame.move({ from, to, promotion: matched.promotion ? "q" : undefined });
          if (mv) {
            o.sScratchHist(h => [...h, mv.san]);
            o.sScratchLm({ from: mv.from, to: mv.to });
            o.sScratchSel(null); o.sScratchVm(new Set()); o.sScratchBk(k => k+1);
            o.snd(mv.captured ? "capture" : "move");
          }
        } catch {}
      } else { o.sScratchSel(null); o.sScratchVm(new Set()); }
      return;
    }
    // Premove
    if (o.tab !== "analysis" && o.game.turn() !== o.pCol && o.on && !o.over) {
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
    // Normal move
    const raw = o.game.moves({ square: from, verbose: true });
    const legal = (o.variant === "diceblade" && o.dicePieceType && o.filterMovesByDice)
      ? o.filterMovesByDice(raw, o.dicePieceType) : raw;
    const matched = legal.find((m: any) => m.to === to);
    if (matched) {
      const mp = o.game.get(from);
      if (mp?.type === "p" && (to[1] === "1" || to[1] === "8")) {
        if (o.autoQueen) o.exec(from, to, "q"); else o.sPromo({ from, to });
      } else { o.exec(from, to); }
    } else { o.sSel(null); o.sVm(new Set()); }
  }, []);

  // ── onBoardDown — all chess input logic lives here ───────────────────────
  const onBoardDown = useCallback((e: React.PointerEvent) => {
    // Ignore non-primary mouse buttons (right-click handled separately).
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const sq = sqFromBoard(e.clientX, e.clientY);
    if (!sq) return;
    const o = optsRef.current;

    const boardEl = boardRef.current;
    if (!boardEl) return;
    const br = boardEl.getBoundingClientRect();
    const bRect: BRect = { l: br.left, t: br.top, cw: br.width / 8, flip: o.flip };

    // Mark this pointer event as handled so onClick won't double-process.
    bDownHandledRef.current = Date.now();

    // ── SCRATCH BOARD ──────────────────────────────────────────────────────
    if (o.scratchOn && o.scratchGame) {
      const p = o.scratchGame.get(sq);
      if (!p || p.color !== o.scratchGame.turn()) {
        o.sScratchSel(null); o.sScratchVm(new Set());
        return;
      }
      e.preventDefault();
      dragRef.current = { from: sq, sx: e.clientX, sy: e.clientY, active: false, pid: e.pointerId, bRect, ptype: e.pointerType || "mouse" };
      try { boardEl.setPointerCapture(e.pointerId); } catch {}
      o.sScratchSel(sq);
      o.sScratchVm(new Set(o.scratchGame.moves({ square: sq, verbose: true }).map(m => m.to)));
      return;
    }

    const isPM = o.tab !== "analysis" && o.game.turn() !== o.pCol && o.on && !o.over;

    // ── NORMAL PLAY: priority checks ──────────────────────────────────────
    if (!o.over && !o.editorMode) {
      // Priority-1: complete existing move selection (tap→tap second tap).
      if (!isPM && o.sel && o.vm.has(sq)) {
        const f = o.sel;
        const mp = o.game.get(f);
        e.preventDefault();
        if (mp?.type === "p" && (sq[1] === "1" || sq[1] === "8")) {
          if (o.autoQueen) o.exec(f, sq, "q"); else o.sPromo({ from: f, to: sq });
        } else { o.exec(f, sq); }
        o.sSel(null); o.sVm(new Set());
        return;
      }

      // Priority-2: complete existing premove selection.
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
        o.sPmSel(null); o.sVm(new Set());
      }

      // Deselect: tap same selected piece.
      if (!isPM && o.sel === sq) {
        e.preventDefault();
        o.sSel(null); o.sVm(new Set());
        return;
      }
    }

    // ── DRAG / SELECTION START ─────────────────────────────────────────────
    const checkBoard = isPM ? o.virtualGame : o.game;
    const p = checkBoard.get(sq);
    const side = o.tab === "analysis" ? o.game.turn() : o.pCol;
    const canDrag = !!p && (o.tab === "analysis" || p.color === side) && !o.over;

    if (!canDrag) {
      // Tapped empty/opponent square — deselect any active selection.
      if (!o.editorMode && (o.sel || (isPM && o.pmSelRef.current))) {
        o.sSel(null); o.sVm(new Set()); o.sPmSel(null);
      }
      return;
    }

    e.preventDefault();
    dragRef.current = { from: sq, sx: e.clientX, sy: e.clientY, active: false, pid: e.pointerId, bRect, ptype: e.pointerType || "mouse" };
    try { boardEl.setPointerCapture(e.pointerId); } catch {}

    // Show selection + valid-move dots immediately (lichess-style: dots on press, not on release).
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

  // ── onBoardMove — drag tracking via board's own handler (setPointerCapture
  //    keeps events flowing even when pointer leaves the board element). ─────
  const onBoardMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pid !== e.pointerId) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    const threshold = d.ptype === "touch" ? DRAG_THRESHOLD_TOUCH : DRAG_THRESHOLD_MOUSE;
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
      const hover = sqFromRect(e.clientX, e.clientY, d.bRect);
      const target = hover && hover !== d.from ? hover : null;
      const board = boardRef.current;
      if (board) { if (target) board.dataset.hoverSq = target; else delete board.dataset.hoverSq; }
      if (target !== dragHoverIntRef.current) {
        dragHoverIntRef.current = target;
        setDragHover(target);
      }
    }
  }, [showGhost, flushGhostPos, sqFromRect]);

  const onBoardUp = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pid !== e.pointerId) return;
    const boardEl = boardRef.current;
    if (boardEl) { try { boardEl.releasePointerCapture(e.pointerId); } catch {} }
    dragRef.current = null;
    const wasActive = d.active;
    hideGhost();
    if (!wasActive) {
      // Press without drag — same-square is handled by onBoardDown's priority logic
      // (selection / deselect / tap-to-move). Cross-square no-drag releases are rare
      // (very fast taps that never trigger move events) — execute as a click-move.
      const sq = sqFromRect(e.clientX, e.clientY, d.bRect) || sqFromBoard(e.clientX, e.clientY);
      if (sq && sq !== d.from) {
        recentDragRef.current = Date.now();
        executeDrop(d.from, sq);
      }
      return;
    }
    recentDragRef.current = Date.now();
    const to = sqFromRect(e.clientX, e.clientY, d.bRect) || sqFromBoard(e.clientX, e.clientY);
    // Drop back on origin → keep the selection so the user can still tap-to-move.
    // Without this, every accidental jitter-drag ate the selection and forced a re-tap.
    if (!to || to === d.from) return;
    executeDrop(d.from, to);
  }, [executeDrop, hideGhost, sqFromBoard, sqFromRect]);

  const onBoardCancel = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pid !== e.pointerId) return;
    if (d.active) {
      const { x, y } = ghostPosRef.current;
      const to = sqFromRect(x, y, d.bRect) || sqFromBoard(x, y);
      if (to && to !== d.from) { recentDragRef.current = Date.now(); executeDrop(d.from, to); }
    }
    dragRef.current = null;
    hideGhost();
  }, [executeDrop, hideGhost, sqFromBoard, sqFromRect]);

  // ── Window listeners as a SAFETY NET ────────────────────────────────────
  // setPointerCapture should keep events on the board, but in some edge cases
  // (capture released by browser, fast lift outside, devtool pause) the board
  // never gets pointerup. Window listeners catch those leaks and clean up.
  useEffect(() => {
    const onWinUp = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pid !== e.pointerId) return;
      // Mimic onBoardUp behavior using the page-level event.
      dragRef.current = null;
      const wasActive = d.active;
      hideGhost();
      if (!wasActive) {
        const sq = sqFromRect(e.clientX, e.clientY, d.bRect) || sqFromBoard(e.clientX, e.clientY);
        if (sq && sq !== d.from) { recentDragRef.current = Date.now(); executeDrop(d.from, sq); }
        return;
      }
      recentDragRef.current = Date.now();
      const to = sqFromRect(e.clientX, e.clientY, d.bRect) || sqFromBoard(e.clientX, e.clientY);
      if (!to || to === d.from) return;
      executeDrop(d.from, to);
    };
    const onWinMove = (e: PointerEvent) => {
      // Forward move events too — covers the case where pointer capture was
      // implicitly released and board's own onPointerMove stops firing.
      const d = dragRef.current;
      if (!d || d.pid !== e.pointerId) return;
      const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
      const threshold = d.ptype === "touch" ? DRAG_THRESHOLD_TOUCH : DRAG_THRESHOLD_MOUSE;
      if (!d.active && Math.hypot(dx, dy) > threshold) {
        d.active = true;
        ghostPosRef.current = { x: e.clientX, y: e.clientY };
        showGhost(d.from, e.clientX, e.clientY);
      }
      if (d.active) {
        ghostPosRef.current = { x: e.clientX, y: e.clientY };
        if (ghostRafRef.current === null)
          ghostRafRef.current = requestAnimationFrame(flushGhostPos);
        const hover = sqFromRect(e.clientX, e.clientY, d.bRect);
        const target = hover && hover !== d.from ? hover : null;
        if (target !== dragHoverIntRef.current) {
          dragHoverIntRef.current = target;
          setDragHover(target);
        }
      }
    };
    const onWinCancel = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pid !== e.pointerId) return;
      dragRef.current = null;
      hideGhost();
    };
    window.addEventListener("pointermove", onWinMove, { passive: true });
    window.addEventListener("pointerup", onWinUp);
    window.addEventListener("pointercancel", onWinCancel);
    return () => {
      window.removeEventListener("pointermove", onWinMove);
      window.removeEventListener("pointerup", onWinUp);
      window.removeEventListener("pointercancel", onWinCancel);
    };
  }, [executeDrop, hideGhost, showGhost, flushGhostPos, sqFromBoard, sqFromRect]);

  return {
    boardRef,
    ghostRef,
    ghostFrom,
    dragHover,
    ghostPosRef,
    ghostSizeRef: { current: 0 } as React.MutableRefObject<number>,
    recentDragRef,
    bDownHandledRef,
    onBoardDown,
    onBoardMove,
    onBoardUp,
    onBoardCancel,
    sqFromBoard,
  };
}
