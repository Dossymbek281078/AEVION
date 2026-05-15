"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "../_lib/CurrencyContext";
import { formatCurrency, type CurrencyCode } from "../_lib/currency";
import { useEcosystemData } from "../_lib/EcosystemDataContext";
import { SOURCE_LABEL_KEY } from "../_lib/ecosystem";
import { CATEGORY_LABEL_KEY } from "../_lib/spending";
import {
  generateBrief,
  loadArchive,
  persistBrief,
  type Brief,
  type BriefMood,
} from "../_lib/weeklyBrief";
import type { Operation } from "../_lib/types";
import { InfoTooltip } from "./InfoTooltip";

const MOOD_COLOR: Record<BriefMood, string> = {
  strong: "#059669",
  steady: "#0d9488",
  cautious: "#d97706",
  quiet: "#64748b",
};

const MOOD_ICON: Record<BriefMood, string> = {
  strong: "▲",
  steady: "→",
  cautious: "▼",
  quiet: "◌",
};

export function WeeklyBrief({
  accountId,
  operations,
}: {
  accountId: string;
  operations: Operation[];
}) {
  const { t, lang } = useI18n();
  const { code } = useCurrency();
  const { ecosystem } = useEcosystemData();
  const [archive, setArchive] = useState<Brief[]>([]);
  const [showArchive, setShowArchive] = useState(false);

  const brief = useMemo(() => {
    if (!ecosystem) return null;
    return generateBrief({
      accountId,
      operations,
      daily: ecosystem.daily,
    });
  }, [accountId, operations, ecosystem]);

  // Persist whenever the brief changes (different week or material data shift)
  useEffect(() => {
    if (!brief) return;
    setArchive(persistBrief(brief));
  }, [brief?.weekIso, brief?.netFlow, brief?.opCount]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setArchive(loadArchive());
  }, []);

  if (!brief) {
    return (
      <section style={containerStyle}>
        <div style={titleRowStyle}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>{t("brief.title")}</div>
        </div>
        <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontSize: 13 }}>
          {t("brief.loading")}
        </div>
      </section>
    );
  }

  const moodColor = MOOD_COLOR[brief.mood];
  const moodIcon = MOOD_ICON[brief.mood];
  const moodLabel = t(`brief.mood.${brief.mood}`);

  const deltaPct =
    brief.prevNetFlow !== 0
      ? ((brief.netFlow - brief.prevNetFlow) / Math.abs(brief.prevNetFlow)) * 100
      : brief.netFlow > 0
        ? 100
        : 0;

  const narrative = buildNarrative(brief, t, code, lang);

  return (
    <section style={containerStyle}>
      <div style={titleRowStyle}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{t("brief.title")}</div>
            <InfoTooltip text={t("brief.tooltip")} />
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            {t("brief.subtitle", { week: brief.weekIso, range: `${brief.startISO} → ${brief.endISO}` })}
          </div>
        </div>
        <button
          onClick={() => setShowArchive((s) => !s)}
          style={{
            padding: "4px 10px",
            borderRadius: 8,
            border: "1px solid rgba(15,23,42,0.12)",
            background: showArchive ? "#0f172a" : "transparent",
            color: showArchive ? "#fff" : "#475569",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {showArchive ? t("brief.hideArchive") : t("brief.showArchive", { count: archive.length })}
        </button>
      </div>

      <div
        style={{
          padding: 16,
          borderRadius: 14,
          border: `1px solid ${moodColor}33`,
          background: `${moodColor}0d`,
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 22, color: moodColor }}>{moodIcon}</span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: moodColor, letterSpacing: 0.6, textTransform: "uppercase" as const }}>
              {moodLabel}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
              {t("brief.netFlowHeader", {
                amount: `${brief.netFlow >= 0 ? "+" : "−"}${formatCurrency(Math.abs(brief.netFlow), code)}`,
              })}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.6 }}>
          {narrative}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <Stat
          label={t("brief.statIn")}
          value={formatCurrency(brief.inflowTotal, code)}
          accent="#059669"
        />
        <Stat
          label={t("brief.statOut")}
          value={formatCurrency(brief.outflowTotal, code)}
          accent="#dc2626"
        />
        <Stat
          label={t("brief.statOps")}
          value={String(brief.opCount)}
          accent="#0d9488"
        />
        <Stat
          label={t("brief.statVsLast")}
          value={`${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(0)}%`}
          accent={deltaPct >= 0 ? "#059669" : "#dc2626"}
        />
      </div>

      <div style={{ display: "grid", gap: 8, marginBottom: 4 }}>
        {brief.topEarningSource ? (
          <BulletRow
            icon="↑"
            color="#059669"
            label={t("brief.bulletTopSource", {
              src: t(SOURCE_LABEL_KEY[brief.topEarningSource.src]),
              amount: formatCurrency(brief.topEarningSource.amount, code),
            })}
          />
        ) : null}
        {brief.topSpendCategory ? (
          <BulletRow
            icon="↓"
            color="#dc2626"
            label={t("brief.bulletTopSpend", {
              cat: t(CATEGORY_LABEL_KEY[brief.topSpendCategory.cat]),
              amount: formatCurrency(brief.topSpendCategory.amount, code),
            })}
          />
        ) : null}
        {brief.anomalies > 0 ? (
          <BulletRow
            icon="!"
            color="#d97706"
            label={t("brief.bulletAnomalies", { count: brief.anomalies })}
          />
        ) : null}
        {brief.topGoal ? (
          <BulletRow
            icon="◎"
            color="#7c3aed"
            label={
              brief.topGoal.deltaPct > 0
                ? t("brief.bulletGoalCompleted", { label: brief.topGoal.label })
                : t("brief.bulletGoalProgress", {
                    label: brief.topGoal.label,
                    pct: brief.topGoal.pct,
                  })
            }
          />
        ) : null}
      </div>

      {showArchive ? (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 12,
            background: "rgba(15,23,42,0.04)",
          }}
        >
          {archive.length === 0 ? (
            <div style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", padding: 8 }}>
              {t("brief.archiveEmpty")}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {archive.map((b) => (
                <div
                  key={b.weekIso}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    background: "#fff",
                    borderRadius: 8,
                    border: "1px solid rgba(15,23,42,0.06)",
                    fontSize: 12,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, color: "#1e293b" }}>{b.weekIso}</div>
                    <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>
                      {b.startISO} → {b.endISO} · {b.opCount} {t("brief.opsShort")}
                    </div>
                  </div>
                  <div
                    style={{
                      fontWeight: 800,
                      color: b.netFlow >= 0 ? "#059669" : "#dc2626",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {b.netFlow >= 0 ? "+" : "−"}
                    {formatCurrency(Math.abs(b.netFlow), code)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function buildNarrative(
  brief: Brief,
  t: (key: string, vars?: Record<string, string | number>) => string,
  code: CurrencyCode,
  _lang: string,
): string {
  const parts: string[] = [];
  // Opening — picks template by mood.
  if (brief.opCount === 0) {
    parts.push(t("brief.narrative.quietOpen"));
  } else if (brief.mood === "strong") {
    parts.push(
      t("brief.narrative.strongOpen", {
        net: formatCurrency(brief.netFlow, code),
        ops: brief.opCount,
      }),
    );
  } else if (brief.mood === "cautious") {
    parts.push(
      t("brief.narrative.cautiousOpen", {
        out: formatCurrency(brief.outflowTotal, code),
        in: formatCurrency(brief.inflowTotal, code),
      }),
    );
  } else {
    parts.push(
      t("brief.narrative.steadyOpen", {
        in: formatCurrency(brief.inflowTotal, code),
        out: formatCurrency(brief.outflowTotal, code),
      }),
    );
  }

  // Top source / top cat
  if (brief.topEarningSource && brief.topEarningSource.amount > 0) {
    parts.push(
      t("brief.narrative.topSource", {
        src: t(SOURCE_LABEL_KEY[brief.topEarningSource.src]),
        amount: formatCurrency(brief.topEarningSource.amount, code),
      }),
    );
  }

  if (brief.topSpendCategory && brief.topSpendCategory.amount > 0) {
    parts.push(
      t("brief.narrative.topCat", {
        cat: t(CATEGORY_LABEL_KEY[brief.topSpendCategory.cat]),
        amount: formatCurrency(brief.topSpendCategory.amount, code),
      }),
    );
  }

  if (brief.anomalies > 0) {
    parts.push(t("brief.narrative.anomalies", { count: brief.anomalies }));
  }

  if (brief.topGoal && brief.topGoal.deltaPct > 0) {
    parts.push(t("brief.narrative.goalDone", { label: brief.topGoal.label }));
  }

  return parts.join(" ");
}

function BulletRow({ icon, color, label }: { icon: string; color: string; label: string }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: `${color}1a`,
          color,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          fontSize: 11,
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <span style={{ color: "#334155" }}>{label}</span>
    </div>
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
  background: "linear-gradient(180deg, #ffffff 0%, rgba(124,58,237,0.04) 100%)",
};

const titleRowStyle = {
  display: "flex",
  justifyContent: "space-between" as const,
  alignItems: "flex-start" as const,
  marginBottom: 12,
  gap: 12,
  flexWrap: "wrap" as const,
};
