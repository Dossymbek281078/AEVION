"use client";
/**
 * StreamerOverlay — draggable YouTube + Twitch embed panels for Streamer Mode.
 *
 * Two independent floating panels (YT + Twitch). Each:
 *  - draggable by header
 *  - resizable corner (320–720 px wide, aspect-locked 16:9)
 *  - URL/channel input persisted to localStorage
 *  - minimize/close
 *  - hidden by default; "+ Add stream" buttons in toolbar reveal them
 *
 * Pure presentational + DOM. No deps on chess state.
 */

import { useCallback, useEffect, useRef, useState } from "react";

type Pos = { x: number; y: number };
type Size = { w: number; h: number };
type Panel = {
  visible: boolean;
  minimized: boolean;
  pos: Pos;
  size: Size;
  url: string;
};

const LS_KEY = "aevion_streamer_panels_v1";

const DEFAULT_PANELS: Record<"yt" | "tw", Panel> = {
  yt: { visible: false, minimized: false, pos: { x: 24, y: 96 }, size: { w: 420, h: 236 }, url: "" },
  tw: { visible: false, minimized: false, pos: { x: 24, y: 360 }, size: { w: 420, h: 236 }, url: "" },
};

function loadPanels(): Record<"yt" | "tw", Panel> {
  if (typeof window === "undefined") return DEFAULT_PANELS;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_PANELS;
    const parsed = JSON.parse(raw);
    return {
      yt: { ...DEFAULT_PANELS.yt, ...(parsed.yt || {}) },
      tw: { ...DEFAULT_PANELS.tw, ...(parsed.tw || {}) },
    };
  } catch {
    return DEFAULT_PANELS;
  }
}

function savePanels(p: Record<"yt" | "tw", Panel>) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch {}
}

// Extract YouTube video ID from URL formats: youtu.be/X, watch?v=X, /live/X, /embed/X.
function ytEmbedUrl(input: string): string | null {
  if (!input) return null;
  const s = input.trim();
  // Channel handle? @name → live embed
  const handle = s.match(/^@([\w.-]+)$/);
  if (handle) return `https://www.youtube.com/embed/live_stream?channel=${handle[1]}`;
  // Plain video ID (11 chars)
  if (/^[\w-]{11}$/.test(s)) return `https://www.youtube.com/embed/${s}?autoplay=1`;
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    const v = u.searchParams.get("v");
    if (v) return `https://www.youtube.com/embed/${v}?autoplay=1`;
    const parts = u.pathname.split("/").filter(Boolean);
    const liveIdx = parts.indexOf("live");
    if (liveIdx >= 0 && parts[liveIdx + 1]) return `https://www.youtube.com/embed/${parts[liveIdx + 1]}?autoplay=1`;
    const embedIdx = parts.indexOf("embed");
    if (embedIdx >= 0 && parts[embedIdx + 1]) return `https://www.youtube.com/embed/${parts[embedIdx + 1]}?autoplay=1`;
    if (u.hostname.includes("youtu.be") && parts[0]) return `https://www.youtube.com/embed/${parts[0]}?autoplay=1`;
    // Channel URL
    const cIdx = parts.findIndex(p => p.startsWith("@"));
    if (cIdx >= 0) return `https://www.youtube.com/embed/live_stream?channel=${parts[cIdx].slice(1)}`;
  } catch {}
  return null;
}

// Extract Twitch channel from URL or accept bare channel name.
function twEmbedUrl(input: string): string | null {
  if (!input) return null;
  const s = input.trim().replace(/^@/, "");
  const parent = typeof window !== "undefined" ? window.location.hostname : "localhost";
  if (/^[\w-]+$/.test(s)) return `https://player.twitch.tv/?channel=${s}&parent=${parent}&muted=true`;
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    const ch = u.pathname.split("/").filter(Boolean)[0];
    if (ch) return `https://player.twitch.tv/?channel=${ch}&parent=${parent}&muted=true`;
  } catch {}
  return null;
}

