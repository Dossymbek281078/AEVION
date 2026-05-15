"use client";
/**
 * WorkspacePiP — floating Picture-in-Picture panel for CyberChess workspace.
 *
 * A draggable, resizable, always-on-top window that shows a YouTube / Twitch
 * stream (or arbitrary URL) over the chess UI. Lets the user watch a stream
 * AND play simultaneously without splitting the main layout.
 *
 *   - Drag header to move (mouse + touch)
 *   - SE corner to resize (8×8 grab handle)
 *   - Collapse to chip · expand · dismiss
 *   - Mute / source-switch overlay
 *   - Position + size persist in localStorage
 *   - Optional Twitch chat side-panel
 */
import React, { useState, useEffect, useRef, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────
export type PiPSource = {
  kind: "youtube" | "twitch" | "url";
  url: string;
  title?: string;
};

type Props = {
  initialSource?: PiPSource;
  defaultPosition?: { x: number; y: number };
  onClose?: () => void;
  /** Optional companion: render a Twitch chat side-panel when source.kind === "twitch" */
  showChatPanel?: boolean;
};

// ── Storage ────────────────────────────────────────────────────────────────
const POS_KEY = "aevion_cyberchess_pip_pos_v1";
const SIZE_KEY = "aevion_cyberchess_pip_size_v1";
const SRC_KEY = "aevion_cyberchess_pip_src_v1";
const MUTE_KEY = "aevion_cyberchess_pip_mute_v1";

const DEFAULT_SIZE = { w: 320, h: 180 };
const MIN_SIZE = { w: 240, h: 135 };
const DEFAULT_POS = { x: 24, y: 24 };
const CHAT_WIDTH = 240;
const Z_INDEX = 8000;

// ── URL helpers ───────────────────────────────────────────────────────────
export function detectMediaSource(url: string): PiPSource | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // YouTube
  const yt =
    trimmed.match(/youtu\.be\/([\w-]{11})/) ||
    trimmed.match(/youtube\.com\/watch\?v=([\w-]{11})/) ||
    trimmed.match(/youtube\.com\/live\/([\w-]{11})/) ||
    trimmed.match(/youtube\.com\/shorts\/([\w-]{11})/) ||
    trimmed.match(/youtube\.com\/embed\/([\w-]{11})/);
  if (yt) return { kind: "youtube", url: yt[1] };

  // Twitch
  const tw = trimmed.match(/twitch\.tv\/([\w_]+)/i);
  if (tw) return { kind: "twitch", url: tw[1].toLowerCase() };

  // Raw 11-char id → assume YT
  if (/^[\w-]{11}$/.test(trimmed)) return { kind: "youtube", url: trimmed };

  // Plain channel handle → assume Twitch
  if (/^[\w_]{3,30}$/.test(trimmed)) return { kind: "twitch", url: trimmed.toLowerCase() };

  // Generic URL
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try { new URL(withProto); return { kind: "url", url: withProto }; } catch { return null; }
}

function buildEmbedSrc(source: PiPSource, muted: boolean, parent: string): string {
  if (source.kind === "youtube") {
    const muteFlag = muted ? 1 : 0;
    return `https://www.youtube-nocookie.com/embed/${source.url}?autoplay=1&mute=${muteFlag}&playsinline=1&rel=0&modestbranding=1`;
  }
  if (source.kind === "twitch") {
    const parents = [parent, "localhost", "127.0.0.1", "aevion.app", "www.aevion.app", "aevion.vercel.app"];
    const seen = new Set<string>();
    const p = parents.filter(h => { if (!h || seen.has(h)) return false; seen.add(h); return true; })
      .map(h => `parent=${encodeURIComponent(h)}`).join("&");
    return `https://player.twitch.tv/?channel=${source.url}&${p}&muted=${muted}&autoplay=true`;
  }
  return source.url;
}

function buildTwitchChatSrc(channel: string, parent: string): string {
  const parents = [parent, "localhost", "127.0.0.1", "aevion.app", "www.aevion.app", "aevion.vercel.app"];
  const seen = new Set<string>();
  const p = parents.filter(h => { if (!h || seen.has(h)) return false; seen.add(h); return true; })
    .map(h => `parent=${encodeURIComponent(h)}`).join("&");
  return `https://www.twitch.tv/embed/${channel}/chat?darkpopout&${p}`;
}

