"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  formatCountdown,
  FORMAT_LABEL,
  FORMAT_TIME,
  type TournamentResult,
} from "../_lib/chess";
import { useCurrency } from "../_lib/CurrencyContext";
import { formatCurrency } from "../_lib/currency";
import { useEcosystemData } from "../_lib/EcosystemDataContext";
import { formatRelative } from "../_lib/format";
import { Sparkline } from "./primitives";
import { SkeletonBlock } from "./Skeleton";

function placeBadge(place: number) {
  const palette: Record<number, { bg: string; fg: string; label: string }> = {
    1: { bg: "#fde68a", fg: "#78350f", label: "1st" },
    2: { bg: "#e5e7eb", fg: "#374151", label: "2nd" },
    3: { bg: "#fed7aa", fg: "#7c2d12", label: "3rd" },
  };
  const p = palette[place];
  if (p) return { ...p, icon: place === 1 ? "♛" : place === 2 ? "♝" : "♞" };
  if (place <= 10) return { bg: "rgba(15,23,42,0.06)", fg: "#334155", label: `#${place}`, icon: "·" };
  return { bg: "rgba(15,23,42,0.04)", fg: "#94a3b8", label: `#${place}`, icon: "·" };
}

function ResultRow({ r }: { r: TournamentResult }) {
  const badge = placeBadge(r.place);
  const deltaColor = r.ratingDelta >= 0 ? "#059669" : "#dc2626";
  const { code } = useCurrency();
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid rgba(15,23,42,0.08)",
        background: "#fff",
      }}
    >
      <span
        aria-label={`Finished ${badge.label} of ${r.totalPlayers}`}
        style={{
          width: 34,
          height: 34,
          borderRadius: 8,
          background: badge.bg,
          color: badge.fg,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.04em",
        }}
      >
        <span style={{ fontSize: 14, lineHeight: 1 }} aria-hidden="true">
          {badge.icon}
        </span>
        <span style={{ lineHeight: 1 }}>{badge.label}</span>
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#0f172a",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap" as const,
          }}
        >
          {r.name}
        </div>
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
          {FORMAT_LABEL[r.format]} {FORMAT_TIME[r.format]} · {r.totalPlayers} players ·{" "}
          {formatRelative(r.finishedAt)}
        </div>
      </div>
      <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
        <div
          style={{
            fontWeight: 900,
            fontSize: 13,
            color: r.prize > 0 ? "#d97706" : "#94a3b8",
            whiteSpace: "nowrap" as const,
          }}
        >
          {r.prize > 0 ? formatCurrency(r.prize, code, { sign: true }) : "—"}
        </div>
        <div style={{ fontSize: 11, color: deltaColor, fontWeight: 700, marginTop: 1 }}>
          {r.ratingDelta >= 0 ? "+" : ""}
          {r.ratingDelta} → {r.ratingAfter}
        </div>
      </div>
    </li>
  );
}

