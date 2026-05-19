"use client";

// AEVION CyberChess — Tournament detail view
// Zone: aevion-core/main owns frontend/src/app/cyberchess/**
//
// Tabs: Bracket / Standings / Schedule
// Format-aware rendering:
//   • single_elimination → classic bracket grid
//   • swiss              → round-by-round view + standings
//   • round_robin        → N×N matrix with results
//
// Enhancements (2026-05-19):
//   A) Sortable standings table (score/buchholz/rating/games)
//   B) Bracket animations: slide-in for pairings, hover-highlight, pulse for live
//   C) Real-time round progress bar with animated stripes, 15s polling,
//      auto-trigger queue-match on round completion for realPlayers tournaments

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
  realPlayers?: boolean;
  liveMatchId?: string | null;
}

type RegState =
  | { phase: "idle" }
  | { phase: "registering" }
  | { phase: "registered"; userId: string; ticketId: string }
  | { phase: "waiting"; userId: string; ticketId: string }
  | {
      phase: "matched";
      userId: string;
      matchId: string;
      color: "white" | "black";
      tournamentId: string;
    }
  | { phase: "error"; message: string };

type SortKey = "score" | "buchholz" | "rating" | "games";
type SortDir = "asc" | "desc";

function genLocalUserId(tournamentId: string): string {
  if (typeof window === "undefined") return `anon_${Math.random().toString(36).slice(2, 10)}`;
  const key = `cc_user_id`;
  let id = window.localStorage.getItem(key);
  if (!id) {
    id =
      `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    try {
      window.localStorage.setItem(key, id);
    } catch {
      // ignore
    }
  }
  void tournamentId;
  return id;
}

function getDisplayName(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("cc_display_name") || "";
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
  const router = useRouter();

  const [tab, setTab] = useState<TabId>("bracket");
  const [meta, setMeta] = useState<TournamentMeta | null>(null);
  const [rounds, setRounds] = useState<BracketRound[]>([]);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [nextRound, setNextRound] = useState<NextRound | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [reg, setReg] = useState<RegState>({ phase: "idle" });
  const sseRef = useRef<EventSource | null>(null);

  // Track previous round-completion state so we only fire queue-match once
  // per transition (instead of every 15s poll).
  const lastDoneCountRef = useRef<number>(0);
  const lastQueueRoundRef = useRef<number>(-1);

  const fetchAll = async (silent = false) => {
    if (!silent) setLoading(true);
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
      if (tData?.ok && tData.tournament) {
        setMeta({
          id: tData.tournament.id,
          title: tData.tournament.title,
          format: tData.tournament.format,
          status: tData.tournament.status,
          swissRounds: tData.tournament.swissRounds,
          currentRound: tData.tournament.currentRound,
          players: tData.tournament.players,
          maxPlayers: tData.tournament.maxPlayers,
          realPlayers: !!tData.tournament.realPlayers,
          liveMatchId: tData.tournament.liveMatchId ?? null,
        });
      }

      if (bRes.ok) {
        const bData = await bRes.json();
        if (bData?.ok && Array.isArray(bData.rounds)) {
          setRounds(bData.rounds);
        }
      }
      if (sRes.ok) {
        const sData = await sRes.json();
        if (sData?.ok && Array.isArray(sData.standings)) {
          setStandings(sData.standings);
        }
      }
      if (nRes.ok) {
        const nData = await nRes.json();
        if (nData?.ok) {
          setNextRound({
            finished: !!nData.finished,
            round: nData.round ?? null,
            name: nData.name,
            matches: nData.matches,
          });
        }
      }
    } catch (e) {
      setErrorMsg((e as Error).message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await fetchAll(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  // C) Real-time polling every 15s — keeps meta/rounds/standings fresh
  // and detects round completion for auto-queue-match trigger.
  useEffect(() => {
    if (!meta) return;
    if (meta.status === "finished") return;
    const interval = window.setInterval(() => {
      void fetchAll(true);
    }, 15_000);
    return () => {
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta?.status, tournamentId]);

  // C) Auto-trigger queue-match when current round completes for realPlayers tournaments
  useEffect(() => {
    if (!meta || !meta.realPlayers) return;
    if (meta.status === "finished") return;
    if (rounds.length === 0) return;

    // Find the latest in-progress round
    const cr = meta.currentRound ?? 0;
    const currentRoundData = rounds.find((r) => r.round === cr);
    if (!currentRoundData) return;

    const total = currentRoundData.matches.length;
    const done = currentRoundData.matches.filter((m) => m.status === "done").length;
    const allDone = total > 0 && done === total;

    // Only fire if round just transitioned to done AND we haven't queued it yet
    if (
      allDone &&
      lastQueueRoundRef.current !== cr &&
      lastDoneCountRef.current < total
    ) {
      lastQueueRoundRef.current = cr;
      void fetch(`/api/cyberchess-tournaments/${tournamentId}/queue-match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }).catch(() => {
        // best-effort; backend may not have endpoint yet
      });
    }
    lastDoneCountRef.current = done;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rounds, meta?.currentRound, meta?.realPlayers, meta?.status, tournamentId]);

  const titleGuess = meta?.title ?? prettyTitle(tournamentId);
  const format: Format = meta?.format ?? "single_elimination";

  // ── registration handler ─────────────────────────────────────────
  const handleRegister = async () => {
    if (!meta) return;
    if (reg.phase === "registering" || reg.phase === "waiting") return;
    setReg({ phase: "registering" });
    const userId = genLocalUserId(tournamentId);
    const displayName = getDisplayName();
    try {
      const r = await fetch(`/api/cyberchess-tournaments/${tournamentId}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, displayName }),
      });
      const data = await r.json();
      if (!r.ok || !data?.ok) {
        const err = (data && data.error) || `HTTP ${r.status}`;
        setReg({ phase: "error", message: String(err) });
        return;
      }
      if (meta.realPlayers || data.realPlayers) {
        setReg({
          phase: "waiting",
          userId,
          ticketId: data.ticketId,
        });
      } else {
        setReg({
          phase: "registered",
          userId,
          ticketId: data.ticketId,
        });
      }
    } catch (e) {
      setReg({ phase: "error", message: (e as Error).message });
    }
  };

  // ── SSE subscription while waiting ───────────────────────────────
  useEffect(() => {
    if (reg.phase !== "waiting") {
      if (sseRef.current) {
        try {
          sseRef.current.close();
        } catch {
          // ignore
        }
        sseRef.current = null;
      }
      return;
    }
    const userId = reg.userId;
    const url = `/api/cyberchess/matchmaking/queue/stream?userId=${encodeURIComponent(userId)}`;
    let es: EventSource;
    try {
      es = new EventSource(url);
    } catch {
      return;
    }
    sseRef.current = es;
    const onMatched = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data);
        const matchId = String(data.matchId || "");
        const color = (data.color === "black" ? "black" : "white") as "white" | "black";
        if (!matchId) return;
        setReg({
          phase: "matched",
          userId,
          matchId,
          color,
          tournamentId,
        });
        try {
          es.close();
        } catch {
          // ignore
        }
        const target = `/cyberchess?matchId=${encodeURIComponent(matchId)}&color=${color}&tournamentId=${encodeURIComponent(tournamentId)}`;
        // small delay so the user sees the "matched" state for ~600ms
        window.setTimeout(() => {
          router.push(target);
        }, 600);
      } catch {
        // ignore malformed payload
      }
    };
    const onCancelled = () => {
      setReg({ phase: "error", message: "Ожидание отменено сервером." });
      try {
        es.close();
      } catch {
        // ignore
      }
    };
    const onTimeout = () => {
      setReg({ phase: "error", message: "Истекло время ожидания пары." });
      try {
        es.close();
      } catch {
        // ignore
      }
    };
    es.addEventListener("matched", onMatched as EventListener);
    es.addEventListener("cancelled", onCancelled as EventListener);
    es.addEventListener("timeout", onTimeout as EventListener);
    es.onerror = () => {
      // best-effort: keep listener open; native EventSource auto-retries
    };
    return () => {
      try {
        es.removeEventListener("matched", onMatched as EventListener);
        es.removeEventListener("cancelled", onCancelled as EventListener);
        es.removeEventListener("timeout", onTimeout as EventListener);
        es.close();
      } catch {
        // ignore
      }
      if (sseRef.current === es) sseRef.current = null;
    };
  }, [reg, tournamentId, router]);

  // ── progress bar metrics ─────────────────────────────────────────
  const progress = useMemo(() => computeProgress(format, meta, rounds), [format, meta, rounds]);

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, padding: "24px 32px" }}>
      {/* Global keyframes for animations */}
      <style>{`
        @keyframes cc-spin { to { transform: rotate(360deg); } }
        @keyframes cc-slide-in-left {
          from { opacity: 0; transform: translateX(-24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes cc-slide-in-right {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes cc-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes cc-pulse-live {
          0%, 100% { box-shadow: 0 0 0 1px ${T.red}55, 0 0 16px ${T.red}33; }
          50%      { box-shadow: 0 0 0 2px ${T.red}aa, 0 0 28px ${T.red}88; }
        }
        @keyframes cc-pulse-dot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%      { transform: scale(1.4); opacity: 0.55; }
        }
        @keyframes cc-stripes {
          0%   { background-position: 0 0; }
          100% { background-position: 32px 0; }
        }
        /* Hover handle so connection lines / next-round cards highlight when a match is hovered */
        .cc-match-card { transition: transform 160ms ease, box-shadow 160ms ease; }
        .cc-match-card:hover { transform: translateY(-1px); }
        .cc-match-card[data-live="1"] {
          animation: cc-pulse-live 1.8s ease-in-out infinite;
        }
        .cc-bracket-round { position: relative; }
        .cc-bracket-round[data-hovered="1"] .cc-match-card {
          border-color: ${T.accent} !important;
        }
        .cc-connector {
          position: absolute;
          background: ${T.border};
          transition: background-color 160ms ease;
        }
        .cc-bracket-round[data-hovered="1"] + .cc-bracket-round .cc-connector,
        .cc-bracket-round[data-hovered="1"] .cc-connector {
          background: ${T.accent};
        }
      `}</style>

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

        {/* C) Real-time progress bar */}
        {meta && meta.status !== "finished" && progress.total > 0 && (
          <RoundProgressBar progress={progress} />
        )}

        {errorMsg && (
          <div style={{ color: T.orange, marginTop: 8, fontSize: 12 }}>
            Бэкенд недоступен ({errorMsg}). Показываем sample data, если оно есть.
          </div>
        )}

        {/* Registration / Matching panel */}
        {meta && meta.status === "upcoming" && (
          <RegPanel
            reg={reg}
            realPlayers={!!meta.realPlayers}
            onRegister={handleRegister}
            full={(meta.players ?? 0) >= (meta.maxPlayers ?? 0) && (meta.maxPlayers ?? 0) > 0}
          />
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
        <BracketView
          format={format}
          rounds={rounds}
          loading={loading}
          liveMatchId={meta?.liveMatchId ?? null}
        />
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
        <ScheduleView
          rounds={rounds}
          nextRound={nextRound}
          loading={loading}
          progress={progress}
        />
      )}
    </div>
  );
}

// ── tab components ────────────────────────────────────────────────

function BracketView({
  format,
  rounds,
  loading,
  liveMatchId,
}: {
  format: Format;
  rounds: BracketRound[];
  loading: boolean;
  liveMatchId: string | null;
}) {
  if (loading && rounds.length === 0) {
    return <SkeletonBox label="Загружаем bracket..." />;
  }
  if (rounds.length === 0) {
    return <EmptyBox label="Сетка ещё не сформирована." />;
  }

  if (format === "swiss") {
    return <SwissRoundsView rounds={rounds} liveMatchId={liveMatchId} />;
  }
  if (format === "round_robin") {
    return <RoundRobinMatrixView rounds={rounds} />;
  }

  // single_elimination — classic horizontal grid with hover-highlight
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
        {rounds.map((round, ri) => (
          <BracketRoundColumn
            key={`${round.name}-${round.round}`}
            round={round}
            roundIndex={ri}
            totalRounds={rounds.length}
            liveMatchId={liveMatchId}
          />
        ))}
      </div>
    </section>
  );
}

function BracketRoundColumn({
  round,
  roundIndex,
  totalRounds,
  liveMatchId,
}: {
  round: BracketRound;
  roundIndex: number;
  totalRounds: number;
  liveMatchId: string | null;
}) {
  const [hoveredMatchId, setHoveredMatchId] = useState<string | null>(null);
  const isHovered = hoveredMatchId !== null;

  return (
    <div
      className="cc-bracket-round"
      data-hovered={isHovered ? "1" : "0"}
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
        {round.matches.map((m, mi) => (
          <div
            key={m.id}
            onMouseEnter={() => setHoveredMatchId(m.id)}
            onMouseLeave={() => setHoveredMatchId(null)}
            style={{
              animation: `cc-fade-in 320ms ease ${Math.min(mi * 60, 480)}ms both`,
              position: "relative",
            }}
          >
            {/* Connector to next round (rightward) */}
            {roundIndex < totalRounds - 1 && (
              <span
                className="cc-connector"
                style={{
                  top: "50%",
                  right: -24,
                  width: 24,
                  height: 1,
                }}
              />
            )}
            <MatchCard m={m} liveMatchId={liveMatchId} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SwissRoundsView({
  rounds,
  liveMatchId,
}: {
  rounds: BracketRound[];
  liveMatchId: string | null;
}) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {rounds.map((round, ri) => (
        <div
          key={`swiss-${round.round}`}
          style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            padding: 16,
            animation: `cc-fade-in 280ms ease ${Math.min(ri * 50, 320)}ms both`,
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
            {round.matches.map((m, mi) => (
              <div
                key={m.id}
                style={{
                  animation: `${mi % 2 === 0 ? "cc-slide-in-left" : "cc-slide-in-right"} 380ms ease ${Math.min(mi * 40, 360)}ms both`,
                }}
              >
                <MatchCard m={m} liveMatchId={liveMatchId} />
              </div>
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
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

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

  // A) Sortable swiss / round_robin → table
  const sortedStandings = useMemo(() => {
    const arr = [...standings];
    const getter: Record<SortKey, (r: StandingRow) => number> = {
      score: (r) => r.score,
      buchholz: (r) => r.buchholz,
      rating: (r) => r.rating,
      games: (r) => r.gamesPlayed,
    };
    const fn = getter[sortKey];
    arr.sort((a, b) => {
      const diff = fn(a) - fn(b);
      return sortDir === "asc" ? diff : -diff;
    });
    return arr;
  }, [standings, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // default to desc for score/buchholz/rating/games (higher = better, except games where higher = more played)
      setSortDir("desc");
    }
  };

  const SortArrow = ({ active }: { active: boolean }) => (
    <span style={{ marginLeft: 4, color: active ? T.accent : T.faint, fontSize: 10 }}>
      {active ? (sortDir === "asc" ? "↑" : "↓") : ""}
    </span>
  );

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
              {/* Static columns */}
              <th style={thStyle({ active: false, sortable: false, align: "center" })}>#</th>
              <th style={thStyle({ active: false, sortable: false, align: "left" })}>Игрок</th>
              {/* Sortable columns */}
              <th
                onClick={() => handleSort("rating")}
                style={thStyle({ active: sortKey === "rating", sortable: true, align: "center" })}
                title="Сортировать по рейтингу"
              >
                Рейтинг <SortArrow active={sortKey === "rating"} />
              </th>
              <th
                onClick={() => handleSort("score")}
                style={thStyle({ active: sortKey === "score", sortable: true, align: "center" })}
                title="Сортировать по очкам"
              >
                Очки <SortArrow active={sortKey === "score"} />
              </th>
              <th
                onClick={() => handleSort("buchholz")}
                style={thStyle({ active: sortKey === "buchholz", sortable: true, align: "center" })}
                title="Сортировать по Buchholz"
              >
                Buchholz <SortArrow active={sortKey === "buchholz"} />
              </th>
              <th
                onClick={() => handleSort("games")}
                style={thStyle({ active: sortKey === "games", sortable: true, align: "center" })}
                title="Сортировать по числу партий"
              >
                Партий <SortArrow active={sortKey === "games"} />
              </th>
              <th style={thStyle({ active: false, sortable: false, align: "center" })}>W/B</th>
            </tr>
          </thead>
          <tbody>
            {sortedStandings.map((r, idx) => (
              <tr key={r.id}>
                <td
                  style={{
                    padding: "8px 10px",
                    color: idx < 3 ? T.yellow : T.faint,
                    fontWeight: 700,
                    textAlign: "center",
                  }}
                >
                  {idx + 1}
                </td>
                <td style={{ padding: "8px 10px", color: T.text }}>{r.name}</td>
                <td
                  style={{
                    padding: "8px 10px",
                    textAlign: "center",
                    color: sortKey === "rating" ? T.text : T.dim,
                    fontWeight: sortKey === "rating" ? 700 : 500,
                  }}
                >
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
                    color: sortKey === "buchholz" ? T.text : T.dim,
                    fontWeight: sortKey === "buchholz" ? 700 : 500,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  }}
                >
                  {r.buchholz.toFixed(1)}
                </td>
                <td
                  style={{
                    padding: "8px 10px",
                    textAlign: "center",
                    color: sortKey === "games" ? T.text : T.dim,
                    fontWeight: sortKey === "games" ? 700 : 500,
                  }}
                >
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

function thStyle(opts: {
  active: boolean;
  sortable: boolean;
  align: "left" | "center";
}): React.CSSProperties {
  return {
    textAlign: opts.align,
    padding: "8px 10px",
    borderBottom: `1px solid ${T.border}`,
    color: opts.active ? T.accent : T.faint,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    cursor: opts.sortable ? "pointer" : "default",
    userSelect: "none",
    background: opts.active ? `${T.accent}10` : "transparent",
    transition: "background 160ms, color 160ms",
  };
}

function ScheduleView({
  rounds,
  nextRound,
  loading,
  progress,
}: {
  rounds: BracketRound[];
  nextRound: NextRound | null;
  loading: boolean;
  progress: { current: number; total: number; label: string };
}) {
  if (loading && rounds.length === 0) {
    return <SkeletonBox label="Загружаем расписание..." />;
  }
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Progress inside Schedule too (always visible here) */}
      {progress.total > 0 && (
        <div
          style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            padding: 16,
          }}
        >
          <h3
            style={{
              margin: "0 0 10px",
              fontSize: 13,
              color: T.faint,
              letterSpacing: 1.5,
              textTransform: "uppercase",
            }}
          >
            Прогресс турнира
          </h3>
          <ProgressBarInner progress={progress} />
        </div>
      )}

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
              {(nextRound.matches ?? []).map((m, mi) => (
                <div
                  key={m.id}
                  style={{
                    animation: `${mi % 2 === 0 ? "cc-slide-in-left" : "cc-slide-in-right"} 340ms ease ${Math.min(mi * 40, 280)}ms both`,
                  }}
                >
                  <MatchCard m={m} liveMatchId={null} />
                </div>
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

// ── progress bar ──────────────────────────────────────────────────

function computeProgress(
  format: Format,
  meta: TournamentMeta | null,
  rounds: BracketRound[],
): { current: number; total: number; label: string } {
  if (!meta) return { current: 0, total: 0, label: "" };

  if (format === "swiss" || format === "round_robin") {
    const total = meta.swissRounds ?? rounds.length;
    const current = meta.currentRound ?? 0;
    return {
      current: Math.min(current, total),
      total,
      label: `Тур ${Math.min(current, total)} / ${total}`,
    };
  }

  // single_elimination: count matches
  let total = 0;
  let done = 0;
  for (const r of rounds) {
    total += r.matches.length;
    done += r.matches.filter((m) => m.status === "done").length;
  }
  return {
    current: done,
    total,
    label: `${done} / ${total} матчей сыграно`,
  };
}

function RoundProgressBar({
  progress,
}: {
  progress: { current: number; total: number; label: string };
}) {
  return (
    <div style={{ marginTop: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 6,
          fontSize: 11,
          color: T.faint,
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        <span>Прогресс</span>
        <span style={{ color: T.dim }}>{progress.label}</span>
      </div>
      <ProgressBarInner progress={progress} />
    </div>
  );
}

function ProgressBarInner({
  progress,
}: {
  progress: { current: number; total: number; label: string };
}) {
  const pct = progress.total > 0 ? Math.min(100, (progress.current / progress.total) * 100) : 0;
  return (
    <div
      style={{
        position: "relative",
        background: T.surfaceAlt,
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        height: 14,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: `repeating-linear-gradient(
            45deg,
            ${T.accent} 0,
            ${T.accent} 8px,
            ${T.accentDim} 8px,
            ${T.accentDim} 16px
          )`,
          backgroundSize: "32px 32px",
          animation: "cc-stripes 1.2s linear infinite",
          transition: "width 600ms ease",
          boxShadow: pct > 0 ? `0 0 12px ${T.accent}66` : "none",
        }}
      />
      {pct > 5 && (
        <span
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            color: T.text,
            fontWeight: 700,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            textShadow: "0 1px 2px rgba(0,0,0,0.6)",
          }}
        >
          {pct.toFixed(0)}%
        </span>
      )}
    </div>
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

function MatchCard({
  m,
  liveMatchId,
}: {
  m: Match;
  liveMatchId: string | null;
}) {
  const live = m.status === "live" || (liveMatchId !== null && liveMatchId === m.id);
  const done = m.status === "done";

  return (
    <div
      className="cc-match-card"
      data-live={live ? "1" : "0"}
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
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: T.red,
              animation: "cc-pulse-dot 1.2s ease-in-out infinite",
              display: "inline-block",
            }}
          />
          LIVE
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

// ── registration panel ────────────────────────────────────────────

function RegPanel({
  reg,
  realPlayers,
  onRegister,
  full,
}: {
  reg: RegState;
  realPlayers: boolean;
  onRegister: () => void;
  full: boolean;
}) {
  const phase = reg.phase;
  const canRegister = phase === "idle" || phase === "error";

  let body: React.ReactNode = null;
  if (phase === "idle" || phase === "error") {
    body = (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button
            onClick={onRegister}
            disabled={!canRegister || full}
            style={{
              background: full ? T.faint : T.accent,
              color: "#0a0e1a",
              border: "none",
              borderRadius: 8,
              padding: "10px 22px",
              fontSize: 14,
              fontWeight: 700,
              cursor: full ? "not-allowed" : "pointer",
              letterSpacing: 0.3,
            }}
          >
            {full ? "Турнир заполнен" : "Зарегистрироваться"}
          </button>
          {realPlayers && (
            <span style={{ fontSize: 12, color: T.dim }}>
              ⚡ Турнир с реальными игроками — после регистрации откроется ожидание пары.
            </span>
          )}
        </div>
        {phase === "error" && (
          <div style={{ marginTop: 8, fontSize: 12, color: T.red }}>
            Ошибка: {(reg as { message: string }).message}
          </div>
        )}
      </>
    );
  } else if (phase === "registering") {
    body = (
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Spinner color={T.accent} />
        <span style={{ fontSize: 14, color: T.text }}>Регистрируем участника...</span>
      </div>
    );
  } else if (phase === "registered") {
    body = (
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Badge color={T.accent}>✓ Регистрация подтверждена</Badge>
        <span style={{ fontSize: 12, color: T.dim }}>
          ticket: {(reg as { ticketId: string }).ticketId.slice(0, 14)}…
        </span>
      </div>
    );
  } else if (phase === "waiting") {
    body = (
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Spinner color={T.blue} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 14, color: T.text, fontWeight: 600 }}>
            Ожидание пары...
          </span>
          <span style={{ fontSize: 11, color: T.faint, marginTop: 2 }}>
            Когда tournament-scheduler опубликует следующий тур, вы получите матч и переход в игру.
          </span>
        </div>
      </div>
    );
  } else if (phase === "matched") {
    const m = reg as Extract<RegState, { phase: "matched" }>;
    body = (
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Badge color={T.accent}>● Пара найдена</Badge>
        <span style={{ fontSize: 13, color: T.text }}>
          Открываем партию ({m.color})…
        </span>
        <span style={{ fontSize: 11, color: T.faint, fontFamily: "ui-monospace, monospace" }}>
          {m.matchId.slice(0, 14)}…
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: 16,
        padding: "14px 16px",
        background: T.surface,
        border: `1px solid ${
          phase === "matched"
            ? T.accent
            : phase === "waiting"
              ? `${T.blue}88`
              : T.border
        }`,
        borderRadius: 10,
      }}
    >
      {body}
    </div>
  );
}

function Spinner({ color }: { color: string }) {
  return (
    <span
      aria-label="loading"
      style={{
        display: "inline-block",
        width: 18,
        height: 18,
        border: `2px solid ${color}33`,
        borderTopColor: color,
        borderRadius: "50%",
        animation: "cc-spin 0.8s linear infinite",
      }}
    />
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
