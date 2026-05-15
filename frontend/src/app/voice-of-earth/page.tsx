"use client";

import { CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Filters, { LangFilter, MoodFilter } from "./components/Filters";
import StatsBar, { Stats } from "./components/StatsBar";
import TrackCard, { Track } from "./components/TrackCard";
import SubmitTrackModal from "./components/SubmitTrackModal";

const VOTER_ALIAS_KEY = "voe:voterAlias";
const VOTED_TRACKS_KEY = "voe:votedTracks";

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background:
    "linear-gradient(180deg, #fff8ec 0%, #fff5e0 35%, #ffe8c8 100%)",
  color: "#3a2a14",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif",
};

const headerStyle: CSSProperties = {
  borderBottom: "1px solid #f0d4a0",
  background: "rgba(255, 250, 242, 0.85)",
  backdropFilter: "blur(8px)",
  position: "sticky",
  top: 0,
  zIndex: 10,
};

const headerInner: CSSProperties = {
  maxWidth: 1100,
  margin: "0 auto",
  padding: "14px 24px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const containerStyle: CSSProperties = {
  maxWidth: 1100,
  margin: "0 auto",
  padding: "24px",
};

const heroStyle: CSSProperties = {
  textAlign: "center",
  padding: "48px 24px 32px",
};

const heroBadge: CSSProperties = {
  display: "inline-block",
  background: "linear-gradient(135deg, #fff, #ffe8c8)",
  border: "1px solid #f0d4a0",
  borderRadius: 999,
  padding: "5px 14px",
  fontSize: 12,
  color: "#a3501a",
  fontWeight: 600,
  letterSpacing: 0.5,
  marginBottom: 18,
};

const heroTitle: CSSProperties = {
  fontSize: "clamp(34px, 5vw, 56px)",
  fontWeight: 800,
  margin: "0 0 16px",
  lineHeight: 1.05,
  letterSpacing: -0.5,
};

const heroAccent: CSSProperties = {
  color: "#c75a1f",
};

const heroText: CSSProperties = {
  fontSize: 17,
  color: "#5b4a2e",
  maxWidth: 640,
  margin: "0 auto 28px",
  lineHeight: 1.55,
};

const sectionTitle: CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  color: "#3a2a14",
  margin: "32px 0 16px",
};

const submitBtn: CSSProperties = {
  background: "linear-gradient(135deg, #d97f3a, #c75a1f)",
  color: "#fff",
  border: "none",
  borderRadius: 999,
  padding: "12px 24px",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 6px 18px rgba(199,90,31,0.3)",
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
  gap: 18,
};

const toolbarStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 16,
  marginTop: 18,
};

const footerStyle: CSSProperties = {
  borderTop: "1px solid #f0d4a0",
  background: "rgba(255, 250, 242, 0.7)",
  padding: "24px",
  textAlign: "center",
  color: "#8a7250",
  fontSize: 13,
};

const emptyStyle: CSSProperties = {
  textAlign: "center",
  padding: "48px 24px",
  background: "#fffaf2",
  border: "1px dashed #e5d4b8",
  borderRadius: 16,
  color: "#8a7250",
};

const JSONLD = {
  "@context": "https://schema.org",
  "@type": "MusicGroup",
  name: "Voice of Earth",
  description:
    "International music project — positive songs in many languages.",
  genre: ["World", "Multilingual"],
  url: "https://aevion.app/voice-of-earth",
};

type ApiTracks = { items: Track[]; total: number; backend?: string };
type ApiTrack = { track: Track };

function getOrCreateVoter(): string {
  if (typeof window === "undefined") return "anon";
  let v = window.localStorage.getItem(VOTER_ALIAS_KEY);
  if (!v) {
    v = "anon-" + Math.random().toString(36).slice(2, 10);
    window.localStorage.setItem(VOTER_ALIAS_KEY, v);
  }
  return v;
}

function loadVotedSet(): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(VOTED_TRACKS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as number[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function saveVotedSet(s: Set<number>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VOTED_TRACKS_KEY, JSON.stringify(Array.from(s)));
  } catch {
    /* ignore */
  }
}

