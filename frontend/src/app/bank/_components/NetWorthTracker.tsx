"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "../_lib/CurrencyContext";
import { formatCurrency } from "../_lib/currency";
import { useEcosystemData } from "../_lib/EcosystemDataContext";
import { loadGoals, type SavingsGoal } from "../_lib/savings";
import type { Account, Operation } from "../_lib/types";
import { InfoTooltip } from "./InfoTooltip";
import { SkeletonBlock } from "./Skeleton";

type Window = "30d" | "90d" | "365d";
const WINDOW_DAYS: Record<Window, number> = { "30d": 30, "90d": 90, "365d": 365 };
const WINDOW_KEY: Record<Window, string> = {
  "30d": "te.period.30d",
  "90d": "te.period.90d",
  "365d": "te.period.365d",
};

function effect(op: Operation, myId: string): number {
  if (op.kind === "topup") return op.amount;
  if (op.from === myId) return -op.amount;
  if (op.to === myId) return op.amount;
  return 0;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type DailyPoint = { ts: number; date: string; banking: number; ecosystem: number; goals: number; total: number };

export function NetWorthTracker({
  account,
  operations,
}: {
  account: Account;
  operations: Operation[];
}) {
  const { t } = useI18n();
  const { code } = useCurrency();
  const { ecosystem } = useEcosystemData();
  const [win, setWin] = useState<Window>("90d");
  const [goals, setGoals] = useState<SavingsGoal[]>([]);

  useEffect(() => {
    setGoals(loadGoals());
  }, [account.id]);

  const series = useMemo<DailyPoint[] | null>(() => {
    if (!ecosystem) return null;
    const days = WINDOW_DAYS[win];
    const today = startOfDay(new Date());
    const start = new Date(today);
    start.setDate(today.getDate() - (days - 1));

    // Banking balance at end-of-day for each day in window — replay operations from current balance.
    const sortedOps = [...operations]
      .filter((op) => Number.isFinite(new Date(op.createdAt).getTime()))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Build per-day balance: walk back from today's balance, subtract ops as we cross day boundaries
    const bankingByDate = new Map<string, number>();
    let runningBalance = account.balance;
    let opIdx = 0;
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dEnd = d.getTime() + 86_400_000 - 1;
      // Subtract any ops that happened AFTER end-of-this-day to roll runningBalance back
      while (opIdx < sortedOps.length) {
        const ts = new Date(sortedOps[opIdx].createdAt).getTime();
        if (ts > dEnd) {
          runningBalance -= effect(sortedOps[opIdx], account.id);
          opIdx++;
        } else {
          break;
        }
      }
      bankingByDate.set(isoDate(d), Math.max(0, runningBalance));
    }

    // Cumulative ecosystem income up to end of each day
    // ecosystem.daily is a list of { date: "YYYY-MM-DD", banking, qright, chess, planet }
    // We sum qright + chess + planet (excluding banking which is already in account balance)
    const ecoCumByDate = new Map<string, number>();
    let ecoCum = 0;
    const sortedDaily = [...ecosystem.daily].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    for (const d of sortedDaily) {
      ecoCum += d.qright + d.chess + d.planet;
      ecoCumByDate.set(d.date, ecoCum);
    }
    // For days inside the window not present in ecosystem.daily, carry forward last known value.
    let lastEco = 0;
    for (const date of Array.from(bankingByDate.keys()).sort()) {
      const v = ecoCumByDate.get(date);
      if (v !== undefined) lastEco = v;
      else ecoCumByDate.set(date, lastEco);
    }

    // Goals: simple approximation — goal.currentAec * progress(elapsed/age) for each day
    // For days before goal.createdAt → 0. After → linear ramp from 0 to currentAec across the
    // span [createdAt, now]. Crude but good enough to add a third visual layer.
    const goalsValueAt = (ts: number): number => {
      let total = 0;
      for (const g of goals) {
        const created = new Date(g.createdAt).getTime();
        if (!Number.isFinite(created) || ts < created) continue;
        const ageMs = Math.max(1, Date.now() - created);
        const elapsed = Math.max(0, Math.min(ageMs, ts - created));
        total += (g.currentAec * elapsed) / ageMs;
      }
      return total;
    };

    const points: DailyPoint[] = [];
    const sortedDates = Array.from(bankingByDate.keys()).sort();
    for (const date of sortedDates) {
      const banking = bankingByDate.get(date) ?? 0;
      const eco = ecoCumByDate.get(date) ?? 0;
      const ts = new Date(date).getTime();
      const goalsVal = goalsValueAt(ts);
      points.push({
        ts,
        date,
        banking,
        ecosystem: eco,
        goals: goalsVal,
        total: banking + eco + goalsVal,
      });
    }
    return points;
  }, [account.balance, account.id, operations, ecosystem, goals, win]);

  if (!ecosystem || !series) {
    return (
      <section style={containerStyle}>
        <div style={titleRowStyle}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>{t("netWorth.title")}</div>
        </div>
        <SkeletonBlock label={t("netWorth.title")} minHeight={260} />
      </section>
    );
  }

  if (series.length < 2) {
    return (
      <section style={containerStyle}>
        <div style={titleRowStyle}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>{t("netWorth.title")}</div>
        </div>
        <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontSize: 13 }}>
          {t("netWorth.empty")}
        </div>
      </section>
    );
  }

  const current = series[series.length - 1];
  const first = series[0];
  const allTimeHigh = series.reduce((m, p) => (p.total > m.total ? p : m), series[0]);
  const delta = current.total - first.total;
  const deltaPct = first.total > 0 ? (delta / first.total) * 100 : delta > 0 ? 100 : 0;

  // Chart geometry
  const W = 760;
  const H = 220;
  const padX = 16;
  const padY = 18;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;
  const minTotal = Math.min(...series.map((p) => p.total));
  const maxTotal = Math.max(...series.map((p) => p.total));
  const padTotal = (maxTotal - minTotal) * 0.1 || Math.max(1, maxTotal * 0.1);
  const lo = Math.max(0, minTotal - padTotal);
  const hi = maxTotal + padTotal;
  const range = hi - lo || 1;
  const xAt = (i: number) => padX + (i / Math.max(series.length - 1, 1)) * innerW;
  const yAt = (v: number) => padY + (1 - (v - lo) / range) * innerH;

  // Build stacked-area paths: banking → +ecosystem → +goals (=total)
  const stackPoints = series.map((p, i) => ({
    x: xAt(i),
    bankingY: yAt(p.banking),
    ecosystemY: yAt(p.banking + p.ecosystem),
    totalY: yAt(p.total),
  }));

  const bankingPoly = stackPoints.map((s) => `${s.x},${s.bankingY}`).join(" ");
  const ecosystemPoly = stackPoints.map((s) => `${s.x},${s.ecosystemY}`).join(" ");
  const totalPoly = stackPoints.map((s) => `${s.x},${s.totalY}`).join(" ");
  const baseY = padY + innerH;

  const bankingFill = `${padX},${baseY} ${bankingPoly} ${padX + innerW},${baseY}`;
  const ecosystemFill = `${bankingPoly.split(" ").reverse().join(" ")} ${ecosystemPoly}`;
  const goalsFill = `${ecosystemPoly.split(" ").reverse().join(" ")} ${totalPoly}`;

  const windows: Window[] = ["30d", "90d", "365d"];
  const deltaColor = delta >= 0 ? "#059669" : "#dc2626";

  return (
    <section style={containerStyle}>
      <div style={titleRowStyle}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{t("netWorth.title")}</div>
            <InfoTooltip text={t("netWorth.tooltip")} />
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            {t("netWorth.subtitle")}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {windows.map((w) => (
            <button
              key={w}
              onClick={() => setWin(w)}
              style={{
                padding: "4px 10px",
                borderRadius: 8,
                border: "1px solid rgba(15,23,42,0.12)",
                background: win === w ? "#0f172a" : "transparent",
                color: win === w ? "#fff" : "#475569",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {t(WINDOW_KEY[w])}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          padding: 16,
          borderRadius: 14,
          background: "linear-gradient(135deg, #0f172a, #1e293b)",
          color: "#f1f5f9",
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.7, letterSpacing: 0.5, textTransform: "uppercase" as const }}>
              {t("netWorth.currentLabel")}
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(current.total, code)}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, opacity: 0.7 }}>
              {t("netWorth.deltaLabel", { window: t(WINDOW_KEY[win]) })}
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: deltaColor, fontVariantNumeric: "tabular-nums" }}>
              {delta >= 0 ? "+" : "−"}
              {formatCurrency(Math.abs(delta), code)} ({deltaPct >= 0 ? "+" : ""}
              {deltaPct.toFixed(0)}%)
            </div>
          </div>
        </div>
      </div>

      <div style={{ overflowX: "auto", marginBottom: 12 }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          style={{ display: "block", maxHeight: 260 }}
          role="img"
          aria-label={t("netWorth.title")}
        >
          <polygon points={bankingFill} fill="#0d9488" fillOpacity={0.85} />
          <polygon points={ecosystemFill} fill="#7c3aed" fillOpacity={0.7} />
          <polygon points={goalsFill} fill="#d97706" fillOpacity={0.6} />
          <polyline points={totalPoly} fill="none" stroke="#0f172a" strokeWidth={1.5} />
          {/* All-time high marker */}
          {allTimeHigh && allTimeHigh.total === maxTotal ? (
            <g>
              <circle
                cx={xAt(series.indexOf(allTimeHigh))}
                cy={yAt(allTimeHigh.total)}
                r={5}
                fill="#fff"
                stroke="#0f172a"
                strokeWidth={2}
              />
            </g>
          ) : null}
        </svg>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
          marginBottom: 8,
        }}
      >
        <BreakdownTile color="#0d9488" label={t("netWorth.tileBanking")} value={formatCurrency(current.banking, code)} />
        <BreakdownTile color="#7c3aed" label={t("netWorth.tileEcosystem")} value={formatCurrency(current.ecosystem, code)} />
        <BreakdownTile color="#d97706" label={t("netWorth.tileGoals")} value={formatCurrency(current.goals, code)} />
        <BreakdownTile color="#0f172a" label={t("netWorth.tileAth")} value={formatCurrency(allTimeHigh.total, code)} hint={allTimeHigh.date} />
      </div>

      <div style={{ display: "flex", gap: 14, fontSize: 11, color: "#64748b", flexWrap: "wrap" }}>
        <Legend color="#0d9488" label={t("netWorth.legendBanking")} />
        <Legend color="#7c3aed" label={t("netWorth.legendEcosystem")} />
        <Legend color="#d97706" label={t("netWorth.legendGoals")} />
      </div>
    </section>
  );
}

function BreakdownTile({
  color,
  label,
  value,
  hint,
}: {
  color: string;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div
      style={{
        padding: "10px 14px",
        borderRadius: 12,
        border: `1px solid ${color}33`,
        background: `${color}0d`,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color,
          letterSpacing: 0.5,
          textTransform: "uppercase" as const,
        }}
      >
        {label}
      </div>
      <div style={{ fontWeight: 900, fontSize: 16, color: "#1e293b", marginTop: 2 }}>
        {value}
      </div>
      {hint ? <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{hint}</div> : null}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 10, height: 10, background: color, borderRadius: 2 }} />
      {label}
    </span>
  );
}

const containerStyle = {
  border: "1px solid rgba(15,23,42,0.1)",
  borderRadius: 16,
  padding: 20,
  marginBottom: 16,
  background: "linear-gradient(180deg, #ffffff 0%, rgba(124,58,237,0.03) 100%)",
};

const titleRowStyle = {
  display: "flex",
  justifyContent: "space-between" as const,
  alignItems: "flex-start" as const,
  marginBottom: 12,
  gap: 12,
  flexWrap: "wrap" as const,
};
