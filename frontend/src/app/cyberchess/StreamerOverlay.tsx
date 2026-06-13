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

// A valid YouTube video id is exactly 11 chars of [A-Za-z0-9_-].
const YT_ID = /^[A-Za-z0-9_-]{11}$/;

// Parse a "t"/"start" timestamp into whole seconds. Accepts "90", "90s", "1m30s", "1h2m3s".
function ytStartSeconds(raw: string | null): number | null {
  if (!raw) return null;
  const v = raw.trim();
  if (/^\d+$/.test(v)) { const n = parseInt(v, 10); return n > 0 ? n : null; }
  const m = v.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (m && (m[1] || m[2] || m[3])) {
    const sec = (parseInt(m[1] || "0", 10) * 3600) + (parseInt(m[2] || "0", 10) * 60) + parseInt(m[3] || "0", 10);
    return sec > 0 ? sec : null;
  }
  return null;
}

// Build a clean embed URL for a video id, stripping all params except autoplay + optional start.
function ytEmbed(id: string, startParam?: string | null): string {
  const start = ytStartSeconds(startParam ?? null);
  return `https://www.youtube.com/embed/${id}?autoplay=1${start ? `&start=${start}` : ""}`;
}

// Extract YouTube video ID from URL formats: plain id, watch?v=X, youtu.be/X,
// youtube.com/live/X, youtube.com/embed/X, youtube.com/shorts/X, youtube.com/@channel/live.
function ytEmbedUrl(input: string): string | null {
  if (!input) return null;
  const s = input.trim();
  // Channel handle? @name → live embed
  const handle = s.match(/^@([\w.-]+)$/);
  if (handle) return `https://www.youtube.com/embed/live_stream?channel=${handle[1]}`;
  // Plain video ID (exactly 11 valid chars)
  if (YT_ID.test(s)) return ytEmbed(s);
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    if (!/(^|\.)(youtube\.com|youtu\.be)$/i.test(u.hostname)) return null;
    const start = u.searchParams.get("t") || u.searchParams.get("start");
    // watch?v=ID
    const v = u.searchParams.get("v");
    if (v && YT_ID.test(v)) return ytEmbed(v, start);
    const parts = u.pathname.split("/").filter(Boolean);
    // youtu.be/ID (id is the first path segment)
    if (/(^|\.)youtu\.be$/i.test(u.hostname) && parts[0] && YT_ID.test(parts[0])) return ytEmbed(parts[0], start);
    // /live/ID, /embed/ID, /shorts/ID, /v/ID
    for (const seg of ["live", "embed", "shorts", "v"]) {
      const idx = parts.indexOf(seg);
      if (idx >= 0 && parts[idx + 1] && YT_ID.test(parts[idx + 1])) return ytEmbed(parts[idx + 1], start);
    }
    // youtube.com/@channel/live (best-effort live embed for the channel)
    const cIdx = parts.findIndex(p => p.startsWith("@"));
    if (cIdx >= 0) {
      // @channel/live → live_stream channel embed; @channel/VIDEOID → that video
      const next = parts[cIdx + 1];
      if (next && YT_ID.test(next)) return ytEmbed(next, start);
      return `https://www.youtube.com/embed/live_stream?channel=${parts[cIdx].slice(1)}`;
    }
  } catch {}
  return null;
}

// The Twitch embed requires the real embedding host as the `parent` param, or it refuses
// to load. Resolve it safely: prefer the top window's hostname (guards against being inside
// an iframe / SSR where window is undefined), fall back to localhost for dev.
function twitchParent(): string {
  if (typeof window === "undefined") return "localhost";
  try {
    // window.location.hostname is the real host the page is served from.
    const h = window.location.hostname;
    return h && h !== "null" ? h : "localhost";
  } catch {
    return "localhost";
  }
}

// Extract Twitch channel from a full twitch.tv/<channel> URL or accept a bare channel name.
function twEmbedUrl(input: string): string | null {
  if (!input) return null;
  const s = input.trim().replace(/^@/, "");
  const parent = twitchParent();
  // Bare channel name (Twitch usernames are alphanumeric + underscore).
  if (/^\w+$/.test(s)) return `https://player.twitch.tv/?channel=${encodeURIComponent(s)}&parent=${encodeURIComponent(parent)}&muted=true`;
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    if (!/(^|\.)twitch\.tv$/i.test(u.hostname)) return null;
    const ch = u.pathname.split("/").filter(Boolean)[0];
    if (ch && /^\w+$/.test(ch)) return `https://player.twitch.tv/?channel=${encodeURIComponent(ch)}&parent=${encodeURIComponent(parent)}&muted=true`;
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
    const vw = window.innerWidth, vh = window.innerHeight;
    let x = Math.max(0, Math.min(vw - 80, e.clientX - d.dx));
    let y = Math.max(0, Math.min(vh - 40, e.clientY - d.dy));
    // Snap-to-edge: when dropped within SNAP px of a viewport edge, dock the panel
    // flush to that edge so it parks out of the way instead of floating over the board.
    const SNAP = 48;
    const w = state.minimized ? 200 : state.size.w;
    const h = state.minimized ? 32 : state.size.h;
    if (x <= SNAP) x = 0;
    else if (x + w >= vw - SNAP) x = Math.max(0, vw - w);
    if (y <= SNAP) y = 0;
    else if (y + h >= vh - SNAP) y = Math.max(0, vh - h);
    onChange({ pos: { x, y } });
  }, [onChange, state.minimized, state.size.w, state.size.h]);

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
              {...({ credentialless: "" } as Record<string, unknown>)}
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
