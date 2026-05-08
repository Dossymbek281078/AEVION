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
import { pieceHtml, getActivePieceSet } from "./Pieces";

const FILES = ["a","b","c","d","e","f","g","h"] as const;
const ACTIVATION_PX_MOUSE = 6;
const ACTIVATION_PX_TOUCH = 10;

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
    // opponent captures the own piece first). Pawn forward squares to OWN piece
    // are added in Pass 3 (pawns don't "attack" forward).
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
        pass1.push({
          color: pCol, from, to: sq, piece: piece.type,
          flags: "c", san: `${fromTypeUpper}x${sq}`,
        });
        have.add(sq);
      }
    }

    // Pass 3 — PAWN-SPECIFIC: chess.js requires existing enemy piece for pawn
    // diagonal captures, and existing empty square for forward pushes. For
    // premoves we are speculative — opponent might:
    //   • move a piece TO our pawn's diagonal (we'd capture it then)
    //   • move a piece AWAY from our pawn's forward push (path clears)
    //   • capture our own piece on the forward push square (path clears)
    // Add ALL pseudo-legal pawn squares regardless of current contents.
    if (piece.type === "p") {
      const fileIdx = FILES.indexOf(from[0] as any);
      const rank = parseInt(from[1], 10);
      const dir = pCol === "w" ? 1 : -1;
      const startRank = pCol === "w" ? 2 : 7;
      const fwd1 = rank + dir;
      const fwd2 = rank + 2 * dir;
      // Forward 1 (any contents — opponent might clear it)
      if (fwd1 >= 1 && fwd1 <= 8) {
        const sq = `${FILES[fileIdx]}${fwd1}` as Square;
        if (!have.has(sq)) {
          pass1.push({ color: pCol, from, to: sq, piece: "p", flags: "n", san: sq });
          have.add(sq);
        }
      }
      // Forward 2 (only from starting rank, any contents)
      if (rank === startRank && fwd2 >= 1 && fwd2 <= 8) {
        const sq = `${FILES[fileIdx]}${fwd2}` as Square;
        if (!have.has(sq)) {
          pass1.push({ color: pCol, from, to: sq, piece: "p", flags: "b", san: sq });
          have.add(sq);
        }
      }
      // Diagonals (any contents — empty/own/enemy. Empty becomes legal if opp moves there)
      for (const df of [-1, 1]) {
        const newFileIdx = fileIdx + df;
        if (newFileIdx < 0 || newFileIdx > 7) continue;
        if (fwd1 < 1 || fwd1 > 8) continue;
        const sq = `${FILES[newFileIdx]}${fwd1}` as Square;
        if (!have.has(sq)) {
          pass1.push({ color: pCol, from, to: sq, piece: "p", flags: "c", san: `${from[0]}x${sq}` });
          have.add(sq);
        }
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
  selRef: React.MutableRefObject<Square | null>;
  vmRef: React.MutableRefObject<Set<string>>;
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

  // ── Ghost helpers — IMPERATIVE DOM (lichess-style, bypass React) ──────────
  // The cyberchess page tree is large (~8000 LoC). Routing the drag visual
  // through React state added 50–150 ms render lag — user perceived "ghost
  // doesn't appear". We now create the ghost <div> via document.createElement
  // and update its transform on every pointermove WITHOUT touching React.
  // ghostFrom state remains, but only so the source cell can hide its piece.
  const ghostNodeRef = useRef<HTMLDivElement | null>(null);

  // Position via left/top (NOT transform). Some Next.js page wrappers emit a
  // `transform: translate(0)` for transitions which silently re-roots
  // position:fixed children — left/top remain viewport-relative.
  // Inner div carries the (-50%,-50%) centering AND the scale pop animation;
  // outer holds just left/top. No transform-property collision possible.
  // ensureGhostNode — guarantees a fresh, clean ghost container in document.body.
  // Cleans up any orphaned #cc-drag-ghost from previous HMR sessions or aborted
  // drags. Returns the outer <div> ready to receive a piece clone.
  const ensureGhostNode = useCallback((): HTMLDivElement => {
    if (typeof document === "undefined") {
      // SSR safety
      return null as unknown as HTMLDivElement;
    }
    // 1. Remove any orphaned ghosts from previous instances (HMR / aborted drags)
    const orphans = document.querySelectorAll("#cc-drag-ghost");
    orphans.forEach(el => {
      if (el !== ghostNodeRef.current) el.remove();
    });
    // 2. If our ref still points to a node IN the DOM, reuse it
    if (ghostNodeRef.current && document.body.contains(ghostNodeRef.current)) {
      return ghostNodeRef.current;
    }
    // 3. Otherwise create fresh
    const node = document.createElement("div");
    node.id = "cc-drag-ghost";
    node.style.cssText = [
      "position:fixed", "left:-9999px", "top:-9999px",
      "pointer-events:none", "z-index:2147483647",
      "will-change:left,top",
      "user-select:none", "-webkit-user-select:none", "-webkit-user-drag:none",
      "margin:0", "padding:0", "border:0", "background:transparent",
      "contain:layout", // isolate layout
    ].join(";");
    const inner = document.createElement("div");
    inner.id = "cc-drag-ghost-inner";
    inner.style.cssText = [
      "width:100%", "height:100%",
      "transform:translate(-50%,-50%)",
      "transform-origin:center center",
      "filter:drop-shadow(0 18px 28px rgba(0,0,0,0.65)) drop-shadow(0 0 22px rgba(5,150,105,0.55))",
      "pointer-events:none",
      "display:flex", "align-items:center", "justify-content:center",
    ].join(";");
    node.appendChild(inner);
    document.body.appendChild(node);
    ghostNodeRef.current = node;
    return node;
  }, []);

  // findSourcePieceEl — locate the actual rendering piece <div> for a given
  // square. Robust strategy: try data-sq cell, then walk descendants looking
  // for the canonical 88%/88%-sized piece wrapper. Falls back to ANY div with
  // an SVG/glyph descendant, in case React render shape changes.
  const findSourcePieceEl = useCallback((from: Square): HTMLElement | null => {
    if (typeof document === "undefined") return null;
    const cell = document.querySelector(`[data-sq="${from}"]`);
    if (!cell) return null;
    // Strategy 1: direct child with width:88% height:88% inline style
    const children = cell.children;
    for (let i = 0; i < children.length; i++) {
      const c = children[i] as HTMLElement;
      if (c.style && c.style.width === "88%" && c.style.height === "88%") {
        return c;
      }
    }
    // Strategy 2: any descendant div containing an SVG (cburnett set) or
    // a span with chess glyph (unicode sets). This is the rendering wrapper.
    const divs = cell.querySelectorAll("div");
    for (let i = 0; i < divs.length; i++) {
      const d = divs[i] as HTMLElement;
      if (d.style && d.style.width === "88%") return d;
      // SVG-bearing wrapper as last resort
      if (d.querySelector(":scope > svg, :scope > div > span")) return d;
    }
    return null;
  }, []);

  const showGhost = useCallback((from: Square, x: number, y: number) => {
    const o = optsRef.current;
    const pieceSrc = o.scratchOn && o.scratchGame
      ? o.scratchGame
      : (o.tab !== "analysis" && o.game.turn() !== o.pCol && o.on ? o.virtualGame : o.game);
    const piece = pieceSrc.get(from) || o.game.get(from);
    if (!piece) {
      if (typeof window !== "undefined" && (window as any).__CC_DEBUG_DRAG !== false) {
        // eslint-disable-next-line no-console
        console.log("[CC] showGhost: no piece on", from);
      }
      return;
    }
    const boardEl = boardRef.current;
    const cellSz = boardEl ? Math.round(boardEl.getBoundingClientRect().width / 8) : 80;
    const node = ensureGhostNode();
    if (!node) return;
    // Outer is sized to the cell. Inner is 100% of outer + lift via scale.
    node.style.width = `${cellSz}px`;
    node.style.height = `${cellSz}px`;
    const inner = node.firstElementChild as HTMLDivElement | null;
    if (inner) {
      inner.replaceChildren();
      const srcPieceEl = findSourcePieceEl(from);
      if (srcPieceEl) {
        const clone = srcPieceEl.cloneNode(true) as HTMLElement;
        // Pickup animation: stage 1 (initial) — slightly compressed, 0.9 opacity.
        // Stage 2 (after reflow): scale up with overshoot bounce. Effect:
        // фигура "хватается" — слегка сжимается, потом упруго растёт.
        clone.style.cssText = [
          "width:100%", "height:100%",
          "transform:scale(0.95)",
          "transform-origin:center center",
          "opacity:0.9",
          "filter:none",
          "transition:transform 110ms cubic-bezier(0.34,1.56,0.64,1), opacity 60ms ease-out",
          "animation:none",
          "pointer-events:none",
          "user-select:none",
          "-webkit-user-drag:none",
        ].join(";");
        clone.removeAttribute("data-ghost-hidden");
        inner.appendChild(clone);
        // Force reflow then animate to lifted state.
        // Use TWO RAFs to ensure browser paints initial state first → animation
        // is GUARANTEED visible (single RAF can be too fast; browser may merge
        // paint and skip the initial frame).
        void clone.offsetWidth;
        requestAnimationFrame(() => requestAnimationFrame(() => {
          clone.style.transform = "scale(1.25)";
          clone.style.opacity = "1";
        }));
      } else {
        // Fallback only — should be rare
        inner.innerHTML = pieceHtml(piece.type, piece.color, getActivePieceSet(), Math.round(cellSz * 1.18));
      }
    }
    const isTouch = dragRef.current?.ptype === "touch";
    const dy = isTouch ? -60 : 0;
    node.style.left = `${x}px`;
    node.style.top = `${y + dy}px`;
    ghostPosRef.current = { x, y };
    if (typeof window !== "undefined" && (window as any).__CC_DEBUG_DRAG !== false) {
      // eslint-disable-next-line no-console
      console.log("[CC] GHOST shown", {
        from, x, y, cellSz,
        piece: `${piece.color}${piece.type}`,
        innerHTML: inner?.innerHTML.slice(0, 80),
        rect: node.getBoundingClientRect(),
      });
    }
    setGhostFrom(from);
    // Imperative source-cell hide — instant, doesn't wait for React render.
    // Use querySelectorAll for robustness against future React-render shape changes.
    if (typeof document !== "undefined") {
      const srcCell = document.querySelector(`[data-sq="${from}"]`);
      if (srcCell) {
        const allDivs = srcCell.querySelectorAll("div");
        for (let i = 0; i < allDivs.length; i++) {
          const c = allDivs[i] as HTMLElement;
          if (c.style && c.style.width === "88%" && c.style.height === "88%") {
            c.dataset.ghostHidden = "1";
            c.style.opacity = "0";
            c.style.transition = "opacity 60ms linear"; // smoother than instant
            break;
          }
        }
      }
      document.body.style.cursor = "grabbing";
    }
  }, [ensureGhostNode, findSourcePieceEl]);

  // moveGhost — direct DOM update, called from window pointermove. No React.
  const moveGhost = useCallback((x: number, y: number) => {
    const node = ghostNodeRef.current;
    if (!node) return;
    const isTouch = dragRef.current?.ptype === "touch";
    const dy = isTouch ? -60 : 0;
    node.style.left = `${x}px`;
    node.style.top = `${y + dy}px`;
  }, []);

  // Imperative hover halo — same idea as ghost. setDragHover() during drag
  // would re-render the whole 8000-line page on every cell crossing.
  const haloNodeRef = useRef<HTMLDivElement | null>(null);

  const ensureHaloNode = useCallback((): HTMLDivElement => {
    if (haloNodeRef.current) return haloNodeRef.current;
    const node = document.createElement("div");
    node.id = "cc-drag-halo";
    node.style.cssText = [
      "position:fixed", "left:0", "top:0",
      "pointer-events:none", "z-index:99998",
      "will-change:transform",
      "border-radius:50%", "box-sizing:border-box",
      "transform:translate3d(-9999px,-9999px,0)",
    ].join(";");
    document.body.appendChild(node);
    haloNodeRef.current = node;
    return node;
  }, []);

  const positionHalo = useCallback((sq: Square | null) => {
    if (!sq) {
      const n = haloNodeRef.current;
      if (n) n.style.transform = "translate3d(-9999px,-9999px,0)";
      return;
    }
    const o = optsRef.current;
    const boardEl = boardRef.current;
    if (!boardEl) return;
    const rect = boardEl.getBoundingClientRect();
    const cw = rect.width / 8;
    const f = FILES.indexOf(sq[0] as any);
    const r = 8 - parseInt(sq[1]);
    const c = o.flip ? 7 - f : f;
    const rr = o.flip ? 7 - r : r;
    const cx = rect.left + c * cw + cw / 2;
    const cy = rect.top + rr * cw + cw / 2;
    const isLegal = o.vmRef.current.has(sq);
    const col = isLegal ? "#10b981" : "#94a3b8";
    const node = ensureHaloNode();
    node.style.width = `${cw * 0.94}px`;
    node.style.height = `${cw * 0.94}px`;
    node.style.border = `3px solid ${col}`;
    node.style.boxShadow = `0 0 18px ${col}55, inset 0 0 14px ${col}33`;
    node.style.transform = `translate3d(${cx}px,${cy}px,0) translate(-50%,-50%) scale(0.92)`;
  }, [ensureHaloNode]);

  const hideGhost = useCallback(() => {
    const node = ghostNodeRef.current;
    if (node) { node.remove(); ghostNodeRef.current = null; }
    const halo = haloNodeRef.current;
    if (halo) { halo.remove(); haloNodeRef.current = null; }
    // Restore any imperatively-hidden source piece (data-ghost-hidden marker)
    if (typeof document !== "undefined") {
      const hidden = document.querySelectorAll('[data-ghost-hidden="1"]');
      hidden.forEach(el => {
        const h = el as HTMLElement;
        h.style.opacity = "";
        delete h.dataset.ghostHidden;
      });
    }
    setGhostFrom(null);
    setDragHover(null);
    dragHoverIntRef.current = null;
    if (typeof document !== "undefined") document.body.style.cursor = "";
  }, []);

  // Cleanup on unmount — orphaned ghost/halo would otherwise stay in DOM forever.
  useEffect(() => {
    return () => {
      if (ghostNodeRef.current) { ghostNodeRef.current.remove(); ghostNodeRef.current = null; }
      if (haloNodeRef.current) { haloNodeRef.current.remove(); haloNodeRef.current = null; }
    };
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
      if (!piece || piece.color !== o.pCol) {
        o.sPmSel(null); o.pmSelRef.current = null;
        o.sVm(new Set()); o.vmRef.current = new Set();
        return;
      }
      const legal = premoveLegalMoves(o.virtualGame, o.pCol, from);
      const matched = legal.find((m: any) => m.to === to);
      if (!matched) {
        o.sPmSel(null); o.pmSelRef.current = null;
        o.sVm(new Set()); o.vmRef.current = new Set();
        return;
      }
      const pre: Pre = { from, to };
      if (piece.type === "p" && to[1] === (o.pCol === "w" ? "8" : "1")) pre.pr = "q";
      o.sPms(v => [...v, pre]); o.pmsRef.current = [...o.pmsRef.current, pre];
      o.sPmSel(null); o.pmSelRef.current = null;
      o.sVm(new Set()); o.vmRef.current = new Set();
      o.snd("premove");
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
      // Drop settle animation — piece "приземляется" с size 1.25 (matches ghost
      // lift size at release) → bounces down to 0.92 → settles to 1. Visible
      // continuity from drag → drop (ghost растёт, piece приземляется).
      if (typeof window !== "undefined") {
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const destCell = document.querySelector(`[data-sq="${to}"]`);
          if (!destCell) return;
          const divs = destCell.querySelectorAll("div");
          for (let i = 0; i < divs.length; i++) {
            const d = divs[i] as HTMLElement;
            if (d.style && d.style.width === "88%" && d.style.height === "88%") {
              d.style.animation = "none";
              void d.offsetWidth;
              d.style.animation = "cc-piece-drop 220ms cubic-bezier(0.34,1.56,0.64,1)";
              break;
            }
          }
        }));
      }
    } else {
      o.sSel(null); o.selRef.current = null;
      o.sVm(new Set()); o.vmRef.current = new Set();
    }
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
        if (typeof window !== "undefined" && (window as any).__CC_DEBUG_DRAG !== false) {
          // eslint-disable-next-line no-console
          console.log("[CC] drag ACTIVATED — ghost should follow cursor");
        }
      }
      if (d.active) {
        e.preventDefault();
        ghostPosRef.current = { x: e.clientX, y: e.clientY };
        // IMPERATIVE: move the DOM node directly, no React, no RAF batching.
        moveGhost(e.clientX, e.clientY);
        const hover = sqFromRect(e.clientX, e.clientY, d.bRect);
        const target = hover && hover !== d.from ? hover : null;
        if (target !== dragHoverIntRef.current) {
          dragHoverIntRef.current = target;
          // Imperative halo — no setDragHover, no React render thrashing.
          positionHalo(target);
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
  }, [executeDrop, moveGhost, hideGhost, showGhost, sqFromBoard, sqFromRect, positionHalo]);

  // ── onPointerDown — v5 verbatim. Synchronous preventDefault path runs the
  //    chess priority logic (priority-1 = exec on legal tap target, priority-2
  //    = exec premove, priority-3 = deselect-same-piece) AND then arms a drag.
  //    Window-pointerup then handles either drop-on-target OR cross-square tap
  //    fallback via opts.click().
  const onBoardDown = useCallback((e: React.PointerEvent) => {
    // DEBUG: visible in browser DevTools console (F12). Strip after diagnosing.
    if (typeof window !== "undefined" && (window as any).__CC_DEBUG_DRAG !== false) {
      // eslint-disable-next-line no-console
      console.log("[CC] onBoardDown fired", { button: e.button, pointerType: e.pointerType, x: e.clientX, y: e.clientY });
    }
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const sq = sqFromBoard(e.clientX, e.clientY);
    if (!sq) {
      if (typeof window !== "undefined" && (window as any).__CC_DEBUG_DRAG !== false) {
        // eslint-disable-next-line no-console
        console.log("[CC] onBoardDown: no square detected — board ref null or pointer outside grid");
      }
      return;
    }
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
      dragRef.current = { from: sq, sx: e.clientX, sy: e.clientY, pid: e.pointerId, ptype: e.pointerType || "mouse", active: true, bRect };
      showGhost(sq, e.clientX, e.clientY);
      o.sScratchSel(sq);
      o.sScratchVm(new Set(o.scratchGame.moves({ square: sq, verbose: true }).map(m => m.to)));
      return;
    }

    const isPM = o.tab !== "analysis" && o.game.turn() !== o.pCol && o.on && !o.over;

    // Read latest sel/vm via refs so a fast follow-up click sees fresh state
    // (refs are updated synchronously below when sSel/sVm are called from this hook).
    const curSel = o.selRef.current;
    const curVm = o.vmRef.current;
    const curPmSel = o.pmSelRef.current;
    const curPms = o.pmsRef.current;

    if (!o.over && !o.editorMode) {
      // Priority-1: tap-to-exec (your turn, sel set, this sq is a legal target).
      if (!isPM && curSel && curVm.has(sq)) {
        const f = curSel;
        const mp = o.game.get(f);
        e.preventDefault();
        if (mp?.type === "p" && (sq[1] === "1" || sq[1] === "8")) {
          if (o.autoQueen) o.exec(f, sq, "q"); else o.sPromo({ from: f, to: sq });
        } else { o.exec(f, sq); }
        o.sSel(null); o.selRef.current = null;
        o.sVm(new Set()); o.vmRef.current = new Set();
        return;
      }
      // Priority-2: complete a queued premove selection.
      if (isPM && curPmSel && sq !== curPmSel && curPms.length < o.pmLim) {
        const f = curPmSel;
        const piece = o.virtualGame.get(f);
        if (piece && piece.color === o.pCol) {
          const legal = premoveLegalMoves(o.virtualGame, o.pCol, f);
          const matched = legal.find((m: any) => m.to === sq);
          if (matched) {
            const pre: Pre = { from: f, to: sq };
            if (piece.type === "p" && sq[1] === (o.pCol === "w" ? "8" : "1")) pre.pr = "q";
            e.preventDefault();
            o.sPms(v => [...v, pre]);
            o.pmsRef.current = [...curPms, pre];
            o.sPmSel(null); o.pmSelRef.current = null;
            o.sVm(new Set()); o.vmRef.current = new Set();
            o.snd("premove");
            return;
          }
        }
        o.sPmSel(null); o.pmSelRef.current = null;
        o.sVm(new Set()); o.vmRef.current = new Set();
      }
      // Priority-3: tap same selected piece → deselect.
      if (!isPM && curSel === sq && !curVm.has(sq)) {
        e.preventDefault();
        o.sSel(null); o.selRef.current = null;
        o.sVm(new Set()); o.vmRef.current = new Set();
        return;
      }
    }

    const checkBoard = isPM ? o.virtualGame : o.game;
    const p = checkBoard.get(sq);
    const side = o.tab === "analysis" ? o.game.turn() : o.pCol;
    const canDrag = !!p && (o.tab === "analysis" || p.color === side) && !o.over;
    if (typeof window !== "undefined" && (window as any).__CC_DEBUG_DRAG !== false) {
      // eslint-disable-next-line no-console
      console.log("[CC] onBoardDown: canDrag check", {
        sq, isPM, hasPiece: !!p, pieceColor: p?.color, side, pCol: o.pCol,
        tab: o.tab, on: o.on, over: o.over, canDrag,
      });
    }
    if (!canDrag) return;

    e.preventDefault();
    dragRef.current = { from: sq, sx: e.clientX, sy: e.clientY, pid: e.pointerId, ptype: e.pointerType || "mouse", active: true, bRect };
    // Show ghost IMMEDIATELY — no threshold wait. Lichess/chess.com behavior:
    // фигура поднимается на первом же pointerdown, без ожидания движения 6px.
    // d.active=true сразу: pointerup → executeDrop (если to !== from), либо
    // priority-логика onBoardDown уже обработала бы tap-to-exec до этой точки.
    showGhost(sq, e.clientX, e.clientY);
    if (typeof window !== "undefined" && (window as any).__CC_DEBUG_DRAG !== false) {
      // eslint-disable-next-line no-console
      console.log("[CC] onBoardDown: drag ARMED + ghost shown immediately");
    }

    const isMyTurn = o.tab === "analysis" || o.game.turn() === o.pCol;
    if (isMyTurn) {
      o.sSel(sq); o.selRef.current = sq;
      const all = o.game.moves({ square: sq, verbose: true });
      const filtered = (o.variant === "diceblade" && o.dicePieceType && o.filterMovesByDice)
        ? o.filterMovesByDice(all, o.dicePieceType) : all;
      const next = new Set(filtered.map((m: any) => m.to));
      o.sVm(next); o.vmRef.current = next;
    } else if (o.on) {
      o.sPmSel(sq); o.pmSelRef.current = sq;
      const next = new Set(premoveLegalMoves(o.virtualGame, o.pCol, sq).map((m: any) => m.to));
      o.sVm(next); o.vmRef.current = next;
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