export default function VoiceOfEarthPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [lang, setLang] = useState<LangFilter>("all");
  const [mood, setMood] = useState<MoodFilter>("all");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [voted, setVoted] = useState<Set<number>>(new Set());

  useEffect(() => {
    setVoted(loadVotedSet());
  }, []);

  const loadTracks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (lang !== "all") params.set("lang", lang);
      if (mood !== "all") params.set("mood", mood);
      params.set("limit", "30");
      const r = await fetch(`/api/voice-of-earth/tracks?${params.toString()}`);
      if (r.ok) {
        const data = (await r.json()) as ApiTracks;
        setTracks(data.items);
      } else {
        setTracks([]);
      }
    } catch {
      setTracks([]);
    } finally {
      setLoading(false);
    }
  }, [lang, mood]);

  const loadStats = useCallback(async () => {
    try {
      const r = await fetch("/api/voice-of-earth/stats");
      if (r.ok) {
        const data = (await r.json()) as Stats;
        setStats(data);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadTracks();
  }, [loadTracks]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const handleVote = useCallback(
    async (id: number) => {
      const voterAlias = getOrCreateVoter();
      try {
        const r = await fetch(`/api/voice-of-earth/tracks/${id}/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ voterAlias }),
        });
        const data = (await r.json()) as {
          ok?: boolean;
          votes?: number;
          error?: string;
        };
        if (r.ok && data.ok) {
          const next = new Set(voted);
          next.add(id);
          setVoted(next);
          saveVotedSet(next);
          void loadStats();
          return { ok: true, votes: data.votes };
        }
        if (data.error === "already_voted") {
          const next = new Set(voted);
          next.add(id);
          setVoted(next);
          saveVotedSet(next);
          return { ok: false, message: "already_voted", votes: data.votes };
        }
        return { ok: false, message: data.error ?? "vote_failed" };
      } catch {
        return { ok: false, message: "network_error" };
      }
    },
    [voted, loadStats],
  );

  const handleSubmit = useCallback(
    async (data: {
      title: string;
      artistAlias: string;
      language: string;
      mood: "hopeful" | "peaceful" | "joyful" | "reflective" | "uplifting";
      lyrics: string;
      audioUrl: string;
    }) => {
      try {
        const body = {
          title: data.title,
          artistAlias: data.artistAlias,
          language: data.language,
          mood: data.mood,
          lyrics: data.lyrics,
          audioUrl: data.audioUrl || undefined,
        };
        const r = await fetch("/api/voice-of-earth/tracks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (r.ok) {
          const result = (await r.json()) as ApiTrack;
          // refresh list + stats
          void loadTracks();
          void loadStats();
          return { ok: true, message: `Опубликовано (id ${result.track.id})` };
        }
        const errData = (await r.json().catch(() => ({}))) as { error?: string };
        return { ok: false, message: errData.error ?? "submit_failed" };
      } catch {
        return { ok: false, message: "network_error" };
      }
    },
    [loadTracks, loadStats],
  );

  const empty = !loading && tracks.length === 0;

  const visibleStats = useMemo(() => stats, [stats]);

  return (
    <main style={pageStyle}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSONLD) }}
      />

      <header style={headerStyle}>
        <div style={headerInner}>
          <Link
            href="/"
            style={{
              color: "#a3501a",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            ← AEVION
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 700, color: "#3a2a14" }}>VoE</span>
            <span
              style={{
                background: "#fff5e6",
                border: "1px solid #f0d4a0",
                color: "#a3501a",
                padding: "2px 8px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              MVP
            </span>
          </div>
        </div>
      </header>

      <section style={heroStyle}>
        <div style={heroBadge}>🌍 Multi-language · Positive · Open</div>
        <h1 style={heroTitle}>
          Voice of Earth — <span style={heroAccent}>песни на разных языках</span>
        </h1>
        <p style={heroText}>
          Каталог позитивных треков со всего света. Каждый автор поёт на
          своём языке, каждый слушатель голосует за то, что трогает. Без
          алгоритмов — только реальные люди и реальные голоса.
        </p>
        <button type="button" style={submitBtn} onClick={() => setShowModal(true)}>
          ✨ Подать свой трек
        </button>
      </section>

      <section style={containerStyle}>
        <StatsBar stats={visibleStats} />

        <div style={toolbarStyle}>
          <Filters lang={lang} mood={mood} onLangChange={setLang} onMoodChange={setMood} />
        </div>

        <h2 style={sectionTitle}>
          {loading
            ? "Загрузка треков…"
            : `Треки${tracks.length ? ` (${tracks.length})` : ""}`}
        </h2>

        {empty ? (
          <div style={emptyStyle}>
            Под выбранные фильтры ничего не нашлось. Попробуйте другой язык
            или настроение — или станьте первым автором.
          </div>
        ) : (
          <div style={gridStyle}>
            {tracks.map((t) => (
              <TrackCard
                key={t.id}
                track={t}
                onVote={handleVote}
                votedLocal={voted.has(t.id)}
              />
            ))}
          </div>
        )}
      </section>

      <footer style={footerStyle}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          © AEVION · Voice of Earth · MVP · мир через музыку
        </div>
      </footer>

      <SubmitTrackModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleSubmit}
      />
    </main>
  );
}
