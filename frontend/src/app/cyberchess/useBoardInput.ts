"use client";
/**
 * useBoardInput v4 — chess board input system, complete rewrite.
 *
 * Goals (in order of importance):
 *   1. Drag-and-drop with mouse — piece physically follows cursor like
 *      lichess/chess.com.
 *   2. Click-to-move — fast, single-click commits a move when a piece is
 *      already selected.
 *   3. Touch / touchpad — same as mouse via Pointer Events (preventDefault
 *      on pointerdown suppresses pan-to-scroll).
 *   4. Premoves — when not your turn, drag or click queues a premove.
 *      Premove chain (multiple queued) supported.
 *   5. Keyboard navigation — arrows + Enter/Space (handled at page level).
 *
 * Key design decisions (learned from previous attempts):
 *   - Ghost element is created IMPERATIVELY via document.createElement and
 *     appended to document.body. NOT in React's render tree. This way, no
 *     React re-render can ever overwrite its inline style. Previous attempts
 *     with portaled JSX or React state for ghostFrom were broken because
 *     React reconciler reset visibility:hidden between renders.
 *   - Window listeners for pointermove/up — single source of truth, no
 *     double-fire from React synthetic delegation.
 *   - React synthetic onPointerDown ONLY for synchronous preventDefault
 *     (suppress HTML5 dragstart and touchpad pan).
 *   - State machine: dragRef holds {from, sx, sy, pid, active}. active=false
 *     until threshold crossed; then ghost appears and tracks cursor.
 *   - On pointerup: if !active → it was a click (no-op, selection set in
 *     pointerdown). If active → execute drop on target square.
 */

import { useCallback, useEffect, useRef } from "react";
import { Chess, type Square, type Color as ChessColor } from "chess.js";

const FILES = ["a","b","c","d","e","f","g","h"] as const;

type Pre = { from: Square; to: Square; pr?: "q"|"r"|"b"|"n" };

/** Legal premove moves: load virtual position, force user's color to move,
    return moves verbose for `from` square. Required because chess.js
    moves() only returns moves for the side currently on move. */
