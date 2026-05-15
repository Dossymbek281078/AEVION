"use client";

// AEVION CyberChess — Tournament detail / bracket view
// Zone: aevion-core/main owns frontend/src/app/cyberchess/**
// Mock 16-player single-elimination bracket.

import { use } from "react";
import Link from "next/link";

const T = {
  bg: "#0a0e1a",
  surface: "#141826",
  surfaceAlt: "#1b2033",
  border: "#2a3148",
  text: "#e2e8f0",
  dim: "#94a3b8",
  faint: "#64748b",
  accent: "#10b981",
  blue: "#3b82f6",
  purple: "#a78bfa",
  red: "#ef4444",
  yellow: "#fbbf24",
};

type MatchStatus = "scheduled" | "live" | "done";

interface Match {
  id: string;
  white: string | null;
  black: string | null;
  whiteScore: number | null;
  blackScore: number | null;
  status: MatchStatus;
  winner?: "white" | "black";
}

// 4 rounds: 8 + 4 + 2 + 1 matches = 15 matches total (16-player single elim)
const MOCK_ROUNDS: { name: string; matches: Match[] }[] = [
  {
    name: "1/8 финала",
    matches: [
      { id: "r1-1", white: "ShadowKnight_2400", black: "PawnStorm_1900", whiteScore: 2, blackScore: 0, status: "done", winner: "white" },
      { id: "r1-2", white: "EndgameKnight", black: "Rookie_2050", whiteScore: 2, blackScore: 1, status: "done", winner: "white" },
      { id: "r1-3", white: "TacticalRose", black: "BishopPair", whiteScore: 2, blackScore: 0, status: "done", winner: "white" },
      { id: "r1-4", white: "PositionalGuru", black: "QueenSac_99", whiteScore: 1, blackScore: 2, status: "done", winner: "black" },
      { id: "r1-5", white: "BulletDemon", black: "ZugzwangFan", whiteScore: 2, blackScore: 1, status: "done", winner: "white" },
      { id: "r1-6", white: "Capablanca-bot", black: "NimzoIndian", whiteScore: 0, blackScore: 2, status: "done", winner: "black" },
      { id: "r1-7", white: "TalLegacy", black: "Petroff_King", whiteScore: 2, blackScore: 1, status: "done", winner: "white" },
      { id: "r1-8", white: "GMPrep_22", black: "Sicilian_Dragon", whiteScore: 2, blackScore: 0, status: "done", winner: "white" },
    ],
  },
  {
    name: "1/4 финала",
    matches: [
      { id: "r2-1", white: "ShadowKnight_2400", black: "EndgameKnight", whiteScore: 2, blackScore: 1, status: "done", winner: "white" },
      { id: "r2-2", white: "TacticalRose", black: "QueenSac_99", whiteScore: 2, blackScore: 0, status: "done", winner: "white" },
      { id: "r2-3", white: "BulletDemon", black: "NimzoIndian", whiteScore: 1, blackScore: 1, status: "live" },
      { id: "r2-4", white: "TalLegacy", black: "GMPrep_22", whiteScore: null, blackScore: null, status: "scheduled" },
    ],
  },
  {
    name: "1/2 финала",
    matches: [
      { id: "r3-1", white: "ShadowKnight_2400", black: "TacticalRose", whiteScore: null, blackScore: null, status: "scheduled" },
      { id: "r3-2", white: null, black: null, whiteScore: null, blackScore: null, status: "scheduled" },
    ],
  },
  {
    name: "Финал",
    matches: [
      { id: "r4-1", white: null, black: null, whiteScore: null, blackScore: null, status: "scheduled" },
    ],
  },
];

export default function TournamentBracketPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  // Next.js 14: params may be a plain object; in 15 it becomes a Promise.
  // `use()` handles both cases safely for sync access.
  const resolved =
    typeof (params as Promise<{ id: string }>).then === "function"
      ? use(params as Promise<{ id: string }>)
      : (params as { id: string });

  const tournamentId = resolved.id;
  const titleGuess = prettyTitle(tournamentId);

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, padding: "24px 32px" }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 16 }}>
        <Link
          href="/cyberchess/tournaments"
          style={{ color: T.dim, textDecoration: "none", fontSize: 14 }}
        >
          ← Назад к турнирам
        </Link>
      </div>

      {/* Header */}
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 32, margin: 0, letterSpacing: -0.5 }}>
          🏆 {titleGuess}
        </h1>
        <div
          style={{
            marginTop: 6,
            fontSize: 12,
            color: T.faint,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          }}
        >
          tournament_id: {tournamentId}
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Badge color={T.accent}>16 игроков</Badge>
          <Badge color={T.blue}>Single elimination</Badge>
          <Badge color={T.red}>● 1 live match</Badge>
        </div>
      </header>

      {/* Bracket grid */}
      <section
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          padding: 20,
          overflowX: "auto",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${MOCK_ROUNDS.length}, minmax(220px, 1fr))`,
            gap: 24,
            minWidth: 920,
          }}
        >
          {MOCK_ROUNDS.map((round) => (
            <div
              key={round.name}
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-around",
                gap: 16,
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: 12,
                  color: T.faint,
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                  textAlign: "center",
                }}
              >
                {round.name}
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
                {round.matches.map((m) => (
                  <MatchCard key={m.id} m={m} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ── components ─────────────────────────────────────────────────────

function MatchCard({ m }: { m: Match }) {
  const live = m.status === "live";
  const done = m.status === "done";

  return (
    <div
      style={{
        background: T.surfaceAlt,
        border: `1px solid ${live ? T.red : T.border}`,
        borderRadius: 8,
        overflow: "hidden",
        position: "relative",
        boxShadow: live ? `0 0 0 1px ${T.red}55, 0 0 16px ${T.red}33` : "none",
      }}
    >
      {live && (
        <div
          style={{
            position: "absolute",
            top: 6,
            right: 8,
            fontSize: 9,
            fontWeight: 700,
            color: T.red,
            letterSpacing: 1,
          }}
        >
          ● LIVE
        </div>
      )}
      <PlayerRow
        name={m.white}
        score={m.whiteScore}
        color="white"
        winner={done && m.winner === "white"}
      />
      <div style={{ height: 1, background: T.border }} />
      <PlayerRow
        name={m.black}
        score={m.blackScore}
        color="black"
        winner={done && m.winner === "black"}
      />
    </div>
  );
}

function PlayerRow({
  name,
  score,
  color,
  winner,
}: {
  name: string | null;
  score: number | null;
  color: "white" | "black";
  winner: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 12px",
        background: winner ? `${T.accent}1a` : "transparent",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 2,
            background: color === "white" ? "#f1f5f9" : "#0f172a",
            border: `1px solid ${T.faint}`,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 13,
            color: name ? (winner ? T.accent : T.text) : T.faint,
            fontWeight: winner ? 700 : 500,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {name ?? "— TBD —"}
        </span>
      </div>
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: winner ? T.accent : T.dim,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          marginLeft: 8,
        }}
      >
        {score ?? "–"}
      </span>
    </div>
  );
}

function Badge({
  children,
  color,
}: {
  children: React.ReactNode;
  color: string;
}) {
  return (
    <span
      style={{
        background: `${color}22`,
        color,
        border: `1px solid ${color}55`,
        borderRadius: 4,
        padding: "3px 10px",
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}

// ── helpers ────────────────────────────────────────────────────────

function prettyTitle(id: string): string {
  return id
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}
