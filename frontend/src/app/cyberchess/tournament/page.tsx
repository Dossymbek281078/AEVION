"use client";

// AEVION CyberChess Tournament Hub —
// визуализирует bracket / badges / leaderboard из tournament.ts.
// Zone: aevion-core/main owns frontend/src/app/cyberchess/**

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  buildBracket,
  awardBadges,
  computeTournamentLeaderboard,
  type BracketRound,
  type TournamentBadge,
  type TournamentHistoryEntry,
  type LeaderboardEntry,
  type LeaderboardHistoryEntry,
} from "../tournament";

const C = {
  bg: "#0f172a",
  panel: "#1e293b",
  border: "#334155",
  text: "#f1f5f9",
  dim: "#94a3b8",
  faint: "#64748b",
  purple: "#a78bfa",
  green: "#34d399",
  red: "#ef4444",
  yellow: "#fbbf24",
  cyan: "#22d3ee",
  gold: "#facc15",
  silver: "#cbd5e1",
  bronze: "#f59e0b",
  orange: "#fb923c",
};

// ─────────────────────────────────────────────────────────────────
// Mock data for visualization — replace with real /api/cyberchess/tournament data later
// ─────────────────────────────────────────────────────────────────

const MOCK_PLAYERS = [
  "ShadowKnight_2400",
  "EndgameKnight",
  "TacticalRose",
  "PositionalGuru",
  "BulletDemon",
  "Capablanca-bot",
  "TalLegacy",
  "NimzoIndian",
];

const MOCK_RESULTS = [
  // Quarterfinal
  { p1: "ShadowKnight_2400", p2: "EndgameKnight",    winner: "ShadowKnight_2400",  score: { p1: 2, p2: 1 } },
  { p1: "TacticalRose",      p2: "PositionalGuru",   winner: "TacticalRose",        score: { p1: 2, p2: 0 } },
  { p1: "BulletDemon",       p2: "Capablanca-bot",   winner: "BulletDemon",         score: { p1: 2, p2: 1 } },
  { p1: "TalLegacy",         p2: "NimzoIndian",      winner: "TalLegacy",           score: { p1: 2, p2: 1 } },
  // Semifinal
  { p1: "ShadowKnight_2400", p2: "TacticalRose",     winner: "ShadowKnight_2400",   score: { p1: 2, p2: 0 } },
  { p1: "BulletDemon",       p2: "TalLegacy",        winner: "TalLegacy",           score: { p1: 2, p2: 1 } },
  // Final
  { p1: "ShadowKnight_2400", p2: "TalLegacy",        winner: "ShadowKnight_2400",   score: { p1: 3, p2: 1 } },
];

const MOCK_LEADERBOARD_HISTORY: LeaderboardHistoryEntry[] = [
  { player: "ShadowKnight_2400", placement: 1, tournamentId: "spring-cup-01" },
  { player: "TalLegacy",         placement: 2, tournamentId: "spring-cup-01" },
  { player: "TacticalRose",      placement: 3, tournamentId: "spring-cup-01" },
  { player: "BulletDemon",       placement: 4, tournamentId: "spring-cup-01" },
  // Past tournament
  { player: "ShadowKnight_2400", placement: 1, tournamentId: "winter-arena-12" },
  { player: "PositionalGuru",    placement: 2, tournamentId: "winter-arena-12" },
  { player: "TacticalRose",      placement: 3, tournamentId: "winter-arena-12" },
  { player: "EndgameKnight",     placement: 5, tournamentId: "winter-arena-12" },
];

const MOCK_BADGE_HISTORY: Record<string, TournamentHistoryEntry[]> = {
  "ShadowKnight_2400": [
    { tournamentId: "winter-arena-12", placement: 1, w: 5, l: 0, d: 0, startingRating: 2400, firstMatchResult: "w", ts: Date.now() - 86400e3 * 60 },
    { tournamentId: "spring-cup-01",   placement: 1, w: 6, l: 1, d: 0, startingRating: 2450, firstMatchResult: "w", ts: Date.now() - 86400e3 * 7 },
  ],
  "TalLegacy": [
    { tournamentId: "spring-cup-01", placement: 2, w: 4, l: 2, d: 1, startingRating: 2421, firstMatchResult: "l", ts: Date.now() - 86400e3 * 7 },
  ],
  "ChessRookie_1450": [
    { tournamentId: "underdog-bowl", placement: 1, w: 4, l: 1, d: 0, startingRating: 1450, firstMatchResult: "l", ts: Date.now() - 86400e3 * 30 },
  ],
};

