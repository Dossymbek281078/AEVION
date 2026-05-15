"use client";

/**
 * FintechLiveStats — aggregated cross-module metrics ticker.
 * Polls each fintech module's stats endpoint and shows live counters.
 *
 * Usage:
 *   <FintechLiveStats />  — full grid (4 columns on desktop)
 *
 * Zone: aevion-core/main owns frontend/src/components/fintech/**
 */

import { useEffect, useState } from "react";
import { getApiBase } from "@/lib/apiBase";

type StatBox = {
  label: string;
  value: string | number;
  unit?: string;
  accent: string;
  loading?: boolean;
};

function fmtCount(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("ru-RU");
}

function fmtMoney(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(2)}M`;
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(1)}K`;
  return `$${dollars.toFixed(0)}`;
}

export default function FintechLiveStats() {
  const [stats, setStats] = useState<{
    veilLength: number | null;
    qgoodRaised: number | null;
    qgoodCampaigns: number | null;
    ztideRank1: string | null;
    qchainProposals: number | null;
    loading: boolean;
  }>({
    veilLength: null,
    qgoodRaised: null,
    qgoodCampaigns: null,
    ztideRank1: null,
    qchainProposals: null,
    loading: true,
  });

  useEffect(() => {
    const fetchAll = async () => {
      const apiBase = getApiBase();
      const safeFetch = async <T,>(path: string): Promise<T | null> => {
        try {
          const r = await fetch(`${apiBase}${path}`, {
            signal: AbortSignal.timeout(5000),
            headers: { Accept: "application/json" },
          });
          if (!r.ok) return null;
          return (await r.json()) as T;
        } catch { return null; }
      };
      const [veil, qgoodS, qgoodC, ztide, qchain] = await Promise.all([
        safeFetch<{ length?: number; total?: number }>("/api/veilnetx-ledger/head"),
        safeFetch<{ total_raised_cents?: number }>("/api/qgood/stats"),
        safeFetch<{ campaigns?: { id: string }[] }>("/api/qgood/campaigns"),
        safeFetch<{ entries?: { username?: string; userId?: string }[] }>("/api/ztide/leaderboard"),
        safeFetch<{ proposals?: { id: string }[] }>("/api/qchaingov/proposals?status=active"),
      ]);
      setStats({
        veilLength: veil?.length ?? veil?.total ?? null,
        qgoodRaised: qgoodS?.total_raised_cents ?? null,
        qgoodCampaigns: qgoodC?.campaigns?.length ?? null,
        ztideRank1: ztide?.entries?.[0]?.username ?? ztide?.entries?.[0]?.userId?.slice(0, 8) ?? null,
        qchainProposals: qchain?.proposals?.length ?? null,
        loading: false,
      });
    };
    fetchAll();
    const t = setInterval(fetchAll, 30_000);
    return () => clearInterval(t);
  }, []);

  const boxes: StatBox[] = [
    { label: "VeilNetX entries", value: fmtCount(stats.veilLength), accent: "#a78bfa", loading: stats.loading },
    { label: "QGood raised", value: fmtMoney(stats.qgoodRaised), accent: "#34d399", loading: stats.loading },
    { label: "Active campaigns", value: fmtCount(stats.qgoodCampaigns), accent: "#10b981", loading: stats.loading },
    { label: "Active proposals", value: fmtCount(stats.qchainProposals), accent: "#f472b6", loading: stats.loading },
  ];

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
      gap: 12,
    }}>
      {boxes.map((b, i) => (
        <div key={i} style={{
          background: "rgba(15,23,42,0.6)",
          border: `1px solid ${b.accent}30`,
          borderRadius: 10,
          padding: "12px 14px",
          minHeight: 70,
          transition: "border-color 0.2s",
        }}>
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#64748b",
            textTransform: "uppercase",
            letterSpacing: 0.5,
            marginBottom: 4,
          }}>{b.label}</div>
          <div style={{
            fontSize: 22,
            fontWeight: 900,
            color: b.loading ? "#475569" : b.accent,
            fontFamily: "ui-monospace, monospace",
            lineHeight: 1.1,
            transition: "color 0.3s",
          }}>
            {b.loading ? "…" : b.value}
          </div>
        </div>
      ))}
    </div>
  );
}
