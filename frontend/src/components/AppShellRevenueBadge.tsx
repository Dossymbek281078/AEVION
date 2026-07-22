"use client";

// Floating goal-progress pill for full-app shells (build, qright, qsign,
// qcoreai, multichat-engine) that hide the global SiteHeader — otherwise
// those users never see New Year goal progress at all. Deliberately NOT
// rendered on /cyberchess: that surface is owned by a separate session/branch
// (see aevion-globus-backend/CLAUDE.md) and stays untouched from here.
import Link from "next/link";
import { useRevenueGoal } from "@/lib/useRevenueGoal";

export function AppShellRevenueBadge() {
  const { goals, summary, pct, days } = useRevenueGoal();

  if (!goals || !summary || pct === null || days === null) return null;

  const tip = `$${summary.grossUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })} raised toward $1M · ${days} days to the deadline ($20M stretch goal)`;

  return (
    <Link
      href="/revenue"
      title={tip}
      aria-label={tip}
      data-app-shell-pill="true"
      style={{
        position: "fixed",
        top: 12,
        left: 12,
        zIndex: 60,
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "6px 10px",
        borderRadius: 10,
        fontSize: 11,
        fontWeight: 800,
        color: "#e2e8f0",
        background: "rgba(15,23,42,0.78)",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(14,165,233,0.35)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
        textDecoration: "none",
        whiteSpace: "nowrap",
      }}
    >
      <span aria-hidden>🎯</span>
      $1M: {pct >= 0.1 ? pct.toFixed(1) : pct.toFixed(2)}%
      <span style={{ fontWeight: 600, opacity: 0.75 }}>· {days}d</span>
    </Link>
  );
}
