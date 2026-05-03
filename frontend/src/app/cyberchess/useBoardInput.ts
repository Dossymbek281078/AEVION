"use client";
/**
 * useBoardInput v3 — DOM-imperative drag, no React state in the hot path.
 *
 * Why: React 19 + non-React event handlers (window listeners) had a quirk
 * where state updates from inside the listener didn't always propagate.
 * Ghost was positioned via direct DOM (worked) but ghostFrom React state
 * stayed null, leaving the ghost div with visibility:hidden.
 *
 * Solution: ghost element is mutated DIRECTLY via the ghostRef:
 *   - visibility:visible/hidden
 *   - innerHTML = piece SVG
 *   - transform via translate3d
 * No React render needed for any drag step. State updates that DO happen
 * (sSel, sVm, sPmSel, sPms, exec) are still going through React because
 * those drive the board re-render, which is fine — they happen outside
 * the per-frame hot path.
 *
 * Drag-hover indicator (the green ring around the hover square) also uses
 * direct DOM via dataset attribute on the board element + a child overlay
 * styled by CSS — no React state needed.
 */

import { useCallback, useEffect, useRef } from "react";
import { Chess, type Square, type Color as ChessColor } from "chess.js";

const FILES = ["a","b","c","d","e","f","g","h"];

type Pre = {from:Square;to:Square;pr?:"q"|"r"|"b"|"n"};

interface BoardInputOptions {
  game: Chess;
  virtualGame: Chess;
  pCol: ChessColor;
  on: boolean;
  over: string|null;
  flip: boolean;
  tab: string;
  sel: Square|null;
  vm: Set<string>;
  pms: Pre[];
  pmSel: Square|null;
  pmLim: number;
  pmsRef: React.MutableRefObject<Pre[]>;
  pmSelRef: React.MutableRefObject<Square|null>;
  scratchOn: boolean;
  scratchGame: Chess|null;
  autoQueen: boolean;
  hotseat: boolean;
  variant: string;
  dicePieceType: string|null;
  editorMode: boolean;
  exec: (from:Square,to:Square,pr?:"q"|"r"|"b"|"n")=>void;
  sSel: (sq:Square|null)=>void;
  sVm: (v:Set<string>)=>void;
  sPms: (fn:(v:Pre[])=>Pre[])=>void;
  sPmSel: (sq:Square|null)=>void;
  sPromo: (p:{from:Square;to:Square}|null)=>void;
  sScratchSel: (sq:Square|null)=>void;
  sScratchVm: (v:Set<string>)=>void;
  sScratchBk: (fn:(k:number)=>number)=>void;
  sScratchHist: (fn:(h:string[])=>string[])=>void;
  sScratchLm: (v:{from:string;to:string}|null)=>void;
  snd: (name:string)=>void;
  click: (sq:Square)=>void;
  filterMovesByDice?: (moves:any[],pieceType:string)=>any[];
  /** Callback that returns the inner HTML for the ghost piece at `sq`.
      Page provides this by looking up the piece on the (virtual) board
      and calling pieceHtml(type, color, activePieceSet, sizePx). */
  getPieceHtml: (sq: Square, sizePx: number) => string;
}

type DragState = {
  from: Square;
  sx: number; sy: number;
  active: boolean;
  pid: number;
  bRect: { l:number; t:number; cw:number; flip:boolean };
};

