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

export function premoveLegalMoves(virtualGame: Chess, pCol: ChessColor, from: Square): any[] {
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
      return null as unknown as HTMLDivElement;
    }
    const orphans = document.querySelectorAll("#cc-drag-ghost");
    orphans.forEach(el => {
      if (el !== ghostNodeRef.current) el.remove();
    });
    if (ghostNodeRef.current && document.body.contains(ghostNodeRef.current)) {
      return ghostNodeRef.current;
    }
    // ⚡ GPU-accelerated positioning: transform: translate3d() + will-change.
    // left/top causes layout (CPU). transform on a translateZ layer is composited
    // by the GPU — mouse movement during drag follows in <1ms, no lag.
    // Outer carries position via transform. Inner carries centering (-50%,-50%).
    // Two separate elements so transforms don't collide.
    const node = document.createElement("div");
    node.id = "cc-drag-ghost";
    node.style.cssText = [
      "position:fixed", "left:0", "top:0",
      "pointer-events:none", "z-index:2147483647",
      "will-change:transform",
      "transform:translate3d(-9999px,-9999px,0)",
      "user-select:none", "-webkit-user-select:none", "-webkit-user-drag:none",
      "margin:0", "padding:0", "border:0", "background:transparent",
    ].join(";");
    const inner = document.createElement("div");
    inner.id = "cc-drag-ghost-inner";
    // No filter, no shadow — drop-shadow на SVG требует пересчёта на каждый
    // paint что вызывает trail курсора. Без filter ghost всегда follows
    // курсор pixel-perfect. Простой опаковый клон piece'а.
    inner.style.cssText = [
      "width:100%", "height:100%",
      "transform:translate(-50%,-50%)",
      "transform-origin:center center",
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

  // Imperative last-move highlight — set cell bg directly via DOM, no waiting
  // for React to render. T.last = "rgba(217,119,6,0.25)" (orange tint).
  // React will set the same bg on next render (when lm state propagates) —
  // no flicker. This eliminates the ~16ms render delay between exec and
  // visible highlight.
  const flashLastMove = useCallback((from: Square, to: Square) => {
    if (typeof document === "undefined") return;
    const lastBg = "rgba(217,119,6,0.25)";
    const fromCell = document.querySelector(`[data-sq="${from}"]`) as HTMLElement | null;
    const toCell = document.querySelector(`[data-sq="${to}"]`) as HTMLElement | null;
    if (fromCell) fromCell.style.background = lastBg;
    if (toCell) toCell.style.background = lastBg;
  }, []);

  const showGhost = useCallback((from: Square, x: number, y: number) => {
    const o = optsRef.current;
    // Pre-cleanup: clear any stale [data-ghost-hidden] markers from a previous
    // botched drag (e.g., focus loss during drag). Without this, subsequent
    // drags can pick up DOM where the source piece is still imperatively
    // hidden, breaking visual feedback for moves 2+.
    if (typeof document !== "undefined") {
      document.querySelectorAll('[data-ghost-hidden="1"]').forEach(el => {
        const h = el as HTMLElement;
        h.style.opacity = "";
        delete h.dataset.ghostHidden;
      });
    }
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
        // No scale, no translateY. Pure horizontal glide — фигура просто
        // следует за курсором в своём размере. User: «нужно чтобы по
        // горизонту плыли».
        clone.style.cssText = [
          "width:100%", "height:100%",
          "transform:none",
          "transform-origin:center center",
          "opacity:1",
          "filter:none",
          "transition:none",
          "animation:none",
          "pointer-events:none",
          "user-select:none",
          "-webkit-user-drag:none",
        ].join(";");
        clone.removeAttribute("data-ghost-hidden");
        inner.appendChild(clone);
      } else {
        // Fallback only — should be rare
        inner.innerHTML = pieceHtml(piece.type, piece.color, getActivePieceSet(), Math.round(cellSz * 1.18));
      }
    }
    const isTouch = dragRef.current?.ptype === "touch";
    const dy = isTouch ? -60 : 0;
    // GPU compositor: transform: translate3d() — instant repaint, no layout
    node.style.transform = `translate3d(${x}px,${y + dy}px,0)`;
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

  // moveGhost — GPU-composited transform update on every pointermove.
  // No layout, no paint of other elements. Cursor follow is <1ms.
  const moveGhost = useCallback((x: number, y: number) => {
    const node = ghostNodeRef.current;
    if (!node) return;
    const isTouch = dragRef.current?.ptype === "touch";
    const dy = isTouch ? -60 : 0;
    node.style.transform = `translate3d(${x}px,${y + dy}px,0)`;
  }, []);

  // Cell-bg drag highlight — DIRECTLY tints target cell's background.
  // Previously used a halo node with box-shadow blur which was paint-expensive
  // and felt laggy. Now: just toggle cell.style.background on cursor move
  // between cells. Instant DOM mutation, no paint cost beyond color change.
  const lastHaloCellRef = useRef<HTMLElement | null>(null);
  const lastHaloOriginalBgRef = useRef<string>("");

  const positionHalo = useCallback((sq: Square | null) => {
    // Restore previous cell's bg
    const prev = lastHaloCellRef.current;
    if (prev) {
      prev.style.background = lastHaloOriginalBgRef.current;
      lastHaloCellRef.current = null;
      lastHaloOriginalBgRef.current = "";
    }
    if (!sq || typeof document === "undefined") return;
    const cell = document.querySelector(`[data-sq="${sq}"]`) as HTMLElement | null;
    if (!cell) return;
    lastHaloCellRef.current = cell;
    lastHaloOriginalBgRef.current = cell.style.background;
    const isLegal = optsRef.current.vmRef.current.has(sq);
    // Bright tint — legal: green, illegal: gray. Solid bg = instant visual.
    cell.style.background = isLegal ? "rgba(16,185,129,0.45)" : "rgba(148,163,184,0.35)";
  }, []);

  const hideGhost = useCallback(() => {
    const node = ghostNodeRef.current;
    if (node) { node.remove(); ghostNodeRef.current = null; }
    // Restore previous cell-bg highlight if any
    const prev = lastHaloCellRef.current;
    if (prev) {
      prev.style.background = lastHaloOriginalBgRef.current;
      lastHaloCellRef.current = null;
      lastHaloOriginalBgRef.current = "";
    }
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (ghostNodeRef.current) { ghostNodeRef.current.remove(); ghostNodeRef.current = null; }
      if (lastHaloCellRef.current) {
        lastHaloCellRef.current.style.background = lastHaloOriginalBgRef.current;
        lastHaloCellRef.current = null;
      }
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
            flashLastMove(from, to);
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
      flashLastMove(from, to);
      // Note: cc-piece-drop animation удалён — он стартовал через RAF×2
      // (~32ms после exec), создавая «появилась → потом начала bounce»
      // несоответствие. Slide на ghost'е уже даёт визуальную непрерывность.
      // Финальная piece просто появляется на dest без дополнительной анимации.
    } else {
      o.sSel(null); o.selRef.current = null;
      o.sVm(new Set()); o.vmRef.current = new Set();
    }
  }, [flashLastMove]);

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
      if (!wasActive) {
        // Tap with no drag — hide ghost + delegate to click().
        hideGhost();
        const sq = sqFromRect(e.clientX, e.clientY, d.bRect) || sqFromBoard(e.clientX, e.clientY);
        if (sq && sq !== d.from) optsRef.current.click(sq);
        return;
      }
      recentDragRef.current = Date.now();
      const to = sqFromRect(e.clientX, e.clientY, d.bRect) || sqFromBoard(e.clientX, e.clientY);
      if (!to || to === d.from) {
        // Drop on origin → snap ghost back to source center, then hide.
        hideGhost();
        return;
      }
      // Compute destination cell center in viewport coords for the slide animation
      const toFile = FILES.indexOf(to[0] as any);
      const toRank = 8 - parseInt(to[1], 10);
      const flip = optsRef.current.flip;
      const tCol = flip ? 7 - toFile : toFile;
      const tRow = flip ? 7 - toRank : toRank;
      const cw = d.bRect.cw;
      const destX = d.bRect.l + tCol * cw + cw / 2;
      const destY = d.bRect.t + tRow * cw + cw / 2;
      const ghostNode = ghostNodeRef.current;
      // ⚡ Snappy slide — 50ms total. Ghost flies from cursor to dest cell
      // center быстро. Exec в одной же frame с release (instant highlight +
      // piece). Ghost overlap'ит с piece на финале slide и удаляется.
      // Раньше 100-150ms slide создавал perception лага между actual move
      // и ghost'ом. 50ms — barely perceptible motion, no lag feel.
      executeDrop(d.from, to);
      // No slide animation — ghost мгновенно скрывается. flashLastMove
      // выставляет highlight, React рендерит piece на dest через 16-50ms.
      // Никаких "подлетающих" анимаций.
      hideGhost();
      void destX; void destY;
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
        flashLastMove(f, sq);
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
  }, [sqFromBoard, showGhost, flashLastMove]);

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
