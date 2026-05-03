"use client";
/**
 * useBoardInput v2 — bulletproof drag/click/premove for chess board.
 *
 * Design rules (learned the hard way):
 *  1. ONLY window listeners for pointermove/pointerup. No React synthetic
 *     handlers for those — React 19 + Turbopack delegation can fire them in
 *     the wrong order vs window listeners and double-process events.
 *  2. React synthetic ONLY for pointerdown (to call e.preventDefault on the
 *     synthetic event for HTML5 drag suppression).
 *  3. Ghost is rendered always with visibility hidden when idle (no
 *     conditional mount race where ghostRef is null on first frame).
 *  4. Ghost position uses translate3d direct DOM mutation (no React render
 *     during drag).
 *  5. No setPointerCapture — window listeners catch the pointer regardless
 *     of where it goes.
 *  6. Direct getBoundingClientRect math — never elementsFromPoint (broken
 *     on Windows/Chrome with overlapping elements).
 *  7. Click vs drag: pointerdown sets selection. pointerup with no movement
 *     calls click() ONLY if released square ≠ pressed square (avoids
 *     select-then-deselect flicker).
 *  8. e.preventDefault() inside onPointerDown synthetic handler suppresses
 *     HTML5 dragstart and browser pan-to-scroll on touchpads.
 */

import { useCallback, useEffect, useRef, useState } from "react";
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
}

type DragState = {
  from: Square;
  sx: number; sy: number;
  active: boolean;
  pid: number;
  // cached at pointerdown — avoids layout reads on every move
  bRect: { l:number; t:number; cw:number; flip:boolean };
};

