"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Btn, Card, Badge, Modal, Tooltip, Icon, Spinner, SectionHeader } from "../ui";
import { COLOR as CC, SPACE, RADIUS, SHADOW, MOTION, Z } from "../theme";

/* ══════════════════════════════════════════════════════════════════════
   AEVION CyberChess — STUDIO MODE v2
   - 1/2/3/4-pane layouts
   - Drag-to-resize splits between panes
   - Сhess-internal pane is locked (always at least one)
   - Curated Twitch + YouTube chess streamer lists with search
   - Lichess Broadcasts API (live tournaments)
   - "↗ open externally" button (Stockfish needs full /cyberchess tab)
   ══════════════════════════════════════════════════════════════════════ */

type SourceKind =
  | "empty"
  | "chess-internal"
  | "twitch"
  | "twitch-chat"
  | "youtube-channel"
  | "youtube-video"
  | "lichess-game"
  | "lichess-tv"
  | "url";

type Source = {
  kind: SourceKind;
  channel?: string;
  videoId?: string;
  gameId?: string;
  url?: string;
  title?: string;
  muted?: boolean;
};

type Layout = "1" | "2v" | "2h" | "3-left-big" | "3-stack" | "4-grid";

type Splits = {
  col?: number;    // main vertical split (2v, 4-grid, 3-left-big) — 0..1
  row?: number;    // main horizontal split (2h, 4-grid) — 0..1
  rowR?: number;   // right column row split (3-left-big) — 0..1
  rowS?: number;   // 3-stack second split row — 0..1 (default 0.66)
};

type StudioState = { layout: Layout; panes: Source[]; splits: Splits };

const STORAGE_KEY = "aevion_studio_v3";  // bumped: chess pane gets bigger defaults + presets reworked

/* ─── Curated chess streamer presets ─── */

type StreamerPreset = {
  name: string;
  platform: "twitch" | "youtube";
  channel: string;
  desc: string;
};

const TWITCH_PRESETS: StreamerPreset[] = [
  { name: "GMHikaru",       platform: "twitch", channel: "gmhikaru",       desc: "🇺🇸 #1 chess streamer · Hikaru Nakamura" },
  { name: "GothamChess",    platform: "twitch", channel: "gothamchess",    desc: "♚ Levy Rozman · разборы и пазлы" },
  { name: "Botez Live",     platform: "twitch", channel: "botezlive",      desc: "♕ Alexandra & Andrea Botez" },
  { name: "ChessNetwork",   platform: "twitch", channel: "chessnetwork",   desc: "♞ Jerry · спокойные комментарии" },
  { name: "chess24 TV",     platform: "twitch", channel: "chess24tv",      desc: "📺 Official chess24 streams" },
  { name: "Eric Rosen",     platform: "twitch", channel: "imrosen",        desc: "♔ Stalemate king" },
  { name: "GM Naroditsky",  platform: "twitch", channel: "gmnaroditsky",   desc: "♛ Speedrun + lessons" },
  { name: "GM Caruana",     platform: "twitch", channel: "fabianocaruana", desc: "🇺🇸 World #2 GM" },
  { name: "FIDE TV",        platform: "twitch", channel: "fide_chess",     desc: "🌍 Official FIDE broadcasts" },
  { name: "Anna Cramling",  platform: "twitch", channel: "annacramling",   desc: "WIM · разборы и подкасты" },
  { name: "GM Igor Smirnov",platform: "twitch", channel: "igorchess1",     desc: "Уроки на русском/eng" },
  { name: "Magnus Carlsen", platform: "twitch", channel: "magnuscarlsen",  desc: "🇳🇴 World Champion (бывший)" },
  { name: "ChessBrah",      platform: "twitch", channel: "chessbrah",      desc: "GM Aman + community" },
  { name: "Hess",           platform: "twitch", channel: "robertkhess",    desc: "GM Robert Hess" },
  { name: "Daniel King",    platform: "twitch", channel: "powerplaychess", desc: "GM Daniel King · PowerPlay" },
];

const YOUTUBE_PRESETS: StreamerPreset[] = [
  { name: "GothamChess",      platform: "youtube", channel: "UCQHX6ViZmPsWiYSFAyS0a3Q", desc: "♚ Levy · 5M+ subs" },
  { name: "agadmator",        platform: "youtube", channel: "UCL5YbN5WLFD8dLIegT5QAbA", desc: "🎬 Антонио Радич · классика" },
  { name: "GMHikaru",         platform: "youtube", channel: "UC5wQEehBI7-kBIeJDJmzoLg", desc: "Hikaru' YouTube" },
  { name: "Eric Rosen",       platform: "youtube", channel: "UCXy10-NEFGxQ3b4NVrzHw1Q", desc: "♔ IM Eric Rosen" },
  { name: "Daniel Naroditsky",platform: "youtube", channel: "UCHP9CdeguNUI-_nBv_UXBhw", desc: "♛ Speedruns" },
  { name: "Saint Louis Chess",platform: "youtube", channel: "UCM-ONC2bCHytG2mYtKDmIeA", desc: "🏆 Official tournaments" },
  { name: "ChessBase India",  platform: "youtube", channel: "UCpCzFUu0ApAQfwvUZuJBWqA", desc: "🇮🇳 Sagar Shah & team" },
  { name: "ChessNetwork",     platform: "youtube", channel: "UCdBJa-x6JBuz7n2vFy15xAA", desc: "Jerry's YouTube" },
  { name: "Hanging Pawns",    platform: "youtube", channel: "UCkJdvwRC-oGPhRHW_XPNokg", desc: "Stjepan · openings/middlegame" },
  { name: "ChessVibes",       platform: "youtube", channel: "UCHP9CdeguNUI-_nBv_UXBhw", desc: "Nelson Lopez · разборы" },
  { name: "John Bartholomew", platform: "youtube", channel: "UCWdWv7RkGslzNqs_FyFRH1g", desc: "IM · climbing the ladder" },
  { name: "ChessOpenings",    platform: "youtube", channel: "UCNQR_8pY7C8qTuO-4xfNIaQ", desc: "Repertoire builders" },
];

const PRESET_LAYOUTS: { id: string; label: string; icon: string; layout: Layout; panes: Source[]; splits?: Splits }[] = [
  // Chess always gets at least ~60% of screen so it stays playable.
  { id: "watch-play", label: "Игра + Стрим", icon: "▶ 📺", layout: "2v",
    panes: [{ kind: "chess-internal" }, { kind: "empty" }], splits: { col: 0.62 } },
  { id: "tournament-hq", label: "Турнирный штаб", icon: "🏆", layout: "3-left-big",
    panes: [{ kind: "chess-internal" }, { kind: "lichess-tv" }, { kind: "empty" }],
    splits: { col: 0.62, rowR: 0.5 } },
  { id: "multi-stream", label: "Игра + 2 стрима", icon: "📺📺", layout: "3-left-big",
    panes: [{ kind: "chess-internal" }, { kind: "empty" }, { kind: "empty" }],
    splits: { col: 0.6, rowR: 0.5 } },
  { id: "focus", label: "Только игра", icon: "□", layout: "1",
    panes: [{ kind: "chess-internal" }] },
];

const EMPTY: Source = { kind: "empty" };
const DEFAULT_SPLITS: Splits = { col: 0.5, row: 0.5, rowR: 0.5, rowS: 0.66 };

function loadState(): StudioState {
  if (typeof window === "undefined") return { layout: "2v", panes: [{ kind: "chess-internal" }, EMPTY], splits: { col: 0.62 } };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && Array.isArray(s.panes) && typeof s.layout === "string") {
        return { ...s, splits: { ...DEFAULT_SPLITS, ...(s.splits || {}) } };
      }
    }
  } catch {}
  return { layout: "2v", panes: [{ kind: "chess-internal" }, EMPTY], splits: { col: 0.62 } };
}

