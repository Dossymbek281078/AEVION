"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "../_lib/CurrencyContext";
import { formatCurrency } from "../_lib/currency";
import { evaluateAll, type ChallengeEval, type ChallengeStatus } from "../_lib/challenges";
import type { Operation } from "../_lib/types";
import { InfoTooltip } from "./InfoTooltip";

const STATUS_COLOR: Record<ChallengeStatus, string> = {
  active: "#0d9488",
  won: "#059669",
  lost: "#94a3b8",
};

const ICONS: Record<string, string> = {
  noSpendDay: "🛡",
  skipTipsWeek: "✨",
  save10Percent: "💎",
  subPauseMonth: "❄",
  goalSprint: "🏁",
};

export function SpendingChallenges({
  myAccountId,
  operations,
}: {
  myAccountId: string;
  operations: Operation[];
}) {
  const { t } = useI18n();
  const { code } = useCurrency();
  const [now, setNow] = useState<Date>(() => new Date());

  // Refresh hours-left every 5 minutes so the timer doesn't go stale during a long visit
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 5 * 60_000);
    return () => window.clearInterval(id);
  }, []);

  const evals = useMemo(
    () => evaluateAll(operations, myAccountId, now),
    [operations, myAccountId, now],
  );

  const wonCount = evals.filter((e) => e.status === "won").length;
  const activeCount = evals.filter((e) => e.status === "active").length;
  const totalRewardEarned = evals
    .filter((e) => e.status === "won")
    .reduce((s, e) => s + e.rewardAec, 0);

  return (
    <section style={containerStyle}>
      <div style={titleRowStyle}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{t("challenge.title")}</div>
            <InfoTooltip text={t("challenge.tooltip")} />
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            {t("challenge.subtitle")}
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
        <Stat label={t("challenge.statActive")} value={String(activeCount)} accent="#0d9488" />
        <Stat label={t("challenge.statWon")} value={String(wonCount)} accent="#059669" />
        <Stat label={t("challenge.statRewards")} value={formatCurrency(totalRewardEarned, code)} accent="#7c3aed" />
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {evals.map((e) => {
          const color = STATUS_COLOR[e.status];
          const fillPct = Math.min(100, e.progress * 100);
          const hoursStr =
            e.hoursLeft >= 24
              ? t("challenge.hoursLeft.d", {
                  d: Math.floor(e.hoursLeft / 24),
                  h: e.hoursLeft % 24,
                })
              : e.hoursLeft > 0
                ? t("challenge.hoursLeft.h", { h: e.hoursLeft })
                : t("challenge.hoursLeft.expired");
          return (
            <div
              key={e.id}
              style={{
                padding: 14,
                borderRadius: 12,
                border: `1px solid ${color}33`,
                background: e.status === "won" ? `${color}10` : "rgba(255,255,255,0.5)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 10,
                  marginBottom: 8,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 20 }}>{ICONS[e.id]}</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: "#1e293b" }}>
                      {t(`challenge.${e.id}.name`)}
                      {e.status === "won" ? (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 10,
                            color,
                            fontWeight: 800,
                            textTransform: "uppercase" as const,
                            letterSpacing: 0.5,
                          }}
                        >
                          ✓ {t("challenge.statusWon")}
                        </span>
                      ) : e.status === "lost" ? (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 10,
                            color,
                            fontWeight: 800,
                            textTransform: "uppercase" as const,
                            letterSpacing: 0.5,
                          }}
                        >
                          {t("challenge.statusLost")}
                        </span>
                      ) : null}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, lineHeight: 1.45 }}>
                      {t(`challenge.${e.id}.desc`)}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" as const }}>
                    {t("challenge.reward")}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 13, color }}>
                    +{formatCurrency(e.rewardAec, code)}
                  </div>
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{hoursStr}</div>
                </div>
              </div>

              <div
                style={{
                  height: 6,
                  borderRadius: 3,
                  background: "rgba(15,23,42,0.06)",
                  overflow: "hidden",
                  marginBottom: 6,
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
              <div style={{ fontSize: 11, color: "#475569" }}>
                {t(e.detailKey, e.detailVars)}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>
        {t("challenge.footer")}
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
