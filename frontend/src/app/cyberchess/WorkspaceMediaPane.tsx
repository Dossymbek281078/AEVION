"use client";
/**
 * WorkspaceMediaPane — multi-pane media column next to the chess board.
 *
 * Supports 1/2/4 split layouts. Each pane has independent state:
 *   - Tab: YouTube · Twitch · Lichess · Custom URL · Notes
 *   - Per-tab content (URL/channel/notes)
 *
 * User can watch 1, 2, or 4 streams/sites SIMULTANEOUSLY while playing.
 * Lichess opens in new tab (X-Frame-Options blocks embedding).
 */

import React, { useState, useEffect, useCallback } from "react";

type TabKind = "youtube" | "twitch" | "lichess" | "url" | "notes";
type PaneState = {
  tab: TabKind;
  yt: string;
  tw: string;
  lichess: string;
  url: string;
  notes: string;
};
type State = {
  layout: 1 | 2 | 4;
  active: number;
  panes: PaneState[];
};

const STORAGE = "aevion_chess_media_pane_v3";
const EMPTY_PANE: PaneState = { tab: "youtube", yt: "", tw: "", lichess: "", url: "", notes: "" };
const DEFAULT: State = {
  layout: 1,
  active: 0,
  panes: [EMPTY_PANE, EMPTY_PANE, EMPTY_PANE, EMPTY_PANE],
};

function load(): State {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(STORAGE);
    if (!raw) return DEFAULT;
    const j = JSON.parse(raw);
    return {
      layout: j.layout || 1,
      active: j.active || 0,
      panes: Array.isArray(j.panes) && j.panes.length === 4 ? j.panes : DEFAULT.panes,
    };
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
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try { new URL(withProto); return withProto; } catch { return null; }
}

// Twitch is strict about `parent` — it must EXACTLY match the page hostname.
// We pass every realistic deployment host plus the current one so preview/prod
// deployments and localhost all work without further config.
const TWITCH_PARENTS = ["localhost", "127.0.0.1", "aevion.app", "www.aevion.app", "aevion.vercel.app"];
function buildTwitchParents(currentHost: string): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const h of [currentHost, ...TWITCH_PARENTS]) {
    if (!h || seen.has(h)) continue;
    seen.add(h);
    out.push(`parent=${encodeURIComponent(h)}`);
  }
  return out.join("&");
}