function saveState(s: StudioState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

function paneCount(layout: Layout): number {
  if (layout === "1") return 1;
  if (layout === "2v" || layout === "2h") return 2;
  if (layout === "3-left-big" || layout === "3-stack") return 3;
  return 4;
}

function gridStyle(layout: Layout, splits: Splits): React.CSSProperties {
  const c = splits.col ?? 0.5;
  const r = splits.row ?? 0.5;
  const rR = splits.rowR ?? 0.5;
  const rS = splits.rowS ?? 0.66;
  if (layout === "1")
    return { gridTemplateAreas: '"a"', gridTemplateColumns: "1fr", gridTemplateRows: "1fr" };
  if (layout === "2v")
    return { gridTemplateAreas: '"a b"', gridTemplateColumns: `${c}fr ${1 - c}fr`, gridTemplateRows: "1fr" };
  if (layout === "2h")
    return { gridTemplateAreas: '"a" "b"', gridTemplateColumns: "1fr", gridTemplateRows: `${r}fr ${1 - r}fr` };
  if (layout === "3-left-big")
    return { gridTemplateAreas: '"a b" "a c"', gridTemplateColumns: `${c}fr ${1 - c}fr`, gridTemplateRows: `${rR}fr ${1 - rR}fr` };
  if (layout === "3-stack")
    return { gridTemplateAreas: '"a" "b" "c"', gridTemplateColumns: "1fr", gridTemplateRows: `${r}fr ${rS - r}fr ${1 - rS}fr` };
  // 4-grid
  return { gridTemplateAreas: '"a b" "c d"', gridTemplateColumns: `${c}fr ${1 - c}fr`, gridTemplateRows: `${r}fr ${1 - r}fr` };
}

const AREA = ["a", "b", "c", "d"] as const;

/* ─── Source labels & helpers ─── */

function srcLabel(s: Source): string {
  if (s.title) return s.title;
  if (s.kind === "empty") return "Пусто";
  if (s.kind === "chess-internal") return "♞ CyberChess";
  if (s.kind === "twitch") return `Twitch · ${s.channel || "?"}`;
  if (s.kind === "twitch-chat") return `💬 Chat · ${s.channel || "?"}`;
  if (s.kind === "youtube-channel") return `YouTube live`;
  if (s.kind === "youtube-video") return `YouTube · ${s.videoId || "?"}`;
  if (s.kind === "lichess-game") return `Lichess · ${s.gameId || "?"}`;
  if (s.kind === "lichess-tv") return "Lichess TV";
  if (s.kind === "url") return s.url || "URL";
  return "?";
}

function srcIcon(kind: SourceKind): string {
  if (kind === "chess-internal") return "♞";
  if (kind === "twitch") return "🟣";
  if (kind === "twitch-chat") return "💬";
  if (kind === "youtube-channel" || kind === "youtube-video") return "▶";
  if (kind === "lichess-game" || kind === "lichess-tv") return "♟";
  if (kind === "url") return "🔗";
  return "+";
}

function externalUrl(s: Source): string | null {
  if (s.kind === "chess-internal") return "/cyberchess";
  if (s.kind === "twitch" && s.channel) return `https://www.twitch.tv/${s.channel}`;
  if (s.kind === "twitch-chat" && s.channel) return `https://www.twitch.tv/popout/${s.channel}/chat`;
  if (s.kind === "youtube-channel" && s.channel) return `https://www.youtube.com/channel/${s.channel}/live`;
  if (s.kind === "youtube-video" && s.videoId) return `https://www.youtube.com/watch?v=${s.videoId}`;
  if (s.kind === "lichess-game" && s.gameId) return `https://lichess.org/${s.gameId}`;
  if (s.kind === "lichess-tv") return "https://lichess.org/tv";
  if (s.kind === "url" && s.url) return s.url;
  return null;
}

/* ─── Pane content (iframe wrappers) ─── */

function PaneContent({ src, parentDomain }: { src: Source; parentDomain: string }) {
  const iframeStyle: React.CSSProperties = {
    width: "100%", height: "100%", border: "none", display: "block", background: "#000",
  };
  if (src.kind === "empty") return null;
  if (src.kind === "chess-internal") {
    // ?embed=1 — hides AEVION top nav, shrinks padding, no bottom mobile nav
    return <iframe src="/cyberchess?embed=1" style={{ ...iframeStyle, background: CC.bg }} title="CyberChess" allow="clipboard-write; microphone" />;
  }
  if (src.kind === "twitch" && src.channel) {
    const muted = src.muted ? "true" : "false";
    return <iframe
      src={`https://player.twitch.tv/?channel=${encodeURIComponent(src.channel)}&parent=${encodeURIComponent(parentDomain)}&muted=${muted}&autoplay=true`}
      style={iframeStyle}
      allowFullScreen allow="autoplay; fullscreen; encrypted-media"
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
      title={`Twitch · ${src.channel}`} />;
  }
  if (src.kind === "twitch-chat" && src.channel) {
    return <iframe
      src={`https://www.twitch.tv/embed/${encodeURIComponent(src.channel)}/chat?parent=${encodeURIComponent(parentDomain)}&darkpopout`}
      style={{ ...iframeStyle, background: "#18181b" }}
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      title={`Twitch chat · ${src.channel}`} />;
  }
  if (src.kind === "youtube-channel" && src.channel) {
    // YouTube channels rarely live 24/7. Embed uploads playlist (UC → UU prefix swap)
    // which auto-plays the channel's most recent videos. Fallback to live_stream if not UC-prefixed.
    const usingUC = src.channel.startsWith("UC");
    const embedUrl = usingUC
      ? `https://www.youtube.com/embed/videoseries?list=${"UU" + src.channel.slice(2)}&autoplay=1&mute=${src.muted ? "1" : "0"}`
      : `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(src.channel)}&autoplay=1&mute=${src.muted ? "1" : "0"}`;
    return <iframe
      src={embedUrl}
      style={iframeStyle}
      allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
      allowFullScreen
      title={`YouTube · ${src.channel}`} />;
  }
  if (src.kind === "youtube-video" && src.videoId) {
    return <iframe
      src={`https://www.youtube.com/embed/${encodeURIComponent(src.videoId)}?autoplay=1&mute=${src.muted ? "1" : "0"}`}
      style={iframeStyle}
      allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
      allowFullScreen
      title={`YouTube · ${src.videoId}`} />;
  }
  if (src.kind === "lichess-game" && src.gameId) {
    return <iframe src={`https://lichess.org/embed/game/${encodeURIComponent(src.gameId)}?theme=brown&bg=dark`} style={iframeStyle} title={`Lichess · ${src.gameId}`} />;
  }
  if (src.kind === "lichess-tv") {
    return <iframe src={`https://lichess.org/tv/frame?theme=brown&bg=dark`} style={iframeStyle} title="Lichess TV" />;
  }
  if (src.kind === "url" && src.url) {
    return <iframe src={src.url} style={iframeStyle} allowFullScreen title={src.url} />;
  }
  return <div style={{ padding: SPACE[4], color: CC.textDim }}>Источник не настроен</div>;
}

/* ─── Source picker modal ─── */

type Broadcast = {
  tour?: { id: string; name: string; slug?: string; image?: string; description?: string };
  rounds?: { id: string; slug?: string; name: string; createdAt?: number; ongoing?: boolean }[];
};

type LiveStreamer = {
  id: string;
  name: string;
  title?: string;          // "GM", "IM" etc
  patron?: boolean;
  stream?: { service: string; status: string; lang?: string };
  streamer?: { name?: string; headline?: string; twitch?: string; youTube?: string };
};

function extractTwitchHandle(url?: string): string | null {
  if (!url) return null;
  const m = url.match(/twitch\.tv\/([a-zA-Z0-9_]+)/i);
  return m ? m[1].toLowerCase() : null;
}
function extractYouTubeChannelId(url?: string): string | null {
  if (!url) return null;
  const m = url.match(/youtube\.com\/(?:channel\/)?(UC[a-zA-Z0-9_-]+)/i);
  return m ? m[1] : null;
}

function SourcePicker({ open, onClose, onPick }: {
  open: boolean; onClose: () => void; onPick: (s: Source) => void;
}) {
  const [tab, setTab] = useState<"live" | "twitch-presets" | "youtube-presets" | "twitch" | "youtube" | "lichess" | "url">("live");
  const [liveStreamers, sLiveStreamers] = useState<LiveStreamer[]>([]);
  const [loadingLive, sLoadingLive] = useState(false);
  const [liveError, sLiveError] = useState<string | null>(null);
  const [liveLastFetch, sLiveLastFetch] = useState<number>(0);
  const [search, setSearch] = useState("");
  const [twitchInput, sTwitchInput] = useState("");
  const [ytChannelInput, sYtChannelInput] = useState("");
  const [ytVideoInput, sYtVideoInput] = useState("");
  const [liGame, sLiGame] = useState("");
  const [urlInput, sUrlInput] = useState("");
  const [broadcasts, sBroadcasts] = useState<Broadcast[]>([]);
  const [loadingBC, sLoadingBC] = useState(false);
  const [bcError, sBcError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (tab !== "lichess") return;
    if (broadcasts.length > 0) return;
    sLoadingBC(true);
    sBcError(null);
    fetch("https://lichess.org/api/broadcast")
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then(text => {
        const lines = text.split("\n").filter(l => l.trim());
        const parsed: Broadcast[] = [];
        for (const l of lines) { try { parsed.push(JSON.parse(l)); } catch {} }
        sBroadcasts(parsed);
      })
      .catch(e => sBcError(e.message || "Не удалось загрузить турниры"))
      .finally(() => sLoadingBC(false));
  }, [open, tab, broadcasts.length]);

  // Lichess streamer/live — auto-fetch on tab open or every 60s while open
  useEffect(() => {
    if (!open) return;
    if (tab !== "live") return;
    if (Date.now() - liveLastFetch < 60_000 && liveStreamers.length > 0) return;
    sLoadingLive(true);
    sLiveError(null);
    fetch("https://lichess.org/api/streamer/live")
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((arr: LiveStreamer[]) => { sLiveStreamers(Array.isArray(arr) ? arr : []); sLiveLastFetch(Date.now()); })
      .catch(e => sLiveError(e?.message || "Не удалось загрузить список стримеров"))
      .finally(() => sLoadingLive(false));
  }, [open, tab, liveLastFetch, liveStreamers.length]);

  if (!open) return null;

  const tabs: { v: typeof tab; label: string; icon: string }[] = [
    { v: "live",            label: "🔴 СЕЙЧАС в эфире",  icon: "📡" },
    { v: "twitch-presets",  label: "Twitch · топ",        icon: "🟣" },
    { v: "youtube-presets", label: "YouTube · топ",       icon: "▶" },
    { v: "twitch",          label: "Twitch URL",          icon: "🟣" },
    { v: "youtube",         label: "YouTube URL",         icon: "▶"  },
    { v: "lichess",         label: "Lichess",             icon: "♟"  },
    { v: "url",             label: "Свой URL",            icon: "🔗" },
  ];

  const presets = tab === "twitch-presets" ? TWITCH_PRESETS : tab === "youtube-presets" ? YOUTUBE_PRESETS : [];
  const filtered = presets.filter(p =>
    !search.trim() || p.name.toLowerCase().includes(search.toLowerCase()) || p.desc.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal open={open} onClose={onClose} title="Выбери источник для панели" size="lg">
      {/* tab strip */}
      <div style={{ display: "flex", gap: 4, marginBottom: SPACE[4], flexWrap: "wrap" }}>
        {tabs.map(t => (
          <button key={t.v} onClick={() => { setTab(t.v); setSearch(""); }} className="cc-focus-ring"
            style={{
              padding: "7px 12px", borderRadius: RADIUS.md, fontSize: 12, fontWeight: 800,
              border: tab === t.v ? `2px solid ${CC.brand}` : `1px solid ${CC.border}`,
              background: tab === t.v ? CC.brandSoft : CC.surface1,
              color: tab === t.v ? CC.brand : CC.text, cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 5,
            }}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* LIVE — auto-fetched from Lichess streamer/live */}
      {tab === "live" && (
        <div>
          <div style={{ display: "flex", gap: SPACE[2], marginBottom: SPACE[2], alignItems: "center" }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍 По имени, языку или title (GM/IM)…"
              style={{ flex: 1, padding: "8px 12px", border: `1px solid ${CC.border}`, borderRadius: RADIUS.md, fontSize: 13 }}
            />
            <button onClick={() => sLiveLastFetch(0)} className="cc-focus-ring"
              style={{ padding: "7px 11px", borderRadius: RADIUS.md, border: `1px solid ${CC.border}`, background: CC.surface1, cursor: "pointer", fontSize: 11, fontWeight: 800 }}
              title="Обновить список">↻</button>
          </div>
          <div style={{ fontSize: 11, color: CC.textDim, marginBottom: SPACE[2] }}>
            Шахматисты, которые СЕЙЧАС в прямом эфире (источник — Lichess streamer/live API). Автообновление каждые 60 сек.
            {liveLastFetch > 0 && <span style={{ marginLeft: 6, color: CC.brand }}>· {liveStreamers.length} live</span>}
          </div>
          {loadingLive && <div style={{ display: "flex", alignItems: "center", gap: 8, color: CC.textDim, fontSize: 12 }}><Spinner size={14} /> Опрашиваю Lichess…</div>}
          {liveError && <div style={{ color: CC.danger, fontSize: 12, padding: SPACE[2] }}>{liveError}</div>}
          {!loadingLive && liveStreamers.length === 0 && !liveError && (
            <div style={{ textAlign: "center", padding: SPACE[4], color: CC.textDim, fontSize: 13 }}>
              Никого не нашлось — попробуй обновить или зайди позже
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: SPACE[2] }}>
            {liveStreamers
              .filter(s => {
                if (!search.trim()) return true;
                const q = search.toLowerCase();
                return (s.name?.toLowerCase().includes(q) ||
                        s.title?.toLowerCase().includes(q) ||
                        s.stream?.lang?.toLowerCase().includes(q) ||
                        s.stream?.status?.toLowerCase().includes(q));
              })
              .slice(0, 60)
              .map(s => {
                const tw = extractTwitchHandle(s.streamer?.twitch);
                const yt = extractYouTubeChannelId(s.streamer?.youTube);
                const platform = s.stream?.service;
                const lang = s.stream?.lang?.toUpperCase() || "?";
                const isLive = !!s.stream;
                return (
                  <div key={s.id} style={{
                    padding: SPACE[3], borderRadius: RADIUS.md,
                    border: `1px solid ${isLive ? "#10b981" : CC.border}`,
                    background: isLive ? "linear-gradient(135deg, #f0fdf4, #ecfdf5)" : CC.surface1,
                    display: "flex", flexDirection: "column", gap: 4,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {isLive && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", animation: "cc-pulse-glow 1.2s ease-in-out infinite" }} />}
                      {s.title && <span style={{ fontSize: 9, fontWeight: 900, padding: "1px 5px", borderRadius: 3, background: "#fbbf24", color: "#7c2d12" }}>{s.title}</span>}
                      <span style={{ fontSize: 13, fontWeight: 900, color: CC.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, color: CC.textDim, padding: "1px 4px", borderRadius: 3, background: CC.surface3 }}>{lang}</span>
                    </div>
                    <div style={{ fontSize: 11, color: CC.textDim, lineHeight: 1.4, minHeight: 28, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>
                      {s.stream?.status || s.streamer?.headline || "Без описания"}
                    </div>
                    <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                      {tw && platform === "twitch" && (
                        <>
                          <button onClick={() => { onPick({ kind: "twitch", channel: tw, title: s.name }); onClose(); }}
                            style={{ flex: "1 1 50px", padding: "5px 6px", border: "none", borderRadius: 5, background: "#9146ff", color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
                            📺 Twitch
                          </button>
                          <button onClick={() => { onPick({ kind: "twitch-chat", channel: tw, title: `💬 ${s.name}` }); onClose(); }}
                            title="Только чат"
                            style={{ padding: "5px 8px", borderRadius: 5, background: "#18181b", color: "#a78bfa", fontSize: 11, fontWeight: 800, cursor: "pointer", border: "1px solid #2a2d34" }}>
                            💬
                          </button>
                        </>
                      )}
                      {yt && platform === "youtube" && (
                        <button onClick={() => { onPick({ kind: "youtube-channel", channel: yt, title: s.name }); onClose(); }}
                          style={{ flex: "1 1 auto", padding: "5px 6px", border: "none", borderRadius: 5, background: "#ff0000", color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
                          ▶ YouTube live
                        </button>
                      )}
                      {/* fallback: if platform unknown but we have any handle, prefer twitch */}
                      {tw && platform !== "twitch" && (
                        <button onClick={() => { onPick({ kind: "twitch", channel: tw, title: s.name }); onClose(); }}
                          style={{ flex: "1 1 auto", padding: "5px 6px", border: "1px solid #2a2d34", borderRadius: 5, background: CC.surface1, color: CC.text, fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
                          🟣 {tw}
                        </button>
                      )}
                      <a href={`https://lichess.org/@/${s.id}`} target="_blank" rel="noopener"
                        title="Профиль на Lichess"
                        style={{ padding: "5px 7px", borderRadius: 5, background: CC.surface3, color: CC.textDim, fontSize: 11, fontWeight: 700, textDecoration: "none" }}>
                        ♟
                      </a>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* PRESETS — Twitch or YouTube */}
      {(tab === "twitch-presets" || tab === "youtube-presets") && (
        <div>
          <div style={{ display: "flex", gap: SPACE[2], marginBottom: SPACE[3], alignItems: "center" }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Поиск по имени или описанию…"
              style={{ flex: 1, padding: "8px 12px", border: `1px solid ${CC.border}`, borderRadius: RADIUS.md, fontSize: 13 }}
            />
            <a href={tab === "twitch-presets" ? "https://www.twitch.tv/directory/category/chess" : "https://www.youtube.com/results?search_query=chess+live"}
              target="_blank" rel="noopener"
              style={{ fontSize: 11, color: CC.accent, textDecoration: "none", fontWeight: 700, padding: "4px 8px" }}>
              {tab === "twitch-presets" ? "Все live на Twitch ↗" : "Поиск на YouTube ↗"}
            </a>
          </div>
          <div style={{ fontSize: 11, color: CC.textDim, marginBottom: SPACE[2] }}>
            {filtered.length} {tab === "twitch-presets" ? "Twitch" : "YouTube"} канал{filtered.length === 1 ? "" : filtered.length < 5 ? "а" : "ов"}. Клик добавит в панель.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: SPACE[2] }}>
            {filtered.map(p => (
              <div key={p.name + p.channel}
                style={{
                  padding: SPACE[3], borderRadius: RADIUS.md,
                  border: `1px solid ${CC.border}`, background: CC.surface1,
                  display: "flex", flexDirection: "column", gap: 5,
                  transition: `all ${MOTION.fast} ${MOTION.ease}`,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = CC.brand; (e.currentTarget as HTMLDivElement).style.background = CC.brandSoft; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = CC.border; (e.currentTarget as HTMLDivElement).style.background = CC.surface1; }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: CC.text }}>{p.name}</div>
                <div style={{ fontSize: 11, color: CC.textDim, lineHeight: 1.35 }}>{p.desc}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: p.platform === "twitch" ? "#9146ff" : "#ff0000" }}>
                  {p.platform === "twitch" ? "🟣 Twitch" : "▶ YouTube"} · {p.channel}
                </div>
                <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                  <button onClick={() => {
                    if (p.platform === "twitch") onPick({ kind: "twitch", channel: p.channel, title: p.name });
                    else onPick({ kind: "youtube-channel", channel: p.channel, title: p.name });
                    onClose();
                  }} className="cc-focus-ring"
                    style={{ flex: 1, padding: "5px 8px", border: "none", borderRadius: 5, background: CC.brand, color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
                    📺 Видео
                  </button>
                  {p.platform === "twitch" && (
                    <button onClick={() => { onPick({ kind: "twitch-chat", channel: p.channel, title: `💬 ${p.name}` }); onClose(); }}
                      className="cc-focus-ring"
                      title="Добавить только чат канала (без видео — экономит трафик и место)"
                      style={{ padding: "5px 9px", borderRadius: 5, background: "#18181b", color: "#a78bfa", fontSize: 11, fontWeight: 800, cursor: "pointer", border: "1px solid #2a2d34" }}>
                      💬 Чат
                    </button>
                  )}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: SPACE[4], color: CC.textDim, fontSize: 13 }}>
                Ничего не найдено по запросу "{search}"
              </div>
            )}
          </div>
        </div>
      )}

      {/* TWITCH custom URL */}
      {tab === "twitch" && (
        <div style={{ display: "flex", flexDirection: "column", gap: SPACE[3] }}>
          <div style={{ fontSize: 12, color: CC.textDim }}>
            Имя канала или URL Twitch. Например: <code style={{ background: CC.surface3, padding: "1px 5px", borderRadius: 3 }}>gmhikaru</code> или <code style={{ background: CC.surface3, padding: "1px 5px", borderRadius: 3 }}>https://twitch.tv/gmhikaru</code>
          </div>
          <input
            value={twitchInput} onChange={e => sTwitchInput(e.target.value)}
            placeholder="gmhikaru или https://twitch.tv/..."
            style={{ padding: "10px 14px", border: `1px solid ${CC.border}`, borderRadius: RADIUS.md, fontSize: 14 }}
          />
          <div style={{ display: "flex", gap: SPACE[2] }}>
            <Btn variant="primary" disabled={!twitchInput.trim()} onClick={() => {
              let ch = twitchInput.trim();
              const m = ch.match(/twitch\.tv\/([^/?#]+)/i);
              if (m) ch = m[1];
              ch = ch.replace(/^@/, "").toLowerCase();
              if (!ch) return;
              onPick({ kind: "twitch", channel: ch });
              onClose();
            }}>📺 Видео</Btn>
            <Btn variant="secondary" disabled={!twitchInput.trim()} onClick={() => {
              let ch = twitchInput.trim();
              const m = ch.match(/twitch\.tv\/([^/?#]+)/i);
              if (m) ch = m[1];
              ch = ch.replace(/^@/, "").toLowerCase();
              if (!ch) return;
              onPick({ kind: "twitch-chat", channel: ch, title: `💬 ${ch}` });
              onClose();
            }}>💬 Только чат</Btn>
          </div>
        </div>
      )}

      {/* YOUTUBE custom URL */}
      {tab === "youtube" && (
        <div style={{ display: "flex", flexDirection: "column", gap: SPACE[4] }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: CC.text, marginBottom: SPACE[2] }}>📡 Live-стрим канала</div>
            <div style={{ fontSize: 11, color: CC.textDim, marginBottom: SPACE[2] }}>
              Channel ID (например, <code>UCQHX6ViZmPsWiYSFAyS0a3Q</code>) — найдёшь в URL канала на youtube.com
            </div>
            <div style={{ display: "flex", gap: SPACE[2] }}>
              <input value={ytChannelInput} onChange={e => sYtChannelInput(e.target.value)}
                placeholder="UCQHX6ViZmPsWiYSFAyS0a3Q"
                style={{ flex: 1, padding: "10px 14px", border: `1px solid ${CC.border}`, borderRadius: RADIUS.md, fontSize: 14 }} />
              <Btn variant="primary" disabled={!ytChannelInput.trim()} onClick={() => {
                onPick({ kind: "youtube-channel", channel: ytChannelInput.trim() });
                onClose();
              }}>Live</Btn>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: CC.text, marginBottom: SPACE[2] }}>🎥 Видео по ID или URL</div>
            <div style={{ display: "flex", gap: SPACE[2] }}>
              <input value={ytVideoInput} onChange={e => sYtVideoInput(e.target.value)}
                placeholder="dQw4w9WgXcQ или https://youtube.com/watch?v=..."
                style={{ flex: 1, padding: "10px 14px", border: `1px solid ${CC.border}`, borderRadius: RADIUS.md, fontSize: 14 }} />
              <Btn variant="primary" disabled={!ytVideoInput.trim()} onClick={() => {
                let id = ytVideoInput.trim();
                const m1 = id.match(/[?&]v=([^&]+)/);
                const m2 = id.match(/youtu\.be\/([^?#]+)/);
                if (m1) id = m1[1]; else if (m2) id = m2[1];
                onPick({ kind: "youtube-video", videoId: id });
                onClose();
              }}>Видео</Btn>
            </div>
          </div>
        </div>
      )}

      {/* LICHESS */}
      {tab === "lichess" && (
        <div style={{ display: "flex", flexDirection: "column", gap: SPACE[4] }}>
          <div style={{ display: "flex", gap: SPACE[2], flexWrap: "wrap" }}>
            <Btn variant="accent" onClick={() => { onPick({ kind: "lichess-tv", title: "Lichess TV" }); onClose(); }}>
              📺 Lichess TV (live top игры)
            </Btn>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: CC.text, marginBottom: SPACE[2] }}>🎮 Конкретная партия (8-знач. ID)</div>
            <div style={{ display: "flex", gap: SPACE[2] }}>
              <input value={liGame} onChange={e => sLiGame(e.target.value)}
                placeholder="abcdefgh или https://lichess.org/abcdefgh"
                style={{ flex: 1, padding: "10px 14px", border: `1px solid ${CC.border}`, borderRadius: RADIUS.md, fontSize: 14 }} />
              <Btn variant="primary" disabled={!liGame.trim()} onClick={() => {
                let id = liGame.trim();
                const m = id.match(/lichess\.org\/([a-zA-Z0-9]{8})/);
                if (m) id = m[1];
                id = id.slice(0, 8);
                onPick({ kind: "lichess-game", gameId: id });
                onClose();
              }}>Открыть</Btn>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: CC.text, marginBottom: SPACE[2] }}>
              🏆 Live турниры (Lichess Broadcasts API)
            </div>
            {loadingBC && <div style={{ display: "flex", alignItems: "center", gap: 8, color: CC.textDim, fontSize: 12 }}><Spinner size={14} /> Загружаю список…</div>}
            {bcError && <div style={{ color: CC.danger, fontSize: 12 }}>{bcError}</div>}
            {!loadingBC && broadcasts.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: SPACE[1], maxHeight: 280, overflowY: "auto", border: `1px solid ${CC.border}`, borderRadius: RADIUS.md, padding: SPACE[2] }}>
                {broadcasts.slice(0, 30).map((bc, i) => {
                  if (!bc.tour) return null;
                  const ongoing = bc.rounds?.find(r => r.ongoing);
                  return (
                    <a key={i} href={`https://lichess.org/broadcast/${bc.tour.slug || bc.tour.id}/${bc.tour.id}`} target="_blank" rel="noopener"
                      style={{ padding: "8px 10px", borderRadius: RADIUS.sm, background: CC.surface2, color: CC.text, textDecoration: "none", display: "flex", alignItems: "center", gap: 8, fontSize: 12, border: `1px solid ${CC.border}` }}>
                      <span style={{ fontSize: 14 }}>{ongoing ? "🔴" : "⚫"}</span>
                      <span style={{ flex: 1, fontWeight: 700 }}>{bc.tour.name}</span>
                      {ongoing && <Badge tone="brand" size="xs">LIVE</Badge>}
                      <span style={{ color: CC.textDim, fontSize: 10 }}>↗ открыть</span>
                    </a>
                  );
                })}
              </div>
            )}
            <div style={{ fontSize: 10, color: CC.textDim, marginTop: SPACE[1] }}>
              Lichess блокирует прямую вставку turnir-страницы. Открой в новой вкладке, скопируй ID партии — вставь его выше.
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM URL */}
      {tab === "url" && (
        <div style={{ display: "flex", flexDirection: "column", gap: SPACE[3] }}>
          <div style={{ fontSize: 12, color: CC.textDim }}>
            Любой embed-friendly URL. Многие сайты блокируют iframing — если белый экран, источник не разрешает встраивание.
          </div>
          <input value={urlInput} onChange={e => sUrlInput(e.target.value)}
            placeholder="https://..."
            style={{ padding: "10px 14px", border: `1px solid ${CC.border}`, borderRadius: RADIUS.md, fontSize: 14 }} />
          <Btn variant="primary" disabled={!urlInput.trim()} onClick={() => {
            onPick({ kind: "url", url: urlInput.trim() });
            onClose();
          }}>Добавить URL</Btn>
        </div>
      )}
    </Modal>
  );
}

/* ─── Single pane (header + content) ─── */

function Pane({ src, area, onChangeSource, onMute, onClose, onMaximize, onPickerOpen, isMax, parentDomain, controlsVisible, isOnlyChessApp }: {
  src: Source; area: typeof AREA[number];
  onChangeSource: () => void; onMute: () => void; onClose: () => void; onMaximize: () => void; onPickerOpen: () => void;
  isMax: boolean; parentDomain: string; controlsVisible: boolean; isOnlyChessApp: boolean;
}) {
  const isEmpty = src.kind === "empty";
  const ext = externalUrl(src);
  return (
    <div style={{
      gridArea: area,
      background: isEmpty ? "#1a1d24" : "#000",
      border: `1px solid ${isEmpty ? "#2a2d34" : "#1a1d24"}`,
      borderRadius: 10, overflow: "hidden",
      display: "flex", flexDirection: "column",
      position: "relative",
      minWidth: 0, minHeight: 0,
    }}>
      {/* Header (auto-hide) */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 5,
        padding: "6px 10px", background: "linear-gradient(180deg, rgba(0,0,0,0.8), rgba(0,0,0,0))",
        display: "flex", alignItems: "center", gap: 6,
        opacity: controlsVisible || isEmpty ? 1 : 0,
        transition: `opacity ${MOTION.base} ${MOTION.ease}`,
        pointerEvents: controlsVisible || isEmpty ? "auto" : "none",
      }}>
        <span style={{ fontSize: 13, marginRight: 4 }}>{srcIcon(src.kind)}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: "#fff", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {srcLabel(src)}
        </span>
        {!isEmpty && (src.kind === "twitch" || src.kind === "youtube-channel" || src.kind === "youtube-video") && (
          <Tooltip label={src.muted ? "Включить звук" : "Mute"}>
            <button onClick={onMute} className="cc-focus-ring"
              style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: 4, padding: "3px 7px", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>
              {src.muted ? "🔇" : "🔊"}
            </button>
          </Tooltip>
        )}
        {!isEmpty && ext && (
          <Tooltip label={src.kind === "chess-internal" ? "Открыть полноценный CyberChess (со Stockfish и движком)" : "Открыть в новой вкладке"}>
            <a href={ext} target="_blank" rel="noopener" className="cc-focus-ring"
              style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: 4, padding: "3px 7px", fontSize: 11, cursor: "pointer", fontWeight: 700, textDecoration: "none" }}>
              ↗
            </a>
          </Tooltip>
        )}
        {!isEmpty && (
          <Tooltip label="Сменить источник">
            <button onClick={onChangeSource} className="cc-focus-ring"
              style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: 4, padding: "3px 7px", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>
              ⇄
            </button>
          </Tooltip>
        )}
        <Tooltip label={isMax ? "Свернуть" : "На весь экран"}>
          <button onClick={onMaximize} className="cc-focus-ring"
            style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: 4, padding: "3px 7px", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>
            {isMax ? "🗗" : "⛶"}
          </button>
        </Tooltip>
        {!isOnlyChessApp && (
          <Tooltip label="Очистить панель">
            <button onClick={onClose} className="cc-focus-ring"
              style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: 4, padding: "3px 7px", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>
              ✕
            </button>
          </Tooltip>
        )}
        {isOnlyChessApp && (
          <Tooltip label="Это единственная панель CyberChess — нельзя убрать">
            <span style={{ background: "rgba(124,58,237,0.3)", color: "#a78bfa", borderRadius: 4, padding: "3px 7px", fontSize: 10, fontWeight: 800, letterSpacing: 0.4 }}>
              🔒 LOCK
            </span>
          </Tooltip>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        {isEmpty ? (
          <button onClick={onPickerOpen} className="cc-focus-ring"
            style={{
              width: "100%", height: "100%", border: "none", cursor: "pointer",
              background: "transparent", color: "#9ca3af",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
              transition: `background ${MOTION.fast} ${MOTION.ease}`,
            }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(124,58,237,0.08)"}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "transparent"}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "rgba(124,58,237,0.18)", color: "#a78bfa",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28, fontWeight: 900,
            }}>+</div>
            <div style={{ fontSize: 14, fontWeight: 800 }}>Добавить источник</div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>Twitch / YouTube / Lichess / своя игра</div>
          </button>
        ) : (
          <PaneContent src={src} parentDomain={parentDomain} />
        )}
      </div>
    </div>
  );
}

/* ─── Drag handle for resizing splits ─── */

function ResizeHandle({ orientation, position, onDrag }: {
  orientation: "v" | "h"; position: number; onDrag: (newPos: number) => void;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <div
      onMouseDown={(e) => {
        e.preventDefault();
        setDragging(true);
        const container = (e.currentTarget as HTMLElement).parentElement as HTMLElement;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const onMove = (ev: MouseEvent) => {
          let pos: number;
          if (orientation === "v") pos = (ev.clientX - rect.left) / rect.width;
          else pos = (ev.clientY - rect.top) / rect.height;
          pos = Math.max(0.1, Math.min(0.9, pos));
          onDrag(pos);
        };
        const onUp = () => {
          setDragging(false);
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      }}
      style={{
        position: "absolute",
        zIndex: 20,
        background: dragging ? "rgba(124,58,237,0.5)" : "transparent",
        transition: `background ${MOTION.fast} ${MOTION.ease}`,
        ...(orientation === "v"
          ? { left: `calc(${position * 100}% - 4px)`, top: 0, bottom: 0, width: 8, cursor: "col-resize" }
          : { top: `calc(${position * 100}% - 4px)`, left: 0, right: 0, height: 8, cursor: "row-resize" }),
      }}
      onMouseEnter={(e) => { if (!dragging) (e.currentTarget as HTMLElement).style.background = "rgba(124,58,237,0.25)"; }}
      onMouseLeave={(e) => { if (!dragging) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    />
  );
}

/* ─── Resize handles per layout ─── */

function ResizeHandles({ layout, splits, onUpdate }: { layout: Layout; splits: Splits; onUpdate: (s: Splits) => void }) {
  const c = splits.col ?? 0.5;
  const r = splits.row ?? 0.5;
  const rR = splits.rowR ?? 0.5;
  const rS = splits.rowS ?? 0.66;
  if (layout === "1") return null;

  if (layout === "2v") {
    return <ResizeHandle orientation="v" position={c} onDrag={(p) => onUpdate({ ...splits, col: p })} />;
  }
  if (layout === "2h") {
    return <ResizeHandle orientation="h" position={r} onDrag={(p) => onUpdate({ ...splits, row: p })} />;
  }
  if (layout === "4-grid") {
    return <>
      <ResizeHandle orientation="v" position={c} onDrag={(p) => onUpdate({ ...splits, col: p })} />
      <ResizeHandle orientation="h" position={r} onDrag={(p) => onUpdate({ ...splits, row: p })} />
    </>;
  }
  if (layout === "3-left-big") {
    // Vertical split for the columns + horizontal split inside the right column.
    // The right column starts at x = col*100% and the inner row split is at rR.
    return <>
      <ResizeHandle orientation="v" position={c} onDrag={(p) => onUpdate({ ...splits, col: p })} />
      <div style={{ position: "absolute", left: `${c * 100}%`, top: 0, bottom: 0, right: 0 }}>
        <ResizeHandle orientation="h" position={rR} onDrag={(p) => onUpdate({ ...splits, rowR: p })} />
      </div>
    </>;
  }
  if (layout === "3-stack") {
    return <>
      <ResizeHandle orientation="h" position={r} onDrag={(p) => onUpdate({ ...splits, row: Math.min(p, (splits.rowS ?? 0.66) - 0.05) })} />
      <ResizeHandle orientation="h" position={rS} onDrag={(p) => onUpdate({ ...splits, rowS: Math.max(p, (splits.row ?? 0.33) + 0.05) })} />
    </>;
  }
  return null;
}

/* ─── Picture-in-picture floating chess overlay ─── */

type PipState = { x: number; y: number; w: number; h: number; open: boolean };
const PIP_KEY = "aevion_studio_pip_v1";
const PIP_DEFAULT: PipState = { x: 20, y: 80, w: 380, h: 420, open: false };

function loadPip(): PipState {
  if (typeof window === "undefined") return PIP_DEFAULT;
  try {
    const raw = localStorage.getItem(PIP_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && typeof s.x === "number") return { ...PIP_DEFAULT, ...s };
    }
  } catch {}
  return PIP_DEFAULT;
}

function PipChess({ pip, onChange, onClose }: {
  pip: PipState; onChange: (p: PipState) => void; onClose: () => void;
}) {
  // Clamp to viewport so the PiP is never thrown off-screen on resize
  const [vp, setVp] = useState({ w: 1280, h: 720 });
  useEffect(() => {
    const sync = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);
  const x = Math.max(0, Math.min(vp.w - 80, pip.x));
  const y = Math.max(0, Math.min(vp.h - 60, pip.y));
  const w = Math.max(280, Math.min(vp.w - 20, pip.w));
  const h = Math.max(320, Math.min(vp.h - 20, pip.h));

  const onDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const baseX = pip.x, baseY = pip.y;
    const onMove = (ev: MouseEvent) => {
      onChange({ ...pip, x: baseX + (ev.clientX - startX), y: baseY + (ev.clientY - startY) });
    };
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX, startY = e.clientY;
    const baseW = pip.w, baseH = pip.h;
    const onMove = (ev: MouseEvent) => {
      onChange({ ...pip, w: Math.max(280, baseW + (ev.clientX - startX)), h: Math.max(320, baseH + (ev.clientY - startY)) });
    };
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div style={{
      position: "fixed", left: x, top: y, width: w, height: h, zIndex: 50,
      background: "#0e1014", borderRadius: 12, overflow: "hidden",
      border: "2px solid #7c3aed", boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,58,237,0.3)",
      display: "flex", flexDirection: "column",
    }}>
      <div onMouseDown={onDragStart}
        style={{
          padding: "6px 10px", background: "linear-gradient(135deg,#3b1d6a,#7c3aed40)",
          color: "#e5e7eb", fontSize: 11, fontWeight: 800, letterSpacing: 0.5,
          display: "flex", alignItems: "center", gap: 6, cursor: "move",
          borderBottom: "1px solid #2a2d34", userSelect: "none",
        }}>
        <span>♞ PiP CyberChess</span>
        <span style={{ flex: 1 }} />
        <a href="/cyberchess" target="_blank" rel="noopener"
          title="Открыть полный CyberChess (Stockfish, AI Coach)"
          style={{ color: "#a78bfa", textDecoration: "none", padding: "1px 6px", borderRadius: 4, background: "rgba(124,58,237,0.18)", fontSize: 10, fontWeight: 800 }}>↗</a>
        <button onClick={onClose}
          style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: 4, padding: "2px 7px", fontSize: 11, cursor: "pointer", fontWeight: 800 }}>✕</button>
      </div>
      <iframe src="/cyberchess?embed=1" title="PiP CyberChess"
        style={{ flex: 1, border: "none", background: CC.bg }}
        allow="clipboard-write; microphone" />
      <div onMouseDown={onResizeStart}
        title="Растянуть"
        style={{
          position: "absolute", right: 0, bottom: 0, width: 18, height: 18,
          cursor: "nwse-resize",
          background: "linear-gradient(135deg, transparent 50%, #7c3aed 50%, #7c3aed 100%)",
          borderBottomRightRadius: 10,
        }} />
    </div>
  );
}

/* ─── Main StudioPage ─── */

export default function StudioPage() {
  const [state, setStateRaw] = useState<StudioState>(() => loadState());
  const [pickerForIdx, setPickerForIdx] = useState<number | null>(null);
  const [maxIdx, setMaxIdx] = useState<number | null>(null);
  const [parentDomain, setParentDomain] = useState("localhost");
  const [controlsVisible, setControlsVisible] = useState(true);
  const [topBarPinned, setTopBarPinned] = useState(true);  // auto-hide toggle
  const [topBarVisible, setTopBarVisible] = useState(true);
  const idleTimer = useRef<any>(null);
  const topBarTimer = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [pip, setPip] = useState<PipState>(() => loadPip());
  useEffect(() => { try { localStorage.setItem(PIP_KEY, JSON.stringify(pip)); } catch {} }, [pip]);

  useEffect(() => { setParentDomain(window.location.hostname || "localhost"); }, []);

  // Setter that ensures at least one chess-internal pane always exists
  const setState = (updater: (s: StudioState) => StudioState) => {
    setStateRaw(prev => {
      const next = updater(prev);
      const n = paneCount(next.layout);
      const visible = next.panes.slice(0, n);
      const hasChess = visible.some(p => p.kind === "chess-internal");
      if (!hasChess) {
        // Auto-restore: find first empty pane and make it chess-internal
        const panes = [...next.panes];
        const firstEmptyIdx = visible.findIndex(p => p.kind === "empty");
        if (firstEmptyIdx >= 0) {
          panes[firstEmptyIdx] = { kind: "chess-internal" };
          setWarningMsg("Восстановлена панель CyberChess — приложение должно быть всегда видно");
          setTimeout(() => setWarningMsg(null), 3500);
          return { ...next, panes };
        } else {
          // No empty slot — replace the last visible pane
          panes[n - 1] = { kind: "chess-internal" };
          setWarningMsg("Панель CyberChess вернулась — она обязательна");
          setTimeout(() => setWarningMsg(null), 3500);
          return { ...next, panes };
        }
      }
      return next;
    });
  };

  useEffect(() => { saveState(state); }, [state]);

  // Auto-hide pane controls after 2.5s of mouse idle
  useEffect(() => {
    const onMove = () => {
      setControlsVisible(true);
      clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => setControlsVisible(false), 2500);
    };
    onMove();
    window.addEventListener("mousemove", onMove);
    return () => { window.removeEventListener("mousemove", onMove); clearTimeout(idleTimer.current); };
  }, []);

  // Auto-hide top bar when unpinned: show on mouse near top edge
  useEffect(() => {
    if (topBarPinned) { setTopBarVisible(true); return; }
    const onMove = (e: MouseEvent) => {
      if (e.clientY < 60) {
        setTopBarVisible(true);
        clearTimeout(topBarTimer.current);
        topBarTimer.current = setTimeout(() => setTopBarVisible(false), 2200);
      }
    };
    setTopBarVisible(false);
    window.addEventListener("mousemove", onMove);
    return () => { window.removeEventListener("mousemove", onMove); clearTimeout(topBarTimer.current); };
  }, [topBarPinned]);

  const visiblePanes = useMemo(() => {
    const n = paneCount(state.layout);
    const out: Source[] = [];
    for (let i = 0; i < n; i++) out.push(state.panes[i] || EMPTY);
    return out;
  }, [state.layout, state.panes]);

  // How many chess-internal panes are currently shown? (used to know if a
  // given pane is the LAST chess pane and therefore not removable)
  const chessPaneCount = visiblePanes.filter(p => p.kind === "chess-internal").length;

  const updatePane = (idx: number, next: Source) => {
    setState(s => {
      const panes = [...s.panes];
      panes[idx] = next;
      return { ...s, panes };
    });
  };

  const setLayout = (layout: Layout) => {
    setState(s => {
      const n = paneCount(layout);
      const panes = [...s.panes];
      while (panes.length < n) panes.push(EMPTY);
      return { layout, panes: panes.slice(0, Math.max(n, panes.length)), splits: { ...DEFAULT_SPLITS, ...s.splits } };
    });
    setMaxIdx(null);
  };

  const applyPreset = (presetId: string) => {
    const p = PRESET_LAYOUTS.find(x => x.id === presetId);
    if (!p) return;
    setState(() => ({ layout: p.layout, panes: [...p.panes], splits: { ...DEFAULT_SPLITS, ...(p.splits || {}) } }));
    setMaxIdx(null);
  };

  const muteAll = (muted: boolean) => {
    setState(s => ({ ...s, panes: s.panes.map(p => ({ ...p, muted })) }));
  };

  const updateSplits = (sp: Splits) => setState(s => ({ ...s, splits: sp }));

  // Layout switcher icons
  const layoutBtns: { v: Layout; label: string; svg: React.ReactNode }[] = [
    { v: "1", label: "1 экран", svg: <RectIcon parts={[[0,0,1,1]]} /> },
    { v: "2v", label: "2 колонки", svg: <RectIcon parts={[[0,0,0.5,1],[0.5,0,0.5,1]]} /> },
    { v: "2h", label: "2 ряда", svg: <RectIcon parts={[[0,0,1,0.5],[0,0.5,1,0.5]]} /> },
    { v: "3-left-big", label: "1 большой + 2 малых", svg: <RectIcon parts={[[0,0,0.66,1],[0.66,0,0.34,0.5],[0.66,0.5,0.34,0.5]]} /> },
    { v: "3-stack", label: "3 ряда", svg: <RectIcon parts={[[0,0,1,0.33],[0,0.33,1,0.33],[0,0.66,1,0.34]]} /> },
    { v: "4-grid", label: "2×2 сетка", svg: <RectIcon parts={[[0,0,0.5,0.5],[0.5,0,0.5,0.5],[0,0.5,0.5,0.5],[0.5,0.5,0.5,0.5]]} /> },
  ];

  return (
    <div style={{
      minHeight: "100vh", background: "#0e1014", color: "#e5e7eb",
      display: "flex", flexDirection: "column",
    }}>
      {/* Top bar — collapsible (auto-hide when unpinned) */}
      <div style={{
        position: topBarPinned ? "relative" : "fixed",
        top: 0, left: 0, right: 0, zIndex: 25,
        transform: (topBarPinned || topBarVisible) ? "translateY(0)" : "translateY(-100%)",
        transition: `transform ${MOTION.base} ${MOTION.ease}`,
        padding: "10px 16px", display: "flex", alignItems: "center", gap: SPACE[3], flexWrap: "wrap",
        background: "rgba(20,22,28,0.95)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        borderBottom: `1px solid #1f2229`,
      }}>
        <Link href="/cyberchess" style={{
          display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 800,
          color: "#e5e7eb", textDecoration: "none", padding: "6px 10px",
          borderRadius: RADIUS.md, background: "#1f2229", border: "1px solid #2a2d34",
        }}>← CyberChess</Link>

        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px",
          borderRadius: RADIUS.full, background: "linear-gradient(135deg,#7c3aed20,#059669 20)",
          border: "1px solid #7c3aed", color: "#a78bfa", fontSize: 11, fontWeight: 900, letterSpacing: 0.5,
        }}>
          🎬 STUDIO MODE
        </div>

        <div style={{ flex: 1 }} />

        {/* Layout switcher */}
        <div style={{ display: "inline-flex", gap: 2, padding: 3, background: "#1f2229", borderRadius: RADIUS.md }}>
          {layoutBtns.map(b => {
            const active = state.layout === b.v;
            return (
              <Tooltip key={b.v} label={b.label}>
                <button onClick={() => setLayout(b.v)} className="cc-focus-ring"
                  style={{
                    width: 34, height: 28, padding: 4, border: "none", cursor: "pointer",
                    background: active ? "#3b3f4a" : "transparent", borderRadius: RADIUS.sm,
                    color: active ? "#a78bfa" : "#9ca3af",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                  }}>
                  {b.svg}
                </button>
              </Tooltip>
            );
          })}
        </div>

        {/* Presets */}
        <div style={{ display: "inline-flex", gap: 4 }}>
          {PRESET_LAYOUTS.map(p => (
            <Tooltip key={p.id} label={p.label}>
              <button onClick={() => applyPreset(p.id)} className="cc-focus-ring"
                style={{
                  padding: "5px 10px", borderRadius: RADIUS.md, border: "1px solid #2a2d34",
                  background: "#1f2229", color: "#e5e7eb", fontSize: 11, fontWeight: 700, cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 4,
                }}>
                <span>{p.icon}</span> {p.label}
              </button>
            </Tooltip>
          ))}
        </div>

        {/* Mute / unmute all */}
        <Tooltip label="Mute все стримы">
          <button onClick={() => muteAll(true)} className="cc-focus-ring"
            style={{ padding: "5px 10px", borderRadius: RADIUS.md, border: "1px solid #2a2d34", background: "#1f2229", color: "#e5e7eb", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            🔇 mute
          </button>
        </Tooltip>
        <Tooltip label="Unmute все">
          <button onClick={() => muteAll(false)} className="cc-focus-ring"
            style={{ padding: "5px 10px", borderRadius: RADIUS.md, border: "1px solid #2a2d34", background: "#1f2229", color: "#e5e7eb", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            🔊 unmute
          </button>
        </Tooltip>
        <Tooltip label={pip.open ? "Скрыть PiP мини-шахматы" : "Показать плавающую мини-шахматную доску — играй пока смотришь стрим"}>
          <button onClick={() => setPip(p => ({ ...p, open: !p.open }))} className="cc-focus-ring"
            style={{ padding: "5px 10px", borderRadius: RADIUS.md, border: `1px solid ${pip.open ? "#7c3aed" : "#2a2d34"}`, background: pip.open ? "#3b1d6a" : "#1f2229", color: pip.open ? "#a78bfa" : "#e5e7eb", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
            ♞ PiP
          </button>
        </Tooltip>
        <Tooltip label={topBarPinned ? "Скрыть верхнюю панель — появится при наведении на верх экрана" : "Закрепить верхнюю панель"}>
          <button onClick={() => setTopBarPinned(!topBarPinned)} className="cc-focus-ring"
            style={{ padding: "5px 10px", borderRadius: RADIUS.md, border: `1px solid ${topBarPinned ? "#2a2d34" : "#7c3aed"}`, background: topBarPinned ? "#1f2229" : "#3b1d6a", color: topBarPinned ? "#e5e7eb" : "#a78bfa", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
            {topBarPinned ? "📍 закр." : "📌 откр."}
          </button>
        </Tooltip>
      </div>

      {/* Hover-zone to reveal top bar when hidden */}
      {!topBarPinned && !topBarVisible && (
        <div
          onMouseEnter={() => setTopBarVisible(true)}
          style={{
            position: "fixed", top: 0, left: 0, right: 0, height: 8,
            background: "linear-gradient(180deg, rgba(124,58,237,0.4), transparent)",
            zIndex: 24, cursor: "ns-resize",
          }}
          aria-label="Показать верхнюю панель"
        />
      )}

      {/* Warning toast */}
      {warningMsg && (
        <div style={{
          position: "fixed", top: 70, left: "50%", transform: "translateX(-50%)",
          background: "rgba(217,119,6,0.95)", color: "#fff", padding: "8px 16px",
          borderRadius: RADIUS.md, fontSize: 12, fontWeight: 800, zIndex: 100,
          boxShadow: SHADOW.lg,
        }}>
          🔒 {warningMsg}
        </div>
      )}

      {/* Grid of panes */}
      <div ref={containerRef} style={{
        flex: 1, padding: 8,
        display: "grid", gap: 0, position: "relative",
        ...(maxIdx !== null
          ? { gridTemplateAreas: '"a"', gridTemplateColumns: "1fr", gridTemplateRows: "1fr" }
          : gridStyle(state.layout, state.splits)),
      }}>
        {(maxIdx !== null ? [visiblePanes[maxIdx]] : visiblePanes).map((src, displayIdx) => {
          const realIdx = maxIdx !== null ? maxIdx : displayIdx;
          const area = maxIdx !== null ? AREA[0] : AREA[displayIdx];
          const isOnlyChessApp = src.kind === "chess-internal" && chessPaneCount === 1;
          return (
            <Pane
              key={`${realIdx}-${src.kind}`}
              src={src}
              area={area}
              parentDomain={parentDomain}
              controlsVisible={controlsVisible}
              isMax={maxIdx === realIdx}
              isOnlyChessApp={isOnlyChessApp}
              onChangeSource={() => setPickerForIdx(realIdx)}
              onPickerOpen={() => setPickerForIdx(realIdx)}
              onMute={() => updatePane(realIdx, { ...src, muted: !src.muted })}
              onClose={() => updatePane(realIdx, EMPTY)}
              onMaximize={() => setMaxIdx(maxIdx === realIdx ? null : realIdx)}
            />
          );
        })}

        {/* Drag handles for resizing splits (hidden when maximized) */}
        {maxIdx === null && <ResizeHandles layout={state.layout} splits={state.splits} onUpdate={updateSplits} />}
      </div>

      <SourcePicker
        open={pickerForIdx !== null}
        onClose={() => setPickerForIdx(null)}
        onPick={(s) => { if (pickerForIdx !== null) updatePane(pickerForIdx, s); }}
      />

      {pip.open && <PipChess pip={pip} onChange={setPip} onClose={() => setPip(p => ({ ...p, open: false }))} />}
    </div>
  );
}

/* ─── tiny SVG layout-icon ─── */
function RectIcon({ parts }: { parts: [number, number, number, number][] }) {
  return (
    <svg viewBox="0 0 16 12" width="22" height="16">
      {parts.map((p, i) => (
        <rect key={i}
          x={1 + p[0] * 14} y={1 + p[1] * 10}
          width={p[2] * 14 - 0.6} height={p[3] * 10 - 0.6}
          rx={1.2} ry={1.2} fill="currentColor" opacity={0.9} />
      ))}
    </svg>
  );
}
