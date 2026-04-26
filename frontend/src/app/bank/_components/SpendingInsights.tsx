"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "../_lib/CurrencyContext";
import { formatCurrency } from "../_lib/currency";
import {
  CATEGORY_COLOR,
  CATEGORY_DESCRIPTION_KEY,
  CATEGORY_LABEL_KEY,
  PERIOD_LABEL_KEY,
  summariseSpending,
  type SpendCategory,
  type SpendingPeriod,
} from "../_lib/spending";
import type { Operation } from "../_lib/types";
import { Legend, PieChart } from "./charts";
import { InfoTooltip } from "./InfoTooltip";
import { Money } from "./Money";

const PERIODS: SpendingPeriod[] = ["thisMonth", "last30d"];

export function SpendingInsights({
  accountId,
  operations,
}: {
  accountId: string;
  operations: Operation[];
}) {
  const { t } = useI18n();
  const [period, setPeriod] = useState<SpendingPeriod>("thisMonth");
  const { code } = useCurrency();

  const summary = useMemo(
    () => summariseSpending(operations, accountId, period),
    [operations, accountId, period],
  );

  const pieData = summary.byCategory
    .filter((b) => b.amount > 0)
    .map((b) => ({
      label: t(CATEGORY_LABEL_KEY[b.category]),
      value: b.amount,
      color: CATEGORY_COLOR[b.category],
    }));

  const trendUp = summary.pctVsPrev > 0;
  const trendColor = trendUp ? "#dc2626" : "#059669";
  const noData = summary.totalSpent === 0;

  return (
    <section
      style={{
        border: "1px solid rgba(15,23,42,0.1)",
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        background: "#fff",
      }}
      aria-labelledby="spending-heading"
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
        <h2
          id="spending-heading"
          style={{ fontSize: 16, fontWeight: 900, margin: 0 }}
        >
          <InfoTooltip text={t("tip.spending")} side="bottom">
            <span>{t("si.title")}</span>
          </InfoTooltip>
        </h2>
        <div role="group" aria-label={t("si.period.aria")} style={{ display: "flex", gap: 4 }}>
          {PERIODS.map((p) => {
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

      {noData ? (
        <div
          style={{
            padding: 20,
            textAlign: "center" as const,
            fontSize: 13,
            color: "#94a3b8",
            border: "1px dashed rgba(15,23,42,0.1)",
            borderRadius: 10,
          }}
        >
          {t("si.empty", { period: t(PERIOD_LABEL_KEY[period]).toLowerCase() })}
        </div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 18,
              marginBottom: 16,
              alignItems: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div style={{ position: "relative" as const, width: 160, height: 160 }}>
                <PieChart data={pieData} size={160} thickness={20} />
                <div
                  style={{
                    position: "absolute" as const,
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none" as const,
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.06em" }}>
                    {t("si.donut.label")}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", lineHeight: 1.1 }}>
                    <Money aec={summary.totalSpent} decimals={0} />
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>{code}</div>
                </div>
              </div>
              <Legend
                items={summary.byCategory
                  .filter((b) => b.amount > 0)
                  .map((b) => ({
                    label: t(CATEGORY_LABEL_KEY[b.category]),
                    color: CATEGORY_COLOR[b.category],
                    hint: formatCurrency(b.amount, code, { decimals: 0 }),
                  }))}
              />
            </div>

            <ul
              role="list"
              style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}
            >
              {summary.byCategory.map((b) => {
                const pct = summary.totalSpent > 0 ? (b.amount / summary.totalSpent) * 100 : 0;
                const prev = summary.byCategoryPrev[b.category];
                const delta = prev > 0 ? ((b.amount - prev) / prev) * 100 : b.amount > 0 ? 100 : 0;
                const dColor = delta > 0 ? "#dc2626" : delta < 0 ? "#059669" : "#94a3b8";
                const color = CATEGORY_COLOR[b.category];
                return (
                  <li key={b.category}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 3,
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 3,
                          background: color,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                        {t(CATEGORY_LABEL_KEY[b.category])}
                      </span>
                      <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>
                        {b.count}×
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>
                        <Money aec={b.amount} />
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-valuenow={Math.round(pct)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={t("si.share.aria", { label: t(CATEGORY_LABEL_KEY[b.category]) })}
                      style={{
                        height: 4,
                        borderRadius: 999,
                        background: "rgba(15,23,42,0.06)",
                        overflow: "hidden",
                        marginBottom: 3,
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: "100%",
                          background: color,
                          transition: "width 400ms ease",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 10,
                        color: "#64748b",
                      }}
                    >
                      <span>{t(CATEGORY_DESCRIPTION_KEY[b.category])}</span>
                      {prev > 0 || b.amount > 0 ? (
                        <span style={{ color: dColor, fontWeight: 700 }}>
                          {t("si.delta", { sign: delta > 0 ? "+" : "", n: delta.toFixed(0) })}
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 10,
            }}
          >
            <InsightCard
              label={t("si.tile.trend")}
              value={`${trendUp ? "+" : ""}${summary.pctVsPrev.toFixed(0)}%`}
              hint={t("si.tile.trend.hint", { amt: formatCurrency(summary.totalSpentPrev, code, { decimals: 0 }) })}
              accent={trendColor}
            />
            <InsightCard
              label={t("si.tile.top")}
              value={summary.topCategory ? t(CATEGORY_LABEL_KEY[summary.topCategory]) : "—"}
              hint={
                summary.topCategory
                  ? formatCurrency(summary.byCategory[0].amount, code, { decimals: 0 })
                  : t("si.tile.top.empty")
              }
              accent={summary.topCategory ? CATEGORY_COLOR[summary.topCategory] : "#94a3b8"}
            />
            <InsightCard
              label={t("si.tile.biggest")}
              value={
                summary.biggestTx ? formatCurrency(summary.biggestTx.op.amount, code) : "—"
              }
              hint={
                summary.biggestTx
                  ? t(CATEGORY_LABEL_KEY[summary.biggestTx.category as SpendCategory])
                  : ""
              }
              accent={
                summary.biggestTx
                  ? CATEGORY_COLOR[summary.biggestTx.category as SpendCategory]
                  : "#94a3b8"
              }
            />
            <InsightCard
              label={t("si.tile.ops")}
              value={String(summary.count)}
              hint={t("si.tile.ops.hint")}
            />
          </div>
        </>
      )}

      <div style={{ marginTop: 14, fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
        {t("si.footer")}
      </div>
    </section>
  );
}

function InsightCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid rgba(15,23,42,0.08)",
        background: "#fff",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: "0.06em" }}>
        {label.toUpperCase()}
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 900,
          color: accent || "#0f172a",
          letterSpacing: "-0.02em",
          marginTop: 2,
        }}
      >
        {value}
      </div>
      {hint ? <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{hint}</div> : null}
    </div>
  );
}