function loadPos(): { x: number; y: number } {
  if (typeof window === "undefined") return DEFAULT_POS;
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return DEFAULT_POS;
    const j = JSON.parse(raw);
    return { x: Number(j.x) || DEFAULT_POS.x, y: Number(j.y) || DEFAULT_POS.y };
  } catch { return DEFAULT_POS; }
}
function loadSize(): { w: number; h: number } {
  if (typeof window === "undefined") return DEFAULT_SIZE;
  try {
    const raw = localStorage.getItem(SIZE_KEY);
    if (!raw) return DEFAULT_SIZE;
    const j = JSON.parse(raw);
    return {
      w: Math.max(MIN_SIZE.w, Number(j.w) || DEFAULT_SIZE.w),
      h: Math.max(MIN_SIZE.h, Number(j.h) || DEFAULT_SIZE.h),
    };
  } catch { return DEFAULT_SIZE; }
}
function clampToViewport(p: { x: number; y: number }, s: { w: number; h: number }) {
  if (typeof window === "undefined") return p;
  const maxX = Math.max(0, window.innerWidth - s.w - 8);
  const maxY = Math.max(0, window.innerHeight - 40);
  return {
    x: Math.min(Math.max(8, p.x), maxX),
    y: Math.min(Math.max(8, p.y), maxY),
  };
}