interface PanelHostProps {
  kind: "yt" | "tw";
  state: Panel;
  onChange: (p: Partial<Panel>) => void;
  onClose: () => void;
}

function PanelHost({ kind, state, onChange, onClose }: PanelHostProps) {
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const resizeRef = useRef<{ sw: number; sh: number; sx: number; sy: number } | null>(null);
  const [editing, setEditing] = useState(!state.url);

  const onHeaderDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    dragRef.current = { dx: e.clientX - state.pos.x, dy: e.clientY - state.pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [state.pos.x, state.pos.y]);

  const onHeaderMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current; if (!d) return;
    e.preventDefault();
    const x = Math.max(0, Math.min(window.innerWidth - 80, e.clientX - d.dx));
    const y = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - d.dy));
    onChange({ pos: { x, y } });
  }, [onChange]);

  const onHeaderUp = useCallback((e: React.PointerEvent) => {
    dragRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId); } catch {}
  }, []);

  const onResizeDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    resizeRef.current = { sw: state.size.w, sh: state.size.h, sx: e.clientX, sy: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [state.size.w, state.size.h]);

  const onResizeMove = useCallback((e: React.PointerEvent) => {
    const r = resizeRef.current; if (!r) return;
    e.preventDefault();
    const dx = e.clientX - r.sx;
    const w = Math.max(280, Math.min(900, r.sw + dx));
    const h = Math.round(w * 9 / 16) + 32; // header height
    onChange({ size: { w, h } });
  }, [onChange]);

  const onResizeUp = useCallback((e: React.PointerEvent) => {
    resizeRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId); } catch {}
  }, []);

  const embed = kind === "yt" ? ytEmbedUrl(state.url) : twEmbedUrl(state.url);
  const accent = kind === "yt" ? "#ff0033" : "#9146ff";
  const label = kind === "yt" ? "YouTube" : "Twitch";
  const placeholder = kind === "yt"
    ? "URL, video ID, or @channel"
    : "channel name or twitch.tv URL";

  return (
    <div style={{
      position: "fixed",
      left: state.pos.x, top: state.pos.y,
      width: state.minimized ? 200 : state.size.w,
      height: state.minimized ? 32 : state.size.h,
      background: "#0a0a0a",
      border: `1px solid ${accent}`,
      borderRadius: 10,
      boxShadow: `0 12px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)`,
      overflow: "hidden",
      zIndex: 250,
      display: "flex",
      flexDirection: "column",
    }}>
      <div
        onPointerDown={onHeaderDown}
        onPointerMove={onHeaderMove}
        onPointerUp={onHeaderUp}
        onPointerCancel={onHeaderUp}
        style={{
          height: 32, padding: "0 8px",
          display: "flex", alignItems: "center", gap: 6,
          background: `linear-gradient(180deg, ${accent}33, transparent)`,
          borderBottom: state.minimized ? "none" : `1px solid ${accent}55`,
          cursor: "move", userSelect: "none",
          touchAction: "none",
        }}>
        <span style={{ width: 10, height: 10, borderRadius: 999, background: accent }} />
        <span style={{ color: "#fff", fontSize: 11, fontWeight: 800, letterSpacing: 0.5, flex: 1 }}>{label}</span>
        <button title="Edit URL" onClick={() => setEditing(v => !v)} style={btnStyle}>✎</button>
        <button title={state.minimized ? "Expand" : "Minimize"} onClick={() => onChange({ minimized: !state.minimized })} style={btnStyle}>{state.minimized ? "▢" : "—"}</button>
        <button title="Close" onClick={onClose} style={btnStyle}>✕</button>
      </div>
      {!state.minimized && (
        <div style={{ flex: 1, position: "relative", background: "#000" }}>
          {editing && (
            <div style={{
              position: "absolute", inset: 0, zIndex: 2,
              background: "rgba(0,0,0,0.92)",
              display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
              gap: 10, padding: 16,
            }}>
              <div style={{ color: accent, fontSize: 12, fontWeight: 800, letterSpacing: 0.5 }}>{label} stream URL</div>
              <input
                autoFocus
                value={state.url}
                onChange={e => onChange({ url: e.target.value })}
                onKeyDown={e => { if (e.key === "Enter") setEditing(false); if (e.key === "Escape") setEditing(false); }}
                placeholder={placeholder}
                style={{
                  width: "92%", maxWidth: 520, padding: "10px 12px",
                  background: "#111", color: "#fff",
                  border: `1px solid ${accent}`, borderRadius: 6,
                  fontSize: 13, outline: "none",
                }}
              />
              <button onClick={() => setEditing(false)} style={{
                padding: "8px 18px", background: accent, color: "#fff",
                border: "none", borderRadius: 6, fontSize: 12, fontWeight: 800,
                cursor: "pointer",
              }}>Done</button>
              <div style={{ color: "#888", fontSize: 10, textAlign: "center" }}>
                {kind === "yt"
                  ? "Examples: dQw4w9WgXcQ · youtube.com/watch?v=… · @LinusTechTips"
                  : "Examples: gmhikaru · twitch.tv/gmhikaru"}
              </div>
            </div>
          )}
          {embed ? (
            <iframe
              key={embed}
              src={embed}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              style={{ width: "100%", height: "100%", border: 0, display: "block" }}
            />
          ) : (
            !editing && <div style={{
              width: "100%", height: "100%",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#666", fontSize: 12,
            }}>
              No stream — click ✎ to set URL
            </div>
          )}
          <div
            onPointerDown={onResizeDown}
            onPointerMove={onResizeMove}
            onPointerUp={onResizeUp}
            onPointerCancel={onResizeUp}
            title="Drag to resize"
            style={{
              position: "absolute", right: 0, bottom: 0,
              width: 16, height: 16, cursor: "nwse-resize",
              background: `linear-gradient(135deg, transparent 50%, ${accent} 50%)`,
              touchAction: "none",
            }}
          />
        </div>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  width: 22, height: 22, padding: 0,
  background: "rgba(255,255,255,0.08)", color: "#fff",
  border: "1px solid rgba(255,255,255,0.15)", borderRadius: 4,
  fontSize: 12, lineHeight: 1, cursor: "pointer",
  display: "inline-flex", alignItems: "center", justifyContent: "center",
};

export interface StreamerOverlayHandle {
  show: (kind: "yt" | "tw") => void;
}

interface StreamerOverlayProps {
  active: boolean; // when false, panels stay hidden regardless of state
  onToolbar?: (toolbar: { showYT: () => void; showTW: () => void; ytVisible: boolean; twVisible: boolean }) => void;
}

export function StreamerOverlay({ active, onToolbar }: StreamerOverlayProps) {
  const [panels, setPanels] = useState<Record<"yt" | "tw", Panel>>(() => loadPanels());

  useEffect(() => { savePanels(panels); }, [panels]);

  const update = useCallback((kind: "yt" | "tw", patch: Partial<Panel>) => {
    setPanels(p => ({ ...p, [kind]: { ...p[kind], ...patch } }));
  }, []);

  const showYT = useCallback(() => update("yt", { visible: true, minimized: false }), [update]);
  const showTW = useCallback(() => update("tw", { visible: true, minimized: false }), [update]);

  useEffect(() => {
    onToolbar?.({
      showYT, showTW,
      ytVisible: panels.yt.visible,
      twVisible: panels.tw.visible,
    });
  }, [onToolbar, showYT, showTW, panels.yt.visible, panels.tw.visible]);

  if (!active) return null;

  return (<>
    {panels.yt.visible && (
      <PanelHost
        kind="yt"
        state={panels.yt}
        onChange={p => update("yt", p)}
        onClose={() => update("yt", { visible: false })}
      />
    )}
    {panels.tw.visible && (
      <PanelHost
        kind="tw"
        state={panels.tw}
        onChange={p => update("tw", p)}
        onClose={() => update("tw", { visible: false })}
      />
    )}
  </>);
}
