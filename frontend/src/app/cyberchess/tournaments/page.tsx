"use client";

// AEVION CyberChess — Tournament Hub (list view)
// Zone: aevion-core/main owns frontend/src/app/cyberchess/**
// Reads from /api/cyberchess-tournaments/list; falls back to mock if offline.
//
// New in this iteration:
//   • Format chips (All / Elim / Swiss / RR)
//   • Format badge on each card ("Swiss 5 rounds" / "Round-robin" / "Single Elim")
//   • Standings preview on card hover (mini-table top-5)

import { useEffect, useMemo, useState } from "react";
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

type TimeControl = "blitz" | "rapid" | "classic";
type Status = "upcoming" | "live" | "finished";
type Format = "single_elimination" | "swiss" | "round_robin";

interface Tournament {
  id: string;
  title: string;
  format: Format;
  timeControl: TimeControl;
  eloMin: number;
  eloMax: number;
  players: number;
  maxPlayers: number;
  prizeChessy: number;
  status: Status;
  startsAt: string;
  swissRounds?: number;
  currentRound?: number;
}

interface StandingRow {
  rank: number;
  id: string;
  name: string;
  rating: number;
  score: number;
  buchholz: number;
  gamesPlayed: number;
}

const MOCK_FALLBACK: Tournament[] = [
  {
    id: "spring-blitz-01",
    title: "Spring Blitz Open",
    format: "single_elimination",
    timeControl: "blitz",
    eloMin: 1800,
    eloMax: 2400,
    players: 87,
    maxPlayers: 128,
    prizeChessy: 50_000,
    status: "upcoming",
    startsAt: "2026-05-18 19:00",
  },
  {
    id: "swiss-arena-may",
    title: "Swiss Arena — Май",
    format: "swiss",
    timeControl: "rapid",
    eloMin: 1900,
    eloMax: 2500,
    players: 8,
    maxPlayers: 16,
    prizeChessy: 40_000,
    status: "live",
    startsAt: "2026-05-16 18:00",
    swissRounds: 5,
    currentRound: 1,
  },
  {
    id: "classic-rr-may",
    title: "Classical Round-robin — May",
    format: "round_robin",
    timeControl: "classic",
    eloMin: 2000,
    eloMax: 2800,
    players: 8,
    maxPlayers: 8,
    prizeChessy: 120_000,
    status: "live",
    startsAt: "2026-05-14 12:00",
  },
];

type TcFilter = "all" | TimeControl;
type StatusFilter = "all" | Status;
type FormatFilter = "all" | Format;

