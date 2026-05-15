"use client";

// AEVION CyberChess — Tournament detail view
// Zone: aevion-core/main owns frontend/src/app/cyberchess/**
//
// Tabs: Bracket / Standings / Schedule
// Format-aware rendering:
//   • single_elimination → classic bracket grid
//   • swiss              → round-by-round view + standings
//   • round_robin        → N×N matrix with results

import { use, useEffect, useMemo, useState } from "react";
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
  accentDim: "#065f46",
  blue: "#3b82f6",
  purple: "#a78bfa",
  red: "#ef4444",
  yellow: "#fbbf24",
  orange: "#fb923c",
};

type MatchStatus = "scheduled" | "live" | "done";
type Format = "single_elimination" | "swiss" | "round_robin";
type TabId = "bracket" | "standings" | "schedule";

interface Match {
  id: string;
  round: number;
  white: string | null;
  black: string | null;
  whiteScore: number | null;
  blackScore: number | null;
  status: MatchStatus;
  winner?: "white" | "black" | "draw";
  whitePlayerId?: string | null;
  blackPlayerId?: string | null;
}

interface BracketRound {
  name: string;
  round: number;
  matches: Match[];
}

interface StandingRow {
  rank: number;
  id: string;
  name: string;
  rating: number;
  score: number;
  buchholz: number;
  whiteCount: number;
  blackCount: number;
  gamesPlayed: number;
}

interface NextRound {
  finished: boolean;
  round: number | null;
  name?: string;
  matches?: Match[];
}

interface TournamentMeta {
  id: string;
  title: string;
  format: Format;
  status: string;
  swissRounds?: number;
  currentRound?: number;
  players?: number;
  maxPlayers?: number;
}

export default function TournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolved =
    typeof (params as Promise<{ id: string }>).then === "function"
      ? use(params as Promise<{ id: string }>)
      : (params as { id: string });

  const tournamentId = resolved.id;

  const [tab, setTab] = useState<TabId>("bracket");
  const [meta, setMeta] = useState<TournamentMeta | null>(null);
  const [rounds, setRounds] = useState<BracketRound[]>([]);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [nextRound, setNextRound] = useState<NextRound | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchAll = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const [tRes, bRes, sRes, nRes] = await Promise.all([
          fetch(`/api/cyberchess-tournaments/${tournamentId}`, { cache: "no-store" }),
          fetch(`/api/cyberchess-tournaments/${tournamentId}/bracket`, { cache: "no-store" }),
          fetch(`/api/cyberchess-tournaments/${tournamentId}/standings`, { cache: "no-store" }),
          fetch(`/api/cyberchess-tournaments/${tournamentId}/next-round`, { cache: "no-store" }),
        ]);

        if (!tRes.ok) throw new Error(`tournament HTTP ${tRes.status}`);
        const tData = await tRes.json();
        if (!cancelled && tData?.ok && tData.tournament) {
          setMeta({
            id: tData.tournament.id,
            title: tData.tournament.title,
            format: tData.tournament.format,
            status: tData.tournament.status,
            swissRounds: tData.tournament.swissRounds,
            currentRound: tData.tournament.currentRound,
            players: tData.tournament.players,
            maxPlayers: tData.tournament.maxPlayers,
          });
        }

        if (bRes.ok) {
          const bData = await bRes.json();
          if (!cancelled && bData?.ok && Array.isArray(bData.rounds)) {
            setRounds(bData.rounds);
          }
        }
        if (sRes.ok) {
          const sData = await sRes.json();
          if (!cancelled && sData?.ok && Array.isArray(sData.standings)) {
            setStandings(sData.standings);
          }
        }
        if (nRes.ok) {
          const nData = await nRes.json();
          if (!cancelled && nData?.ok) {
            setNextRound({
              finished: !!nData.finished,
              round: nData.round ?? null,
              name: nData.name,
              matches: nData.matches,
            });
          }
        }
      } catch (e) {
        if (!cancelled) setErrorMsg((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchAll();
    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  const titleGuess = meta?.title ?? prettyTitle(tournamentId);
  const format: Format = meta?.format ?? "single_elimination";

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
        <h1 style={{ fontSize: 32, margin: 0, letterSpacing: -0.5 }}>🏆 {titleGuess}</h1>
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
          {meta && (
            <>
              <Badge color={formatColor(format)}>{formatLabel(format, meta)}</Badge>
              <Badge color={T.accent}>
                {meta.players ?? "?"} / {meta.maxPlayers ?? "?"} игроков
              </Badge>
              <Badge color={meta.status === "live" ? T.red : T.dim}>
                {meta.status === "live" ? "● LIVE" : meta.status}
              </Badge>
              {format === "swiss" && meta.swissRounds && (
                <Badge color={T.blue}>
                  Тур {meta.currentRound ?? 0} / {meta.swissRounds}
                </Badge>
              )}
            </>
          )}
          {!meta && loading && <Badge color={T.faint}>Загрузка...</Badge>}
        </div>
        {errorMsg && (
          <div style={{ color: T.orange, marginTop: 8, fontSize: 12 }}>
            Бэкенд недоступен ({errorMsg}). Показываем sample data, если оно есть.
          </div>
        )}
      </header>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 16,
          borderBottom: `1px solid ${T.border}`,
        }}
      >
        <Tab id="bracket" active={tab} onClick={setTab} label="Bracket" />
        <Tab id="standings" active={tab} onClick={setTab} label="Standings" />
        <Tab id="schedule" active={tab} onClick={setTab} label="Schedule" />
      </div>

      {/* Tab content */}
      {tab === "bracket" && (
        <BracketView format={format} rounds={rounds} loading={loading} />
      )}
      {tab === "standings" && (
        <StandingsView
          format={format}
          standings={standings}
          rounds={rounds}
          loading={loading}
        />
      )}
      {tab === "schedule" && (
        <ScheduleView rounds={rounds} nextRound={nextRound} loading={loading} />
      )}
    </div>
  );
}

