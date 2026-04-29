"use client";

import { useMemo, useState } from "react";
import {
  periodTotals,
  SOURCE_COLOR,
  SOURCE_DESCRIPTION_KEY,
  SOURCE_LABEL_KEY,
  type EarningSource,
} from "../_lib/ecosystem";
import { formatRelative } from "../_lib/format";
import { useCurrency } from "../_lib/CurrencyContext";
import { formatCurrency } from "../_lib/currency";
import { useEcosystemData } from "../_lib/EcosystemDataContext";
import { Legend, PieChart, StackedAreaChart, type StackedSeries } from "./charts";
import { Sparkline } from "./primitives";
import { SkeletonBlock } from "./Skeleton";
import { InfoTooltip } from "./InfoTooltip";
import { StatusPill } from "./StatusPill";
import { useI18n } from "@/lib/i18n";

type Period = "30d" | "90d" | "365d";
const PERIOD_DAYS: Record<Period, number> = { "30d": 30, "90d": 90, "365d": 365 };
const PERIOD_LABEL_KEY: Record<Period, string> = { "30d": "te.period.30d", "90d": "te.period.90d", "365d": "te.period.365d" };
const SOURCES: EarningSource[] = ["banking", "qright", "chess", "planet"];

function sourceIcon(s: EarningSource): string {
  return { banking: "₳", qright: "♪", chess: "♞", planet: "◉" }[s];
}

export function TotalEarningsDashboard() {
  const { t } = useI18n();
  const { ecosystem: summary } = useEcosystemData();
  const [period, setPeriod] = useState<Period>("30d");
  const { code } = useCurrency();

  const days = PERIOD_DAYS[period];
  const totals = useMemo(() => (summary ? periodTotals(summary.daily, days) : null), [summary, days]);

  const series: StackedSeries[] = useMemo(() => {
    if (!summary) return [];
    const slice = summary.daily.slice(-days);
    return SOURCES.map((src) => ({
      key: src,
      label: t(SOURCE_LABEL_KEY[src]),
      color: SOURCE_COLOR[src],
      values: slice.map((d) => d[src]),
    }));
  }, [summary, days, t]);

  if (!summary || !totals) {
    return (
      <section
        style={{
          border: "1px solid rgba(15,23,42,0.1)",
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          background: "linear-gradient(180deg, #ffffff 0%, rgba(13,148,136,0.03) 100%)",
        }}
      >
        <SkeletonBlock label={t("te.loading")} minHeight={280} />
      </section>
    );
  }

  const sliceForSpark = summary.daily.slice(-days);
  const pieData = SOURCES.map((src) => ({
    label: t(SOURCE_LABEL_KEY[src]),
    value: totals[src],
    color: SOURCE_COLOR[src],
  }));

  return (
    <section
      style={{
        border: "1px solid rgba(15,23,42,0.1)",
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        background: "linear-gradient(180deg, #ffffff 0%, rgba(13,148,136,0.03) 100%)",
      }}
      aria-labelledby="total-earnings-heading"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color: "#0f766e",
              marginBottom: 4,
            }}
          >
            {t("te.eyebrow")}
          </div>
          <h2 id="total-earnings-heading" style={{ fontSize: 18, fontWeight: 900, margin: 0, color: "#0f172a", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <InfoTooltip text={t("tip.totalEarnings")} side="bottom">
              <span>{t("te.title")}</span>
            </InfoTooltip>
            <StatusPill
              kind="partial"
              reason="Banking stream is live (real qtrade operations). QRight / CyberChess / Planet streams use seeded ecosystem data until /api/ecosystem/earnings exists."
            />
          </h2>
        </div>
        <div role="group" aria-label={t("te.period.aria")} style={{ display: "flex", gap: 4 }}>
          {(Object.keys(PERIOD_DAYS) as Period[]).map((p) => {
            const active = period === p;
            return (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                aria-pressed={active}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: active ? "1px solid #0f172a" : "1px solid rgba(15,23,42,0.12)",
                  background: active ? "#0f172a" : "#fff",
                  color: active ? "#fff" : "#334155",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {t(PERIOD_LABEL_KEY[p])}
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 20,
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ position: "relative" as const, width: 180, height: 180 }}>
            <PieChart data={pieData} size={180} thickness={22} />
            <div
              style={{
                position: "absolute" as const,
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center" as const,
              }}
            >
              <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, letterSpacing: "0.06em" }}>
                {t("te.donut.total", { period: t(PERIOD_LABEL_KEY[period]) })}
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", lineHeight: 1.1 }}>
                {formatCurrency(totals.total, code, { decimals: 0 })}
              </div>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>{code}</div>
            </div>
          </div>
          <Legend
            items={SOURCES.map((src) => ({
              label: t(SOURCE_LABEL_KEY[src]),
              color: SOURCE_COLOR[src],
              hint: formatCurrency(totals[src], code, { decimals: 0 }),
            }))}
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 8,
          }}
        >
          {SOURCES.map((src) => {
            const spark = sliceForSpark.map((d) => d[src]);
            return (
              <div
                key={src}
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: `1px solid ${SOURCE_COLOR[src]}33`,
                  background: "#fff",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      background: `${SOURCE_COLOR[src]}18`,
                      color: SOURCE_COLOR[src],
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 900,
                    }}
                  >
                    {sourceIcon(src)}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>
                    {t(SOURCE_LABEL_KEY[src])}
                  </span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.02em" }}>
                  {formatCurrency(totals[src], code)}
                </div>
                <div style={{ marginTop: 4 }}>
                  <Sparkline data={spark} width={140} height={24} color={SOURCE_COLOR[src]} />
                </div>
                <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>
                  {t(SOURCE_DESCRIPTION_KEY[src])}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase" as const,
            color: "#64748b",
            marginBottom: 6,
          }}
        >
          {t("te.stacked", { period: t(PERIOD_LABEL_KEY[period]) })}
        </div>
        <StackedAreaChart series={series} width={640} height={120} />
      </div>

      <div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase" as const,
            color: "#64748b",
            marginBottom: 8,
          }}
        >
          {t("te.recent")}
        </div>
        {summary.recent.length === 0 ? (
          <div style={{ fontSize: 12, color: "#64748b", padding: "10px 0" }}>
            {t("te.recent.empty")}
          </div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
            {summary.recent.slice(0, 5).map((ev) => (
              <li
                key={ev.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: `1px solid ${SOURCE_COLOR[ev.source]}22`,
                  background: `${SOURCE_COLOR[ev.source]}08`,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    background: `${SOURCE_COLOR[ev.source]}22`,
                    color: SOURCE_COLOR[ev.source],
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 900,
                    flexShrink: 0,
                  }}
                >
                  {sourceIcon(ev.source)}
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
                    {ev.title}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
                    {t(SOURCE_LABEL_KEY[ev.source])} · {formatRelative(ev.timestamp)}
                    {ev.meta ? ` · ${ev.meta}` : ""}
                  </div>
                </div>
                <div style={{ fontWeight: 900, fontSize: 14, color: SOURCE_COLOR[ev.source], whiteSpace: "nowrap" as const }}>
                  {formatCurrency(ev.amount, code, { sign: true })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ marginTop: 14, fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>
        {t("te.footer")}
      </div>
    </section>
  );
}