export default function TournamentsHubPage() {
  const [tcFilter, setTcFilter] = useState<TcFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [formatFilter, setFormatFilter] = useState<FormatFilter>("all");
  const [eloMin, setEloMin] = useState<number>(0);
  const [eloMax, setEloMax] = useState<number>(3000);

  const [tournaments, setTournaments] = useState<Tournament[]>(MOCK_FALLBACK);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchList = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const r = await fetch("/api/cyberchess-tournaments/list", { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (!cancelled && data?.ok && Array.isArray(data.tournaments)) {
          setTournaments(data.tournaments);
        }
      } catch (e) {
        if (!cancelled) setErrorMsg((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchList();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    return tournaments.filter((t) => {
      if (formatFilter !== "all" && t.format !== formatFilter) return false;
      if (tcFilter !== "all" && t.timeControl !== tcFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (t.eloMax < eloMin) return false;
      if (t.eloMin > eloMax) return false;
      return true;
    });
  }, [tournaments, formatFilter, tcFilter, statusFilter, eloMin, eloMax]);

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, padding: "24px 32px" }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 16 }}>
        <Link
          href="/cyberchess"
          style={{ color: T.dim, textDecoration: "none", fontSize: 14 }}
        >
          ← к шахматам
        </Link>
      </div>

      {/* Header */}
      <header style={{ marginBottom: 32 }}>
        <h1
          style={{
            fontSize: 36,
            margin: 0,
            letterSpacing: -0.5,
            color: T.text,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span>🏆</span>
          <span>Турниры AEVION</span>
        </h1>
        <p style={{ color: T.dim, marginTop: 8, fontSize: 14 }}>
          Single elimination, Swiss или round-robin — выбирай формат и регистрируйся.
        </p>
        {loading && (
          <div style={{ color: T.faint, marginTop: 8, fontSize: 12 }}>Загружаем список...</div>
        )}
        {errorMsg && (
          <div style={{ color: T.orange, marginTop: 8, fontSize: 12 }}>
            Бэкенд недоступен ({errorMsg}). Показываем sample data.
          </div>
        )}
      </header>

      {/* Filters */}
      <section
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          padding: 16,
          marginBottom: 24,
          display: "flex",
          flexWrap: "wrap",
          gap: 24,
          alignItems: "center",
        }}
      >
        <FilterGroup label="Формат">
          {(["all", "single_elimination", "swiss", "round_robin"] as const).map((v) => (
            <PillButton
              key={v}
              active={formatFilter === v}
              onClick={() => setFormatFilter(v)}
              label={
                v === "all"
                  ? "Все"
                  : v === "single_elimination"
                  ? "Elim"
                  : v === "swiss"
                  ? "Swiss"
                  : "RR"
              }
            />
          ))}
        </FilterGroup>

        <FilterGroup label="Контроль времени">
          {(["all", "blitz", "rapid", "classic"] as const).map((v) => (
            <PillButton
              key={v}
              active={tcFilter === v}
              onClick={() => setTcFilter(v)}
              label={
                v === "all"
                  ? "Все"
                  : v === "blitz"
                  ? "Блиц"
                  : v === "rapid"
                  ? "Рапид"
                  : "Классика"
              }
            />
          ))}
        </FilterGroup>

        <FilterGroup label="Статус">
          {(["all", "upcoming", "live", "finished"] as const).map((v) => (
            <PillButton
              key={v}
              active={statusFilter === v}
              onClick={() => setStatusFilter(v)}
              label={
                v === "all"
                  ? "Все"
                  : v === "upcoming"
                  ? "Скоро"
                  : v === "live"
                  ? "Live"
                  : "Завершён"
              }
            />
          ))}
        </FilterGroup>

        <FilterGroup label="ELO диапазон">
          <input
            type="number"
            value={eloMin}
            onChange={(e) => setEloMin(Number(e.target.value) || 0)}
            style={inputStyle}
            placeholder="от"
          />
          <span style={{ color: T.dim }}>—</span>
          <input
            type="number"
            value={eloMax}
            onChange={(e) => setEloMax(Number(e.target.value) || 0)}
            style={inputStyle}
            placeholder="до"
          />
        </FilterGroup>
      </section>

      {/* Tournament cards grid */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
          gap: 16,
        }}
      >
        {filtered.length === 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              padding: 32,
              textAlign: "center",
              color: T.dim,
              background: T.surface,
              border: `1px dashed ${T.border}`,
              borderRadius: 12,
            }}
          >
            Турниры под текущие фильтры не найдены.
          </div>
        )}
        {filtered.map((t) => (
          <TournamentCard key={t.id} t={t} />
        ))}
      </section>
    </div>
  );
}

// ── small inline components ────────────────────────────────────────

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 11, color: T.faint, textTransform: "uppercase", letterSpacing: 1 }}>
        {label}
      </span>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        {children}
      </div>
    </div>
  );
}

function PillButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? T.accent : T.surfaceAlt,
        color: active ? "#022c22" : T.text,
        border: `1px solid ${active ? T.accent : T.border}`,
        borderRadius: 999,
        padding: "6px 14px",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 120ms",
      }}
    >
      {label}
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  background: T.surfaceAlt,
  border: `1px solid ${T.border}`,
  borderRadius: 6,
  padding: "6px 10px",
  color: T.text,
  fontSize: 13,
  width: 70,
};

function formatLabel(f: Format, t: Tournament): string {
  if (f === "single_elimination") return "Single Elim";
  if (f === "swiss") {
    const rounds = t.swissRounds ?? 5;
    return `Swiss · ${rounds} туров`;
  }
  return "Round-robin";
}

function formatColor(f: Format): string {
  if (f === "single_elimination") return T.purple;
  if (f === "swiss") return T.blue;
  return T.yellow;
}