export function useBoardInput(opts: BoardInputOptions) {
  const boardRef = useRef<HTMLDivElement|null>(null);
  const ghostRef = useRef<HTMLDivElement|null>(null);
  const ghostPosRef = useRef<{x:number;y:number}>({x:0,y:0});
  const ghostSizeRef = useRef<number>(72);
  const ghostRafRef = useRef<number|null>(null);
  const dragRef = useRef<DragState|null>(null);
  const dragHoverRef = useRef<Square|null>(null);
  const recentDragRef = useRef<number>(0);

  const [ghostFrom, sGhostFrom] = useState<Square|null>(null);
  const [dragHover, sDragHover] = useState<Square|null>(null);

  // optsRef stays in sync with the latest props every render — so window
  // listeners always see fresh state without re-attaching.
  const optsRef = useRef(opts);
  optsRef.current = opts;

  // ── Hit-test helpers (math-only, no DOM traversal) ─────────────────────────
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

  // ── Ghost positioning (RAF-throttled, direct DOM) ─────────────────────────
  const flushGhost = useCallback(() => {
    ghostRafRef.current = null;
    const el = ghostRef.current; if (!el) return;
    const { x, y } = ghostPosRef.current;
    el.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
  }, []);
  const cancelGhostRaf = useCallback(() => {
    if (ghostRafRef.current !== null) {
      cancelAnimationFrame(ghostRafRef.current);
      ghostRafRef.current = null;
    }
  }, []);

  // ── Drop execution (called from window pointerup when drag was active) ────
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
            o.sScratchSel(null); o.sScratchVm(new Set()); o.sScratchBk(k => k + 1);
            o.snd(mv.captured ? "capture" : "move");
          }
        } catch {}
      } else { o.sScratchSel(null); o.sScratchVm(new Set()); }
      return;
    }
    // Premove (not our turn)
    if (o.tab !== "analysis" && o.game.turn() !== o.pCol && o.on && !o.over) {
      if (o.pmsRef.current.length >= o.pmLim) return;
      const p = o.virtualGame.get(from) || o.game.get(from);
      const pre: Pre = { from, to };
      const promoRank = o.pCol === "w" ? "8" : "1";
      if (p?.type === "p" && to[1] === promoRank) pre.pr = "q";
      o.sPms(v => [...v, pre]); o.sPmSel(null); o.sVm(new Set()); o.snd("premove");
      return;
    }
    // Normal move (with optional dice filter)
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

  // ── Window listeners (single source of truth for move/up) ─────────────────
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pid !== e.pointerId) return;
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      // Activation threshold: 3px — just enough to differentiate click from drag.
      if (!d.active && (dx*dx + dy*dy) > 9) {
        d.active = true;
        ghostPosRef.current = { x: e.clientX, y: e.clientY };
        ghostSizeRef.current = Math.max(48, Math.round(d.bRect.cw * 1.15));
        sGhostFrom(d.from);
        document.body.style.cursor = "grabbing";
      }
      if (d.active) {
        ghostPosRef.current = { x: e.clientX, y: e.clientY };
        if (ghostRafRef.current === null) {
          ghostRafRef.current = requestAnimationFrame(flushGhost);
        }
        const hover = sqFromCachedRect(e.clientX, e.clientY, d.bRect);
        const target = hover && hover !== d.from ? hover : null;
        if (target !== dragHoverRef.current) {
          dragHoverRef.current = target;
          sDragHover(target);
        }
      }
    };

    const onUp = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pid !== e.pointerId) return;
      dragRef.current = null;

      cancelGhostRaf(); sGhostFrom(null);
      if (dragHoverRef.current !== null) { dragHoverRef.current = null; sDragHover(null); }
      document.body.style.cursor = "";

      if (!d.active) {
        // Pure click (no drag): if released on a different square, run click()
        // logic. If same square, selection was already set in pointerdown.
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
      // Salvage: if drag was active and we have a valid target, commit it.
      if (d.active) {
        const { x, y } = ghostPosRef.current;
        const to = sqFromCachedRect(x, y, d.bRect) || sqFromBoard(x, y);
        if (to && to !== d.from) {
          recentDragRef.current = Date.now();
          executeDrop(d.from, to);
        }
      }
      dragRef.current = null;
      cancelGhostRaf(); sGhostFrom(null);
      if (dragHoverRef.current !== null) { dragHoverRef.current = null; sDragHover(null); }
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
  }, [executeDrop, flushGhost, cancelGhostRaf, sqFromBoard, sqFromCachedRect]);

  // ── onPointerDown — ONLY React synthetic handler we use. ─────────────────
  // We need it on the synthetic event so e.preventDefault() suppresses
  // HTML5 dragstart and browser pan-to-scroll on touchpads BEFORE the
  // browser starts those gestures.
  const onBoardDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return; // ignore right-click; allow touch/pen
    const sq = sqFromBoard(e.clientX, e.clientY);
    if (!sq) return;
    const o = optsRef.current;

    // Compute board rect immediately — we need it for cached hit-tests.
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

    // Priority 1: complete an existing selection on click — execute move now.
    if (!o.over && !o.editorMode) {
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
      // Priority 2: complete a premove selection.
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

    // Drag start path — must have a piece of correct color (or any piece in analysis).
    const checkBoard = isPM ? o.virtualGame : o.game;
    const p = checkBoard.get(sq);
    const side = o.tab === "analysis" ? o.game.turn() : o.pCol;
    const canDrag = !!p && (o.tab === "analysis" ? true : p.color === side) && !o.over;
    if (!canDrag) {
      // Tapped empty / opponent's piece without a selection — nothing to do.
      // Don't preventDefault so right-click handlers / annotations still work.
      return;
    }

    // Suppress browser default behaviours BEFORE they kick in.
    e.preventDefault();
    dragRef.current = { from: sq, sx: e.clientX, sy: e.clientY, active: false, pid: e.pointerId, bRect };
    ghostSizeRef.current = Math.max(48, Math.round(bRect.cw * 1.15));

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

  // No React synthetic move/up/cancel — window listeners handle everything.
  // Provide no-op stubs for backwards compat with JSX bindings.
  const noopHandler = useCallback((_e: React.PointerEvent) => {}, []);

  return {
    boardRef, ghostRef, ghostPosRef, ghostSizeRef,
    ghostFrom, dragHover, recentDragRef,
    onBoardDown,
    onBoardMove: noopHandler,
    onBoardUp: noopHandler,
    onBoardCancel: noopHandler,
    sqFromBoard,
  };
}
