"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "../_lib/CurrencyContext";
import { formatCurrency } from "../_lib/currency";
import type { Account, Operation } from "../_lib/types";
import { InfoTooltip } from "./InfoTooltip";

type Window = "30d" | "90d" | "365d";
const WINDOW_DAYS: Record<Window, number> = { "30d": 30, "90d": 90, "365d": 365 };
const WINDOW_KEY: Record<Window, string> = {
  "30d": "te.period.30d",
  "90d": "te.period.90d",
  "365d": "te.period.365d",
};

type Snapshot = {
  ts: number;
  balance: number;
};

// Effect of an op on MY balance at the moment it was applied:
//  topup     → +amount
//  transfer where from = me → -amount
//  transfer where to   = me → +amount
function effect(op: Operation, myId: string): number {
  if (op.kind === "topup") return op.amount;
  if (op.from === myId) return -op.amount;
  if (op.to === myId) return op.amount;
  return 0;
}

function isoDay(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export function TimeTravel({
  account,
  operations,
}: {
  account: Account;
  operations: Operation[];
}) {
  const { t } = useI18n();
  const { code } = useCurrency();
  const [win, setWin] = useState<Window>("90d");
  const [pct, setPct] = useState(100); // 100 = now, 0 = start of window

  const series = useMemo(() => {
    const days = WINDOW_DAYS[win];
    const now = Date.now();
    const start = now - days * 86_400_000;
    // Walk operations newest→oldest, subtract effect to compute balance going back in time.
    const sorted = [...operations]
      .filter((op) => Number.isFinite(new Date(op.createdAt).getTime()))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const points: Snapshot[] = [];
    points.push({ ts: now, balance: account.balance });

    let runningBalance = account.balance;
    for (const op of sorted) {
      const ts = new Date(op.createdAt).getTime();
      // Subtract this op's effect → balance just BEFORE it.
      runningBalance -= effect(op, account.id);
      points.push({ ts, balance: runningBalance });
      if (ts < start) break;
    }
    // Anchor a point at window start so the slider always has a left endpoint.
    if (points.length === 0 || points[points.length - 1].ts > start) {
      points.push({ ts: start, balance: runningBalance });
    }
    return points.sort((a, b) => a.ts - b.ts);
  }, [operations, account.balance, account.id, win]);

  const range = useMemo(() => {
    if (series.length === 0) return null;
    const first = series[0];
    const last = series[series.length - 1];
    const span = last.ts - first.ts || 1;
    const cursorTs = first.ts + (span * pct) / 100;
    // Find balance at cursorTs (linear scan; series is small)
    let balanceAt = first.balance;
    for (const p of series) {
      if (p.ts <= cursorTs) balanceAt = p.balance;
      else break;
    }
    const change = balanceAt - first.balance;
    const changeNow = account.balance - balanceAt;
    return { first, last, cursorTs, balanceAt, change, changeNow, span };
  }, [series, pct, account.balance]);

  // Operations near the cursor (±36h)
  const nearby = useMemo(() => {
    if (!range) return [];
    const window = 36 * 3600 * 1000;
    return operations
      .filter((op) => {
        const ts = new Date(op.createdAt).getTime();
        return Number.isFinite(ts) && Math.abs(ts - range.cursorTs) <= window;
      })
      .sort(
        (a, b) =>
          Math.abs(new Date(a.createdAt).getTime() - range.cursorTs) -
          Math.abs(new Date(b.createdAt).getTime() - range.cursorTs),
      )
      .slice(0, 5);
  }, [operations, range]);

  // SVG line chart geometry
  const chart = useMemo(() => {
    if (series.length === 0 || !range) return null;
    const W = 720;
    const H = 140;
    const padX = 12;
    const padY = 16;
    const innerW = W - padX * 2;
    const innerH = H - padY * 2;
    const minB = Math.min(...series.map((p) => p.balance));
    const maxB = Math.max(...series.map((p) => p.balance));
    const padB = (maxB - minB) * 0.1 || Math.max(1, Math.abs(maxB) * 0.1);
    const lo = minB - padB;
    const hi = maxB + padB;
    const rangeB = hi - lo || 1;
    const xAt = (ts: number) =>
      padX + ((ts - range.first.ts) / Math.max(range.span, 1)) * innerW;
    const yAt = (b: number) => padY + (1 - (b - lo) / rangeB) * innerH;
    const linePts = series.map((p) => `${xAt(p.ts)},${yAt(p.balance)}`).join(" ");
    const fillPts = `${padX},${padY + innerH} ${linePts} ${padX + innerW},${padY + innerH}`;
    const cursorX = xAt(range.cursorTs);
    const cursorY = yAt(range.balanceAt);
    return { W, H, linePts, fillPts, cursorX, cursorY, padX, padY, innerH };
  }, [series, range]);

  if (!range || !chart) {
    return (
      <section style={containerStyle}>
        <div style={titleRowStyle}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>{t("timeTravel.title")}</div>
        </div>
        <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontSize: 13 }}>
          {t("timeTravel.empty")}
        </div>
      </section>
    );
  }

  const cursorDate = new Date(range.cursorTs);
  const dateLabel = cursorDate.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const isNow = pct >= 99;
  const windows: Window[] = ["30d", "90d", "365d"];
  const changeColor = range.change >= 0 ? "#059669" : "#dc2626";
  const changeNowColor = range.changeNow >= 0 ? "#0d9488" : "#dc2626";

  return (
    <section style={containerStyle}>
      <div style={titleRowStyle}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{t("timeTravel.title")}</div>
            <InfoTooltip text={t("timeTravel.tooltip")} />
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            {t("timeTravel.subtitle")}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {windows.map((w) => (
            <button
              key={w}
              onClick={() => {
                setWin(w);
                setPct(100);
              }}
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
          padding: 14,
          borderRadius: 12,
          border: "1px solid rgba(15,23,42,0.08)",
          background: "linear-gradient(135deg, #0f172a, #1e293b)",
          color: "#f1f5f9",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.7, letterSpacing: 0.5 }}>
              {isNow ? t("timeTravel.now") : t("timeTravel.atDate", { date: dateLabel })}
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(range.balanceAt, code)}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
            <div style={{ fontSize: 11, opacity: 0.7 }}>
              {t("timeTravel.sinceStart")}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: changeColor }}>
              {range.change >= 0 ? "+" : "−"}{formatCurrency(Math.abs(range.change), code)}
            </div>
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
              {t("timeTravel.toToday")}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: changeNowColor }}>
              {range.changeNow >= 0 ? "+" : "−"}{formatCurrency(Math.abs(range.changeNow), code)}
            </div>
          </div>
        </div>
      </div>

      <div style={{ position: "relative", marginBottom: 4 }}>
        <svg
          viewBox={`0 0 ${chart.W} ${chart.H}`}
          width="100%"
          style={{ display: "block", maxHeight: 180 }}
          role="img"
          aria-label={t("timeTravel.chartLabel")}
        >
          <defs>
            <linearGradient id="tt-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#0d9488" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#0d9488" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <polyline points={chart.fillPts} fill="url(#tt-fill)" stroke="none" />
          <polyline
            points={chart.linePts}
            fill="none"
            stroke="#0d9488"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line
            x1={chart.cursorX}
            x2={chart.cursorX}
            y1={chart.padY}
            y2={chart.padY + chart.innerH}
            stroke="#0f172a"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            opacity={0.6}
          />
          <circle
            cx={chart.cursorX}
            cy={chart.cursorY}
            r={6}
            fill="#0f172a"
            stroke="#fff"
            strokeWidth={2}
          />
        </svg>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        step={0.5}
        value={pct}
        onChange={(e) => setPct(Number(e.target.value))}
        aria-label={t("timeTravel.sliderLabel")}
        style={{
          width: "100%",
          accentColor: "#0d9488",
          cursor: "ew-resize",
          marginBottom: 6,
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 10,
          color: "#64748b",
          marginBottom: 14,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span>{isoDay(range.first.ts)}</span>
        <span>{isoDay(range.last.ts)}</span>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        <ScrubButton onClick={() => setPct(0)}>{t("timeTravel.jumpStart")}</ScrubButton>
        <ScrubButton onClick={() => setPct(50)}>{t("timeTravel.jumpMid")}</ScrubButton>
        <ScrubButton onClick={() => setPct(100)}>{t("timeTravel.jumpNow")}</ScrubButton>
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: 0.4, textTransform: "uppercase" as const, marginBottom: 8 }}>
          {t("timeTravel.nearbyOps")}
        </div>
        {nearby.length === 0 ? (
          <div style={{ fontSize: 12, color: "#94a3b8", padding: "8px 0" }}>
            {t("timeTravel.noNearby")}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {nearby.map((op) => {
              const eff = effect(op, account.id);
              const sign = eff > 0 ? "+" : eff < 0 ? "−" : "";
              const color = eff > 0 ? "#059669" : eff < 0 ? "#dc2626" : "#64748b";
              const dt = new Date(op.createdAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
              const label =
                op.kind === "topup"
                  ? t("timeTravel.opTopup")
                  : op.from === account.id
                    ? t("timeTravel.opOut", { to: shortId(op.to) })
                    : t("timeTravel.opIn", { from: shortId(op.from) });
              return (
                <div
                  key={op.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    borderRadius: 10,
                    background: "rgba(15,23,42,0.04)",
                    fontSize: 12,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, color: "#1e293b" }}>{label}</div>
                    <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>{dt}</div>
                  </div>
                  <div style={{ fontWeight: 800, color, fontVariantNumeric: "tabular-nums" }}>
                    {sign}{formatCurrency(Math.abs(eff), code)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function shortId(id: string | null): string {
  if (!id) return "—";
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function ScrubButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "4px 10px",
        borderRadius: 8,
        border: "1px solid rgba(15,23,42,0.12)",
        background: "transparent",
        color: "#475569",
        fontSize: 11,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

const containerStyle = {
  border: "1px solid rgba(15,23,42,0.1)",
  borderRadius: 16,
  padding: 20,
  marginBottom: 16,
  background: "linear-gradient(180deg, #ffffff 0%, rgba(2,132,199,0.03) 100%)",
};

const titleRowStyle = {
  display: "flex",
  justifyContent: "space-between" as const,
  alignItems: "flex-start" as const,
  marginBottom: 12,
  gap: 12,
  flexWrap: "wrap" as const,
};