export function ChessWinnings() {
  const { chess: data } = useEcosystemData();
  const { code } = useCurrency();

  const peakPos = useMemo(() => {
    if (!data || data.ratingSeries.length === 0) return -1;
    let idx = 0;
    let max = data.ratingSeries[0];
    for (let i = 1; i < data.ratingSeries.length; i++) {
      if (data.ratingSeries[i] > max) {
        max = data.ratingSeries[i];
        idx = i;
      }
    }
    return idx;
  }, [data]);

  if (!data) {
    return (
      <section
        style={{
          border: "1px solid rgba(217,119,6,0.2)",
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          background: "linear-gradient(180deg, rgba(217,119,6,0.03) 0%, #ffffff 100%)",
        }}
      >
        <SkeletonBlock label="Loading CyberChess tournament history" />
      </section>
    );
  }

  const winRate = data.tournamentsPlayed > 0
    ? Math.round((data.wins / data.tournamentsPlayed) * 100)
    : 0;
  const top3Rate = data.tournamentsPlayed > 0
    ? Math.round((data.topThreeFinishes / data.tournamentsPlayed) * 100)
    : 0;

  return (
    <section
      style={{
        border: "1px solid rgba(217,119,6,0.25)",
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        background: "linear-gradient(180deg, rgba(217,119,6,0.05) 0%, #ffffff 100%)",
      }}
      aria-labelledby="chess-winnings-heading"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            aria-hidden="true"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "rgba(217,119,6,0.14)",
              color: "#b45309",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 900,
            }}
          >
            ♞
          </span>
          <h2
            id="chess-winnings-heading"
            style={{ fontSize: 16, fontWeight: 900, margin: 0, color: "#78350f" }}
          >
            CyberChess winnings
          </h2>
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            borderRadius: 999,
            background: "rgba(217,119,6,0.1)",
            border: "1px solid rgba(217,119,6,0.3)",
            fontSize: 11,
            fontWeight: 800,
            color: "#92400e",
          }}
        >
          Rating <strong style={{ fontSize: 13 }}>{data.currentRating}</strong>
          <span style={{ color: "#b45309", opacity: 0.7 }}>· peak {data.peakRating}</span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            background: "rgba(217,119,6,0.06)",
            border: "1px solid rgba(217,119,6,0.18)",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, color: "#78350f", letterSpacing: "0.06em" }}>
            TOTAL WON
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#d97706", letterSpacing: "-0.02em" }}>
            {formatCurrency(data.totalWon, code, { decimals: 0 })}
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>all tournaments</div>
        </div>
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: "0.06em" }}>
            WINS
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.02em" }}>
            {data.wins} <span style={{ fontSize: 11, color: "#94a3b8" }}>/ {data.tournamentsPlayed}</span>
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{winRate}% win rate</div>
        </div>
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: "0.06em" }}>
            TOP 3 FINISHES
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.02em" }}>
            {data.topThreeFinishes}
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{top3Rate}% of tournaments</div>
        </div>
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: "0.06em" }}>
            RATING TREND
          </div>
          <Sparkline data={data.ratingSeries} width={140} height={28} color="#d97706" />
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
            {data.ratingSeries.length} games
            {peakPos >= 0 ? ` · peak @${peakPos + 1}` : ""}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color: "#94a3b8",
              marginBottom: 8,
            }}
          >
            Recent results
          </div>
          {data.results.length === 0 ? (
            <div style={{ fontSize: 12, color: "#94a3b8", padding: "8px 0" }}>No tournaments yet.</div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
              {data.results.slice(0, 5).map((r) => (
                <ResultRow key={r.id} r={r} />
              ))}
            </ul>
          )}
        </div>

        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color: "#94a3b8",
              marginBottom: 8,
            }}
          >
            Upcoming tournaments
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
            {data.upcoming.map((u) => (
              <li
                key={u.id}
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(217,119,6,0.2)",
                  background: "linear-gradient(135deg, rgba(217,119,6,0.04), rgba(120,53,15,0.02))",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: "1 1 160px", minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: "#78350f",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap" as const,
                      }}
                    >
                      {u.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#b45309", marginTop: 1 }}>
                      {FORMAT_LABEL[u.format]} {FORMAT_TIME[u.format]} · {u.players} signed up ·{" "}
                      {formatCountdown(u.startsAt)}
                    </div>
                  </div>
                  <div
                    style={{
                      fontWeight: 900,
                      fontSize: 13,
                      color: "#d97706",
                      whiteSpace: "nowrap" as const,
                    }}
                  >
                    {formatCurrency(u.prizePool, code, { decimals: 0 })} pool
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontSize: 11, color: "#94a3b8" }}>
          Prizes auto-deposit to your wallet when a tournament finalises.
        </div>
        <Link
          href="/cyberchess"
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            background: "linear-gradient(135deg, #d97706, #b45309)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 800,
            textDecoration: "none",
            whiteSpace: "nowrap" as const,
          }}
        >
          Play now →
        </Link>
      </div>
    </section>
  );
}