function premoveLegalMoves(virtualGame: Chess, pCol: ChessColor, from: Square): any[] {
  try {
    const g = new Chess(virtualGame.fen());
    const fp = g.fen().split(" ");
    fp[1] = pCol;
    // Reset en-passant + castling can be skipped — chess.js will accept them as-is.
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
  /** Returns inner HTML for the piece at `sq` sized to `sizePx`. */
  getPieceHtml: (sq: Square, sizePx: number) => string;
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

const GHOST_ID = "cc-ghost-v4";
const ACTIVATION_THRESHOLD_SQ = 9; // 3px squared

export function useBoardInput(opts: BoardInputOptions) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  // ghostRef is kept for backwards compat with the page; we DON'T render it
  // via React. Instead we create the element imperatively below and store
  // the reference here. Page can pass an empty placeholder div if it likes —
  // we'll detach and re-create regardless.
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const recentDragRef = useRef<number>(0);
  const ghostPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const ghostRafRef = useRef<number | null>(null);

  // optsRef stays current — assigned during render, before any window
  // listener can fire.
  const optsRef = useRef(opts);
  optsRef.current = opts;

  // ── Imperative ghost lifecycle ──────────────────────────────────────────
  useEffect(() => {
    // Reuse existing element if any (HMR survival).
    let el = document.getElementById(GHOST_ID) as HTMLDivElement | null;
    if (!el) {
      el = document.createElement("div");
      el.id = GHOST_ID;
      document.body.appendChild(el);
    }
    el.style.cssText = [
      "position:fixed",
      "left:0", "top:0",
      "width:0", "height:0",
      "transform:translate3d(-9999px,-9999px,0)",
      "pointer-events:none",
      "z-index:99999",
      "will-change:transform",
      "visibility:hidden",
      "filter:drop-shadow(0 12px 22px rgba(0,0,0,0.55)) drop-shadow(0 0 14px rgba(5,150,105,0.35))",
    ].join(";");
    el.innerHTML = "";
    ghostRef.current = el;
    return () => {
      // Don't remove — survives HMR. Real unmount is rare.
    };
  }, []);

  // ── Hit-test helpers ────────────────────────────────────────────────────
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

  // ── Ghost DOM mutations (pure imperative, NO React) ─────────────────────
  const showGhost = useCallback((from: Square, x: number, y: number, cw: number) => {
    const el = ghostRef.current;
    if (!el) return;
    const sz = Math.max(48, Math.round(cw * 1.15));
    el.style.width = `${sz}px`;
    el.style.height = `${sz}px`;
    el.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
    el.style.visibility = "visible";
    el.dataset.from = from;
    el.innerHTML = optsRef.current.getPieceHtml(from, sz);
    const board = boardRef.current;
    if (board) board.dataset.dragFrom = from;
    document.body.style.cursor = "grabbing";
  }, []);

  const flushGhostPos = useCallback(() => {
    ghostRafRef.current = null;
    const el = ghostRef.current;
    if (!el) return;
    const { x, y } = ghostPosRef.current;
    el.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
  }, []);

  const hideGhost = useCallback(() => {
    if (ghostRafRef.current !== null) {
      cancelAnimationFrame(ghostRafRef.current);
      ghostRafRef.current = null;
    }
    const el = ghostRef.current;
    if (el) {
      el.style.visibility = "hidden";
      el.style.transform = "translate3d(-9999px,-9999px,0)";
      el.innerHTML = "";
      delete el.dataset.from;
    }
    const board = boardRef.current;
    if (board) {
      delete board.dataset.dragFrom;
      delete board.dataset.hoverSq;
    }
    document.body.style.cursor = "";
  }, []);

  const setHover = useCallback((sq: Square | null) => {
    const board = boardRef.current;
    if (!board) return;
    if (sq) board.dataset.hoverSq = sq;
    else delete board.dataset.hoverSq;
  }, []);

  // ── Move execution ──────────────────────────────────────────────────────
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
    // Premove (not user's turn) — must be a legal move on the virtual board
    // with user's color forced on move.
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
    // Normal move
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

  // ── Window pointer listeners ────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pid !== e.pointerId) return;
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      // Activation threshold
      if (!d.active && (dx * dx + dy * dy) > ACTIVATION_THRESHOLD_SQ) {
        d.active = true;
        ghostPosRef.current = { x: e.clientX, y: e.clientY };
        showGhost(d.from, e.clientX, e.clientY, d.bRect.cw);
      }
      if (d.active) {
        e.preventDefault?.();
        ghostPosRef.current = { x: e.clientX, y: e.clientY };
        if (ghostRafRef.current === null) {
          ghostRafRef.current = requestAnimationFrame(flushGhostPos);
        }
        const hover = sqFromCachedRect(e.clientX, e.clientY, d.bRect);
        setHover(hover && hover !== d.from ? hover : null);
      }
    };

    const onUp = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pid !== e.pointerId) return;
      dragRef.current = null;
      const wasActive = d.active;
      hideGhost();

      if (!wasActive) {
        // Pure click: if released on a different square, run click() — covers
        // edge cases where pointerdown set selection but pointerup landed on
        // a different (also valid) square. Same-square click was already
        // handled in onPointerDown selection logic.
        const sq = sqFromCachedRect(e.clientX, e.clientY, d.bRect)
                || sqFromBoard(e.clientX, e.clientY);
        if (sq && sq !== d.from) optsRef.current.click(sq);
        return;
      }
      recentDragRef.current = Date.now();
      const to = sqFromCachedRect(e.clientX, e.clientY, d.bRect)
              || sqFromBoard(e.clientX, e.clientY);
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
      // Salvage: if drag was active and we have a valid landing, commit it.
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
  }, [executeDrop, flushGhostPos, hideGhost, setHover, showGhost, sqFromBoard, sqFromCachedRect]);

  // ── React-synthetic onPointerDown ────────────────────────────────────────
  // The ONLY synthetic handler we keep. Needed for synchronous
  // preventDefault() to suppress HTML5 dragstart and touchpad pan-to-scroll.
  const onBoardDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const sq = sqFromBoard(e.clientX, e.clientY);
    if (!sq) return;
    const o = optsRef.current;

    const boardEl = boardRef.current;
    if (!boardEl) return;
    const br = boardEl.getBoundingClientRect();
    const bRect: BRect = { l: br.left, t: br.top, cw: br.width / 8, flip: o.flip };

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
      // Priority 1: complete an existing selection — execute move now.
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
      // Priority 2: complete a premove selection — validate legality.
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
        // Illegal premove target — fall through to normal click handling.
        o.sPmSel(null);
        o.sVm(new Set());
      }
      // Tap same selected piece again → deselect.
      if (!isPM && o.sel === sq && !o.vm.has(sq)) {
        e.preventDefault();
        o.sSel(null);
        o.sVm(new Set());
        return;
      }
    }

    // Drag-start path.
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
        ? o.filterMovesByDice(all, o.dicePieceType)
        : all;
      o.sVm(new Set(filtered.map((m: any) => m.to)));
    } else if (o.on) {
      o.sPmSel(sq);
      // Use forced-turn helper — chess.js moves() returns nothing for the
      // wrong side. premoveLegalMoves loads virtual FEN with our color
      // forced on move, so dots reflect actual legal premove targets.
      const legal = premoveLegalMoves(o.virtualGame, o.pCol, sq);
      o.sVm(new Set(legal.map((m: any) => m.to)));
    }
  }, [sqFromBoard]);

  const noopHandler = useCallback((_e: React.PointerEvent) => {}, []);

  return {
    boardRef,
    ghostRef,
    // Legacy compat fields — not used anymore (ghost is imperative DOM):
    ghostPosRef,
    ghostSizeRef: { current: 0 } as React.MutableRefObject<number>,
    ghostFrom: null as Square | null,
    dragHover: null as Square | null,
    recentDragRef,
    onBoardDown,
    onBoardMove: noopHandler,
    onBoardUp: noopHandler,
    onBoardCancel: noopHandler,
    sqFromBoard,
  };
}
