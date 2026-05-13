"use client";

import { CSSProperties, useState } from "react";

export type Track = {
  id: number;
  title: string;
  artist_alias: string;
  language: string;
  lyrics: string;
  mood: "hopeful" | "peaceful" | "joyful" | "reflective" | "uplifting";
  audio_url: string | null;
  votes: number;
  created_at: string;
};

const LANG_FLAG: Record<string, string> = {
  ru: "🇷🇺",
  en: "🇬🇧",
  kk: "🇰🇿",
  es: "🇪🇸",
  it: "🇮🇹",
  fr: "🇫🇷",
  de: "🇩🇪",
  ja: "🇯🇵",
  zh: "🇨🇳",
  ar: "🇦🇪",
  pt: "🇵🇹",
};

const MOOD_EMOJI: Record<Track["mood"], string> = {
  hopeful: "🌅",
  peaceful: "🕊️",
  joyful: "💃",
  reflective: "🌙",
  uplifting: "🔥",
};

const MOOD_LABEL: Record<Track["mood"], string> = {
  hopeful: "надежда",
  peaceful: "покой",
  joyful: "радость",
  reflective: "размышление",
  uplifting: "подъём",
};

const cardStyle: CSSProperties = {
  background: "#fffaf2",
  border: "1px solid #f0d4a0",
  borderRadius: 16,
  padding: 18,
  display: "flex",
  flexDirection: "column",
  gap: 12,
  boxShadow: "0 1px 3px rgba(163,80,26,0.05)",
  transition: "box-shadow 0.2s ease, transform 0.2s ease",
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
};

const titleStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: "#3a2a14",
  margin: 0,
  lineHeight: 1.25,
};

const artistStyle: CSSProperties = {
  fontSize: 13,
  color: "#8a7250",
  marginTop: 2,
};

const badgesStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  alignItems: "flex-end",
};

const badgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  background: "#fff5e6",
  border: "1px solid #f0d4a0",
  borderRadius: 999,
  padding: "3px 9px",
  fontSize: 12,
  color: "#5b4a2e",
  whiteSpace: "nowrap",
};

const lyricsStyle: CSSProperties = {
  fontSize: 13,
  color: "#5b4a2e",
  lineHeight: 1.6,
  whiteSpace: "pre-wrap",
  maxHeight: 120,
  overflow: "hidden",
  position: "relative",
  background: "#fff",
  border: "1px solid #f5e4c2",
  borderRadius: 10,
  padding: 12,
};

const lyricsExpandedStyle: CSSProperties = {
  ...lyricsStyle,
  maxHeight: "none",
};

const footerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
};

const voteBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "linear-gradient(135deg, #d97f3a, #c75a1f)",
  color: "#fff",
  border: "none",
  borderRadius: 999,
  padding: "8px 14px",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 600,
  boxShadow: "0 2px 6px rgba(199,90,31,0.25)",
};

const voteBtnDisabledStyle: CSSProperties = {
  ...voteBtnStyle,
  opacity: 0.6,
  cursor: "not-allowed",
};

const linkStyle: CSSProperties = {
  fontSize: 13,
  color: "#a3501a",
  textDecoration: "none",
  fontWeight: 600,
};

type Props = {
  track: Track;
  onVote: (id: number) => Promise<{ ok: boolean; message?: string; votes?: number }>;
  votedLocal: boolean;
};

export default function TrackCard({ track, onVote, votedLocal }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [voting, setVoting] = useState(false);
  const [localVotes, setLocalVotes] = useState(track.votes);
  const [voted, setVoted] = useState(votedLocal);
  const [err, setErr] = useState<string | null>(null);

  async function handleVote() {
    if (voting || voted) return;
    setVoting(true);
    setErr(null);
    const result = await onVote(track.id);
    setVoting(false);
    if (result.ok) {
      setVoted(true);
      if (typeof result.votes === "number") setLocalVotes(result.votes);
      else setLocalVotes(localVotes + 1);
    } else {
      setErr(result.message ?? "Не удалось проголосовать");
      if (result.message === "already_voted") {
        setVoted(true);
        if (typeof result.votes === "number") setLocalVotes(result.votes);
      }
    }
  }

  const flag = LANG_FLAG[track.language] ?? "🌐";
  const moodEmoji = MOOD_EMOJI[track.mood];

  return (
    <article style={cardStyle}>
      <div style={headerStyle}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={titleStyle}>{track.title}</h3>
          <div style={artistStyle}>{track.artist_alias}</div>
        </div>
        <div style={badgesStyle}>
          <span style={badgeStyle}>
            <span>{flag}</span>
            <span style={{ textTransform: "uppercase", fontSize: 11 }}>
              {track.language}
            </span>
          </span>
          <span style={badgeStyle}>
            <span>{moodEmoji}</span>
            <span>{MOOD_LABEL[track.mood]}</span>
          </span>
        </div>
      </div>

      <div
        style={expanded ? lyricsExpandedStyle : lyricsStyle}
        onClick={() => setExpanded(!expanded)}
        title={expanded ? "Свернуть" : "Развернуть"}
      >
        {track.lyrics}
        {!expanded && (
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 32,
              background:
                "linear-gradient(to bottom, rgba(255,255,255,0), #fff)",
              borderBottomLeftRadius: 10,
              borderBottomRightRadius: 10,
              pointerEvents: "none",
            }}
          />
        )}
      </div>

      <div style={footerStyle}>
        <button
          type="button"
          onClick={handleVote}
          disabled={voting || voted}
          style={voted || voting ? voteBtnDisabledStyle : voteBtnStyle}
          aria-label="Голос"
        >
          <span>{voted ? "❤️" : "🤍"}</span>
          <span>{localVotes}</span>
        </button>
        {track.audio_url ? (
          <a href={track.audio_url} target="_blank" rel="noreferrer" style={linkStyle}>
            Слушать →
          </a>
        ) : (
          <span style={{ fontSize: 12, color: "#a89479" }}>аудио позже</span>
        )}
      </div>

      {err && err !== "already_voted" && (
        <div style={{ fontSize: 12, color: "#c75a1f" }}>{err}</div>
      )}
    </article>
  );
}