// ── Main component ─────────────────────────────────────────────────────────
export default function WorkspacePiP({ initialSource, defaultPosition, onClose, showChatPanel }: Props) {
  const [hydrated, setHydrated] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>(defaultPosition || DEFAULT_POS);
  const [size, setSize] = useState<{ w: number; h: number }>(DEFAULT_SIZE);
  const [source, setSource] = useState<PiPSource | null>(initialSource || null);
  const [muted, setMuted] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [showSourceInput, setShowSourceInput] = useState(false);
  const [draft, setDraft] = useState("");
  const [parent, setParent] = useState("localhost");

  const dragRef = useRef<{ ox: number; oy: number; px: number; py: number } | null>(null);
  const resizeRef = useRef<{ ox: number; oy: number; w: number; h: number } | null>(null);

  // ── Hydration: load persisted state ───────────────────────────────────
  useEffect(() => {
    const loadedSize = loadSize();
    const loadedPos = clampToViewport(loadPos(), loadedSize);
    setSize(loadedSize);
    setPos(loadedPos);
    setParent(window.location.hostname || "localhost");
    try {
      const m = localStorage.getItem(MUTE_KEY);
      if (m !== null) setMuted(m === "1");
      if (!initialSource) {
        const raw = localStorage.getItem(SRC_KEY);
        if (raw) {
          const j = JSON.parse(raw);
          if (j && j.kind && j.url) setSource(j as PiPSource);
        }
      }
    } catch {}
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persist ───────────────────────────────────────────────────────────
  useEffect(() => { if (hydrated) try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch {} }, [pos, hydrated]);
  useEffect(() => { if (hydrated) try { localStorage.setItem(SIZE_KEY, JSON.stringify(size)); } catch {} }, [size, hydrated]);
  useEffect(() => { if (hydrated) try { localStorage.setItem(MUTE_KEY, muted ? "1" : "0"); } catch {} }, [muted, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (source) localStorage.setItem(SRC_KEY, JSON.stringify(source));
      else localStorage.removeItem(SRC_KEY);
    } catch {}
  }, [source, hydrated]);

  // ── Drag (mouse + touch) ──────────────────────────────────────────────
  const onDragStart = useCallback((clientX: number, clientY: number) => {
    dragRef.current = { ox: clientX, oy: clientY, px: pos.x, py: pos.y };
  }, [pos]);

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragRef.current) return;
      const t = "touches" in e ? e.touches[0] : (e as MouseEvent);
      if (!t) return;
      const next = {
        x: dragRef.current.px + (t.clientX - dragRef.current.ox),
        y: dragRef.current.py + (t.clientY - dragRef.current.oy),
      };
      setPos(clampToViewport(next, size));
    };
    const onEnd = () => { dragRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [size]);

  // ── Resize (SE corner) ────────────────────────────────────────────────
  const onResizeStart = useCallback((clientX: number, clientY: number) => {
    resizeRef.current = { ox: clientX, oy: clientY, w: size.w, h: size.h };
  }, [size]);

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!resizeRef.current) return;
      const t = "touches" in e ? e.touches[0] : (e as MouseEvent);
      if (!t) return;
      const nextW = Math.max(MIN_SIZE.w, resizeRef.current.w + (t.clientX - resizeRef.current.ox));
      const nextH = Math.max(MIN_SIZE.h, resizeRef.current.h + (t.clientY - resizeRef.current.oy));
      setSize({ w: nextW, h: nextH });
    };
    const onEnd = () => { resizeRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, []);

  // ── Clamp on viewport resize ─────────────────────────────────────────
  useEffect(() => {
    const onWinResize = () => setPos(p => clampToViewport(p, size));
    window.addEventListener("resize", onWinResize);
    return () => window.removeEventListener("resize", onWinResize);
  }, [size]);

  const applySource = (raw: string) => {
    const s = detectMediaSource(raw);
    if (s) { setSource(s); setShowSourceInput(false); setDraft(""); }
  };

  // ── Collapsed: chip ───────────────────────────────────────────────────
  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        style={{
          position: "fixed", left: pos.x, top: pos.y, zIndex: Z_INDEX,
          padding: "6px 12px", borderRadius: 999,
          background: "rgba(2,6,23,0.95)", border: "1px solid #334155",
          color: "#fbbf24", fontSize: 11, fontWeight: 800, cursor: "pointer",
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", gap: 6,
        }}
        title="Развернуть PiP"
      >
        <span>📺</span>
        <span>{source ? (source.title || source.kind.toUpperCase()) : "PiP"}</span>
      </button>
    );
  }

  const embedSrc = source ? buildEmbedSrc(source, muted, parent) : "";
  const withChat = !!(showChatPanel && source && source.kind === "twitch");

  return (
    <div
      style={{
        position: "fixed", left: pos.x, top: pos.y, zIndex: Z_INDEX,
        display: "flex", flexDirection: "row", gap: 4,
        pointerEvents: "auto",
      }}
    >
      {/* Main floating panel */}
      <div
        style={{
          width: size.w, height: size.h,
          background: "rgba(2,6,23,0.95)",
          border: "1px solid #334155", borderRadius: 8,
          overflow: "hidden",
          display: "flex", flexDirection: "column",
          boxShadow: "0 8px 24px rgba(0,0,0,0.55)",
          position: "relative",
        }}
      >
        {/* Header (drag handle) */}
        <div
          onMouseDown={(e) => { e.preventDefault(); onDragStart(e.clientX, e.clientY); }}
          onTouchStart={(e) => { const t = e.touches[0]; if (t) onDragStart(t.clientX, t.clientY); }}
          style={{
            height: 28, flexShrink: 0,
            display: "flex", alignItems: "center", gap: 6, padding: "0 8px",
            background: "#020617", borderBottom: "1px solid #1e293b",
            cursor: "move", userSelect: "none", touchAction: "none",
          }}
        >
          <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 800 }}>☰</span>
          <span style={{
            flex: 1, fontSize: 10.5, fontWeight: 700, color: "#cbd5e1",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            letterSpacing: 0.3,
          }}>
            {source ? (source.title || `${source.kind.toUpperCase()} · ${source.url}`) : "PiP — выбери источник"}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); setCollapsed(true); }}
            title="Свернуть"
            style={{
              border: "none", background: "transparent", color: "#64748b",
              fontSize: 13, cursor: "pointer", padding: "0 4px", lineHeight: 1,
            }}
          >–</button>
          <button
            onClick={(e) => { e.stopPropagation(); onClose?.(); }}
            title="Закрыть"
            style={{
              border: "none", background: "transparent", color: "#ef4444",
              fontSize: 13, fontWeight: 800, cursor: "pointer", padding: "0 4px", lineHeight: 1,
            }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, position: "relative", background: "#000", minHeight: 0 }}>
          {embedSrc ? (
            <iframe
              src={embedSrc}
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write; accelerometer; gyroscope"
              allowFullScreen
              referrerPolicy="origin-when-cross-origin"
              loading="eager"
              style={{ width: "100%", height: "100%", border: "none", background: "#000", display: "block" }}
            />
          ) : (
            <div style={{
              height: "100%", display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 8, padding: 12,
              color: "#94a3b8", fontSize: 10.5, textAlign: "center",
            }}>
              <div style={{ fontSize: 24 }}>📺</div>
              <div>Вставь YouTube или Twitch URL</div>
              <button
                onClick={() => setShowSourceInput(true)}
                style={{
                  padding: "5px 12px", borderRadius: 4, border: "none",
                  background: "#fbbf24", color: "#0f172a",
                  fontSize: 10, fontWeight: 800, cursor: "pointer",
                }}
              >+ Источник</button>
            </div>
          )}

          {/* Source input overlay */}
          {showSourceInput && (
            <div style={{
              position: "absolute", inset: 0, background: "rgba(2,6,23,0.92)",
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: 6, padding: 12, zIndex: 3,
            }}>
              <input
                autoFocus
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && draft.trim()) applySource(draft.trim());
                  if (e.key === "Escape") { setShowSourceInput(false); setDraft(""); }
                }}
                placeholder="YouTube / Twitch URL"
                style={{
                  width: "100%", maxWidth: 280, padding: "5px 8px", borderRadius: 4,
                  border: "1px solid #334155", background: "#0f172a", color: "#e2e8f0",
                  fontSize: 10.5, fontFamily: "ui-monospace, SFMono-Regular, monospace",
                }}
              />
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => draft.trim() && applySource(draft.trim())}
                  style={{
                    padding: "4px 10px", borderRadius: 4, border: "none",
                    background: "#fbbf24", color: "#0f172a",
                    fontSize: 10, fontWeight: 800, cursor: "pointer",
                  }}
                >OK</button>
                <button
                  onClick={() => { setShowSourceInput(false); setDraft(""); }}
                  style={{
                    padding: "4px 10px", borderRadius: 4, border: "1px solid #334155",
                    background: "transparent", color: "#94a3b8",
                    fontSize: 10, fontWeight: 700, cursor: "pointer",
                  }}
                >Отмена</button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom overlay strip — mute + source */}
        <div style={{
          height: 24, flexShrink: 0,
          display: "flex", alignItems: "center", gap: 4, padding: "0 6px",
          background: "#020617", borderTop: "1px solid #1e293b",
        }}>
          <button
            onClick={() => setMuted(m => !m)}
            title={muted ? "Включить звук" : "Выключить звук"}
            style={{
              border: "none", background: "transparent",
              color: muted ? "#64748b" : "#fbbf24",
              fontSize: 12, cursor: "pointer", padding: "0 4px", lineHeight: 1,
            }}
          >{muted ? "🔇" : "🔊"}</button>
          <button
            onClick={() => setShowSourceInput(true)}
            title="Сменить источник"
            style={{
              border: "none", background: "transparent", color: "#94a3b8",
              fontSize: 9.5, fontWeight: 800, cursor: "pointer",
              padding: "0 6px", letterSpacing: 0.4,
            }}
          >🔗 SRC</button>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 8.5, color: "#475569", fontWeight: 700 }}>
            {size.w}×{size.h}
          </span>
        </div>

        {/* SE resize handle */}
        <div
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onResizeStart(e.clientX, e.clientY); }}
          onTouchStart={(e) => {
            const t = e.touches[0];
            if (t) { e.stopPropagation(); onResizeStart(t.clientX, t.clientY); }
          }}
          title="Изменить размер"
          style={{
            position: "absolute", right: 0, bottom: 0, width: 8, height: 8,
            cursor: "nwse-resize", touchAction: "none",
            background: "linear-gradient(135deg, transparent 0 50%, #fbbf24 50% 100%)",
            zIndex: 4,
          }}
        />
      </div>

      {/* Twitch chat side-panel */}
      {withChat && source && (
        <div style={{
          width: CHAT_WIDTH, height: size.h,
          background: "rgba(2,6,23,0.95)",
          border: "1px solid #334155", borderRadius: 8,
          overflow: "hidden", display: "flex", flexDirection: "column",
          boxShadow: "0 8px 24px rgba(0,0,0,0.55)",
        }}>
          <div style={{
            height: 28, flexShrink: 0,
            display: "flex", alignItems: "center", gap: 6, padding: "0 8px",
            background: "#020617", borderBottom: "1px solid #1e293b",
          }}>
            <span style={{ color: "#94a3b8", fontSize: 11, fontWeight: 800 }}>💬</span>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: "#cbd5e1", letterSpacing: 0.3 }}>
              Twitch chat
            </span>
          </div>
          <iframe
            src={buildTwitchChatSrc(source.url, parent)}
            style={{ flex: 1, width: "100%", border: "none", background: "#0e0e10" }}
          />
        </div>
      )}
    </div>
  );
}

// ── Helper hook for page-level state management ───────────────────────────
export function useWorkspacePiP(): {
  open: boolean;
  source: PiPSource | null;
  show: (s: PiPSource) => void;
  hide: () => void;
  toggle: () => void;
} {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<PiPSource | null>(null);

  const show = useCallback((s: PiPSource) => { setSource(s); setOpen(true); }, []);
  const hide = useCallback(() => { setOpen(false); }, []);
  const toggle = useCallback(() => { setOpen(o => !o); }, []);

  return { open, source, show, hide, toggle };
}
