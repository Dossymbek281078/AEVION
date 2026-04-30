"use client";
import React, { useState, useEffect } from "react";

// Multi-panel: до 4 окон с произвольным контентом — YouTube/Twitch live + чат + чат-боты
// + произвольный URL. Чтобы стримить шахматы и одновременно смотреть разборы.

export type PaneKind = "empty" | "youtube" | "twitch" | "twitch-chat" | "url";
export type Pane = { id: string; kind: PaneKind; src: string; label?: string };

const STORAGE = "aevion_chess_multipanel_v1";

function loadPanes(): Pane[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, 4);
  } catch { return []; }
}
function savePanes(p: Pane[]) {
  try { localStorage.setItem(STORAGE, JSON.stringify(p)); } catch {}
}

function ytId(url: string): string | null {
  // https://youtu.be/ID, https://www.youtube.com/watch?v=ID, https://www.youtube.com/live/ID
  const m =
    url.match(/youtu\.be\/([\w-]{11})/) ||
    url.match(/youtube\.com\/watch\?v=([\w-]{11})/) ||
    url.match(/youtube\.com\/live\/([\w-]{11})/) ||
    url.match(/youtube\.com\/embed\/([\w-]{11})/);
  return m ? m[1] : null;
}
function twitchChannel(url: string): string | null {
  // https://www.twitch.tv/CHANNEL  | https://twitch.tv/CHANNEL
  const m = url.match(/twitch\.tv\/([\w]+)/);
  return m ? m[1] : null;
}

function makeIframeSrc(p: Pane): string {
  if (p.kind === "youtube") {
    const id = ytId(p.src) || p.src;
    return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1`;
  }
  if (p.kind === "twitch") {
    const ch = twitchChannel(p.src) || p.src;
    const parent = typeof window !== "undefined" ? window.location.hostname : "localhost";
    return `https://player.twitch.tv/?channel=${ch}&parent=${parent}&muted=true`;
  }
  if (p.kind === "twitch-chat") {
    const ch = twitchChannel(p.src) || p.src;
    const parent = typeof window !== "undefined" ? window.location.hostname : "localhost";
    return `https://www.twitch.tv/embed/${ch}/chat?parent=${parent}&darkpopout`;
  }
  if (p.kind === "url") return p.src;
  return "about:blank";
}

function detectKind(url: string): PaneKind {
  if (/youtu\.?be/.test(url)) return "youtube";
  if (/twitch\.tv/.test(url)) return "twitch";
  return "url";
}

type Props = { open: boolean; onClose: () => void };

