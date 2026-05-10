"use client";

import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "../_lib/CurrencyContext";
import { formatCurrency } from "../_lib/currency";
import { CATEGORY_COLOR, CATEGORY_LABEL_KEY } from "../_lib/spending";
import { computeSpendForecast } from "../_lib/spendForecast";
import type { Operation } from "../_lib/types";
import { InfoTooltip } from "./InfoTooltip";

export function SpendForecast({
  myAccountId,
  operations,
}: {
  myAccountId: string;
  operations: Operation[];
}) {
  const { t } = useI18n();
  const { code } = useCurrency();

  const forecast = useMemo(
    () => computeSpendForecast(operations, myAccountId),
    [operations, myAccountId],
  );

  const totalCurrent = forecast.categories.reduce((s, c) => s + c.currentMonth, 0);
  const totalPrev = forecast.categories.reduce((s, c) => s + c.prevMonth, 0);
  const projDelta = forecast.total.projected - totalPrev;
  const projDeltaPct =
    totalPrev > 0 ? (projDelta / totalPrev) * 100 : projDelta > 0 ? 100 : 0;

  return (
    <section style={containerStyle}>
      <div style={titleRowStyle}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{t("spendForecast.title")}</div>
            <InfoTooltip text={t("spendForecast.tooltip")} />
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            {t("spendForecast.subtitle")}
          </div>
        </div>
      </div>

      <div
        style={{
          padding: 16,
          borderRadius: 14,
          background: "linear-gradient(135deg, #1e293b, #0f172a)",
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
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                opacity: 0.7,
                letterSpacing: 0.5,
                textTransform: "uppercase" as const,
              }}
            >
              {t("spendForecast.projectedTitle")}
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(forecast.total.projected, code)}
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
              {t("spendForecast.range", {
                low: formatCurrency(forecast.total.low, code),
                high: formatCurrency(forecast.total.high, code),
              })}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, opacity: 0.7 }}>{t("spendForecast.vsPrev")}</div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: projDelta > 0 ? "#fca5a5" : "#86efac",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {projDelta >= 0 ? "+" : "−"}
              {formatCurrency(Math.abs(projDelta), code)} ({projDeltaPct >= 0 ? "+" : ""}
              {projDeltaPct.toFixed(0)}%)
            </div>
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
              {t("spendForecast.curMonthSoFar", {
                amount: formatCurrency(totalCurrent, code),
              })}
            </div>
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
        <Stat
          label={t("spendForecast.tileRecurring")}
          value={formatCurrency(forecast.recurringMonthly, code)}
          accent="#7c3aed"
        />
        <Stat
          label={t("spendForecast.tileAdHoc")}
          value={formatCurrency(forecast.adHocMonthly, code)}
          accent="#d97706"
        />
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {forecast.categories.map((c) => {
          const color = CATEGORY_COLOR[c.category];
          const ratio =
            c.projected > 0 ? Math.min(1.2, c.currentMonth / c.projected) : 0;
          const fillPct = Math.min(100, ratio * 100);
          const onTrack = ratio <= 1;
          return (
            <div
              key={c.category}
              style={{
                padding: 12,
                borderRadius: 12,
                border: `1px solid ${color}33`,
                background: `${color}06`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  flexWrap: "wrap",
                  marginBottom: 6,
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13, color: "#1e293b" }}>
                    {t(CATEGORY_LABEL_KEY[c.category])}
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 10,
                        color,
                        fontWeight: 700,
                      }}
                    >
                      {c.confidencePct}% {t("spendForecast.confidence")}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 3 }}>
                    {t("spendForecast.curVsProj", {
                      cur: formatCurrency(c.currentMonth, code),
                      proj: formatCurrency(c.projected, code),
                    })}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>
                    {t("spendForecast.range", {
                      low: formatCurrency(c.low, code),
                      high: formatCurrency(c.high, code),
                    })}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: onTrack ? "#059669" : "#dc2626",
                    }}
                  >
                    {onTrack
                      ? t("spendForecast.onTrack")
                      : t("spendForecast.overprojection")}
                  </div>
                </div>
              </div>
              <div
                style={{
                  height: 6,
                  borderRadius: 3,
                  background: "rgba(15,23,42,0.06)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${fillPct}%`,
                    height: "100%",
                    background: color,
                    transition: "width 240ms ease",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>
        {t("spendForecast.footer")}
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
  background: "linear-gradient(180deg, #ffffff 0%, rgba(220,38,38,0.03) 100%)",
};

const titleRowStyle = {
  display: "flex",
  justifyContent: "space-between" as const,
  alignItems: "flex-start" as const,
  marginBottom: 12,
  gap: 12,
  flexWrap: "wrap" as const,
};