const BADGE_META: Record<TournamentBadge, { emoji: string; label: string; desc: string; color: string }> = {
  "first-blood":    { emoji: "🩸", label: "First Blood",    desc: "Выиграл первый матч первого турнира", color: C.red },
  "underdog":       { emoji: "🐺", label: "Underdog",       desc: "Победа в турнире, начав с рейтинга < 1500", color: C.orange },
  "champion":       { emoji: "🏆", label: "Champion",       desc: "Победа в турнире (1 место)", color: C.gold },
  "perfect-run":    { emoji: "💎", label: "Perfect Run",    desc: "5+ побед без поражений и ничьих в одном турнире", color: C.cyan },
  "comeback-king":  { emoji: "👑", label: "Comeback King",  desc: "Победа в турнире после проигрыша первого матча", color: C.purple },
};

// ─────────────────────────────────────────────────────────────────

function roundLabel(idx: number, total: number): string {
  const fromEnd = total - 1 - idx;
  if (fromEnd === 0) return "Финал";
  if (fromEnd === 1) return "Полуфинал";
  if (fromEnd === 2) return "Четвертьфинал";
  return `Раунд ${idx + 1}`;
}

function BracketView({ bracket }: { bracket: BracketRound[] }) {
  return (
    <div style={{ display: "flex", gap: 24, overflowX: "auto", paddingBottom: 12 }}>
      {bracket.map((r) => (
        <div key={r.round} style={{ minWidth: 220, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{
            fontSize: 10, fontWeight: 900, color: C.purple, textTransform: "uppercase",
            letterSpacing: 0.7, paddingBottom: 6, borderBottom: `1px solid ${C.border}`,
          }}>
            {roundLabel(r.round, bracket.length)}
          </div>
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            justifyContent: "space-around",
            flex: 1,
          }}>
            {r.matches.map((m, i) => (
              <div key={i} style={{
                background: C.panel,
                border: `1px solid ${C.border}`,
                borderLeft: `3px solid ${m.winner ? C.green : C.faint}`,
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 12,
              }}>
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  color: m.winner === m.p1 ? C.text : C.dim,
                  fontWeight: m.winner === m.p1 ? 800 : 500,
                  marginBottom: 4,
                }}>
                  <span>{m.winner === m.p1 ? "👑 " : ""}{m.p1}</span>
                  {m.score && <span style={{ fontFamily: "ui-monospace, monospace", color: C.cyan }}>{m.score.p1}</span>}
                </div>
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  color: m.winner === m.p2 ? C.text : C.dim,
                  fontWeight: m.winner === m.p2 ? 800 : 500,
                }}>
                  <span>{m.winner === m.p2 ? "👑 " : ""}{m.p2}</span>
                  {m.score && <span style={{ fontFamily: "ui-monospace, monospace", color: C.cyan }}>{m.score.p2}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function BadgeShowcase({ playerId, badges }: { playerId: string; badges: TournamentBadge[] }) {
  if (badges.length === 0) return (
    <div style={{ fontSize: 12, color: C.faint, fontStyle: "italic" }}>{playerId}: пока без бейджей</div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{playerId}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {badges.map(b => {
          const m = BADGE_META[b];
          return (
            <span key={b} title={m.desc} style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "4px 10px", borderRadius: 999,
              background: `${m.color}20`, color: m.color,
              fontSize: 11, fontWeight: 700,
              border: `1px solid ${m.color}40`,
            }}>
              <span style={{ fontSize: 14 }}>{m.emoji}</span>
              <span>{m.label}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function TournamentHubPage() {
  const [selectedTournament, setSelectedTournament] = useState<"spring-cup-01">("spring-cup-01");

  const bracket = useMemo(() => buildBracket(MOCK_PLAYERS, MOCK_RESULTS), []);
  const leaderboard = useMemo(() => computeTournamentLeaderboard(MOCK_LEADERBOARD_HISTORY), []);

  const playerBadges = useMemo(() => {
    const map = new Map<string, TournamentBadge[]>();
    for (const [pid, history] of Object.entries(MOCK_BADGE_HISTORY)) {
      map.set(pid, awardBadges(pid, history));
    }
    return map;
  }, []);

  return (
    <main style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "system-ui, sans-serif", padding: "32px 16px" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebPage",
        "@id": "https://aevion.app/cyberchess/tournament",
        name: "AEVION CyberChess Tournament Hub",
        description: "Bracket visualization, badges и cross-tournament leaderboard. Single-elimination + round-robin форматы.",
        isPartOf: { "@type": "WebSite", url: "https://aevion.app", name: "AEVION" },
        about: { "@type": "SportsEvent", name: "Chess tournaments" },
      }) }} />
      <style>{`
        @media (max-width: 640px) {
          h1 { font-size: 22px !important; }
          h2 { font-size: 16px !important; }
          button, a[role="button"] { min-height: 44px; }
          table { font-size: 11px; }
          pre { font-size: 11px !important; }
        }
      `}</style>

      <article style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: 12, color: C.faint, marginBottom: 16 }}>
          <Link href="/cyberchess" style={{ color: C.dim, textDecoration: "none" }}>CyberChess</Link>
          {" / "}<span style={{ color: C.text }}>Tournament Hub</span>
        </div>

        {/* Hero */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 10px", lineHeight: 1.15 }}>
            Tournament <span style={{ color: C.purple }}>Hub</span>
          </h1>
          <p style={{ fontSize: 14, color: C.dim, lineHeight: 1.65, margin: 0, maxWidth: 700 }}>
            Bracket-визуализация + cross-tournament leaderboard + бейджи достижений.
            Все турниры single-elimination или round-robin. Mock-данные —{" "}
            <code style={{ fontSize: 12, color: C.cyan, fontFamily: "ui-monospace, monospace" }}>
              /api/cyberchess/tournament/...
            </code>{" "}
            backend в roadmap.
          </p>
        </div>

        {/* Tournament selector */}
        <div style={{ marginBottom: 24, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setSelectedTournament("spring-cup-01")}
            style={{
              padding: "8px 16px", borderRadius: 999,
              border: `1px solid ${selectedTournament === "spring-cup-01" ? C.purple : C.border}`,
              background: selectedTournament === "spring-cup-01" ? "rgba(167,139,250,0.15)" : "transparent",
              color: selectedTournament === "spring-cup-01" ? C.purple : C.dim,
              fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}>
            🌸 Spring Cup 2026
          </button>
          <span style={{ alignSelf: "center", fontSize: 12, color: C.faint }}>
            Активный · 8 игроков · single-elimination
          </span>
        </div>

        {/* Bracket */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: "0 0 12px" }}>
            🥊 Сетка турнира
          </h2>
          <div style={{
            background: C.panel,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: "20px 18px",
          }}>
            {bracket.length > 0
              ? <BracketView bracket={bracket} />
              : <div style={{ color: C.faint, fontStyle: "italic" }}>Bracket пуст</div>
            }
            <div style={{
              marginTop: 12, fontSize: 11, color: C.faint,
              fontFamily: "ui-monospace, monospace",
            }}>
              Powered by <code style={{ color: C.cyan }}>buildBracket(players, results)</code> из tournament.ts
            </div>
          </div>
        </section>

        {/* Leaderboard */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: "0 0 12px" }}>
            🏆 Cross-tournament Leaderboard
          </h2>
          <div style={{
            background: C.panel,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            overflow: "hidden",
          }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "rgba(167,139,250,0.08)" }}>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 800, color: C.purple, textTransform: "uppercase", letterSpacing: 0.5 }}>#</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 800, color: C.purple, textTransform: "uppercase", letterSpacing: 0.5 }}>Игрок</th>
                    <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 10, fontWeight: 800, color: C.purple, textTransform: "uppercase", letterSpacing: 0.5 }}>Турниров</th>
                    <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 10, fontWeight: 800, color: C.purple, textTransform: "uppercase", letterSpacing: 0.5 }}>Побед</th>
                    <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 10, fontWeight: 800, color: C.purple, textTransform: "uppercase", letterSpacing: 0.5 }}>Подиумов</th>
                    <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 10, fontWeight: 800, color: C.purple, textTransform: "uppercase", letterSpacing: 0.5 }}>Очки</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((e, i) => {
                    const rankColor = i === 0 ? C.gold : i === 1 ? C.silver : i === 2 ? C.bronze : C.dim;
                    return (
                      <tr key={e.player} style={{ borderTop: i === 0 ? "none" : `1px solid ${C.border}` }}>
                        <td style={{ padding: "10px 14px", color: rankColor, fontWeight: 900, fontFamily: "ui-monospace, monospace" }}>
                          {i + 1}
                        </td>
                        <td style={{ padding: "10px 14px", color: C.text, fontWeight: 700 }}>
                          {i === 0 && "👑 "}
                          {e.player}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right", color: C.dim, fontFamily: "ui-monospace, monospace" }}>{e.tournaments}</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", color: C.green, fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>{e.wins}</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", color: C.cyan, fontFamily: "ui-monospace, monospace" }}>{e.podiums}</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", color: rankColor, fontFamily: "ui-monospace, monospace", fontWeight: 900 }}>{e.points}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{
              padding: "10px 16px", borderTop: `1px solid ${C.border}`,
              fontSize: 11, color: C.faint, fontFamily: "ui-monospace, monospace",
            }}>
              points = 10·wins + 5·(podiums − wins) + tournaments · sort by points → wins → podiums → name
            </div>
          </div>
        </section>

        {/* Badges */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: "0 0 12px" }}>
            💎 Achievements
          </h2>
          <div style={{
            background: C.panel,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: "16px 20px",
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {Array.from(playerBadges.entries()).map(([pid, badges]) => (
                <BadgeShowcase key={pid} playerId={pid} badges={badges} />
              ))}
            </div>
          </div>

          {/* Badge legend */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.faint, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
              Все возможные бейджи
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 8 }}>
              {(Object.entries(BADGE_META) as Array<[TournamentBadge, typeof BADGE_META[TournamentBadge]]>).map(([key, m]) => (
                <div key={key} style={{
                  background: C.panel,
                  border: `1px solid ${m.color}40`,
                  borderLeft: `3px solid ${m.color}`,
                  borderRadius: 8,
                  padding: "10px 14px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 18 }}>{m.emoji}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: m.color }}>{m.label}</span>
                  </div>
                  <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.4 }}>{m.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Related */}
        <div style={{ marginTop: 32, display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }}>
          <Link href="/cyberchess" style={{ color: C.purple, textDecoration: "none" }}>← Играть</Link>
          <span style={{ color: C.faint }}>·</span>
          <Link href="/cyberchess/cpi/leaderboard" style={{ color: C.purple, textDecoration: "none" }}>📊 CPI Leaderboard</Link>
          <span style={{ color: C.faint }}>·</span>
          <Link href="/cyberchess/economy" style={{ color: C.purple, textDecoration: "none" }}>🪙 Economy</Link>
          <span style={{ color: C.faint }}>·</span>
          <Link href="/cyberchess/training" style={{ color: C.purple, textDecoration: "none" }}>🎯 Training Hub</Link>
        </div>

        <div style={{ marginTop: 32, fontSize: 11, color: C.faint, textAlign: "center" }}>
          Powered by <code style={{ color: C.cyan, fontFamily: "ui-monospace, monospace" }}>tournament.ts</code> ·
          Real backend: <code style={{ color: C.cyan, fontFamily: "ui-monospace, monospace" }}>POST /api/cyberchess/tournament/create</code> + <code style={{ color: C.cyan, fontFamily: "ui-monospace, monospace" }}>GET /list</code> (roadmap)
        </div>
      </article>
    </main>
  );
}
