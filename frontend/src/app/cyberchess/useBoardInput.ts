"use client";
/**
 * useBoardInput v9 — restoration of the proven v5 architecture
 * (window pointer listeners + delegate click logic to page's `click`),
 * with ONLY the additive premove improvements layered on top:
 *   - premoveLegalMoves: per-square removal with king preserved (rescue).
 *   - virtualGame still does rescue projection in page.tsx.
 *
 * Why we are back here: every variant since (v6/v7/v8) tried to inline the
 * click logic into onBoardDown and chase setPointerCapture / native fallback.
 * Each variant broke something the user could feel. v5 worked. Keep v5.
 *
 * Wiring in page.tsx:
 *   <div ref={boardRef}
 *        onPointerDown={onBoardDown}        ← only synchronous preventDefault
 *        ...>
 *
 * Drag/click flow:
 *   - onBoardDown captures the press: sets dragRef, draws sel + vm dots.
 *   - WINDOW pointermove tracks: once distance > threshold, ghost shows and
 *     follows the cursor via RAF.
 *   - WINDOW pointerup: if drag activated, executeDrop. If not, treat as a
 *     tap — call opts.click(sq) for the OTHER square (the page's click()
 *     handles all selection/deselection/exec/premove logic).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Chess, type Square, type Color as ChessColor } from "chess.js";

const FILES = ["a","b","c","d","e","f","g","h"] as const;
const ACTIVATION_PX_MOUSE = 4;
const ACTIVATION_PX_TOUCH = 8;

type Pre = { from: Square; to: Square; pr?: "q"|"r"|"b"|"n" };

function premoveLegalMoves(virtualGame: Chess, pCol: ChessColor, from: Square): any[] {
  try {
    const fen = virtualGame.fen();
    const g = new Chess(fen);
    {
      const fp = g.fen().split(" "); fp[1] = pCol;
      try { g.load(fp.join(" ")); } catch { return []; }
    }
    const piece = g.get(from);
    if (!piece || piece.color !== pCol) return [];

    // Pass 1 — standard chess.js legal moves (FROM → empty / FROM → enemy capture).
    const pass1: any[] = g.moves({ square: from, verbose: true });
    const have = new Set(pass1.map(m => m.to));

    // Pass 2 — RESCUE: own-piece squares that FROM ATTACKS (= can land on if
    // opponent captures the own piece first). Use chess.js attackers() which is
    // O(1) per square, instead of per-square board rebuilds. Massively faster
    // mid-game when the user has many own pieces still on the board.
    const board = g.board();
    const fromTypeUpper = piece.type === "p" ? "" : piece.type.toUpperCase();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p || p.color !== pCol || p.type === "k") continue;
        const sq = (FILES[c] + (8 - r)) as Square;
        if (sq === from || have.has(sq)) continue;
        let attackers: Square[] = [];
        try { attackers = g.attackers(sq, pCol); } catch {}
        if (attackers.indexOf(from) === -1) continue;
        // Synthesize a verbose-shaped move record. It only needs `to` for our
        // matched.find(m=>m.to===sq) consumer, but we shape the rest minimally.
        pass1.push({
          color: pCol, from, to: sq, piece: piece.type,
          flags: "c", san: `${fromTypeUpper}x${sq}`,
        });
        have.add(sq);
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
  click: (sq: Square) => void;  // ← delegate tap-to-move to page's proven click()
  filterMovesByDice?: (moves: any[], pieceType: string) => any[];
}

type BRect = { l: number; t: number; cw: number; flip: boolean };
type DragState = { from: Square; sx: number; sy: number; pid: number; ptype: string; active: boolean; bRect: BRect };

export function useBoardInput(opts: BoardInputOptions) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const dragRef  = useRef<DragState | null>(null);
  const recentDragRef    = useRef(0);
  const ghostPosRef      = useRef({ x: 0, y: 0 });
  const ghostRafRef      = useRef<number | null>(null);
  const dragHoverIntRef  = useRef<Square | null>(null);
  const bDownHandledRef  = useRef(0); // kept for back-compat with page.tsx onClick guard

  const [ghostFrom, setGhostFrom] = useState<Square | null>(null);
  const [dragHover, setDragHover] = useState<Square | null>(null);

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

  const sqFromRect = useCallback((x: number, y: number, b: BRect): Square | null => {
    const fx = Math.floor((x - b.l) / b.cw);
    const fy = Math.floor((y - b.t) / b.cw);
    if (fx < 0 || fx > 7 || fy < 0 || fy > 7) return null;
    return `${FILES[b.flip ? 7 - fx : fx]}${(b.flip ? fy : 7 - fy) + 1}` as Square;
  }, []);

  // ── Ghost helpers ────────────────────────────────────────────────────────
  // On touch, the user's finger covers the dragged piece. Lift the ghost ~60px
  // above the touch point so the piece is always visible.
  const flushGhostPos = useCallback(() => {
    ghostRafRef.current = null;
    const el = ghostRef.current;
    if (!el) return;
    const { x, y } = ghostPosRef.current;
    const isTouch = dragRef.current?.ptype === "touch";
    const dy = isTouch ? -60 : 0;
    el.style.transform = `translate3d(${x}px,${y + dy}px,0) translate(-50%,-50%)`;
  }, []);

  const showGhost = useCallback((from: Square, x: number, y: number) => {
    ghostPosRef.current = { x, y };
    setGhostFrom(from);
    if (typeof document !== "undefined") document.body.style.cursor = "grabbing";
    // Force-flush an initial position immediately so the ghost doesn't appear
    // for one frame at (0,0) before the first RAF runs. Wait one RAF for the
    // ref to be attached, then write the transform.
    requestAnimationFrame(() => {
      const el = ghostRef.current;
      if (!el) return;
      const { x: gx, y: gy } = ghostPosRef.current;
      const isTouch = dragRef.current?.ptype === "touch";
      const off = isTouch ? -60 : 0;
      el.style.transform = `translate3d(${gx}px,${gy + off}px,0) translate(-50%,-50%)`;
    });
  }, []);

  const hideGhost = useCallback(() => {
    if (ghostRafRef.current !== null) { cancelAnimationFrame(ghostRafRef.current); ghostRafRef.current = null; }
    setGhostFrom(null);
    setDragHover(null);
    dragHoverIntRef.current = null;
    if (typeof document !== "undefined") document.body.style.cursor = "";
  }, []);

  // ── Drop / premove application (drag path only) ─────────────────────────
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
      // Premove drop
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

  // ── WINDOW pointer listeners — primary path for move/up/cancel ──────────
  // (v5 architecture — no setPointerCapture, no React handlers on the board
  //  for move/up. Window listeners are reliable and survive HMR.)
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pid !== e.pointerId) return;
      const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
      const threshold = d.ptype === "touch" ? ACTIVATION_PX_TOUCH : ACTIVATION_PX_MOUSE;
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
        // Tap with no drag. Same-square tap is already handled by onBoardDown's
        // priority logic — calling click() again would deselect what we just
        // selected. Cross-square taps (rare — finger lifted on a different
        // square without crossing the drag threshold) DO need click() to fire.
        const sq = sqFromRect(e.clientX, e.clientY, d.bRect) || sqFromBoard(e.clientX, e.clientY);
        if (sq && sq !== d.from) optsRef.current.click(sq);
        return;
      }
      // Drag activated — drop on target.
      recentDragRef.current = Date.now();
      const to = sqFromRect(e.clientX, e.clientY, d.bRect) || sqFromBoard(e.clientX, e.clientY);
      if (!to || to === d.from) {
        // Drop on origin → keep selection so click-to-move still works after a misfire.
        return;
      }
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

  // ── onPointerDown — v5 verbatim. Synchronous preventDefault path runs the
  //    chess priority logic (priority-1 = exec on legal tap target, priority-2
  //    = exec premove, priority-3 = deselect-same-piece) AND then arms a drag.
  //    Window-pointerup then handles either drop-on-target OR cross-square tap
  //    fallback via opts.click().
  const onBoardDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const sq = sqFromBoard(e.clientX, e.clientY);
    if (!sq) return;
    const o = optsRef.current;
    const boardEl = boardRef.current;
    if (!boardEl) return;
    const br = boardEl.getBoundingClientRect();
    const bRect: BRect = { l: br.left, t: br.top, cw: br.width / 8, flip: o.flip };
    bDownHandledRef.current = Date.now();

    if (o.scratchOn && o.scratchGame) {
      const p = o.scratchGame.get(sq);
      if (!p || p.color !== o.scratchGame.turn()) return;
      e.preventDefault();
      dragRef.current = { from: sq, sx: e.clientX, sy: e.clientY, pid: e.pointerId, ptype: e.pointerType || "mouse", active: false, bRect };
      o.sScratchSel(sq);
      o.sScratchVm(new Set(o.scratchGame.moves({ square: sq, verbose: true }).map(m => m.to)));
      return;
    }

    const isPM = o.tab !== "analysis" && o.game.turn() !== o.pCol && o.on && !o.over;

    if (!o.over && !o.editorMode) {
      // Priority-1: tap-to-exec (your turn, sel set, this sq is a legal target).
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
      // Priority-2: complete a queued premove selection.
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
      // Priority-3: tap same selected piece → deselect.
      if (!isPM && o.sel === sq && !o.vm.has(sq)) {
        e.preventDefault();
        o.sSel(null); o.sVm(new Set());
        return;
      }
    }

    const checkBoard = isPM ? o.virtualGame : o.game;
    const p = checkBoard.get(sq);
    const side = o.tab === "analysis" ? o.game.turn() : o.pCol;
    const canDrag = !!p && (o.tab === "analysis" || p.color === side) && !o.over;
    if (!canDrag) return;

    e.preventDefault();
    dragRef.current = { from: sq, sx: e.clientX, sy: e.clientY, pid: e.pointerId, ptype: e.pointerType || "mouse", active: false, bRect };

    const isMyTurn = o.tab === "analysis" || o.game.turn() === o.pCol;
    if (isMyTurn) {
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

  // ── No-op handlers (kept so page.tsx wiring can still reference them). ──
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
    onBoardMove:   noopHandler,
    onBoardUp:     noopHandler,
    onBoardCancel: noopHandler,
    sqFromBoard,
  };
}
