"use client";

// Shared data hook behind the two goal-progress widgets (header pill +
// app-shell floating pill). Fetches in useEffect (never in render) so
// client/server hydration can't desync; consumers render nothing until the
// first successful read.
import { useEffect, useState } from "react";
import { getClientApiBase } from "@/lib/apiBase";

export type RevenueGoals = { primaryUsd: number; stretchUsd: number; deadline: string };
export type RevenueSummary = { grossUsd: number };

export function daysUntil(deadline: string): number {
  const target = Date.parse(`${deadline}T00:00:00Z`);
  if (Number.isNaN(target)) return 0;
  return Math.max(0, Math.ceil((target - Date.now()) / 86_400_000));
}

export function useRevenueGoal() {
  const [goals, setGoals] = useState<RevenueGoals | null>(null);
  const [summary, setSummary] = useState<RevenueSummary | null>(null);

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

  const pct = goals && summary ? Math.min(100, (summary.grossUsd / goals.primaryUsd) * 100) : null;
  const days = goals ? daysUntil(goals.deadline) : null;

  return { goals, summary, pct, days };
}