function TournamentCard({ t }: { t: Tournament }) {
  const [hovered, setHovered] = useState(false);
  const [standings, setStandings] = useState<StandingRow[] | null>(null);
  const [standingsLoading, setStandingsLoading] = useState(false);

  const tcLabel =
    t.timeControl === "blitz" ? "Блиц" : t.timeControl === "rapid" ? "Рапид" : "Классика";
  const tcColor =
    t.timeControl === "blitz" ? T.orange : t.timeControl === "rapid" ? T.blue : T.purple;
  const statusColor =
    t.status === "live" ? T.red : t.status === "upcoming" ? T.accent : T.faint;
  const statusLabel =
    t.status === "live" ? "● LIVE" : t.status === "upcoming" ? "Скоро" : "Завершён";

  const full = t.players >= t.maxPlayers;

  useEffect(() => {
    if (!hovered || standings) return;
    let cancelled = false;
    setStandingsLoading(true);
    fetch(`/api/cyberchess-tournaments/${t.id}/standings`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data?.ok && Array.isArray(data.standings)) {
          setStandings(data.standings.slice(0, 5));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setStandingsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hovered, t.id, standings]);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: T.surface,
        border: `1px solid ${hovered ? T.accentDim : T.border}`,
        borderRadius: 12,
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        position: "relative",
        transition: "border-color 160ms",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 17, color: T.text }}>{t.title}</h3>
          <div style={{ marginTop: 4, fontSize: 12, color: T.dim }}>{t.startsAt}</div>
        </div>
        <span
          style={{
            color: statusColor,
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 1,
          }}
        >
          {statusLabel}
        </span>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Tag color={formatColor(t.format)}>{formatLabel(t.format, t)}</Tag>
        <Tag color={tcColor}>{tcLabel}</Tag>
        <Tag color={T.dim}>
          ELO {t.eloMin}–{t.eloMax}
        </Tag>
        <Tag color={full ? T.red : T.accent}>
          {t.players}/{t.maxPlayers} игроков
        </Tag>
      </div>

      {/* Standings preview (hover) */}
      {hovered && (t.format === "swiss" || t.format === "round_robin") && (
        <div
          style={{
            background: T.surfaceAlt,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            padding: 10,
            fontSize: 12,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: T.faint,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 6,
            }}
          >
            Топ-5 · {t.format === "swiss" ? "Buchholz tiebreak" : "Round-robin"}
          </div>
          {standingsLoading && <div style={{ color: T.dim }}>Загрузка...</div>}
          {!standingsLoading && (!standings || standings.length === 0) && (
            <div style={{ color: T.faint }}>Данных пока нет</div>
          )}
          {!standingsLoading && standings && standings.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {standings.map((row) => (
                  <tr key={row.id}>
                    <td style={{ color: T.faint, width: 24, padding: "2px 4px" }}>
                      {row.rank}.
                    </td>
                    <td style={{ color: T.text, padding: "2px 4px" }}>{row.name}</td>
                    <td
                      style={{
                        color: T.yellow,
                        fontWeight: 700,
                        textAlign: "right",
                        padding: "2px 4px",
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      }}
                    >
                      {row.score}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 4,
        }}
      >
        <span style={{ fontSize: 14, color: T.yellow, fontWeight: 700 }}>
          💎 {t.prizeChessy.toLocaleString("ru-RU")} Chessy
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <Link
            href={`/cyberchess/tournaments/${t.id}`}
            style={{
              background: T.surfaceAlt,
              color: T.text,
              border: `1px solid ${T.border}`,
              borderRadius: 6,
              padding: "6px 12px",
              fontSize: 12,
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Подробнее
          </Link>
          {t.status === "live" ? (
            <button
              onClick={() => alert(`[mock] Spectate ${t.title}`)}
              style={btnPrimary(T.blue)}
            >
              Spectate
            </button>
          ) : t.status === "upcoming" ? (
            <button
              disabled={full}
              onClick={async () => {
                try {
                  const r = await fetch(
                    `/api/cyberchess-tournaments/${t.id}/register`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({}),
                    },
                  );
                  const data = await r.json();
                  if (data?.ok) {
                    alert(`Registered. Ticket ${data.ticketId}`);
                  } else {
                    alert(`Error: ${data?.error || "unknown"}`);
                  }
                } catch (e) {
                  alert(`Registered (offline mock) for ${t.title}`);
                }
              }}
              style={btnPrimary(full ? T.faint : T.accent)}
            >
              {full ? "Заполнен" : "Register"}
            </button>
          ) : (
            <button disabled style={btnPrimary(T.faint)}>
              Завершён
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Tag({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      style={{
        background: `${color}22`,
        color,
        border: `1px solid ${color}55`,
        borderRadius: 4,
        padding: "2px 8px",
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}

function btnPrimary(color: string): React.CSSProperties {
  return {
    background: color,
    color: "#022c22",
    border: "none",
    borderRadius: 6,
    padding: "6px 14px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  };
}
