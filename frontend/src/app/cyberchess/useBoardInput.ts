"use client";
/**
 * useBoardInput v5 — chess board input system.
 *
 * Ghost rendering: React state `ghostFrom` → page renders <Piece> in JSX.
 * Position: ghostRef.current.style.transform via RAF (no re-renders per pixel).
 * Window listeners: pointermove/up/cancel tracked even off-board.
 * DragHover: React state updated only on square change (not per pixel).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Chess, type Square, type Color as ChessColor } from "chess.js";

const FILES = ["a","b","c","d","e","f","g","h"] as const;

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

interface BoardInputOptions {
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
  click: (sq: Square) => void;
  filterMovesByDice?: (moves: any[], pieceType: string) => any[];
}

type BRect = { l: number; t: number; cw: number; flip: boolean };

type DragState = {
  from: Square;
  sx: number;
  sy: number;
  pid: number;
  active: boolean;
  bRect: BRect;
};

const ACTIVATION_PX = 4; // pixels before ghost appears

export function useBoardInput(opts: BoardInputOptions) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const recentDragRef = useRef<number>(0);
  const ghostPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const ghostRafRef = useRef<number | null>(null);
  const dragHoverRefInternal = useRef<Square | null>(null);

  // Real React state — page renders ghost JSX and hover ring based on these.
  const [ghostFrom, setGhostFrom] = useState<Square | null>(null);
  const [dragHover, setDragHover] = useState<Square | null>(null);

  const optsRef = useRef(opts);
  optsRef.current = opts;

  // ── Hit-test helpers ──────────────────────────────────────────────────────
  const sqFromBoard = useCallback((x: number, y: number): Square | null => {
    const el = boardRef.current;
    if (!el) return null;
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

  const sqFromCachedRect = useCallback((x: number, y: number, b: BRect): Square | null => {
    const fx = Math.floor((x - b.l) / b.cw);
    const fy = Math.floor((y - b.t) / b.cw);
    if (fx < 0 || fx > 7 || fy < 0 || fy > 7) return null;
    const file = b.flip ? 7 - fx : fx;
    const rank = b.flip ? fy : 7 - fy;
    return `${FILES[file]}${rank + 1}` as Square;
  }, []);

  // ── Ghost helpers (React-state driven, position via ref) ──────────────────
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
    document.body.style.cursor = "grabbing";
  }, []);

  const hideGhost = useCallback(() => {
    if (ghostRafRef.current !== null) {
      cancelAnimationFrame(ghostRafRef.current);
      ghostRafRef.current = null;
    }
    setGhostFrom(null);
    setDragHover(null);
    dragHoverRefInternal.current = null;
    const board = boardRef.current;
    if (board) {
      delete board.dataset.dragFrom;
      delete board.dataset.hoverSq;
    }
    document.body.style.cursor = "";
  }, []);

  // ── Move execution ────────────────────────────────────────────────────────
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
            o.sScratchSel(null);
            o.sScratchVm(new Set());
            o.sScratchBk(k => k + 1);
            o.snd(mv.captured ? "capture" : "move");
          }
        } catch {}
      } else {
        o.sScratchSel(null);
        o.sScratchVm(new Set());
      }
      return;
    }
    if (o.tab !== "analysis" && o.game.turn() !== o.pCol && o.on && !o.over) {
      if (o.pmsRef.current.length >= o.pmLim) return;
      const piece = o.virtualGame.get(from);
      if (!piece || piece.color !== o.pCol) {
        o.sPmSel(null); o.sVm(new Set());
        return;
      }
      const legal = premoveLegalMoves(o.virtualGame, o.pCol, from);
      const matched = legal.find((m: any) => m.to === to);
      if (!matched) {
        o.sPmSel(null); o.sVm(new Set());
        return;
      }
      const pre: Pre = { from, to };
      const promoRank = o.pCol === "w" ? "8" : "1";
      if (piece.type === "p" && to[1] === promoRank) pre.pr = "q";
      o.sPms(v => [...v, pre]);
      o.sPmSel(null);
      o.sVm(new Set());
      o.snd("premove");
      return;
    }
    const rawLegal = o.game.moves({ square: from, verbose: true });
    const legal = (o.variant === "diceblade" && o.dicePieceType && o.filterMovesByDice)
      ? o.filterMovesByDice(rawLegal, o.dicePieceType)
      : rawLegal;
    const matched = legal.find((m: any) => m.to === to);
    if (matched) {
      const mp = o.game.get(from);
      if (mp?.type === "p" && (to[1] === "1" || to[1] === "8")) {
        if (o.autoQueen) o.exec(from, to, "q");
        else o.sPromo({ from, to });
      } else {
        o.exec(from, to);
      }
    } else {
      o.sSel(null);
      o.sVm(new Set());
    }
  }, []);

  // ── Window pointer listeners ──────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pid !== e.pointerId) return;
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      if (!d.active && Math.hypot(dx, dy) > ACTIVATION_PX) {
        d.active = true;
        ghostPosRef.current = { x: e.clientX, y: e.clientY };
        showGhost(d.from, e.clientX, e.clientY);
      }
      if (d.active) {
        e.preventDefault?.();
        ghostPosRef.current = { x: e.clientX, y: e.clientY };
        if (ghostRafRef.current === null) {
          ghostRafRef.current = requestAnimationFrame(flushGhostPos);
        }
        const hover = sqFromCachedRect(e.clientX, e.clientY, d.bRect);
        const target = hover && hover !== d.from ? hover : null;
        // update CSS data-attr for CSS-based hover ring
        const board = boardRef.current;
        if (board) {
          if (target) board.dataset.hoverSq = target;
          else delete board.dataset.hoverSq;
        }
        // update React state only on square boundary (not per pixel)
        if (target !== dragHoverRefInternal.current) {
          dragHoverRefInternal.current = target;
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
        // For non-drag clicks: the board div's onClick handler fires ~10ms later
        // and will call click(sq) itself. Calling it here too would double-execute.
        // Exception: if the pointer moved to a DIFFERENT square between down and up
        // (fast swipe without crossing the drag threshold), we handle it here and
        // set recentDragRef so onClick ignores it.
        const sq = sqFromCachedRect(e.clientX, e.clientY, d.bRect) || sqFromBoard(e.clientX, e.clientY);
        if (sq && sq !== d.from) {
          recentDragRef.current = Date.now();
          optsRef.current.click(sq);
        }
        return;
      }
      recentDragRef.current = Date.now();
      const to = sqFromCachedRect(e.clientX, e.clientY, d.bRect) || sqFromBoard(e.clientX, e.clientY);
      if (!to || to === d.from) {
        optsRef.current.sSel(null);
        optsRef.current.sVm(new Set());
        return;
      }
      executeDrop(d.from, to);
    };

    const onCancel = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pid !== e.pointerId) return;
      if (d.active) {
        const { x, y } = ghostPosRef.current;
        const to = sqFromCachedRect(x, y, d.bRect) || sqFromBoard(x, y);
        if (to && to !== d.from) {
          recentDragRef.current = Date.now();
          executeDrop(d.from, to);
        }
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
  }, [executeDrop, flushGhostPos, hideGhost, showGhost, sqFromBoard, sqFromCachedRect]);

  // ── onPointerDown (synthetic — only for synchronous preventDefault) ───────
  const onBoardDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const sq = sqFromBoard(e.clientX, e.clientY);
    if (!sq) return;
    const o = optsRef.current;

    const boardEl = boardRef.current;
    if (!boardEl) return;
    const br = boardEl.getBoundingClientRect();
    const bRect: BRect = { l: br.left, t: br.top, cw: br.width / 8, flip: o.flip };

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
      if (!isPM && o.sel && o.vm.has(sq)) {
        const f = o.sel;
        const mp = o.game.get(f);
        e.preventDefault();
        if (mp?.type === "p" && (sq[1] === "1" || sq[1] === "8")) {
          if (o.autoQueen) o.exec(f, sq, "q");
          else o.sPromo({ from: f, to: sq });
        } else {
          o.exec(f, sq);
        }
        o.sSel(null);
        o.sVm(new Set());
        return;
      }
      if (isPM && o.pmSelRef.current && sq !== o.pmSelRef.current && o.pmsRef.current.length < o.pmLim) {
        const f = o.pmSelRef.current;
        const piece = o.virtualGame.get(f);
        if (piece && piece.color === o.pCol) {
          const legal = premoveLegalMoves(o.virtualGame, o.pCol, f);
          const matched = legal.find((m: any) => m.to === sq);
          if (matched) {
            const pre: Pre = { from: f, to: sq };
            const pr = o.pCol === "w" ? "8" : "1";
            if (piece.type === "p" && sq[1] === pr) pre.pr = "q";
            e.preventDefault();
            o.sPms(v => [...v, pre]);
            o.sPmSel(null);
            o.sVm(new Set());
            o.snd("premove");
            return;
          }
        }
        o.sPmSel(null);
        o.sVm(new Set());
      }
      if (!isPM && o.sel === sq && !o.vm.has(sq)) {
        e.preventDefault();
        o.sSel(null);
        o.sVm(new Set());
        return;
      }
    }

    const checkBoard = isPM ? o.virtualGame : o.game;
    const p = checkBoard.get(sq);
    const side = o.tab === "analysis" ? o.game.turn() : o.pCol;
    const canDrag = !!p && (o.tab === "analysis" ? true : p.color === side) && !o.over;
    if (!canDrag) return;

    e.preventDefault();
    dragRef.current = { from: sq, sx: e.clientX, sy: e.clientY, active: false, pid: e.pointerId, bRect };

    const isMyTurn = o.tab === "analysis" || o.game.turn() === o.pCol;
    if (isMyTurn) {
      o.sSel(sq);
      const all = o.game.moves({ square: sq, verbose: true });
      const filtered = (o.variant === "diceblade" && o.dicePieceType && o.filterMovesByDice)
        ? o.filterMovesByDice(all, o.dicePieceType)
        : all;
      o.sVm(new Set(filtered.map((m: any) => m.to)));
    } else if (o.on) {
      o.sPmSel(sq);
      const legal = premoveLegalMoves(o.virtualGame, o.pCol, sq);
      o.sVm(new Set(legal.map((m: any) => m.to)));
    }
  }, [sqFromBoard]);

  const noopHandler = useCallback((_e: React.PointerEvent) => {}, []);

  return {
    boardRef,
    ghostRef,
    ghostFrom,       // real React state — page renders ghost JSX when non-null
    dragHover,       // real React state — page renders hover ring when non-null
    ghostPosRef,
    ghostSizeRef: { current: 0 } as React.MutableRefObject<number>,
    recentDragRef,
    onBoardDown,
    onBoardMove: noopHandler,
    onBoardUp: noopHandler,
    onBoardCancel: noopHandler,
    sqFromBoard,
  };
}
