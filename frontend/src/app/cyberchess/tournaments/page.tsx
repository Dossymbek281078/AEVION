"use client";

// AEVION CyberChess — Tournament Hub (list view)
// Zone: aevion-core/main owns frontend/src/app/cyberchess/**
// Mock-data MVP. Replaces tournament v1 with multi-tournament index.

import { useMemo, useState } from "react";
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

interface Tournament {
  id: string;
  title: string;
  timeControl: TimeControl;
  eloMin: number;
  eloMax: number;
  players: number;
  maxPlayers: number;
  prizeChessy: number;
  status: Status;
  startsAt: string;
}

const MOCK_TOURNAMENTS: Tournament[] = [
  {
    id: "spring-blitz-01",
    title: "Spring Blitz Open",
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
    id: "weekly-rapid-22",
    title: "Weekly Rapid #22",
    timeControl: "rapid",
    eloMin: 1500,
    eloMax: 2200,
    players: 64,
    maxPlayers: 64,
    prizeChessy: 25_000,
    status: "live",
    startsAt: "2026-05-15 18:30",
  },
  {
    id: "classic-arena-may",
    title: "Classical Arena — May",
    timeControl: "classic",
    eloMin: 2000,
    eloMax: 2800,
    players: 32,
    maxPlayers: 32,
    prizeChessy: 120_000,
    status: "live",
    startsAt: "2026-05-14 12:00",
  },
  {
    id: "bullet-storm-7",
    title: "Bullet Storm #7",
    timeControl: "blitz",
    eloMin: 1200,
    eloMax: 2600,
    players: 211,
    maxPlayers: 256,
    prizeChessy: 15_000,
    status: "upcoming",
    startsAt: "2026-05-16 21:00",
  },
  {
    id: "veterans-cup",
    title: "Veterans Cup (40+)",
    timeControl: "rapid",
    eloMin: 1600,
    eloMax: 2400,
    players: 48,
    maxPlayers: 64,
    prizeChessy: 35_000,
    status: "upcoming",
    startsAt: "2026-05-20 17:00",
  },
  {
    id: "winter-arena-12",
    title: "Winter Arena #12",
    timeControl: "classic",
    eloMin: 1900,
    eloMax: 2700,
    players: 16,
    maxPlayers: 16,
    prizeChessy: 80_000,
    status: "finished",
    startsAt: "2026-04-30 15:00",
  },
  {
    id: "newbies-rapid",
    title: "Newbies Rapid Friendly",
    timeControl: "rapid",
    eloMin: 800,
    eloMax: 1500,
    players: 22,
    maxPlayers: 64,
    prizeChessy: 5_000,
    status: "upcoming",
    startsAt: "2026-05-17 14:00",
  },
];

type TcFilter = "all" | TimeControl;
type StatusFilter = "all" | Status;

export default function TournamentsHubPage() {
  const [tcFilter, setTcFilter] = useState<TcFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [eloMin, setEloMin] = useState<number>(0);
  const [eloMax, setEloMax] = useState<number>(3000);

  const filtered = useMemo(() => {
    return MOCK_TOURNAMENTS.filter((t) => {
      if (tcFilter !== "all" && t.timeControl !== tcFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (t.eloMax < eloMin) return false;
      if (t.eloMin > eloMax) return false;
      return true;
    });
  }, [tcFilter, statusFilter, eloMin, eloMax]);

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
          Зарегистрируйся в активном турнире или посмотри live-матчи.
        </p>
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
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
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

function TournamentCard({ t }: { t: Tournament }) {
  const tcLabel =
    t.timeControl === "blitz" ? "Блиц" : t.timeControl === "rapid" ? "Рапид" : "Классика";
  const tcColor =
    t.timeControl === "blitz" ? T.orange : t.timeControl === "rapid" ? T.blue : T.purple;
  const statusColor =
    t.status === "live" ? T.red : t.status === "upcoming" ? T.accent : T.faint;
  const statusLabel =
    t.status === "live" ? "● LIVE" : t.status === "upcoming" ? "Скоро" : "Завершён";

  const full = t.players >= t.maxPlayers;

  return (
    <div
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 12,
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
        <Tag color={tcColor}>{tcLabel}</Tag>
        <Tag color={T.dim}>
          ELO {t.eloMin}–{t.eloMax}
        </Tag>
        <Tag color={full ? T.red : T.accent}>
          {t.players}/{t.maxPlayers} игроков
        </Tag>
      </div>

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
            Bracket
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
              onClick={() => alert(`[mock] Registered for ${t.title}`)}
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
