"use client";

/**
 * Awards hub leaderboard widget — top-3 from each track, side by side.
 * Reads from the same localStorage stores as the per-track panels.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { AwardSubmission, AwardTrack, topN } from "../_lib/submissions";

type ColumnTheme = {
  label: string;
  href: string;
  accent: string;
  border: string;
  bg: string;
  buttonBg: string;
  buttonText: string;
};

const MUSIC_COL: ColumnTheme = {
  label: "Music",
  href: "/awards/music",
  accent: "#c4b5fd",
  border: "rgba(167,139,250,0.35)",
  bg: "linear-gradient(165deg, rgba(76,29,149,0.22), rgba(15,23,42,0.7))",
  buttonBg: "linear-gradient(135deg, #7c3aed, #4c1d95)",
  buttonText: "#fff",
};

const FILM_COL: ColumnTheme = {
  label: "Film",
  href: "/awards/film",
  accent: "#fde68a",
  border: "rgba(251,191,36,0.35)",
  bg: "linear-gradient(165deg, rgba(180,83,9,0.22), rgba(15,23,42,0.7))",
  buttonBg: "linear-gradient(135deg, #b45309, #7f1d1d)",
  buttonText: "#fff",
};

const MEDAL = ["#fde047", "#cbd5e1", "#d97706"];
const MEDAL_LABEL = ["#1", "#2", "#3"];

export function HubLeaderboard() {
  const [music, setMusic] = useState<AwardSubmission[]>([]);
  const [film, setFilm] = useState<AwardSubmission[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setMusic(topN("music", 3));
      setFilm(topN("film", 3));
    };
    refresh();
    setHydrated(true);
    // Refresh on focus so cross-tab edits are picked up.
    const onFocus = () => refresh();
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return refresh();
      if (e.key.startsWith("aevion_awards_")) refresh();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return (
    <section
      style={{
        marginTop: 32,
        padding: 26,
        borderRadius: 20,
        border: "1px solid rgba(94,234,212,0.25)",
        background: "linear-gradient(165deg, rgba(15,23,42,0.9), rgba(13,148,136,0.12))",
      }}
      aria-labelledby="hub-leaderboard-heading"
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 16,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.2em",
              color: "#5eead4",
              textTransform: "uppercase",
            }}
          >
            Live leaderboard
          </div>
          <h2
            id="hub-leaderboard-heading"
            style={{
              margin: "6px 0 0",
              fontSize: 24,
              fontWeight: 900,
              color: "#fff",
              letterSpacing: "-0.02em",
            }}
          >
            Top 3 — both tracks
          </h2>
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8", maxWidth: 320, textAlign: "right" }}>
          Local + seeded entries. Submit and vote to move the ranking.
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        <Column theme={MUSIC_COL} items={music} hydrated={hydrated} track="music" />
        <Column theme={FILM_COL} items={film} hydrated={hydrated} track="film" />
      </div>
    </section>
  );
}

function Column({
  theme,
  items,
  hydrated,
  track,
}: {
  theme: ColumnTheme;
  items: AwardSubmission[];
  hydrated: boolean;
  track: AwardTrack;
}) {
  return (
    <div
      style={{
        padding: 18,
        borderRadius: 16,
        border: `1px solid ${theme.border}`,
        background: theme.bg,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "#f8fafc" }}>
          {theme.label}
        </h3>
        <Link
          href={theme.href}
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: theme.accent,
            textDecoration: "none",
          }}
        >
          Open track →
        </Link>
      </div>

      {hydrated && items.length === 0 ? (
        <EmptyState theme={theme} track={track} />
      ) : (
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((sub, i) => (
            <li
              key={sub.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 10,
                background: "rgba(15,23,42,0.5)",
                border: "1px solid rgba(148,163,184,0.18)",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  background: `${MEDAL[i]}26`,
                  border: `1px solid ${MEDAL[i]}`,
                  color: MEDAL[i],
                  fontWeight: 900,
                  fontSize: 11,
                }}
              >
                {MEDAL_LABEL[i]}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: "#f8fafc",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {sub.title}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                  {sub.author} · {sub.genre}
                </div>
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 900,
                  color: theme.accent,
                  letterSpacing: "-0.01em",
                }}
              >
                {sub.votes}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function EmptyState({ theme, track }: { theme: ColumnTheme; track: AwardTrack }) {
  void track;
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 12,
        border: "1px dashed rgba(148,163,184,0.35)",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 13, color: "#cbd5e1", marginBottom: 10 }}>
        No submissions yet — be the first.
      </div>
      <Link
        href={theme.href}
        style={{
          display: "inline-block",
          padding: "8px 14px",
          borderRadius: 10,
          background: theme.buttonBg,
          color: theme.buttonText,
          fontWeight: 800,
          textDecoration: "none",
          fontSize: 12,
        }}
      >
        Submit to {theme.label} →
      </Link>
    </div>
  );
}
