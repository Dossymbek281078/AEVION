"use client";
/**
 * WorkspaceMediaPane — sticky inline column NEXT to the chess board.
 *
 * Tabs: YouTube · Twitch · Lichess · Custom URL · Notes.
 * Each tab persists its own URL/content. The whole pane persists in localStorage
 * so the user's stream / open-tab survives reload.
 *
 * 320px wide (resizable later); stacks below the board on narrow screens.
 */

import React, { useState, useEffect, useCallback } from "react";

type TabKind = "youtube" | "twitch" | "lichess" | "url" | "notes";
type State = {
  tab: TabKind;
  yt: string;       // YouTube ID or URL
  tw: string;       // Twitch channel
  lichess: string;  // Lichess game/user URL
  url: string;      // free URL
  notes: string;    // freeform notes
};

const STORAGE = "aevion_chess_media_pane_v1";
const DEFAULT: State = {
  tab: "youtube",
  yt: "",
  tw: "",
  lichess: "https://lichess.org/tv",
  url: "",
  notes: "",
};

function load(): State {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(STORAGE);
    if (!raw) return DEFAULT;
    const j = JSON.parse(raw);
    return { ...DEFAULT, ...j };
  } catch { return DEFAULT; }
}
function save(s: State) {
  try { localStorage.setItem(STORAGE, JSON.stringify(s)); } catch {}
}

function ytId(input: string): string | null {
  const m =
    input.match(/youtu\.be\/([\w-]{11})/) ||
    input.match(/youtube\.com\/watch\?v=([\w-]{11})/) ||
    input.match(/youtube\.com\/live\/([\w-]{11})/) ||
    input.match(/youtube\.com\/embed\/([\w-]{11})/) ||
    input.match(/^([\w-]{11})$/);
  return m ? m[1] : null;
}
function twChannel(input: string): string | null {
  const m = input.match(/twitch\.tv\/(\w+)/) || input.match(/^(\w+)$/);
  return m ? m[1] : null;
}