function paneIframe(p: PaneState, parent: string): { src: string; key: string; ext: string } {
  if (p.tab === "youtube") {
    const id = ytId(p.yt);
    return id
      ? { src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1`, key: `yt-${id}`, ext: `https://youtube.com/watch?v=${id}` }
      : { src: "", key: "yt-empty", ext: "" };
  }
  if (p.tab === "twitch") {
    const ch = twChannel(p.tw);
    return ch
      ? { src: `https://player.twitch.tv/?channel=${ch}&${buildTwitchParents(parent)}&muted=true&autoplay=true`, key: `tw-${ch}`, ext: `https://twitch.tv/${ch}` }
      : { src: "", key: "tw-empty", ext: "" };
  }
  if (p.tab === "url") {
    const u = safeUrl(p.url);
    return u ? { src: u, key: `url-${u}`, ext: u } : { src: "", key: "url-empty", ext: "" };
  }
  if (p.tab === "lichess") {
    return { src: "", key: "li", ext: p.lichess || "https://lichess.org/tv" };
  }
  return { src: "", key: "notes", ext: "" };
}

const TABS: { id: TabKind; icon: string; label: string }[] = [
  { id: "youtube", icon: "▶", label: "YT" },
  { id: "twitch",  icon: "🎥", label: "TW" },
  { id: "lichess", icon: "♞", label: "Lich" },
  { id: "url",     icon: "🔗", label: "URL" },
  { id: "notes",   icon: "📝", label: "Note" },
];

const YT_CHANNELS: [string, string][] = [
  ["https://www.youtube.com/@GothamChess", "▶ GothamChess"],
  ["https://www.youtube.com/@HikaruNakamura", "▶ Hikaru"],
  ["https://www.youtube.com/@DanielNaroditskyGM", "▶ Naroditsky"],
  ["https://www.youtube.com/@ChessNetwork", "▶ ChessNetwork"],
  ["https://www.youtube.com/@agadmator", "▶ Agadmator"],
];
const TW_CHANNELS: [string, string][] = [
  ["gmhikaru", "🎥 GMHikaru"],
  ["chess", "🎥 Chess.com"],
  ["botezlive", "🎥 BotezLive"],
  ["gothamchess", "🎥 GothamChess"],
  ["danya", "🎥 Naroditsky"],
];
const LICHESS_LINKS: [string, string][] = [
  ["https://lichess.org/tv", "♛ TV — top game"],
  ["https://lichess.org/tv/blitz", "⚡ Blitz TV"],
  ["https://lichess.org/tv/rapid", "🕐 Rapid TV"],
  ["https://lichess.org/tv/bullet", "💨 Bullet TV"],
  ["https://lichess.org/tv/classical", "📜 Classical TV"],
  ["https://lichess.org/tv/chess960", "🎲 Chess960 TV"],
  ["https://lichess.org/training", "🧩 Puzzles"],
  ["https://lichess.org/streamers", "📺 Streamers"],
  ["https://lichess.org/broadcast", "📡 Broadcasts"],
];

function PaneBody({ p, idx, isActive, onSelect, onUpdate }: {
  p: PaneState;
  idx: number;
  isActive: boolean;
  onSelect: () => void;
  onUpdate: (next: PaneState) => void;
}) {
  const [draft, setDraft] = useState("");
  const parent = typeof window !== "undefined" ? window.location.hostname : "localhost";
  const { src, key, ext } = paneIframe(p, parent);

  const setTab = (tab: TabKind) => onUpdate({ ...p, tab });
  const apply = (value: string) => {
    if (p.tab === "youtube") onUpdate({ ...p, yt: value });
    else if (p.tab === "twitch") onUpdate({ ...p, tw: value });
    else if (p.tab === "url") onUpdate({ ...p, url: value });
    setDraft("");
  };

  const showInputBar = p.tab !== "notes" && p.tab !== "lichess";
  const placeholder =
    p.tab === "youtube" ? "YouTube URL/ID" :
    p.tab === "twitch"  ? "twitch.tv/channel" :
    p.tab === "url"     ? "URL" : "";

  return (
    <div onClick={onSelect}
      style={{
        display: "flex", flexDirection: "column",
        background: "#0f172a",
        border: isActive ? "1.5px solid #fbbf24" : "1px solid #1e293b",
        borderRadius: 6, overflow: "hidden",
        minHeight: 0, minWidth: 0,
      }}>
      {/* Tabs */}
      <div style={{ display: "flex", background: "#020617", borderBottom: "1px solid #1e293b" }}>
        {TABS.map(t => {
          const active = p.tab === t.id;
          return (
            <button key={t.id} onClick={(e) => { e.stopPropagation(); setTab(t.id); }}
              title={t.label}
              style={{
                flex: 1, padding: "3px 0", border: "none",
                background: active ? "#1e293b" : "transparent",
                color: active ? "#fbbf24" : "#94a3b8",
                fontSize: 9.5, fontWeight: 800, cursor: "pointer",
                borderBottom: active ? "2px solid #fbbf24" : "2px solid transparent",
                lineHeight: 1.1,
              }}>
              <div style={{ fontSize: 11 }}>{t.icon}</div>
              <div style={{ fontSize: 7.5, fontWeight: 800, marginTop: 0.5, letterSpacing: 0.3 }}>{t.label}</div>
            </button>
          );
        })}
      </div>

      {/* Input bar */}
      {showInputBar && (
        <div style={{ padding: "3px 5px", background: "#0b1220", borderBottom: "1px solid #1e293b", display: "flex", gap: 3 }}>
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && draft.trim()) apply(draft.trim()); }}
            onClick={(e) => e.stopPropagation()}
            placeholder={placeholder}
            style={{
              flex: 1, padding: "3px 6px", borderRadius: 3,
              border: "1px solid #334155", background: "#0f172a", color: "#e2e8f0",
              fontSize: 9.5, fontFamily: "ui-monospace, SFMono-Regular, monospace",
              minWidth: 0,
            }}
          />
          <button onClick={(e) => { e.stopPropagation(); draft.trim() && apply(draft.trim()); }}
            style={{
              padding: "3px 7px", borderRadius: 3, border: "none",
              background: "#fbbf24", color: "#0f172a", fontSize: 9.5, fontWeight: 800, cursor: "pointer",
              whiteSpace: "nowrap",
            }}>OK</button>
        </div>
      )}

      {/* Body */}
      <div style={{ flex: 1, position: "relative", background: "#000", minHeight: 0 }}>
        {p.tab === "notes" ? (
          <textarea
            value={p.notes}
            onChange={e => onUpdate({ ...p, notes: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder="Заметки…"
            style={{
              width: "100%", height: "100%", padding: 8,
              background: "#0f172a", color: "#e2e8f0",
              border: "none", outline: "none", resize: "none",
              fontSize: 11.5, fontFamily: "ui-monospace, SFMono-Regular, monospace",
              lineHeight: 1.4, boxSizing: "border-box",
            }}
          />
        ) : p.tab === "lichess" ? (
          <div style={{
            display: "flex", flexDirection: "column",
            height: "100%", padding: 8, gap: 4,
            color: "#cbd5e1", fontSize: 10.5, lineHeight: 1.3,
            background: "#0f172a", overflowY: "auto",
            boxSizing: "border-box",
          }}>
            <div style={{ fontSize: 8.5, color: "#fbbf24", fontWeight: 700 }}>
              Lichess блокирует embed — клик откроет в новой вкладке
            </div>
            {LICHESS_LINKS.map(([url, label]) => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                onClick={(e) => { e.stopPropagation(); onUpdate({ ...p, lichess: url }); }}
                style={{
                  padding: "5px 7px", borderRadius: 4,
                  background: p.lichess === url ? "#334155" : "#1e293b",
                  color: "#e2e8f0", border: `1px solid ${p.lichess === url ? "#fbbf24" : "#334155"}`,
                  fontSize: 10, fontWeight: 700,
                  textDecoration: "none", display: "block",
                }}>
                {label} <span style={{ float: "right", color: "#64748b", fontSize: 8.5 }}>↗</span>
              </a>
            ))}
          </div>
        ) : src ? (
          <div style={{ position: "relative", width: "100%", height: "100%" }}>
            <iframe
              key={key}
              src={src}
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write; accelerometer; gyroscope"
              allowFullScreen
              referrerPolicy="origin-when-cross-origin"
              loading="eager"
              style={{ width: "100%", height: "100%", border: "none", background: "#000", display: "block" }}
            />
            {/* Always-visible "open in new tab" pill overlay — many sites send X-Frame-Options DENY
                so the iframe shows blank. The pill gives the user an immediate escape hatch. */}
            {ext && (
              <a href={ext} target="_blank" rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title="Если страница не отображается — сайт запретил iframe"
                style={{
                  position: "absolute", top: 6, right: 6, zIndex: 2,
                  padding: "3px 8px", borderRadius: 999,
                  background: "rgba(15,23,42,0.78)", color: "#fbbf24",
                  fontSize: 9.5, fontWeight: 800, letterSpacing: 0.3,
                  textDecoration: "none", border: "1px solid rgba(251,191,36,0.4)",
                  backdropFilter: "blur(4px)",
                }}>
                ↗ Новая вкладка
              </a>
            )}
          </div>
        ) : (
          <div style={{
            display: "flex", flexDirection: "column",
            height: "100%", padding: 8, gap: 4,
            color: "#cbd5e1", fontSize: 10.5, lineHeight: 1.3,
            background: "#0f172a", overflowY: "auto",
            boxSizing: "border-box",
          }}>
            {p.tab === "youtube" && (
              <>
                <div style={{ fontSize: 9, color: "#94a3b8", padding: "0 2px" }}>Вставь ссылку или ID</div>
                {YT_CHANNELS.map(([url, label]) => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      padding: "5px 7px", borderRadius: 4, background: "#1e293b", color: "#e2e8f0",
                      border: "1px solid #334155", fontSize: 10, fontWeight: 700,
                      textDecoration: "none", display: "block",
                    }}>
                    {label} <span style={{ float: "right", color: "#64748b", fontSize: 8.5 }}>↗</span>
                  </a>
                ))}
              </>
            )}
            {p.tab === "twitch" && (
              <>
                <div style={{ fontSize: 9, color: "#94a3b8", padding: "0 2px" }}>Кликни канал</div>
                {TW_CHANNELS.map(([ch, label]) => (
                  <button key={ch} onClick={(e) => { e.stopPropagation(); apply(ch); }}
                    style={{
                      padding: "5px 7px", borderRadius: 4, background: "#1e293b", color: "#e2e8f0",
                      border: "1px solid #334155", fontSize: 10, fontWeight: 700,
                      textAlign: "left", cursor: "pointer",
                    }}>
                    {label}
                  </button>
                ))}
              </>
            )}
            {p.tab === "url" && (
              <div style={{ fontSize: 10, color: "#94a3b8", padding: "0 2px" }}>
                Вставь URL — стрим, дашборд, доска. Не все сайты разрешают встраивание.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {(src || ext) && (
        <div style={{
          padding: "2px 6px", background: "#020617", borderTop: "1px solid #1e293b",
          fontSize: 8.5, color: "#475569", display: "flex", alignItems: "center", gap: 4, minHeight: 18,
        }}>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            P{idx + 1}
          </span>
          {ext && (
            <a href={ext} target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{ color: "#fbbf24", fontSize: 8.5, fontWeight: 700, textDecoration: "none" }}>
              ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function WorkspaceMediaPane() {
  const [state, setState] = useState<State>(DEFAULT);
  const [hyd, setHyd] = useState(false);

  useEffect(() => { setState(load()); setHyd(true); }, []);
  useEffect(() => { if (hyd) save(state); }, [state, hyd]);

  const updatePane = useCallback((idx: number, next: PaneState) => {
    setState(s => ({ ...s, panes: s.panes.map((p, i) => i === idx ? next : p) }));
  }, []);
  const setLayout = useCallback((layout: 1 | 2 | 4) => {
    setState(s => ({ ...s, layout, active: Math.min(s.active, layout - 1) }));
  }, []);
  const setActive = useCallback((idx: number) => {
    setState(s => ({ ...s, active: idx }));
  }, []);

  const visiblePanes = state.panes.slice(0, state.layout);

  // Grid template for 1/2/4 layouts
  const gridStyle: React.CSSProperties =
    state.layout === 1 ? { display: "grid", gridTemplateRows: "1fr", gap: 4 } :
    state.layout === 2 ? { display: "grid", gridTemplateRows: "1fr 1fr", gap: 4 } :
    { display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 4 };

  return (
    <div style={{
      width: "min(640px, 44vw)", minWidth: 360, maxWidth: 760, alignSelf: "stretch",
      display: "flex", flexDirection: "column",
      borderRadius: 10, overflow: "hidden",
      background: "#0f172a", color: "#e2e8f0",
      border: "1px solid #1e293b",
      boxShadow: "0 4px 14px rgba(0,0,0,0.14)",
      flexShrink: 0,
    }}>
      {/* Layout toggle — top bar */}
      <div style={{
        display: "flex", gap: 4, padding: "5px 6px",
        background: "#020617", borderBottom: "1px solid #1e293b",
        alignItems: "center",
      }}>
        <span style={{ fontSize: 9.5, fontWeight: 800, color: "#94a3b8", letterSpacing: 0.5 }}>SPLIT</span>
        {([1, 2, 4] as const).map(n => (
          <button key={n} onClick={() => setLayout(n)}
            title={`${n} pane${n > 1 ? "s" : ""}`}
            style={{
              padding: "3px 9px", borderRadius: 4, border: "none",
              background: state.layout === n ? "#fbbf24" : "#1e293b",
              color: state.layout === n ? "#0f172a" : "#cbd5e1",
              fontSize: 10, fontWeight: 800, cursor: "pointer",
              minWidth: 22,
            }}>
            {n === 1 ? "▢" : n === 2 ? "⬓" : "⊞"} {n}
          </button>
        ))}
        <span style={{ flex: 1 }}/>
        <span style={{ fontSize: 9, color: "#475569" }}>
          {state.layout === 1 ? "1 экран" : state.layout === 2 ? "2 экрана (горизонт)" : "4 экрана (сетка)"}
        </span>
      </div>

      {/* Pane(s) */}
      <div style={{ flex: 1, padding: 4, ...gridStyle, minHeight: 0 }}>
        {visiblePanes.map((p, i) => (
          <PaneBody key={i} p={p} idx={i}
            isActive={state.active === i}
            onSelect={() => setActive(i)}
            onUpdate={(next) => updatePane(i, next)}
          />
        ))}
      </div>
    </div>
  );
}
