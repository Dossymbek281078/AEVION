"use client";
/**
 * BoardDebugHud — live diagnostic overlay for chess drag/click events.
 * Shows in real time whether pointer events reach the board, what the
 * drag state contains, and where the ghost is. Toggle with Ctrl+Shift+D
 * or set localStorage.aevion_chess_debug = "1".
 */

import { useEffect, useRef, useState } from "react";

interface DebugHudProps {
  boardRef: React.RefObject<HTMLDivElement|null>;
  ghostRef: React.RefObject<HTMLDivElement|null>;
  ghostFrom: string|null;
  dragHover: string|null;
}

export function BoardDebugHud({ boardRef, ghostRef, ghostFrom, dragHover }: DebugHudProps) {
  const [visible, setVisible] = useState<boolean>(()=>{
    try { return typeof window!=="undefined" && localStorage.getItem("aevion_chess_debug")==="1"; }
    catch { return false; }
  });
  const [counts, setCounts] = useState({down:0, move:0, up:0, cancel:0, lastEvent:""});
  const [boardRect, setBoardRect] = useState<{l:number;t:number;w:number;h:number}|null>(null);
  const [ghostStyle, setGhostStyle] = useState<{visibility:string;transform:string;w:string;h:string}|null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "D" || e.key === "d")) {
        setVisible(v => {
          const nv = !v;
          try { localStorage.setItem("aevion_chess_debug", nv ? "1" : "0"); } catch {}
          return nv;
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Tap into board pointer events at the document level (capture)
  useEffect(() => {
    if (!visible) return;
    const isBoardEvent = (e: PointerEvent) => {
      const el = boardRef.current;
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return e.clientX >= r.left && e.clientX <= r.right
          && e.clientY >= r.top && e.clientY <= r.bottom;
    };
    const onDown = (e: PointerEvent) => {
      if (!isBoardEvent(e)) return;
      setCounts(c => ({...c, down: c.down+1, lastEvent: `down @${Math.round(e.clientX)},${Math.round(e.clientY)} btn=${e.button} type=${e.pointerType}`}));
    };
    const onMove = (e: PointerEvent) => {
      if (!isBoardEvent(e)) return;
      setCounts(c => ({...c, move: c.move+1, lastEvent: `move @${Math.round(e.clientX)},${Math.round(e.clientY)}`}));
    };
    const onUp = (e: PointerEvent) => {
      if (!isBoardEvent(e)) return;
      setCounts(c => ({...c, up: c.up+1, lastEvent: `up @${Math.round(e.clientX)},${Math.round(e.clientY)}`}));
    };
    const onCancel = (e: PointerEvent) => {
      if (!isBoardEvent(e)) return;
      setCounts(c => ({...c, cancel: c.cancel+1, lastEvent: `cancel`}));
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onCancel, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onCancel, true);
    };
  }, [visible, boardRef]);

  // Snapshot board + ghost styles 4× per second
  useEffect(() => {
    if (!visible) return;
    const tick = () => {
      const b = boardRef.current?.getBoundingClientRect();
      if (b) setBoardRect({l:Math.round(b.left), t:Math.round(b.top), w:Math.round(b.width), h:Math.round(b.height)});
      const g = ghostRef.current;
      if (g) {
        const cs = g.style;
        setGhostStyle({visibility: cs.visibility || "(default)", transform: cs.transform || "(default)", w: cs.width, h: cs.height});
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [visible, boardRef, ghostRef]);

  if (!visible) return null;

  return (
    <div style={{
      position: "fixed", left: 8, bottom: 8, zIndex: 9999,
      background: "rgba(0,0,0,0.85)", color: "#0f0",
      padding: "10px 12px", borderRadius: 8,
      fontFamily: "ui-monospace, monospace", fontSize: 11,
      lineHeight: 1.5, minWidth: 320, maxWidth: 480,
      border: "1px solid #0f0",
      pointerEvents: "none", // never blocks board interaction
      whiteSpace: "pre-wrap" as const,
    }}>
      <div style={{fontWeight: 900, color: "#0ff", marginBottom: 4}}>♟ BOARD DEBUG · Ctrl+Shift+D toggle</div>
      <div>events: down={counts.down}  move={counts.move}  up={counts.up}  cancel={counts.cancel}</div>
      <div style={{color:"#ff0"}}>last: {counts.lastEvent || "(none — try clicking the board)"}</div>
      <div style={{marginTop:6}}>boardRef: {boardRect ? `${boardRect.w}×${boardRect.h} @ ${boardRect.l},${boardRect.t}` : "(null!)"}</div>
      <div>ghostRef: {ghostStyle ? `vis=${ghostStyle.visibility} ${ghostStyle.w}×${ghostStyle.h}` : "(null!)"}</div>
      {ghostStyle && <div style={{color:"#aaa",fontSize:10}}>tx: {ghostStyle.transform}</div>}
      <div style={{marginTop:6,color:"#0ff"}}>state: ghostFrom={ghostFrom||"null"}  hover={dragHover||"null"}</div>
      <div style={{marginTop:4,fontSize:10,color:"#888"}}>If down=0 — events don't reach the board (parent stops them).{"\n"}If move=0 after down — pointer capture or scroll intercepts.{"\n"}If ghostFrom=null after a drag — sGhostFrom not firing.{"\n"}If ghostFrom set but vis=hidden — ancestor transform breaks position:fixed.</div>
    </div>
  );
}