export default function WorkspaceMediaPane() {
  const [state, setState] = useState<State>(DEFAULT);
  const [hyd, setHyd] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => { setState(load()); setHyd(true); }, []);
  useEffect(() => { if (hyd) save(state); }, [state, hyd]);

  const setTab = useCallback((tab: TabKind) => setState(s => ({ ...s, tab })), []);
  const apply = useCallback((value: string) => {
    setState(s => {
      if (s.tab === "youtube") return { ...s, yt: value };
      if (s.tab === "twitch")  return { ...s, tw: value };
      if (s.tab === "lichess") return { ...s, lichess: value };
      if (s.tab === "url")     return { ...s, url: value };
      return s;
    });
    setDraft("");
  }, []);

  const tabs: { id: TabKind; icon: string; label: string }[] = [
    { id: "youtube", icon: "▶", label: "YouTube" },
    { id: "twitch",  icon: "🎥", label: "Twitch" },
    { id: "lichess", icon: "♞", label: "Lichess" },
    { id: "url",     icon: "🔗", label: "URL" },
    { id: "notes",   icon: "📝", label: "Notes" },
  ];

  const parent = typeof window !== "undefined" ? window.location.hostname : "localhost";

  let iframeSrc = "";
  let iframeKey = state.tab;
  if (state.tab === "youtube") {
    const id = ytId(state.yt);
    if (id) iframeSrc = `https://www.youtube.com/embed/${id}?autoplay=1&mute=1`;
    iframeKey = `yt-${id || "empty"}`;
  } else if (state.tab === "twitch") {
    const ch = twChannel(state.tw);
    if (ch) iframeSrc = `https://player.twitch.tv/?channel=${ch}&parent=${parent}&muted=true`;
    iframeKey = `tw-${ch || "empty"}`;
  } else if (state.tab === "lichess") {
    iframeSrc = state.lichess || "https://lichess.org/tv";
    iframeKey = `li-${iframeSrc}`;
  } else if (state.tab === "url") {
    iframeSrc = state.url;
    iframeKey = `url-${iframeSrc}`;
  }

  const showInputBar = state.tab !== "notes" && state.tab !== "lichess";
  const placeholder =
    state.tab === "youtube" ? "YouTube URL или ID (например: dQw4w9WgXcQ)" :
    state.tab === "twitch"  ? "twitch.tv/channel или просто имя канала" :
    state.tab === "url"     ? "Любой URL (https://...)" : "";

  return (
    <div style={{
      width: 340, minWidth: 340, maxWidth: 340,
      display: "flex", flexDirection: "column",
      borderRadius: 12, overflow: "hidden",
      background: "#0f172a", color: "#e2e8f0",
      border: "1px solid #1e293b",
      boxShadow: "0 4px 14px rgba(0,0,0,0.14)",
      height: "min(620px, calc(100vw - 32px))",
    }}>
      {/* Tab strip */}
      <div style={{ display: "flex", gap: 0, background: "#020617", borderBottom: "1px solid #1e293b" }}>
        {tabs.map(t => {
          const active = state.tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              title={t.label}
              style={{
                flex: 1, padding: "8px 0", border: "none",
                background: active ? "#1e293b" : "transparent",
                color: active ? "#fbbf24" : "#94a3b8",
                fontSize: 12, fontWeight: 800, cursor: "pointer",
                borderBottom: active ? "2px solid #fbbf24" : "2px solid transparent",
                transition: "all 0.15s ease",
              }}>
              <span style={{ fontSize: 14 }}>{t.icon}</span>
              <div style={{ fontSize: 9, fontWeight: 800, marginTop: 2, letterSpacing: 0.5 }}>{t.label}</div>
            </button>
          );
        })}
      </div>

      {/* Input bar (per tab) */}
      {showInputBar && (
        <div style={{ padding: "8px 10px", background: "#0b1220", borderBottom: "1px solid #1e293b", display: "flex", gap: 6 }}>
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && draft.trim()) apply(draft.trim()); }}
            placeholder={placeholder}
            style={{
              flex: 1, padding: "6px 9px", borderRadius: 6,
              border: "1px solid #334155", background: "#0f172a", color: "#e2e8f0",
              fontSize: 11, fontFamily: "ui-monospace, SFMono-Regular, monospace",
            }}
          />
          <button onClick={() => draft.trim() && apply(draft.trim())}
            style={{
              padding: "6px 12px", borderRadius: 6, border: "none",
              background: "#fbbf24", color: "#0f172a", fontSize: 11, fontWeight: 800, cursor: "pointer",
            }}>Открыть</button>
        </div>
      )}

      {/* Body */}
      <div style={{ flex: 1, position: "relative", background: "#000" }}>
        {state.tab === "notes" ? (
          <textarea
            value={state.notes}
            onChange={e => setState(s => ({ ...s, notes: e.target.value }))}
            placeholder="Заметки по партии: дебют, идеи, разборы…"
            style={{
              width: "100%", height: "100%", padding: 12,
              background: "#0f172a", color: "#e2e8f0",
              border: "none", outline: "none", resize: "none",
              fontSize: 13, fontFamily: "ui-monospace, SFMono-Regular, monospace",
              lineHeight: 1.55,
            }}
          />
        ) : iframeSrc ? (
          <iframe
            key={iframeKey}
            src={iframeSrc}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            style={{ width: "100%", height: "100%", border: "none", background: "#000" }}
          />
        ) : (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            height: "100%", padding: 20, textAlign: "center",
            color: "#64748b", fontSize: 12, lineHeight: 1.5,
          }}>
            {state.tab === "youtube" && "Вставь YouTube URL или ID (11 символов) и нажми Enter"}
            {state.tab === "twitch"  && "Вставь имя канала Twitch (например: gmhikaru) и нажми Enter"}
            {state.tab === "url"     && "Вставь любой URL и нажми Enter"}
            {state.tab === "lichess" && "Lichess TV — прямые трансляции топ-партий"}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: "5px 10px", background: "#020617", borderTop: "1px solid #1e293b",
        fontSize: 10, color: "#475569", display: "flex", alignItems: "center", gap: 6,
      }}>
        <span style={{ flex: 1 }}>
          {state.tab === "youtube" && state.yt && `YT · ${ytId(state.yt) || state.yt}`}
          {state.tab === "twitch"  && state.tw && `TW · ${twChannel(state.tw)}`}
          {state.tab === "lichess" && "Lichess"}
          {state.tab === "url"     && state.url && new URL(state.url).hostname}
        </span>
        {iframeSrc && state.tab !== "notes" && (
          <a href={iframeSrc} target="_blank" rel="noopener noreferrer"
            style={{ color: "#fbbf24", fontSize: 10, fontWeight: 700, textDecoration: "none" }}>
            ↗ Открыть
          </a>
        )}
      </div>
    </div>
  );
}
