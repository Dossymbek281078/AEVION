"use client";

// Compact cross-module goal-progress pill for the global header. Reads the
// same two endpoints /revenue itself uses (goals + summary) so the $1M/$20M
// New Year targets stay visible from any module, not just the dashboard.
// Fetches in useEffect (never in render) so client/server hydration can't
// desync; renders nothing until the first successful read.
import { useEffect, useState } from "react";
import Link from "next/link";
import { getClientApiBase } from "@/lib/apiBase";

type Goals = { primaryUsd: number; stretchUsd: number; deadline: string };
type Summary = { grossUsd: number };

function daysUntil(deadline: string): number {
  const target = Date.parse(`${deadline}T00:00:00Z`);
  if (Number.isNaN(target)) return 0;
  return Math.max(0, Math.ceil((target - Date.now()) / 86_400_000));
}

export default function RevenueGoalBadge() {
  const [goals, setGoals] = useState<Goals | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const base = getClientApiBase();
        const [g, s] = await Promise.all([
          fetch(`${base}/api/revenue/goals`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
          fetch(`${base}/api/revenue/summary`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
        ]);
        if (alive && g && typeof g.primaryUsd === "number") setGoals(g);
        if (alive && s && typeof s.grossUsd === "number") setSummary(s);
      } catch {
        /* silent — the widget is non-critical */
      }
    };
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (!goals || !summary) return null;

  const pct = Math.min(100, (summary.grossUsd / goals.primaryUsd) * 100);
  const days = daysUntil(goals.deadline);
  const tip = `$${summary.grossUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })} собрано из $1M · ${days} дн. до цели ($20M — стретч)`;

  return (
    <Link
      href="/revenue"
      title={tip}
      aria-label={tip}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 9px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 800,
        color: "#0c4a6e",
        background: "rgba(14,165,233,0.12)",
        border: "1px solid rgba(14,165,233,0.35)",
        textDecoration: "none",
        whiteSpace: "nowrap",
      }}
    >
      <span aria-hidden>🎯</span>
      $1M: {pct >= 0.1 ? pct.toFixed(1) : pct.toFixed(2)}%
      <span style={{ fontWeight: 600, opacity: 0.75 }}>· {days}д</span>
    </Link>
  );
}