// ── tab components ────────────────────────────────────────────────

function BracketView({
  format,
  rounds,
  loading,
}: {
  format: Format;
  rounds: BracketRound[];
  loading: boolean;
}) {
  if (loading && rounds.length === 0) {
    return <SkeletonBox label="Загружаем bracket..." />;
  }
  if (rounds.length === 0) {
    return <EmptyBox label="Сетка ещё не сформирована." />;
  }

  if (format === "swiss") {
    return <SwissRoundsView rounds={rounds} />;
  }
  if (format === "round_robin") {
    return <RoundRobinMatrixView rounds={rounds} />;
  }

  // single_elimination — classic horizontal grid
  return (
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
          gridTemplateColumns: `repeat(${rounds.length}, minmax(220px, 1fr))`,
          gap: 24,
          minWidth: 920,
        }}
      >
        {rounds.map((round) => (
          <div
            key={`${round.name}-${round.round}`}
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
  );
}

function SwissRoundsView({ rounds }: { rounds: BracketRound[] }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {rounds.map((round) => (
        <div
          key={`swiss-${round.round}`}
          style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            padding: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 14,
                color: T.text,
                textTransform: "uppercase",
                letterSpacing: 1.5,
              }}
            >
              {round.name}
            </h3>
            <span style={{ fontSize: 11, color: T.faint }}>
              {round.matches.filter((m) => m.status === "done").length} /{" "}
              {round.matches.length} партий сыграно
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 10,
            }}
          >
            {round.matches.map((m) => (
              <MatchCard key={m.id} m={m} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function RoundRobinMatrixView({ rounds }: { rounds: BracketRound[] }) {
  // collect player set + result map by (white,black) → "1-0" / "0-1" / "½-½"
  const { players, byPair } = useMemo(() => {
    const playerSet = new Map<string, string>(); // id → name
    const map = new Map<string, Match>();
    for (const r of rounds) {
      for (const m of r.matches) {
        if (m.whitePlayerId && m.white) playerSet.set(m.whitePlayerId, m.white);
        if (m.blackPlayerId && m.black) playerSet.set(m.blackPlayerId, m.black);
        if (m.whitePlayerId && m.blackPlayerId) {
          map.set(`${m.whitePlayerId}__${m.blackPlayerId}`, m);
        }
      }
    }
    return {
      players: Array.from(playerSet.entries()).map(([id, name]) => ({ id, name })),
      byPair: map,
    };
  }, [rounds]);

  if (players.length === 0) {
    return <EmptyBox label="Расписание ещё не построено." />;
  }

  const cellSize = 56;

  return (
    <section
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        padding: 20,
        overflowX: "auto",
      }}
    >
      <table
        style={{
          borderCollapse: "collapse",
          fontSize: 12,
          minWidth: cellSize * (players.length + 2),
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                background: T.surfaceAlt,
                border: `1px solid ${T.border}`,
                padding: 6,
                color: T.faint,
                textAlign: "left",
                position: "sticky",
                left: 0,
                zIndex: 2,
              }}
            >
              #
            </th>
            <th
              style={{
                background: T.surfaceAlt,
                border: `1px solid ${T.border}`,
                padding: 6,
                color: T.faint,
                textAlign: "left",
                position: "sticky",
                left: 32,
                zIndex: 2,
              }}
            >
              Игрок
            </th>
            {players.map((p, idx) => (
              <th
                key={p.id}
                style={{
                  background: T.surfaceAlt,
                  border: `1px solid ${T.border}`,
                  padding: 6,
                  color: T.faint,
                  width: cellSize,
                  textAlign: "center",
                }}
                title={p.name}
              >
                {idx + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((row, rowIdx) => (
            <tr key={row.id}>
              <td
                style={{
                  background: T.surfaceAlt,
                  border: `1px solid ${T.border}`,
                  padding: 6,
                  color: T.faint,
                  position: "sticky",
                  left: 0,
                  zIndex: 1,
                }}
              >
                {rowIdx + 1}
              </td>
              <td
                style={{
                  background: T.surfaceAlt,
                  border: `1px solid ${T.border}`,
                  padding: "6px 10px",
                  color: T.text,
                  whiteSpace: "nowrap",
                  position: "sticky",
                  left: 32,
                  zIndex: 1,
                }}
              >
                {row.name}
              </td>
              {players.map((col) => {
                if (col.id === row.id) {
                  return (
                    <td
                      key={col.id}
                      style={{
                        background: T.bg,
                        border: `1px solid ${T.border}`,
                        textAlign: "center",
                        color: T.faint,
                      }}
                    >
                      —
                    </td>
                  );
                }
                // row plays col: lookup either order
                const asWhite = byPair.get(`${row.id}__${col.id}`);
                const asBlack = byPair.get(`${col.id}__${row.id}`);
                const m = asWhite ?? asBlack;
                let label = "·";
                let color: string = T.faint;
                if (m && m.status === "done") {
                  if (asWhite) {
                    // row was white
                    if (m.winner === "white") {
                      label = "1";
                      color = T.accent;
                    } else if (m.winner === "black") {
                      label = "0";
                      color = T.red;
                    } else {
                      label = "½";
                      color = T.yellow;
                    }
                  } else if (asBlack) {
                    // row was black
                    if (m.winner === "white") {
                      label = "0";
                      color = T.red;
                    } else if (m.winner === "black") {
                      label = "1";
                      color = T.accent;
                    } else {
                      label = "½";
                      color = T.yellow;
                    }
                  }
                } else if (m && m.status === "live") {
                  label = "●";
                  color = T.red;
                } else if (m && m.status === "scheduled") {
                  label = "·";
                  color = T.faint;
                }
                return (
                  <td
                    key={col.id}
                    style={{
                      border: `1px solid ${T.border}`,
                      background: T.surface,
                      textAlign: "center",
                      color,
                      fontWeight: 700,
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      height: cellSize,
                      width: cellSize,
                    }}
                  >
                    {label}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function StandingsView({
  format,
  standings,
  rounds,
  loading,
}: {
  format: Format;
  standings: StandingRow[];
  rounds: BracketRound[];
  loading: boolean;
}) {
  if (loading && standings.length === 0) {
    return <SkeletonBox label="Считаем standings..." />;
  }

  if (format === "single_elimination") {
    // For elim — derive a simple "still-alive" / "eliminated" view from rounds
    const alive = new Set<string>();
    const eliminated = new Set<string>();
    for (const r of rounds) {
      for (const m of r.matches) {
        if (m.status === "done" && m.winner && m.winner !== "draw") {
          const w = m.winner === "white" ? m.white : m.black;
          const l = m.winner === "white" ? m.black : m.white;
          if (w) alive.add(w);
          if (l) eliminated.add(l);
        } else {
          if (m.white) alive.add(m.white);
          if (m.black) alive.add(m.black);
        }
      }
    }
    // anyone in eliminated is not alive
    for (const e of eliminated) alive.delete(e);

    return (
      <section
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          padding: 20,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        <div>
          <h3 style={{ margin: "0 0 12px", color: T.accent, fontSize: 14 }}>
            Ещё в турнире ({alive.size})
          </h3>
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {Array.from(alive).map((n) => (
              <li key={n} style={{ padding: "4px 0", color: T.text, fontSize: 13 }}>
                {n}
              </li>
            ))}
            {alive.size === 0 && <li style={{ color: T.faint, fontSize: 12 }}>—</li>}
          </ul>
        </div>
        <div>
          <h3 style={{ margin: "0 0 12px", color: T.red, fontSize: 14 }}>
            Выбыли ({eliminated.size})
          </h3>
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {Array.from(eliminated).map((n) => (
              <li key={n} style={{ padding: "4px 0", color: T.dim, fontSize: 13 }}>
                {n}
              </li>
            ))}
            {eliminated.size === 0 && <li style={{ color: T.faint, fontSize: 12 }}>—</li>}
          </ul>
        </div>
      </section>
    );
  }

  // swiss / round_robin → table
  return (
    <section
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        padding: 20,
        overflowX: "auto",
      }}
    >
      {standings.length === 0 ? (
        <EmptyBox label="Standings пока пустые." />
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {["#", "Игрок", "Рейтинг", "Очки", "Buchholz", "Партий", "W/B"].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: h === "Игрок" ? "left" : "center",
                    padding: "8px 10px",
                    borderBottom: `1px solid ${T.border}`,
                    color: T.faint,
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {standings.map((r) => (
              <tr key={r.id}>
                <td
                  style={{
                    padding: "8px 10px",
                    color: r.rank <= 3 ? T.yellow : T.faint,
                    fontWeight: 700,
                    textAlign: "center",
                  }}
                >
                  {r.rank}
                </td>
                <td style={{ padding: "8px 10px", color: T.text }}>{r.name}</td>
                <td style={{ padding: "8px 10px", textAlign: "center", color: T.dim }}>
                  {r.rating}
                </td>
                <td
                  style={{
                    padding: "8px 10px",
                    textAlign: "center",
                    color: T.accent,
                    fontWeight: 700,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  }}
                >
                  {r.score}
                </td>
                <td
                  style={{
                    padding: "8px 10px",
                    textAlign: "center",
                    color: T.dim,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  }}
                >
                  {r.buchholz.toFixed(1)}
                </td>
                <td style={{ padding: "8px 10px", textAlign: "center", color: T.dim }}>
                  {r.gamesPlayed}
                </td>
                <td
                  style={{
                    padding: "8px 10px",
                    textAlign: "center",
                    color: T.faint,
                    fontSize: 11,
                  }}
                >
                  {r.whiteCount}/{r.blackCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function ScheduleView({
  rounds,
  nextRound,
  loading,
}: {
  rounds: BracketRound[];
  nextRound: NextRound | null;
  loading: boolean;
}) {
  if (loading && rounds.length === 0) {
    return <SkeletonBox label="Загружаем расписание..." />;
  }
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Up next */}
      <div
        style={{
          background: T.surface,
          border: `1px solid ${nextRound?.finished ? T.faint : T.accent}55`,
          borderRadius: 12,
          padding: 16,
        }}
      >
        <h3 style={{ margin: "0 0 8px", fontSize: 13, color: T.faint, letterSpacing: 1.5, textTransform: "uppercase" }}>
          Следующий тур
        </h3>
        {!nextRound && <div style={{ color: T.faint, fontSize: 13 }}>—</div>}
        {nextRound?.finished && (
          <div style={{ color: T.accent, fontSize: 14, fontWeight: 700 }}>
            Турнир завершён ✓
          </div>
        )}
        {nextRound && !nextRound.finished && (
          <>
            <div style={{ fontSize: 14, color: T.text, marginBottom: 8 }}>
              {nextRound.name ?? `Тур ${nextRound.round}`}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8 }}>
              {(nextRound.matches ?? []).map((m) => (
                <MatchCard key={m.id} m={m} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* All rounds chronologically */}
      <div
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          padding: 16,
        }}
      >
        <h3 style={{ margin: "0 0 12px", fontSize: 13, color: T.faint, letterSpacing: 1.5, textTransform: "uppercase" }}>
          Полное расписание ({rounds.length} туров)
        </h3>
        {rounds.length === 0 && <EmptyBox label="Расписание пока пустое." />}
        {rounds.map((round) => {
          const doneCount = round.matches.filter((m) => m.status === "done").length;
          const liveCount = round.matches.filter((m) => m.status === "live").length;
          const total = round.matches.length;
          const allDone = doneCount === total;
          return (
            <div
              key={`sched-${round.round}`}
              style={{
                padding: "10px 12px",
                borderBottom: `1px solid ${T.border}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ color: T.text, fontSize: 14 }}>{round.name}</span>
              <span style={{ fontSize: 11, color: T.faint }}>
                {allDone ? (
                  <span style={{ color: T.accent }}>✓ завершён</span>
                ) : liveCount > 0 ? (
                  <span style={{ color: T.red }}>● {liveCount} live</span>
                ) : (
                  <span>{doneCount}/{total} сыграно</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── small bits ────────────────────────────────────────────────────

function Tab({
  id,
  active,
  onClick,
  label,
}: {
  id: TabId;
  active: TabId;
  onClick: (id: TabId) => void;
  label: string;
}) {
  const isActive = active === id;
  return (
    <button
      onClick={() => onClick(id)}
      style={{
        background: "transparent",
        color: isActive ? T.accent : T.dim,
        border: "none",
        borderBottom: `2px solid ${isActive ? T.accent : "transparent"}`,
        padding: "10px 18px",
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
        marginBottom: -1,
      }}
    >
      {label}
    </button>
  );
}

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
        draw={done && m.winner === "draw"}
      />
      <div style={{ height: 1, background: T.border }} />
      <PlayerRow
        name={m.black}
        score={m.blackScore}
        color="black"
        winner={done && m.winner === "black"}
        draw={done && m.winner === "draw"}
      />
    </div>
  );
}

function PlayerRow({
  name,
  score,
  color,
  winner,
  draw,
}: {
  name: string | null;
  score: number | null;
  color: "white" | "black";
  winner: boolean;
  draw: boolean;
}) {
  const highlight = winner ? T.accent : draw ? T.yellow : T.text;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 12px",
        background: winner ? `${T.accent}1a` : draw ? `${T.yellow}1a` : "transparent",
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
            color: name ? highlight : T.faint,
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
          color: highlight,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          marginLeft: 8,
        }}
      >
        {score ?? "–"}
      </span>
    </div>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
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

function SkeletonBox({ label }: { label: string }) {
  return (
    <div
      style={{
        background: T.surface,
        border: `1px dashed ${T.border}`,
        borderRadius: 12,
        padding: 32,
        textAlign: "center",
        color: T.faint,
        fontSize: 13,
      }}
    >
      {label}
    </div>
  );
}

function EmptyBox({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: 24,
        textAlign: "center",
        color: T.faint,
        fontSize: 13,
        background: T.surfaceAlt,
        border: `1px dashed ${T.border}`,
        borderRadius: 8,
      }}
    >
      {label}
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────────

function prettyTitle(id: string): string {
  return id
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

function formatLabel(f: Format, meta: TournamentMeta): string {
  if (f === "single_elimination") return "Single Elim";
  if (f === "swiss") return `Swiss · ${meta.swissRounds ?? 5} туров`;
  return "Round-robin";
}

function formatColor(f: Format): string {
  if (f === "single_elimination") return T.purple;
  if (f === "swiss") return T.blue;
  return T.yellow;
}
