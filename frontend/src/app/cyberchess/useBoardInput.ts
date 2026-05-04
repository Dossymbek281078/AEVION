"use client";
/**
 * useBoardInput v6 — chess board input: drag, click, premove, touch.
 *
 * Key design decisions:
 *
 * 1. Ghost element is rendered in React JSX (outside board div, sibling of board).
 *    ghostFrom = React state controls visibility.
 *    ghostRef = ref to the div; position updated via RAF (no re-renders per pixel).
 *
 * 2. onBoardDown handles ALL chess logic:
 *    - Priority-1: complete existing selection (exec move).
 *    - Priority-2: complete premove selection.
 *    - Deselect: tap same piece → deselect.
 *    - Deselect-invalid: tap non-vm non-own square → deselect.
 *    - New selection: tap own piece → sel + vm dots.
 *    - Drag-start: sets dragRef (same pointer-down also starts potential drag).
 *
 * 3. onClick does NOT call click(). It only clears annotation arrows/highlights.
 *    We export `bDownHandledRef` so onClick can check if onBoardDown just ran.
 *
 * 4. Window listeners track drag across the whole document (off-board drag works).
 *
 * 5. setPointerCapture on the board element keeps pointer events coming to the
 *    board even after the pointer leaves it, which is belt-and-suspenders with
 *    the window listeners.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Chess, type Square, type Color as ChessColor } from "chess.js";

const FILES = ["a","b","c","d","e","f","g","h"] as const;
const DRAG_THRESHOLD_PX = 4;

type Pre = { from: Square; to: Square; pr?: "q"|"r"|"b"|"n" };

function premoveLegalMoves(virtualGame: Chess, pCol: ChessColor, from: Square): any[] {
  try {
    const g = new Chess(virtualGame.fen());
    const fp = g.fen().split(" ");
    fp[1] = pCol;
    try { g.load(fp.join(" ")); } catch { return []; }
    return g.moves({ square: from, verbose: true });
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
type DragState = { from: Square; sx: number; sy: number; pid: number; active: boolean; bRect: BRect };

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

  // ── Window listeners (move/up/cancel track drag off-board) ───────────────
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pid !== e.pointerId) return;
      const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
      if (!d.active && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
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
    };
    const onUp = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pid !== e.pointerId) return;
      dragRef.current = null;
      const wasActive = d.active;
      hideGhost();
      if (!wasActive) {
        // Non-drag: cross-square swipe handled here (same-square is handled by onBoardDown)
        const sq = sqFromRect(e.clientX, e.clientY, d.bRect) || sqFromBoard(e.clientX, e.clientY);
        if (sq && sq !== d.from) {
          recentDragRef.current = Date.now();
          executeDrop(d.from, sq);
        }
        return;
      }
      recentDragRef.current = Date.now();
      const to = sqFromRect(e.clientX, e.clientY, d.bRect) || sqFromBoard(e.clientX, e.clientY);
      if (!to || to === d.from) { optsRef.current.sSel(null); optsRef.current.sVm(new Set()); return; }
      executeDrop(d.from, to);
    };
    const onCancel = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pid !== e.pointerId) return;
      if (d.active) {
        const { x, y } = ghostPosRef.current;
        const to = sqFromRect(x, y, d.bRect) || sqFromBoard(x, y);
        if (to && to !== d.from) { recentDragRef.current = Date.now(); executeDrop(d.from, to); }
      }
      dragRef.current = null;
      hideGhost();
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [executeDrop, flushGhostPos, hideGhost, showGhost, sqFromBoard, sqFromRect]);

  // ── onBoardDown — ALL chess input logic lives here ───────────────────────
  const onBoardDown = useCallback((e: React.PointerEvent) => {
    // Ignore non-primary mouse buttons (right-click, middle-click handled elsewhere)
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const sq = sqFromBoard(e.clientX, e.clientY);
    if (!sq) return;
    const o = optsRef.current;

    const boardEl = boardRef.current;
    if (!boardEl) return;
    const br = boardEl.getBoundingClientRect();
    const bRect: BRect = { l: br.left, t: br.top, cw: br.width / 8, flip: o.flip };

    // Mark that we handled this pointer event so onClick won't also run chess logic.
    bDownHandledRef.current = Date.now();

    // ── SCRATCH BOARD ──────────────────────────────────────────────────────
    if (o.scratchOn && o.scratchGame) {
      const p = o.scratchGame.get(sq);
      if (!p || p.color !== o.scratchGame.turn()) {
        // Click non-movable square in scratch → deselect
        o.sScratchSel(null); o.sScratchVm(new Set());
        return;
      }
      e.preventDefault();
      dragRef.current = { from: sq, sx: e.clientX, sy: e.clientY, active: false, pid: e.pointerId, bRect };
      try { boardEl.setPointerCapture(e.pointerId); } catch {}
      o.sScratchSel(sq);
      o.sScratchVm(new Set(o.scratchGame.moves({ square: sq, verbose: true }).map(m => m.to)));
      return;
    }

    const isPM = o.tab !== "analysis" && o.game.turn() !== o.pCol && o.on && !o.over;

    // ── NORMAL PLAY: priority checks ──────────────────────────────────────
    if (!o.over && !o.editorMode) {
      // Priority-1: complete existing move selection.
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

      // Priority-2: complete premove selection.
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
      // Clicked on empty/opponent square — deselect if we had a selection.
      if (!o.editorMode && (o.sel || isPM && o.pmSelRef.current)) {
        o.sSel(null); o.sVm(new Set()); o.sPmSel(null);
      }
      return;
    }

    e.preventDefault();
    dragRef.current = { from: sq, sx: e.clientX, sy: e.clientY, active: false, pid: e.pointerId, bRect };
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

  const noopHandler = useCallback((_e: React.PointerEvent) => {}, []);

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
    onBoardMove: noopHandler,
    onBoardUp:   noopHandler,
    onBoardCancel: noopHandler,
    sqFromBoard,
  };
}
