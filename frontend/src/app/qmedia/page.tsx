"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";

type Track = {
  id: string;
  title: string;
  artist: string;
  genre: string;
  duration: number;
  url: string | null;
  coverUrl: string | null;
  playCount: number;
  tags?: string[];
};
type Video = { id: string; title: string; viewCount: number };
type TrendingGenre = { genre: string; plays: number };
type RecoMode = "personal" | "popular";

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

function fmtTime(s: number) {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function QMediaPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [recos, setRecos] = useState<Track[]>([]);
  const [recoMode, setRecoMode] = useState<RecoMode>("popular");
  const [recoTags, setRecoTags] = useState<string[]>([]);
  const [trendingGenres, setTrendingGenres] = useState<TrendingGenre[]>([]);

  // Player state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(0.9);
  const playReported = useRef<string | null>(null);

  const active = activeIdx >= 0 ? queue[activeIdx] ?? null : null;

  useEffect(() => {
    fetch(apiUrl("/api/qmedia/tracks?limit=8"))
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.items)) setTracks(d.items); })
      .catch(() => {});
    fetch(apiUrl("/api/qmedia/videos?limit=6"))
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.items)) setVideos(d.items); })
      .catch(() => {});
    fetch(apiUrl("/api/qmedia/trending"))
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.genres)) setTrendingGenres(d.genres); })
      .catch(() => {});

    const token = typeof window !== "undefined" ? window.localStorage.getItem("aevion_jwt") : null;
    fetch(apiUrl("/api/qmedia/recommendations?limit=10"), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.items)) setRecos(d.items);
        if (d.mode === "personal" || d.mode === "popular") setRecoMode(d.mode);
        if (d?.profile?.tags && Array.isArray(d.profile.tags)) setRecoTags(d.profile.tags.slice(0, 6));
      })
      .catch(() => {});
  }, []);

  // Sync audio element with state
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.playbackRate = speed;
  }, [speed]);
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = volume;
  }, [volume]);
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !active) return;
    if (el.src !== (active.url ?? "")) {
      el.src = active.url ?? "";
      el.load();
    }
    if (playing) {
      el.play().catch(() => setPlaying(false));
      // Fire a play-count increment exactly once per (track) selection
      if (playReported.current !== active.id) {
        playReported.current = active.id;
        fetch(apiUrl(`/api/qmedia/tracks/${active.id}/play`), { method: "POST" }).catch(() => {});
      }
    } else {
      el.pause();
    }
  }, [active, playing]);

  const playList = useCallback((list: Track[], startIdx = 0) => {
    const playable = list.filter((t) => !!t.url);
    if (playable.length === 0) {
      // Allow play attempt even without url — player will show "no source"
      setQueue(list);
      setActiveIdx(startIdx);
    } else {
      setQueue(list);
      setActiveIdx(startIdx);
    }
    setPlaying(true);
  }, []);

  const onPlayTrack = useCallback((list: Track[], t: Track) => {
    const idx = list.findIndex((x) => x.id === t.id);
    playList(list, idx >= 0 ? idx : 0);
  }, [playList]);

  const togglePlay = useCallback(() => {
    if (!active) return;
    setPlaying((p) => !p);
  }, [active]);

  const goPrev = useCallback(() => {
    if (queue.length === 0) return;
    setActiveIdx((i) => (i <= 0 ? queue.length - 1 : i - 1));
    setPlaying(true);
  }, [queue.length]);
  const goNext = useCallback(() => {
    if (queue.length === 0) return;
    setActiveIdx((i) => (i + 1) % queue.length);
    setPlaying(true);
  }, [queue.length]);

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    const v = Number(e.target.value);
    el.currentTime = (v / 100) * duration;
    setCurrent(el.currentTime);
  };

  const cycleSpeed = () => {
    setSpeed((s) => {
      const i = SPEEDS.indexOf(s);
      return SPEEDS[(i + 1) % SPEEDS.length] ?? 1;
    });
  };

  const features = [
    { icon: "🎵", title: "Music", desc: "Stream and create music with AI", href: "/qmedia/music", color: "#0d9488" },
    { icon: "🎬", title: "Videos", desc: "Watch and share videos", href: "/qmedia/videos", color: "#7c3aed" },
    { icon: "🎨", title: "Creative", desc: "AI lyrics, titles, color palettes", href: "/qmedia/creative", color: "#d97706" },
    { icon: "📻", title: "Live", desc: "Coming soon", href: "#", color: "#94a3b8", disabled: true },
  ];

  const progressPct = useMemo(() => (duration > 0 ? (current / duration) * 100 : 0), [current, duration]);
  const recoListSrc = recos.length > 0 ? recos : tracks;

  return (
    <main>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", margin: "0 0 6px" }}>🎵 QMedia</h1>
          <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>Music, video and creative tools — all in one place.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 32 }}>
          {features.map((f) => (
            <Link key={f.title} href={f.href} style={{ textDecoration: "none", pointerEvents: f.disabled ? "none" : "auto" }}>
              <div style={{ padding: 20, borderRadius: 14, border: `1px solid ${f.color}33`, background: "#fff", opacity: f.disabled ? 0.5 : 1, cursor: f.disabled ? "default" : "pointer" }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>{f.icon}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: f.color, marginBottom: 4 }}>{f.title}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{f.desc}</div>
                {!f.disabled && <div style={{ marginTop: 12, fontSize: 12, fontWeight: 700, color: f.color }}>Open →</div>}
              </div>
            </Link>
          ))}
        </div>

        {/* Recommendations */}
        {recoListSrc.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10, gap: 12, flexWrap: "wrap" }}>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", margin: 0 }}>
                {recoMode === "personal" ? "✨ For you" : "🔥 Popular tracks"}
              </h2>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                {recoMode === "personal" && recoTags.length > 0 && recoTags.map((tag) => (
                  <span key={tag} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 999, background: "#0d948822", color: "#0d9488", fontWeight: 700, textTransform: "lowercase" }}>{tag}</span>
                ))}
                {recoMode === "popular" && (
                  <span style={{ fontSize: 10, color: "#94a3b8" }}>Sign in to personalise</span>
                )}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {recoListSrc.slice(0, 8).map((t, i) => {
                const isActive = active?.id === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => onPlayTrack(recoListSrc, t)}
                    style={{
                      all: "unset",
                      cursor: "pointer",
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: isActive ? "#0d948811" : "#f8fafc",
                      border: isActive ? "1px solid #0d948866" : "1px solid rgba(15,23,42,0.08)",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <span style={{ width: 20, fontSize: 11, color: "#94a3b8", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
                    <span style={{ fontSize: 18 }}>{isActive && playing ? "⏸" : "▶"}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: isActive ? "#0d9488" : "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>{t.artist || "Unknown"} · {t.genre}</div>
                    </div>
                    <span style={{ fontSize: 11, color: "#94a3b8", fontVariantNumeric: "tabular-nums" }}>▶ {t.playCount}</span>
                    <span style={{ fontSize: 11, color: "#94a3b8", fontVariantNumeric: "tabular-nums", width: 38, textAlign: "right" }}>{fmtTime(t.duration)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Trending genres */}
        {trendingGenres.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginBottom: 10 }}>📈 Trending genres</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {trendingGenres.map((g) => (
                <span key={g.genre} style={{ padding: "6px 12px", borderRadius: 999, background: "#7c3aed11", color: "#7c3aed", fontSize: 12, fontWeight: 700, border: "1px solid #7c3aed33" }}>
                  {g.genre} <span style={{ color: "#94a3b8", fontWeight: 500 }}>· {g.plays}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Popular tracks (kept distinct from recommendations) */}
        {tracks.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginBottom: 10 }}>🎵 Most played</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {tracks.map((t) => {
                const isActive = active?.id === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => onPlayTrack(tracks, t)}
                    style={{
                      all: "unset",
                      cursor: "pointer",
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: isActive ? "#0d948811" : "#f8fafc",
                      border: isActive ? "1px solid #0d948866" : "1px solid rgba(15,23,42,0.08)",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{isActive && playing ? "⏸" : "🎵"}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: isActive ? "#0d9488" : "#0f172a" }}>{t.title}</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>{t.artist || "Unknown"} · {t.genre}</div>
                    </div>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>▶ {t.playCount}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {videos.length > 0 && (
          <div style={{ marginBottom: active ? 120 : 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginBottom: 10 }}>🎬 Popular videos</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
              {videos.map((v) => (
                <div key={v.id} style={{ borderRadius: 10, overflow: "hidden", border: "1px solid rgba(15,23,42,0.08)", background: "#fff" }}>
                  <div style={{ height: 100, background: "linear-gradient(135deg, #0d9488, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>🎬</div>
                  <div style={{ padding: "8px 10px" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{v.title}</div>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>{v.viewCount} views</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </ProductPageShell>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={(e) => setCurrent((e.target as HTMLAudioElement).currentTime)}
        onLoadedMetadata={(e) => setDuration((e.target as HTMLAudioElement).duration || 0)}
        onEnded={() => goNext()}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      {/* Sticky player bar */}
      {active && (
        <div style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 50,
          background: "linear-gradient(180deg, rgba(15,23,42,0.96), rgba(15,23,42,1))",
          color: "#f1f5f9",
          borderTop: "1px solid rgba(13,148,136,0.4)",
          padding: "10px 14px",
          backdropFilter: "blur(10px)",
        }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ minWidth: 220, flex: "1 1 220px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 44, height: 44, borderRadius: 8, background: "linear-gradient(135deg, #0d9488, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>🎵</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{active.title}</div>
                <div style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{active.artist || "Unknown"} · {active.genre}</div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={goPrev} title="Previous" style={btnIcon}>⏮</button>
              <button onClick={togglePlay} title={playing ? "Pause" : "Play"} style={{ ...btnIcon, width: 42, height: 42, background: "#0d9488", color: "#fff", fontSize: 18 }}>{playing ? "⏸" : "▶"}</button>
              <button onClick={goNext} title="Next" style={btnIcon}>⏭</button>
            </div>

            <div style={{ flex: "2 1 320px", display: "flex", alignItems: "center", gap: 10, minWidth: 220 }}>
              <span style={{ fontSize: 11, color: "#94a3b8", fontVariantNumeric: "tabular-nums", width: 38, textAlign: "right" }}>{fmtTime(current)}</span>
              <input
                type="range"
                min={0}
                max={100}
                step={0.1}
                value={progressPct}
                onChange={onSeek}
                aria-label="Seek"
                style={{ flex: 1, accentColor: "#0d9488", cursor: "pointer" }}
              />
              <span style={{ fontSize: 11, color: "#94a3b8", fontVariantNumeric: "tabular-nums", width: 38 }}>{fmtTime(duration)}</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={cycleSpeed} title="Playback speed" style={{ ...btnIcon, width: "auto", padding: "0 10px", fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{speed}x</button>
              <span title="Volume" style={{ fontSize: 14 }}>{volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                aria-label="Volume"
                style={{ width: 80, accentColor: "#0d9488", cursor: "pointer" }}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const btnIcon: React.CSSProperties = {
  all: "unset",
  width: 34,
  height: 34,
  borderRadius: 999,
  background: "rgba(255,255,255,0.08)",
  color: "#f1f5f9",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  fontSize: 14,
  flexShrink: 0,
};