export function useBoardInput(opts: BoardInputOptions) {
  const boardRef = useRef<HTMLDivElement|null>(null);
  const ghostRef = useRef<HTMLDivElement|null>(null);
  const dragRef = useRef<DragState|null>(null);
  const recentDragRef = useRef<number>(0);
  const ghostRafRef = useRef<number|null>(null);
  const ghostPosRef = useRef<{x:number;y:number}>({x:0,y:0});

  // Always-fresh opts via render-time assignment.
  const optsRef = useRef(opts);
  optsRef.current = opts;

  // ── Hit-test helpers ──────────────────────────────────────────────────────
  const sqFromBoard = useCallback((x:number, y:number): Square|null => {
    const el = boardRef.current; if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0) return null;
    const cw = r.width / 8;
    const fx = Math.floor((x - r.left) / cw);
    const fy = Math.floor((y - r.top) / cw);
    if (fx < 0 || fx > 7 || fy < 0 || fy > 7) return null;
    const flip = optsRef.current.flip;
    const file = flip ? 7 - fx : fx;
    const rank = flip ? fy : 7 - fy;
    return `${FILES[file]}${rank + 1}` as Square;
  }, []);

  const sqFromCachedRect = useCallback((x:number, y:number, b: DragState["bRect"]): Square|null => {
    const fx = Math.floor((x - b.l) / b.cw);
    const fy = Math.floor((y - b.t) / b.cw);
    if (fx < 0 || fx > 7 || fy < 0 || fy > 7) return null;
    const file = b.flip ? 7 - fx : fx;
    const rank = b.flip ? fy : 7 - fy;
    return `${FILES[file]}${rank + 1}` as Square;
  }, []);

  // ── Ghost DOM mutation helpers ────────────────────────────────────────────
  const showGhost = useCallback((from: Square, x: number, y: number, cw: number) => {
    const el = ghostRef.current; if (!el) return;
    const sz = Math.max(48, Math.round(cw * 1.15));
    el.style.width = `${sz}px`;
    el.style.height = `${sz}px`;
    el.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
    el.style.visibility = "visible";
    el.dataset.from = from;
    el.innerHTML = optsRef.current.getPieceHtml(from, sz);
    // Mark board so CSS fades the source-square piece (via [data-drag-from]).
    const board = boardRef.current;
    if (board) board.dataset.dragFrom = from;
  }, []);

  const flushGhostPos = useCallback(() => {
    ghostRafRef.current = null;
    const el = ghostRef.current; if (!el) return;
    const { x, y } = ghostPosRef.current;
    el.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
  }, []);

  const hideGhost = useCallback(() => {
    if (ghostRafRef.current !== null) { cancelAnimationFrame(ghostRafRef.current); ghostRafRef.current = null; }
    const el = ghostRef.current;
    if (el) {
      el.style.visibility = "hidden";
      el.innerHTML = "";
      delete el.dataset.from;
    }
    const board = boardRef.current;
    if (board) {
      delete board.dataset.dragFrom;
      delete board.dataset.hoverSq;
    }
  }, []);

  const setHover = useCallback((sq: Square|null) => {
    const board = boardRef.current; if (!board) return;
    if (sq) board.dataset.hoverSq = sq;
    else delete board.dataset.hoverSq;
  }, []);

  // ── Drop execution ────────────────────────────────────────────────────────
  const executeDrop = useCallback((from: Square, to: Square) => {
    const o = optsRef.current;
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
    if (o.tab !== "analysis" && o.game.turn() !== o.pCol && o.on && !o.over) {
      if (o.pmsRef.current.length >= o.pmLim) return;
      const p = o.virtualGame.get(from) || o.game.get(from);
      const pre: Pre = { from, to };
      const promoRank = o.pCol === "w" ? "8" : "1";
      if (p?.type === "p" && to[1] === promoRank) pre.pr = "q";
      o.sPms(v => [...v, pre]); o.sPmSel(null); o.sVm(new Set()); o.snd("premove");
      return;
    }
    const rawLegal = o.game.moves({ square: from, verbose: true });
    const legal = (o.variant === "diceblade" && o.dicePieceType && o.filterMovesByDice)
      ? o.filterMovesByDice(rawLegal, o.dicePieceType)
      : rawLegal;
    const matched = legal.find((m:any) => m.to === to);
    if (matched) {
      const mp = o.game.get(from);
      if (mp?.type === "p" && (to[1] === "1" || to[1] === "8")) {
        if (o.autoQueen) o.exec(from, to, "q");
        else o.sPromo({ from, to });
      } else {
        o.exec(from, to);
      }
    } else {
      o.sSel(null); o.sVm(new Set());
    }
  }, []);

  // ── Window listeners (single source of truth) ─────────────────────────────
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pid !== e.pointerId) return;
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      // Activation threshold: ~3px squared = 9
      if (!d.active && (dx*dx + dy*dy) > 9) {
        d.active = true;
        ghostPosRef.current = { x: e.clientX, y: e.clientY };
        showGhost(d.from, e.clientX, e.clientY, d.bRect.cw);
        document.body.style.cursor = "grabbing";
      }
      if (d.active) {
        e.preventDefault?.();
        ghostPosRef.current = { x: e.clientX, y: e.clientY };
        if (ghostRafRef.current === null) {
          ghostRafRef.current = requestAnimationFrame(flushGhostPos);
        }
        const hover = sqFromCachedRect(e.clientX, e.clientY, d.bRect);
        const target = hover && hover !== d.from ? hover : null;
        setHover(target);
      }
    };

    const onUp = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pid !== e.pointerId) return;
      dragRef.current = null;
      const wasActive = d.active;
      hideGhost(); setHover(null);
      document.body.style.cursor = "";

      if (!wasActive) {
        // Pure click: if released on a different square, run click().
        const sq = sqFromCachedRect(e.clientX, e.clientY, d.bRect)
                || sqFromBoard(e.clientX, e.clientY);
        if (sq && sq !== d.from) optsRef.current.click(sq);
        return;
      }
      recentDragRef.current = Date.now();
      const to = sqFromCachedRect(e.clientX, e.clientY, d.bRect)
              || sqFromBoard(e.clientX, e.clientY);
      if (!to || to === d.from) {
        optsRef.current.sSel(null); optsRef.current.sVm(new Set());
        return;
      }
      executeDrop(d.from, to);
    };

    const onCancel = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pid !== e.pointerId) return;
      // Salvage drop if drag was active.
      if (d.active) {
        const { x, y } = ghostPosRef.current;
        const to = sqFromCachedRect(x, y, d.bRect) || sqFromBoard(x, y);
        if (to && to !== d.from) {
          recentDragRef.current = Date.now();
          executeDrop(d.from, to);
        }
      }
      dragRef.current = null;
      hideGhost(); setHover(null);
      document.body.style.cursor = "";
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [executeDrop, flushGhostPos, hideGhost, setHover, showGhost, sqFromBoard, sqFromCachedRect]);

  // ── React-synthetic onPointerDown — only synthetic handler we keep.
  // We need it for synchronous e.preventDefault() to suppress HTML5 dragstart
  // and touchpad pan-to-scroll BEFORE the browser commits to those gestures.
  const onBoardDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const sq = sqFromBoard(e.clientX, e.clientY);
    if (!sq) return;
    const o = optsRef.current;

    const boardEl = boardRef.current;
    if (!boardEl) return;
    const br = boardEl.getBoundingClientRect();
    const bRect = { l: br.left, t: br.top, cw: br.width / 8, flip: o.flip };

    // Scratch board mode
    if (o.scratchOn && o.scratchGame) {
      const p = o.scratchGame.get(sq);
      if (!p || p.color !== o.scratchGame.turn()) return;
      e.preventDefault();
      dragRef.current = { from: sq, sx: e.clientX, sy: e.clientY, active: false, pid: e.pointerId, bRect };
      o.sScratchSel(sq);
      o.sScratchVm(new Set(o.scratchGame.moves({ square: sq, verbose: true }).map(m => m.to)));
      return;
    }

    const isPM = o.tab !== "analysis" && o.game.turn() !== o.pCol && o.on && !o.over;

    if (!o.over && !o.editorMode) {
      // Priority 1: complete an existing selection on click.
      if (!isPM && o.sel && o.vm.has(sq)) {
        const f = o.sel;
        const mp = o.game.get(f);
        e.preventDefault();
        if (mp?.type === "p" && (sq[1] === "1" || sq[1] === "8")) {
          if (o.autoQueen) o.exec(f, sq, "q");
          else o.sPromo({ from: f, to: sq });
        } else o.exec(f, sq);
        o.sSel(null); o.sVm(new Set());
        return;
      }
      // Priority 2: complete a premove selection on click.
      if (isPM && o.pmSelRef.current && sq !== o.pmSelRef.current && o.pmsRef.current.length < o.pmLim) {
        const f = o.pmSelRef.current;
        const vp = o.virtualGame.get(f) || o.game.get(f);
        const pre: Pre = { from: f, to: sq };
        const pr = o.pCol === "w" ? "8" : "1";
        if (vp?.type === "p" && sq[1] === pr) pre.pr = "q";
        e.preventDefault();
        o.sPms(v => [...v, pre]);
        o.sPmSel(null); o.sVm(new Set()); o.snd("premove");
        return;
      }
      // Tap same selected piece again → deselect.
      if (!isPM && o.sel === sq && !o.vm.has(sq)) {
        e.preventDefault();
        o.sSel(null); o.sVm(new Set());
        return;
      }
    }

    // Drag candidate? Must have own piece (or any piece in analysis).
    const checkBoard = isPM ? o.virtualGame : o.game;
    const p = checkBoard.get(sq);
    const side = o.tab === "analysis" ? o.game.turn() : o.pCol;
    const canDrag = !!p && (o.tab === "analysis" ? true : p.color === side) && !o.over;
    if (!canDrag) return;

    // Suppress browser default behaviours BEFORE they kick in.
    e.preventDefault();
    dragRef.current = { from: sq, sx: e.clientX, sy: e.clientY, active: false, pid: e.pointerId, bRect };

    // Show selection + valid move dots immediately on press.
    const isMyTurn = o.tab === "analysis" || o.game.turn() === o.pCol;
    if (isMyTurn) {
      o.sSel(sq);
      const all = o.game.moves({ square: sq, verbose: true });
      const filtered = (o.variant === "diceblade" && o.dicePieceType && o.filterMovesByDice)
        ? o.filterMovesByDice(all, o.dicePieceType) : all;
      o.sVm(new Set(filtered.map((m:any) => m.to)));
    } else if (o.on) {
      o.sPmSel(sq);
      try { o.sVm(new Set(o.virtualGame.moves({ square: sq, verbose: true }).map(m => m.to))); } catch {}
    }
  }, [sqFromBoard]);

  const noopHandler = useCallback((_e: React.PointerEvent) => {}, []);

  return {
    boardRef, ghostRef,
    // Legacy compat (not needed now — ghost is DOM-managed):
    ghostPosRef,
    ghostSizeRef: { current: 0 } as React.MutableRefObject<number>,
    ghostFrom: null as Square|null,
    dragHover: null as Square|null,
    recentDragRef,
    onBoardDown,
    onBoardMove: noopHandler,
    onBoardUp: noopHandler,
    onBoardCancel: noopHandler,
    sqFromBoard,
  };
}