export default function MultiPanel({ open, onClose }: Props) {
  const [panes, setPanes] = useState<Pane[]>([]);
  const [draft, setDraft] = useState("");
  const [layout, setLayout] = useState<1 | 2 | 3 | 4>(2);

  useEffect(() => {
    if (open) {
      const ld = loadPanes();
      setPanes(ld);
      const lay = Math.max(1, Math.min(4, ld.length || 2)) as 1|2|3|4;
      setLayout(lay);
    }
  }, [open]);

  useEffect(() => { savePanes(panes); }, [panes]);

  if (!open) return null;

  const addPane = (input: string) => {
    if (!input.trim() || panes.length >= 4) return;
    const kind = detectKind(input);
    const id = `p_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    let label = "";
    if (kind === "youtube") {
      const id2 = ytId(input);
      label = id2 ? `YT · ${id2.slice(0,8)}` : "YouTube";
    } else if (kind === "twitch") {
      const ch = twitchChannel(input);
      label = ch ? `Twitch · ${ch}` : "Twitch";
    } else {
      try { label = new URL(input).hostname; } catch { label = "Custom"; }
    }
    setPanes(p => [...p, { id, kind, src: input.trim(), label }]);
    setDraft("");
  };

  const addQuick = (kind: PaneKind, src: string, label: string) => {
    if (panes.length >= 4) return;
    const id = `p_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    setPanes(p => [...p, { id, kind, src, label }]);
  };

  const removePane = (id: string) => setPanes(p => p.filter(x => x.id !== id));
  const clearAll = () => { setPanes([]); savePanes([]); };

  // Grid layout based on count.
  const cols = layout === 1 ? "1fr" : layout === 2 ? "1fr 1fr" : layout === 3 ? "1fr 1fr 1fr" : "1fr 1fr";
  const rows = layout <= 2 ? "1fr" : layout === 3 ? "1fr" : "1fr 1fr";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.92)", backdropFilter: "blur(8px)",
      display: "flex", flexDirection: "column",
    }}>
      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
        background: "rgba(15,23,42,0.95)", borderBottom: "1px solid rgba(255,255,255,0.1)",
        flexWrap: "wrap"
      }}>
        <span style={{ fontSize: 16, fontWeight: 900, color: "#fff", letterSpacing: 0.4 }}>📺 Multi-panel</span>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>{panes.length}/4</span>
        <div style={{ flex: 1 }} />
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") addPane(draft); }}
          placeholder="Вставь YouTube / Twitch / любой URL"
          style={{
            flex: "1 1 320px", maxWidth: 480, padding: "7px 12px",
            borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(0,0,0,0.4)", color: "#fff", fontSize: 13,
          }}
        />
        <button onClick={() => addPane(draft)} disabled={!draft.trim() || panes.length >= 4} style={{
          padding: "7px 14px", borderRadius: 8, border: "none",
          background: draft.trim() && panes.length < 4 ? "#10b981" : "rgba(255,255,255,0.1)",
          color: "#fff", fontWeight: 800, cursor: draft.trim() && panes.length < 4 ? "pointer" : "not-allowed",
          fontSize: 12,
        }}>+ Добавить</button>
        {/* Layout switcher */}
        <div style={{ display: "flex", gap: 4 }}>
          {([1, 2, 3, 4] as const).map(n => (
            <button key={n} onClick={() => setLayout(n)} style={{
              width: 28, height: 28, borderRadius: 6,
              border: "1px solid " + (layout === n ? "#7c3aed" : "rgba(255,255,255,0.15)"),
              background: layout === n ? "#7c3aed" : "rgba(255,255,255,0.05)",
              color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer"
            }}>{n}</button>
          ))}
        </div>
        <button onClick={clearAll} disabled={panes.length === 0} title="Очистить все панели" style={{
          padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)",
          background: "transparent", color: panes.length ? "#fca5a5" : "rgba(255,255,255,0.3)",
          fontSize: 12, fontWeight: 700, cursor: panes.length ? "pointer" : "not-allowed"
        }}>Очистить</button>
        <button onClick={onClose} style={{
          padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)",
          background: "rgba(220,38,38,0.2)", color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 12,
        }}>✕ Закрыть</button>
      </div>

      {/* Quick suggestions when empty */}
      {panes.length === 0 && (
        <div style={{ padding: 24, textAlign: "center", color: "rgba(255,255,255,0.85)" }}>
          <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>📺 Раздели экран до 4 окон</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 16 }}>
            Подключи YouTube-стрим, Twitch-канал, любой URL — для одновременного просмотра во время игры.
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => addQuick("twitch", "https://twitch.tv/gmhikaru", "Twitch · GMHikaru")} style={{
              padding: "10px 16px", borderRadius: 8, border: "1px solid #9146ff",
              background: "rgba(145,70,255,0.15)", color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 13
            }}>🟣 Hikaru на Twitch</button>
            <button onClick={() => addQuick("twitch", "https://twitch.tv/chess", "Twitch · chess.com")} style={{
              padding: "10px 16px", borderRadius: 8, border: "1px solid #9146ff",
              background: "rgba(145,70,255,0.15)", color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 13
            }}>🟣 Twitch chess.com</button>
            <button onClick={() => addQuick("youtube", "https://www.youtube.com/@chess", "YouTube · chess.com")} style={{
              padding: "10px 16px", borderRadius: 8, border: "1px solid #ef4444",
              background: "rgba(239,68,68,0.15)", color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 13
            }}>🔴 YouTube chess.com</button>
          </div>
        </div>
      )}

      {/* Panels grid */}
      {panes.length > 0 && (
        <div style={{
          flex: 1, display: "grid",
          gridTemplateColumns: cols, gridTemplateRows: rows,
          gap: 6, padding: 6, minHeight: 0,
        }}>
          {panes.slice(0, layout).map(p => (
            <div key={p.id} style={{
              position: "relative", display: "flex", flexDirection: "column",
              background: "#000", borderRadius: 6, overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.1)", minHeight: 0,
            }}>
              {/* Pane header */}
              <div style={{
                display: "flex", alignItems: "center", gap: 8, padding: "5px 10px",
                background: "rgba(15,23,42,0.95)", borderBottom: "1px solid rgba(255,255,255,0.08)",
                flexShrink: 0,
              }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#fff",
                  padding: "2px 6px", borderRadius: 3,
                  background: p.kind === "youtube" ? "#ef4444" : p.kind === "twitch" || p.kind === "twitch-chat" ? "#9146ff" : "#64748b",
                }}>{p.kind === "youtube" ? "YT" : p.kind === "twitch" ? "TW" : p.kind === "twitch-chat" ? "CHAT" : "URL"}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: "#e2e8f0", fontWeight: 700,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.label}</span>
                {/* Open in tab */}
                <a href={p.src} target="_blank" rel="noopener noreferrer" title="Открыть в новой вкладке" style={{
                  fontSize: 13, color: "#94a3b8", textDecoration: "none"
                }}>↗</a>
                <button onClick={() => removePane(p.id)} title="Удалить панель" style={{
                  width: 20, height: 20, borderRadius: 4, border: "none",
                  background: "rgba(220,38,38,0.2)", color: "#fca5a5", cursor: "pointer",
                  fontSize: 11, fontWeight: 800, padding: 0
                }}>✕</button>
              </div>
              {/* Iframe */}
              <iframe
                src={makeIframeSrc(p)}
                title={p.label || p.id}
                allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                allowFullScreen
                style={{ flex: 1, border: "none", background: "#000", minHeight: 0 }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
