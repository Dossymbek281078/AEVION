"use client";
/**
 * useBoardInput — isolated pointer/touch/keyboard input for the chess board.
 *
 * Handles drag-and-drop, click-to-move, premoves, and click-deselect.
 * Completely independent of the rest of page.tsx state management.
 *
 * Design principles:
 *  - Native window-level pointermove/pointerup (avoids React synthetic event
 *    system which misses captured pointer events on Windows/Chrome)
 *  - boardRef direct getBoundingClientRect() math — no elementsFromPoint
 *  - Ghost always in DOM (visibility:hidden when idle) — no ghostRef=null race
 *  - No setPointerCapture (window listeners make it redundant)
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
  // callbacks
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

export function useBoardInput(opts:BoardInputOptions) {
  const boardRef = useRef<HTMLDivElement|null>(null);
  const dragRef = useRef<{
    from:Square; sx:number; sy:number; active:boolean; pid:number;
    bRect:{l:number;t:number;cw:number;flip:boolean};
  }|null>(null);
  const ghostRef = useRef<HTMLDivElement|null>(null);
  const ghostPosRef = useRef<{x:number;y:number}>({x:0,y:0});
  const ghostRafRef = useRef<number|null>(null);
  const ghostSizeRef = useRef<number>(72);
  const dragHoverRef = useRef<Square|null>(null);
  const recentDragRef = useRef<number>(0);

  const [ghostFrom, sGhostFrom] = useState<Square|null>(null);
  const [dragHover, sDragHover] = useState<Square|null>(null);

  // Keep a ref to latest opts so closures are always fresh
  const optsRef = useRef(opts);
  useEffect(()=>{ optsRef.current = opts; });

  // ── Square from board coordinates ─────────────────────────────────────────
  const sqFromBoard = useCallback((x:number,y:number):Square|null=>{
    const el = boardRef.current; if(!el) return null;
    const r = el.getBoundingClientRect();
    const cw = r.width/8;
    const fx = Math.floor((x-r.left)/cw);
    const fy = Math.floor((y-r.top)/cw);
    if(fx<0||fx>7||fy<0||fy>7) return null;
    const {flip} = optsRef.current;
    const file = flip?7-fx:fx;
    const rank = flip?fy:7-fy;
    return `${FILES[file]}${rank+1}` as Square;
  },[]);

  const sqFromCachedRect = useCallback((x:number,y:number,br:{l:number;t:number;cw:number;flip:boolean}):Square|null=>{
    const fx = Math.floor((x-br.l)/br.cw);
    const fy = Math.floor((y-br.t)/br.cw);
    if(fx<0||fx>7||fy<0||fy>7) return null;
    const file = br.flip?7-fx:fx;
    const rank = br.flip?fy:7-fy;
    return `${FILES[file]}${rank+1}` as Square;
  },[]);

  // ── Ghost RAF flush ────────────────────────────────────────────────────────
  const flushGhost = useCallback(()=>{
    ghostRafRef.current = null;
    const el = ghostRef.current; if(!el) return;
    const {x,y} = ghostPosRef.current;
    el.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
  },[]);

  const cancelGhostRaf = useCallback(()=>{
    if(ghostRafRef.current!==null){ cancelAnimationFrame(ghostRafRef.current); ghostRafRef.current=null; }
  },[]);

  // ── Drop execution ─────────────────────────────────────────────────────────
  const executeDrop = useCallback((from:Square,to:Square)=>{
    const o = optsRef.current;
    // Scratch mode
    if(o.scratchOn && o.scratchGame){
      const moves = o.scratchGame.moves({square:from,verbose:true});
      const matched = moves.find(m=>m.to===to);
      if(matched){
        try{
          const mv = o.scratchGame.move({from,to,promotion:matched.promotion?"q":undefined});
          if(mv){
            o.sScratchHist(h=>[...h,mv.san]);
            o.sScratchLm({from:mv.from,to:mv.to});
            o.sScratchSel(null); o.sScratchVm(new Set()); o.sScratchBk(k=>k+1);
            o.snd(mv.captured?"capture":"move");
          }
        }catch{}
      } else { o.sScratchSel(null); o.sScratchVm(new Set()); }
      return;
    }
    // Premove mode (not our turn)
    if(o.tab!=="analysis" && o.game.turn()!==o.pCol && o.on && !o.over){
      if(o.pmsRef.current.length >= o.pmLim) return;
      const p = o.virtualGame.get(from) || o.game.get(from);
      const pre:Pre = {from,to};
      const promoRank = o.pCol==="w"?"8":"1";
      if(p?.type==="p" && to[1]===promoRank) pre.pr="q";
      o.sPms(v=>[...v,pre]); o.sPmSel(null); o.sVm(new Set()); o.snd("premove");
      return;
    }
    // Normal move (with optional diceblade filter)
    const rawLegal = o.game.moves({square:from,verbose:true});
    const legal = (o.variant==="diceblade" && o.dicePieceType && o.filterMovesByDice)
      ? o.filterMovesByDice(rawLegal, o.dicePieceType)
      : rawLegal;
    const matched = legal.find((m:any)=>m.to===to);
    if(matched){
      const mp = o.game.get(from);
      if(mp?.type==="p" && (to[1]==="1"||to[1]==="8")){
        if(o.autoQueen) o.exec(from,to,"q");
        else o.sPromo({from,to});
      } else {
        o.exec(from,to);
      }
    } else {
      o.sSel(null); o.sVm(new Set());
    }
  },[]);

  // ── Global pointer handlers ────────────────────────────────────────────────
  useEffect(()=>{
    const onMove = (e:PointerEvent)=>{
      const d = dragRef.current;
      if(!d || d.pid!==e.pointerId) return;
      const dx=e.clientX-d.sx, dy=e.clientY-d.sy;
      // Threshold 3px — lower than before for snappier feel
      if(!d.active && Math.hypot(dx,dy)>3){
        d.active = true;
        ghostPosRef.current = {x:e.clientX,y:e.clientY};
        ghostSizeRef.current = Math.max(52, Math.round(d.bRect.cw*1.2));
        sGhostFrom(d.from);
        document.body.style.cursor = "grabbing";
      }
      if(d.active){
        ghostPosRef.current = {x:e.clientX,y:e.clientY};
        if(ghostRafRef.current===null)
          ghostRafRef.current = requestAnimationFrame(flushGhost);
        const hover = sqFromCachedRect(e.clientX,e.clientY,d.bRect);
        const target = hover && hover!==d.from ? hover : null;
        if(target!==dragHoverRef.current){ dragHoverRef.current=target; sDragHover(target); }
      }
    };

    const onUp = (e:PointerEvent)=>{
      const d = dragRef.current; dragRef.current = null;
      cancelGhostRaf(); sGhostFrom(null);
      if(dragHoverRef.current!==null){ dragHoverRef.current=null; sDragHover(null); }
      document.body.style.cursor = "";
      if(!d || d.pid!==e.pointerId) return;
      if(!d.active){
        // Simple click — only call click() for a DIFFERENT square than pressed.
        // Same square was already handled by onBoardDown (selection set there).
        const sq = sqFromCachedRect(e.clientX,e.clientY,d.bRect) || sqFromBoard(e.clientX,e.clientY);
        if(sq && sq!==d.from) optsRef.current.click(sq);
        return;
      }
      recentDragRef.current = Date.now();
      const to = sqFromCachedRect(e.clientX,e.clientY,d.bRect) || sqFromBoard(e.clientX,e.clientY);
      if(!to || to===d.from){ optsRef.current.sSel(null); optsRef.current.sVm(new Set()); return; }
      executeDrop(d.from, to);
    };

    window.addEventListener("pointermove", onMove, {passive:false});
    window.addEventListener("pointerup", onUp);
    return ()=>{
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // ── onBoardDown ────────────────────────────────────────────────────────────
  const onBoardDown = useCallback((e:React.PointerEvent)=>{
    if(e.button!==0) return;
    const sq = sqFromBoard(e.clientX, e.clientY); if(!sq) return;
    const o = optsRef.current;

    // Scratch mode
    if(o.scratchOn && o.scratchGame){
      const p = o.scratchGame.get(sq);
      if(!p || p.color!==o.scratchGame.turn()) return;
      e.preventDefault();
      const boardEl = boardRef.current || e.currentTarget as HTMLElement;
      const br = boardEl.getBoundingClientRect();
      const bRect = {l:br.left,t:br.top,cw:br.width/8,flip:o.flip};
      dragRef.current = {from:sq,sx:e.clientX,sy:e.clientY,active:false,pid:e.pointerId,bRect};
      o.sScratchSel(sq);
      o.sScratchVm(new Set(o.scratchGame.moves({square:sq,verbose:true}).map(m=>m.to)));
      return;
    }

    const isPM = o.tab!=="analysis" && o.game.turn()!==o.pCol && o.on && !o.over;
    const checkBoard = isPM ? o.virtualGame : o.game;

    // Priority 1: complete existing selection → execute move immediately
    if(!o.over && !o.editorMode){
      if(!isPM && o.sel && o.vm.has(sq)){
        const f = o.sel; const mp = o.game.get(f);
        if(mp?.type==="p" && (sq[1]==="1"||sq[1]==="8")){
          if(o.autoQueen) o.exec(f,sq,"q"); else o.sPromo({from:f,to:sq});
        } else o.exec(f,sq);
        o.sSel(null); o.sVm(new Set()); return;
      }
      // Priority 2: complete existing premove selection
      if(isPM && o.pmSelRef.current && sq!==o.pmSelRef.current && o.pmsRef.current.length<o.pmLim){
        const f = o.pmSelRef.current;
        const vp = o.virtualGame.get(f) || o.game.get(f);
        const pre:Pre = {from:f,to:sq};
        const pr = o.pCol==="w"?"8":"1";
        if(vp?.type==="p" && sq[1]===pr) pre.pr="q";
        o.sPms(v=>[...v,pre]); o.sPmSel(null); o.sVm(new Set()); o.snd("premove"); return;
      }
      // Double-click same piece → deselect
      if(!isPM && o.sel===sq && !o.vm.has(sq)){ o.sSel(null); o.sVm(new Set()); return; }
    }

    const p = checkBoard.get(sq);
    const side = o.tab==="analysis" ? o.game.turn() : o.pCol;
    const canDrag = !!p && (o.tab==="analysis" ? true : p.color===side) && !o.over;
    if(!canDrag) return;

    e.preventDefault();
    const boardEl = boardRef.current || e.currentTarget as HTMLElement;
    const br = boardEl.getBoundingClientRect();
    const bRect = {l:br.left,t:br.top,cw:br.width/8,flip:o.flip};
    dragRef.current = {from:sq,sx:e.clientX,sy:e.clientY,active:false,pid:e.pointerId,bRect};
    ghostSizeRef.current = Math.max(52, Math.round(bRect.cw*1.2));

    const isMyTurn = o.tab==="analysis" || o.game.turn()===o.pCol;
    if(isMyTurn){
      o.sSel(sq);
      o.sVm(new Set(o.game.moves({square:sq,verbose:true}).map(m=>m.to)));
    } else if(o.on){
      o.sPmSel(sq);
      try{ o.sVm(new Set(o.virtualGame.moves({square:sq,verbose:true}).map(m=>m.to))); }catch{}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[sqFromBoard]);

  // Legacy React synthetic handlers for inside-board coverage
  // (window listeners cover outside-board; these handle inside fast events)
  const onBoardMove = useCallback((e:React.PointerEvent)=>{
    const d = dragRef.current;
    if(!d||d.pid!==e.pointerId) return;
    const dx=e.clientX-d.sx, dy=e.clientY-d.sy;
    if(!d.active && Math.hypot(dx,dy)>3){
      d.active=true;
      ghostPosRef.current={x:e.clientX,y:e.clientY};
      ghostSizeRef.current=Math.max(52,Math.round(d.bRect.cw*1.2));
      sGhostFrom(d.from);
      document.body.style.cursor="grabbing";
    }
    if(d.active){
      ghostPosRef.current={x:e.clientX,y:e.clientY};
      if(ghostRafRef.current===null) ghostRafRef.current=requestAnimationFrame(flushGhost);
      const hover = sqFromCachedRect(e.clientX,e.clientY,d.bRect);
      const target = hover&&hover!==d.from?hover:null;
      if(target!==dragHoverRef.current){ dragHoverRef.current=target; sDragHover(target); }
    }
  },[flushGhost,sqFromCachedRect]);

  const onBoardUp = useCallback((e:React.PointerEvent)=>{
    // Window listener handles the actual drop logic.
    // This handler just cleans up in case window listener didn't fire.
    const d = dragRef.current;
    if(!d) return;
    cancelGhostRaf(); sGhostFrom(null);
    if(dragHoverRef.current!==null){ dragHoverRef.current=null; sDragHover(null); }
    document.body.style.cursor="";
  },[cancelGhostRaf]);

  const onBoardCancel = useCallback(()=>{
    // Salvage: if drag was active and pointer ended over a valid square,
    // commit as if pointerup fired. Windows pen / multitouch may surface
    // pointercancel even after preventDefault — this prevents lost moves.
    const d = dragRef.current;
    if(d && d.active){
      const {x,y} = ghostPosRef.current;
      const to = sqFromCachedRect(x,y,d.bRect) || sqFromBoard(x,y);
      if(to && to!==d.from){
        recentDragRef.current = Date.now();
        executeDrop(d.from, to);
      }
    }
    dragRef.current=null; cancelGhostRaf(); sGhostFrom(null);
    if(dragHoverRef.current!==null){ dragHoverRef.current=null; sDragHover(null); }
    document.body.style.cursor="";
  },[cancelGhostRaf, executeDrop, sqFromBoard, sqFromCachedRect]);

  return {
    boardRef, ghostRef, ghostPosRef, ghostSizeRef,
    ghostFrom, dragHover, recentDragRef,
    onBoardDown, onBoardMove, onBoardUp, onBoardCancel,
    sqFromBoard,
  };
}
