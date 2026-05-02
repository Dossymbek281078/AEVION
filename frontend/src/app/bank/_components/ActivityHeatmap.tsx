"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "../_lib/CurrencyContext";
import { formatCurrency } from "../_lib/currency";
import type { Operation } from "../_lib/types";
import { InfoTooltip } from "./InfoTooltip";

const WEEKS = 53;
const DAYS = 7;
const CELL = 12;
const GAP = 3;

type DayBucket = {
  date: Date;
  iso: string;
  net: number;
  inflow: number;
  outflow: number;
  count: number;
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function effect(op: Operation, myId: string): number {
  if (op.kind === "topup") return op.amount;
  if (op.from === myId) return -op.amount;
  if (op.to === myId) return op.amount;
  return 0;
}

const POSITIVE_SHADES = ["#dcfce7", "#86efac", "#22c55e", "#15803d", "#064e3b"];
const NEGATIVE_SHADES = ["#fee2e2", "#fca5a5", "#ef4444", "#b91c1c", "#7f1d1d"];
const EMPTY_SHADE = "#f1f5f9";

function pickShade(net: number, scaleAbs: number): string {
  if (net === 0 || scaleAbs <= 0) return EMPTY_SHADE;
  const ratio = Math.min(1, Math.abs(net) / scaleAbs);
  const idx = Math.min(4, Math.floor(ratio * 5));
  return net > 0 ? POSITIVE_SHADES[idx] : NEGATIVE_SHADES[idx];
}

export function ActivityHeatmap({
  accountId,
  operations,
}: {
  accountId: string;
  operations: Operation[];
}) {
  const { t } = useI18n();
  const { code } = useCurrency();
  const [hovered, setHovered] = useState<DayBucket | null>(null);

  const data = useMemo(() => {
    const today = startOfDay(new Date());
    // End grid on the END of this week (Saturday) so today's column lines up.
    const dow = today.getDay();
    const endOfThisWeek = new Date(today);
    endOfThisWeek.setDate(today.getDate() + (6 - dow));
    const totalDays = WEEKS * DAYS;
    const startDay = new Date(endOfThisWeek);
    startDay.setDate(endOfThisWeek.getDate() - (totalDays - 1));

    const buckets = new Map<string, DayBucket>();
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(startDay);
      d.setDate(startDay.getDate() + i);
      const iso = isoDate(d);
      buckets.set(iso, { date: d, iso, net: 0, inflow: 0, outflow: 0, count: 0 });
    }

    for (const op of operations) {
      const ts = new Date(op.createdAt).getTime();
      if (!Number.isFinite(ts)) continue;
      const day = startOfDay(new Date(ts));
      if (day < startDay || day > endOfThisWeek) continue;
      const eff = effect(op, accountId);
      if (eff === 0) continue;
      const b = buckets.get(isoDate(day));
      if (!b) continue;
      b.net += eff;
      if (eff > 0) b.inflow += eff;
      else b.outflow += -eff;
      b.count++;
    }

    const days = Array.from(buckets.values());
    const positives = days.filter((d) => d.net !== 0).map((d) => Math.abs(d.net)).sort((a, b) => a - b);
    // 90th percentile for scale to avoid one outlier flattening everything
    const scaleAbs =
      positives.length > 0
        ? positives[Math.min(positives.length - 1, Math.floor(positives.length * 0.9))]
        : 0;

    // Compute streak + totals
    let activeDays = 0;
    let posDays = 0;
    let negDays = 0;
    let totalIn = 0;
    let totalOut = 0;
    let topDay: DayBucket | null = null;
    let streak = 0;
    let bestStreak = 0;
    for (const d of days) {
      if (d.count > 0) {
        activeDays++;
        streak++;
        if (streak > bestStreak) bestStreak = streak;
      } else {
        streak = 0;
      }
      if (d.net > 0) posDays++;
      else if (d.net < 0) negDays++;
      totalIn += d.inflow;
      totalOut += d.outflow;
      if (!topDay || Math.abs(d.net) > Math.abs(topDay.net)) topDay = d;
    }

    // Build column structure: WEEKS columns × DAYS rows.
    // Column 0 starts at startDay (which is a Sunday by construction).
    const startDow = startDay.getDay();
    const cols: DayBucket[][] = [];
    for (let w = 0; w < WEEKS; w++) {
      const col: DayBucket[] = [];
      for (let r = 0; r < DAYS; r++) {
        const idx = w * DAYS + r - startDow;
        if (idx >= 0 && idx < days.length) {
          col.push(days[idx]);
        } else {
          col.push({
            date: new Date(NaN),
            iso: `pad-${w}-${r}`,
            net: 0,
            inflow: 0,
            outflow: 0,
            count: -1,
          });
        }
      }
      cols.push(col);
    }

    return { cols, scaleAbs, days, activeDays, posDays, negDays, totalIn, totalOut, topDay, bestStreak };
  }, [operations, accountId]);

  const W = WEEKS * (CELL + GAP) + 28;
  const H = DAYS * (CELL + GAP) + 24;

  const dowLabels = ["", "Mon", "", "Wed", "", "Fri", ""];
  const monthLabels = useMemo(() => {
    const labels: { x: number; text: string }[] = [];
    let lastMonth = -1;
    data.cols.forEach((col, w) => {
      const firstReal = col.find((c) => Number.isFinite(c.date.getTime()));
      if (!firstReal) return;
      const m = firstReal.date.getMonth();
      if (m !== lastMonth) {
        lastMonth = m;
        labels.push({
          x: 24 + w * (CELL + GAP),
          text: firstReal.date.toLocaleDateString(undefined, { month: "short" }),
        });
      }
    });
    return labels;
  }, [data.cols]);

  return (
    <section style={containerStyle}>
      <div style={titleRowStyle}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{t("heatmap.title")}</div>
            <InfoTooltip text={t("heatmap.tooltip")} />
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            {t("heatmap.subtitle")}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <Stat label={t("heatmap.statActive")} value={`${data.activeDays} / ${data.days.length}`} accent="#0d9488" />
        <Stat label={t("heatmap.statStreak")} value={`${data.bestStreak} ${t("heatmap.daysShort")}`} accent="#7c3aed" />
        <Stat label={t("heatmap.statIn")} value={formatCurrency(data.totalIn, code)} accent="#059669" />
        <Stat label={t("heatmap.statOut")} value={formatCurrency(data.totalOut, code)} accent="#dc2626" />
      </div>

      <div style={{ overflowX: "auto", paddingBottom: 6 }}>
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          style={{ display: "block", minWidth: W }}
          role="img"
          aria-label={t("heatmap.title")}
        >
          {monthLabels.map((m, i) => (
            <text key={i} x={m.x} y={10} fontSize={9} fill="#64748b" fontWeight={600}>
              {m.text}
            </text>
          ))}
          {dowLabels.map((d, r) =>
            d ? (
              <text
                key={r}
                x={0}
                y={20 + r * (CELL + GAP) + CELL - 2}
                fontSize={9}
                fill="#64748b"
              >
                {d}
              </text>
            ) : null,
          )}
          {data.cols.map((col, w) =>
            col.map((cell, r) => {
              if (cell.count === -1) return null;
              const isHovered = hovered?.iso === cell.iso;
              return (
                <rect
                  key={cell.iso}
                  x={24 + w * (CELL + GAP)}
                  y={16 + r * (CELL + GAP)}
                  width={CELL}
                  height={CELL}
                  rx={2}
                  fill={pickShade(cell.net, data.scaleAbs)}
                  stroke={isHovered ? "#0f172a" : "rgba(15,23,42,0.05)"}
                  strokeWidth={isHovered ? 1.5 : 0.5}
                  onMouseEnter={() => setHovered(cell)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: cell.count > 0 ? "pointer" : "default", transition: "stroke 120ms ease" }}
                >
                  <title>
                    {`${cell.iso} · ${cell.count} ${t("heatmap.opsShort")} · ${cell.net >= 0 ? "+" : "−"}${formatCurrency(Math.abs(cell.net), code)}`}
                  </title>
                </rect>
              );
            }),
          )}
        </svg>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginTop: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minHeight: 36 }}>
          {hovered ? (
            <div style={{ fontSize: 12, color: "#1e293b", fontVariantNumeric: "tabular-nums" }}>
              <strong>{hovered.iso}</strong>
              <span style={{ color: "#64748b" }}>
                {" · "}
                {hovered.count} {t("heatmap.opsShort")} · {hovered.net >= 0 ? "+" : "−"}
                {formatCurrency(Math.abs(hovered.net), code)}
              </span>
            </div>
          ) : data.topDay && data.topDay.count > 0 ? (
            <div style={{ fontSize: 12, color: "#64748b" }}>
              {t("heatmap.topDay", {
                date: data.topDay.iso,
                amount: `${data.topDay.net >= 0 ? "+" : "−"}${formatCurrency(Math.abs(data.topDay.net), code)}`,
              })}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "#94a3b8" }}>{t("heatmap.empty")}</div>
          )}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 11,
            color: "#64748b",
          }}
        >
          <span>{t("heatmap.legendOut")}</span>
          {NEGATIVE_SHADES.slice().reverse().map((c, i) => (
            <span key={`n${i}`} style={{ width: 10, height: 10, background: c, borderRadius: 2, display: "inline-block" }} />
          ))}
          <span style={{ width: 10, height: 10, background: EMPTY_SHADE, borderRadius: 2, display: "inline-block" }} />
          {POSITIVE_SHADES.map((c, i) => (
            <span key={`p${i}`} style={{ width: 10, height: 10, background: c, borderRadius: 2, display: "inline-block" }} />
          ))}
          <span>{t("heatmap.legendIn")}</span>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div
      style={{
        padding: "10px 14px",
        borderRadius: 12,
        border: `1px solid ${accent}33`,
        background: `${accent}0d`,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: accent,
          letterSpacing: 0.5,
          textTransform: "uppercase" as const,
        }}
      >
        {label}
      </div>
      <div style={{ fontWeight: 900, fontSize: 16, color: "#1e293b", marginTop: 2 }}>
        {value}
      </div>
    </div>
  );
}

const containerStyle = {
  border: "1px solid rgba(15,23,42,0.1)",
  borderRadius: 16,
  padding: 20,
  marginBottom: 16,
  background: "linear-gradient(180deg, #ffffff 0%, rgba(34,197,94,0.03) 100%)",
};

const titleRowStyle = {
  display: "flex",
  justifyContent: "space-between" as const,
  alignItems: "flex-start" as const,
  marginBottom: 12,
  gap: 12,
  flexWrap: "wrap" as const,
};
