"use client";
/**
 * WorkspaceMediaPane — sticky media column next to the chess board.
 *
 * Tabs: YouTube · Twitch · Lichess · Custom URL · Notes.
 *
 * Embedding constraints handled:
 *   - YouTube: nocookie embed + autoplay+mute+playsinline (always works)
 *   - Twitch:  parent param = current hostname (required by Twitch)
 *   - Lichess: ALWAYS opens in new tab (lichess.org sets X-Frame-Options: DENY)
 *   - URL:    iframe attempt + prominent "open external" fallback
 */

import React, { useState, useEffect, useCallback } from "react";

type TabKind = "youtube" | "twitch" | "lichess" | "url" | "notes";
type State = {
  tab: TabKind;
  yt: string;
  tw: string;
  lichess: string;
  url: string;
  notes: string;
};

const STORAGE = "aevion_chess_media_pane_v2";
const DEFAULT: State = {
  tab: "youtube",
  yt: "",
  tw: "",
  lichess: "",
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
  if (!input) return null;
  const m =
    input.match(/youtu\.be\/([\w-]{11})/) ||
    input.match(/youtube\.com\/watch\?v=([\w-]{11})/) ||
    input.match(/youtube\.com\/live\/([\w-]{11})/) ||
    input.match(/youtube\.com\/shorts\/([\w-]{11})/) ||
    input.match(/youtube\.com\/embed\/([\w-]{11})/) ||
    input.match(/^([\w-]{11})$/);
  return m ? m[1] : null;
}
function twChannel(input: string): string | null {
  if (!input) return null;
  const m = input.match(/twitch\.tv\/([\w_]+)/) || input.match(/^([\w_]+)$/);
  return m ? m[1].toLowerCase() : null;
}
function safeUrl(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Add https:// if no protocol
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try { new URL(withProto); return withProto; } catch { return null; }
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
    { id: "youtube", icon: "▶", label: "YT" },
    { id: "twitch",  icon: "🎥", label: "TW" },
    { id: "lichess", icon: "♞", label: "Lich" },
    { id: "url",     icon: "🔗", label: "URL" },
    { id: "notes",   icon: "📝", label: "Note" },
  ];

  const parent = typeof window !== "undefined" ? window.location.hostname : "localhost";

  let iframeSrc = "";
  let iframeKey: string = state.tab;
  let externalUrl = "";

  if (state.tab === "youtube") {
    const id = ytId(state.yt);
    if (id) {
      iframeSrc = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1`;
      externalUrl = `https://youtube.com/watch?v=${id}`;
    }
    iframeKey = `yt-${id || "empty"}`;
  } else if (state.tab === "twitch") {
    const ch = twChannel(state.tw);
    if (ch) {
      iframeSrc = `https://player.twitch.tv/?channel=${ch}&parent=${parent}&parent=localhost&muted=true&autoplay=true`;
      externalUrl = `https://twitch.tv/${ch}`;
    }
    iframeKey = `tw-${ch || "empty"}`;
  } else if (state.tab === "lichess") {
    // Lichess BLOCKS embedding via X-Frame-Options: DENY. No iframe possible.
    // Show button list that opens in new tab.
    externalUrl = state.lichess || "https://lichess.org/tv";
  } else if (state.tab === "url") {
    const u = safeUrl(state.url);
    if (u) { iframeSrc = u; externalUrl = u; }
    iframeKey = `url-${iframeSrc}`;
  }

  const showInputBar = state.tab !== "notes" && state.tab !== "lichess";
  const placeholder =
    state.tab === "youtube" ? "YouTube URL или 11-знач ID" :
    state.tab === "twitch"  ? "twitch.tv/channel или просто имя" :
    state.tab === "url"     ? "Любой URL (https://...)" : "";

  return (
    <div style={{
      width: "min(380px, 30vw)", minWidth: 280, maxWidth: 420,
      display: "flex", flexDirection: "column",
      borderRadius: 10, overflow: "hidden",
      background: "#0f172a", color: "#e2e8f0",
      border: "1px solid #1e293b",
      boxShadow: "0 4px 14px rgba(0,0,0,0.14)",
      alignSelf: "stretch", // stretch to match board height in flex parent
      flexShrink: 0,
    }}>
      {/* Tab strip — compact */}
      <div style={{ display: "flex", gap: 0, background: "#020617", borderBottom: "1px solid #1e293b" }}>
        {tabs.map(t => {
          const active = state.tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              title={t.label}
              style={{
                flex: 1, padding: "5px 0", border: "none",
                background: active ? "#1e293b" : "transparent",
                color: active ? "#fbbf24" : "#94a3b8",
                fontSize: 11, fontWeight: 800, cursor: "pointer",
                borderBottom: active ? "2px solid #fbbf24" : "2px solid transparent",
                transition: "all 0.15s ease",
                lineHeight: 1.1,
              }}>
              <div style={{ fontSize: 13 }}>{t.icon}</div>
              <div style={{ fontSize: 8.5, fontWeight: 800, marginTop: 1, letterSpacing: 0.4 }}>{t.label}</div>
            </button>
          );
        })}
      </div>

      {/* Input bar (per tab) — compact */}
      {showInputBar && (
        <div style={{ padding: "5px 7px", background: "#0b1220", borderBottom: "1px solid #1e293b", display: "flex", gap: 4 }}>
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && draft.trim()) apply(draft.trim()); }}
            placeholder={placeholder}
            style={{
              flex: 1, padding: "4px 7px", borderRadius: 4,
              border: "1px solid #334155", background: "#0f172a", color: "#e2e8f0",
              fontSize: 10.5, fontFamily: "ui-monospace, SFMono-Regular, monospace",
              minWidth: 0,
            }}
          />
          <button onClick={() => draft.trim() && apply(draft.trim())}
            style={{
              padding: "4px 10px", borderRadius: 4, border: "none",
              background: "#fbbf24", color: "#0f172a", fontSize: 10.5, fontWeight: 800, cursor: "pointer",
              whiteSpace: "nowrap",
            }}>OK</button>
        </div>
      )}

      {/* Body */}
      <div style={{ flex: 1, position: "relative", background: "#000", minHeight: 0 }}>
        {state.tab === "notes" ? (
          <textarea
            value={state.notes}
            onChange={e => setState(s => ({ ...s, notes: e.target.value }))}
            placeholder="Заметки по партии: дебют, идеи, разборы…"
            style={{
              width: "100%", height: "100%", padding: 10,
              background: "#0f172a", color: "#e2e8f0",
              border: "none", outline: "none", resize: "none",
              fontSize: 12.5, fontFamily: "ui-monospace, SFMono-Regular, monospace",
              lineHeight: 1.5,
              boxSizing: "border-box",
            }}
          />
        ) : state.tab === "lichess" ? (
          // Lichess — special case: iframe blocked, always open in new tab
          <div style={{
            display: "flex", flexDirection: "column",
            height: "100%", padding: 10, gap: 6,
            color: "#cbd5e1", fontSize: 11.5, lineHeight: 1.4,
            background: "#0f172a", overflowY: "auto",
            boxSizing: "border-box",
          }}>
            <div style={{ fontSize: 10, color: "#fbbf24", fontWeight: 700, letterSpacing: 0.5 }}>
              ⚠ Lichess блокирует встраивание — клик открывает в новой вкладке
            </div>
            {[
              ["https://lichess.org/tv", "♛ TV — top game"],
              ["https://lichess.org/tv/best", "♛ TV / Best"],
              ["https://lichess.org/tv/blitz", "⚡ Blitz TV"],
              ["https://lichess.org/tv/rapid", "🕐 Rapid TV"],
              ["https://lichess.org/tv/bullet", "💨 Bullet TV"],
              ["https://lichess.org/tv/classical", "📜 Classical TV"],
              ["https://lichess.org/tv/chess960", "🎲 Chess960 TV"],
              ["https://lichess.org/training", "🧩 Puzzles"],
              ["https://lichess.org/streamers", "📺 Live streamers"],
              ["https://lichess.org/broadcast", "📡 Broadcasts"],
            ].map(([url, label]) => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                onClick={() => setState(s => ({ ...s, lichess: url }))}
                style={{
                  padding: "6px 9px", borderRadius: 5,
                  background: state.lichess === url ? "#334155" : "#1e293b",
                  color: "#e2e8f0", border: `1px solid ${state.lichess === url ? "#fbbf24" : "#334155"}`,
                  fontSize: 11, fontWeight: 700,
                  textAlign: "left", cursor: "pointer",
                  textDecoration: "none", display: "block",
                }}>
                {label} <span style={{ float: "right", color: "#64748b", fontSize: 9 }}>↗</span>
              </a>
            ))}
          </div>
        ) : iframeSrc ? (
          <>
            <iframe
              key={iframeKey}
              src={iframeSrc}
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write"
              allowFullScreen
              referrerPolicy="origin-when-cross-origin"
              loading="eager"
              style={{ width: "100%", height: "100%", border: "none", background: "#000", display: "block" }}
            />
            {/* Overlay hint — visible only briefly via title; user can hover footer link */}
          </>
        ) : (
          <div style={{
            display: "flex", flexDirection: "column",
            height: "100%", padding: 10, gap: 8,
            color: "#cbd5e1", fontSize: 11.5, lineHeight: 1.4,
            background: "#0f172a", overflowY: "auto",
            boxSizing: "border-box",
          }}>
            {state.tab === "youtube" && (
              <>
                <div style={{ fontSize: 10, color: "#94a3b8", padding: "0 2px" }}>
                  Вставь ссылку на видео или 11-знач ID. Каналы YouTube не позволяет встраивать целиком.
                </div>
                <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 1, color: "#94a3b8", marginTop: 4 }}>КАНАЛЫ ↗</div>
                {[
                  ["https://www.youtube.com/@GothamChess", "▶ GothamChess"],
                  ["https://www.youtube.com/@HikaruNakamura", "▶ Hikaru"],
                  ["https://www.youtube.com/@DanielNaroditskyGM", "▶ Naroditsky"],
                  ["https://www.youtube.com/@ChessNetwork", "▶ ChessNetwork"],
                  ["https://www.youtube.com/@agadmator", "▶ Agadmator"],
                ].map(([url, label]) => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                    style={{
                      padding: "6px 9px", borderRadius: 5,
                      background: "#1e293b", color: "#e2e8f0",
                      border: "1px solid #334155", fontSize: 11, fontWeight: 700,
                      textDecoration: "none", display: "block",
                    }}>
                    {label} <span style={{ float: "right", color: "#64748b", fontSize: 9 }}>↗</span>
                  </a>
                ))}
              </>
            )}
            {state.tab === "twitch" && (
              <>
                <div style={{ fontSize: 10, color: "#94a3b8", padding: "0 2px" }}>
                  Кликни канал чтобы запустить встраивание прямо в окне.
                </div>
                <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 1, color: "#94a3b8", marginTop: 4 }}>КАНАЛЫ</div>
                {[
                  ["gmhikaru", "🎥 GMHikaru"],
                  ["chess", "🎥 Chess.com"],
                  ["botezlive", "🎥 BotezLive"],
                  ["gothamchess", "🎥 GothamChess"],
                  ["danya", "🎥 Naroditsky"],
                ].map(([ch, label]) => (
                  <button key={ch} onClick={() => apply(ch)}
                    style={{
                      padding: "6px 9px", borderRadius: 5,
                      background: "#1e293b", color: "#e2e8f0",
                      border: "1px solid #334155", fontSize: 11, fontWeight: 700,
                      textAlign: "left", cursor: "pointer",
                    }}>
                    {label}
                  </button>
                ))}
              </>
            )}
            {state.tab === "url" && (
              <div style={{ fontSize: 11, color: "#94a3b8", padding: "0 2px" }}>
                Вставь URL выше — стрим, дашборд, доска. Не все сайты разрешают встраивание (X-Frame-Options).
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer — current source + open external */}
      <div style={{
        padding: "4px 8px", background: "#020617", borderTop: "1px solid #1e293b",
        fontSize: 9.5, color: "#475569", display: "flex", alignItems: "center", gap: 6, minHeight: 22,
      }}>
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {state.tab === "youtube" && state.yt && `YT · ${ytId(state.yt) || state.yt}`}
          {state.tab === "twitch"  && state.tw && `TW · ${twChannel(state.tw)}`}
          {state.tab === "lichess" && state.lichess && `Lichess · ${state.lichess.replace("https://lichess.org/", "")}`}
          {state.tab === "url"     && state.url && (() => { try { return new URL(safeUrl(state.url) || "").hostname } catch { return state.url } })()}
        </span>
        {externalUrl && (
          <a href={externalUrl} target="_blank" rel="noopener noreferrer"
            style={{ color: "#fbbf24", fontSize: 9.5, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>
            ↗ Открыть
          </a>
        )}
      </div>
    </div>
  );
}
