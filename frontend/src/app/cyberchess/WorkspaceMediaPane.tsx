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
  let iframeKey: string = state.tab;
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
            display: "flex", flexDirection: "column",
            height: "100%", padding: 16, gap: 12,
            color: "#cbd5e1", fontSize: 12, lineHeight: 1.5,
            background: "#0f172a", overflowY: "auto",
          }}>
            {/* Что это вообще такое — короткий онбординг */}
            <div style={{
              padding: 12, borderRadius: 8,
              background: "rgba(251,191,36,0.08)",
              border: "1px solid rgba(251,191,36,0.25)",
            }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#fbbf24", marginBottom: 4 }}>
                📺 Stream-режим
              </div>
              <div style={{ fontSize: 11.5, color: "#cbd5e1", lineHeight: 1.5 }}>
                Окно YouTube/Twitch/Lichess <b>прямо рядом с доской</b> — играй и смотри одновременно.
                Вставь ссылку выше или выбери быстрый пресет ниже.
              </div>
            </div>

            {/* YouTube quick channels — open in new tab (channels can't be embedded directly,
                only specific videos can). User can paste any video URL/ID into the input bar. */}
            {state.tab === "youtube" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 9.5, fontWeight: 900, letterSpacing: 1, color: "#94a3b8", textTransform: "uppercase" }}>Каналы (откроются в новой вкладке)</div>
                {[
                  ["https://www.youtube.com/@GothamChess", "▶ GothamChess (Levy)"],
                  ["https://www.youtube.com/@HikaruNakamura", "▶ Hikaru Nakamura"],
                  ["https://www.youtube.com/@DanielNaroditskyGM", "▶ Daniel Naroditsky"],
                  ["https://www.youtube.com/@ChessNetwork", "▶ ChessNetwork"],
                  ["https://www.youtube.com/@agadmator", "▶ agadmator's Chess Channel"],
                ].map(([url, label]) => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                    style={{
                      padding: "8px 10px", borderRadius: 6,
                      background: "#1e293b", color: "#e2e8f0",
                      border: "1px solid #334155", fontSize: 11.5, fontWeight: 700,
                      textDecoration: "none", display: "block",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#334155")}
                    onMouseLeave={e => (e.currentTarget.style.background = "#1e293b")}>
                    {label} <span style={{ float: "right", color: "#64748b", fontSize: 10 }}>↗</span>
                  </a>
                ))}
                <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 6, padding: "0 4px", lineHeight: 1.45 }}>
                  💡 Чтобы встроить видео в окно — скопируй ссылку (или 11-значный ID) с конкретного видео в YouTube и вставь в поле выше. Каналы целиком встраивать YouTube не позволяет.
                </div>
              </div>
            )}
            {state.tab === "twitch" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 9.5, fontWeight: 900, letterSpacing: 1, color: "#94a3b8", textTransform: "uppercase" }}>Популярные Twitch-каналы</div>
                {[
                  ["gmhikaru", "🎥 GMHikaru (Hikaru Nakamura)"],
                  ["chess", "🎥 Chess.com официальный"],
                  ["botezlive", "🎥 BotezLive (Alexandra & Andrea)"],
                  ["gothamchess", "🎥 GothamChess (Levy)"],
                  ["danya", "🎥 Daniel Naroditsky"],
                ].map(([ch, label]) => (
                  <button key={ch} onClick={() => apply(ch)}
                    style={{
                      padding: "8px 10px", borderRadius: 6,
                      background: "#1e293b", color: "#e2e8f0",
                      border: "1px solid #334155", fontSize: 11.5, fontWeight: 700,
                      textAlign: "left", cursor: "pointer",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#334155")}
                    onMouseLeave={e => (e.currentTarget.style.background = "#1e293b")}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            {state.tab === "url" && (
              <div style={{ fontSize: 11.5, color: "#94a3b8", padding: "0 4px" }}>
                Вставь любой URL выше — например ссылку на стрим, дашборд, доску анализа на lichess или PGN viewer. Сайт откроется внутри панели через iframe.
                Не все сайты разрешают встраивание (X-Frame-Options).
              </div>
            )}
            {state.tab === "lichess" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 9.5, fontWeight: 900, letterSpacing: 1, color: "#94a3b8", textTransform: "uppercase" }}>Lichess TV каналы</div>
                {[
                  ["https://lichess.org/tv/best", "♛ Best — топ-партии всех типов"],
                  ["https://lichess.org/tv/blitz", "⚡ Blitz TV"],
                  ["https://lichess.org/tv/rapid", "🕐 Rapid TV"],
                  ["https://lichess.org/tv/bullet", "💨 Bullet TV"],
                  ["https://lichess.org/tv/classical", "📜 Classical TV"],
                  ["https://lichess.org/tv/chess960", "🎲 Chess960 TV"],
                ].map(([url, label]) => (
                  <button key={url} onClick={() => setState(s => ({ ...s, lichess: url }))}
                    style={{
                      padding: "8px 10px", borderRadius: 6,
                      background: state.lichess === url ? "#334155" : "#1e293b",
                      color: "#e2e8f0", border: `1px solid ${state.lichess === url ? "#fbbf24" : "#334155"}`,
                      fontSize: 11.5, fontWeight: 700, textAlign: "left", cursor: "pointer",
                    }}>
                    {label}
                  </button>
                ))}
                <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 4, padding: "0 4px", lineHeight: 1.45 }}>
                  💡 Если окно остаётся чёрным — Lichess блокирует embed на этом домене. Жми «↗ Открыть» внизу панели чтобы открыть в новой вкладке.
                </div>
              </div>
            )}
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
