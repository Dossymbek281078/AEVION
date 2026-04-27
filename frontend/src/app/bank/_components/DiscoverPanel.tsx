"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { InfoTooltip } from "./InfoTooltip";

type Cluster = "overview" | "earn" | "send" | "grow" | "security";

type FeatureRef = {
  id: string;
  cluster: Cluster;
  anchor?: string;
  /** Whether to mark this as freshly shipped this generation. */
  fresh?: boolean;
  emoji: string;
  /** i18n key suffix; full key = "discover.<id>.label" / ".desc" */
};

const FEATURES: FeatureRef[] = [
  { id: "suggestions", cluster: "overview", emoji: "💡", fresh: true },
  { id: "moneyFlow", cluster: "overview", anchor: "bank-anchor-flow", emoji: "🌊", fresh: true },
  { id: "netWorth", cluster: "overview", anchor: "bank-anchor-networth", emoji: "📈", fresh: true },
  { id: "ecosystemPulse", cluster: "overview", anchor: "bank-anchor-ecosystem", emoji: "🌐" },
  { id: "constellation", cluster: "overview", anchor: "bank-anchor-constellation", emoji: "✨" },

  { id: "weeklyBrief", cluster: "earn", anchor: "bank-anchor-brief", emoji: "📰", fresh: true },
  { id: "totalEarnings", cluster: "earn", emoji: "💰" },
  { id: "timeTravel", cluster: "earn", anchor: "bank-anchor-timetravel", emoji: "⏪", fresh: true },
  { id: "heatmap", cluster: "earn", anchor: "bank-anchor-heatmap", emoji: "🔥", fresh: true },
  { id: "wealthForecast", cluster: "earn", anchor: "bank-anchor-forecast", emoji: "🔮" },
  { id: "spendForecast", cluster: "earn", emoji: "🎯", fresh: true },
  { id: "spendingInsights", cluster: "earn", emoji: "🔍" },
  { id: "budgetCaps", cluster: "earn", emoji: "⚖", fresh: true },
  { id: "royalties", cluster: "earn", emoji: "♪" },
  { id: "chess", cluster: "earn", emoji: "♞" },
  { id: "autopilot", cluster: "earn", anchor: "bank-anchor-statement", emoji: "🤖" },

  { id: "subScan", cluster: "send", emoji: "🩺", fresh: true },
  { id: "cooldown", cluster: "send", anchor: "bank-anchor-cooldown", emoji: "⏳", fresh: true },
  { id: "trip", cluster: "send", anchor: "bank-anchor-trip", emoji: "✈", fresh: true },
  { id: "billingCalendar", cluster: "send", emoji: "📅", fresh: true },
  { id: "recurring", cluster: "send", anchor: "bank-anchor-recurring", emoji: "↻" },
  { id: "circles", cluster: "send", emoji: "👥" },
  { id: "gift", cluster: "send", emoji: "🎁" },
  { id: "split", cluster: "send", emoji: "✂" },

  { id: "trust", cluster: "grow", anchor: "bank-anchor-trust", emoji: "🤝" },
  { id: "tiers", cluster: "grow", anchor: "bank-anchor-tiers", emoji: "↑" },
  { id: "peer", cluster: "grow", emoji: "📊" },
  { id: "achievements", cluster: "grow", anchor: "bank-anchor-achievements", emoji: "🏆" },
  { id: "savings", cluster: "grow", emoji: "🎯" },
  { id: "goalTpl", cluster: "grow", emoji: "📋", fresh: true },
  { id: "roundUp", cluster: "grow", emoji: "🪙", fresh: true },
  { id: "challenges", cluster: "grow", anchor: "bank-anchor-challenges", emoji: "🏁", fresh: true },
  { id: "vault", cluster: "grow", anchor: "bank-anchor-vault", emoji: "🏦", fresh: true },
  { id: "pie", cluster: "grow", emoji: "🥧", fresh: true },
  { id: "loyalty", cluster: "grow", anchor: "bank-anchor-loyalty", emoji: "🎫", fresh: true },
  { id: "advance", cluster: "grow", emoji: "💸" },
  { id: "referrals", cluster: "grow", emoji: "🤝" },

  { id: "biometric", cluster: "security", emoji: "🔐" },
  { id: "vcards", cluster: "security", anchor: "bank-anchor-vcards", emoji: "💳", fresh: true },
  { id: "activity", cluster: "security", emoji: "📋" },
  { id: "audit", cluster: "security", anchor: "bank-anchor-audit-unified", emoji: "✓" },
  { id: "devices", cluster: "security", emoji: "💻" },
  { id: "snapshot", cluster: "security", emoji: "📸" },
];

const CLUSTER_LABEL_KEY: Record<Cluster, string> = {
  overview: "tab.overview",
  earn: "tab.earn",
  send: "tab.send",
  grow: "tab.grow",
  security: "tab.security",
};

export function DiscoverPanel({
  setActiveTab,
}: {
  setActiveTab: (id: Cluster) => void;
}) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<"all" | "fresh">("all");

  const visible = FEATURES.filter((f) => filter === "all" || f.fresh);
  const grouped = new Map<Cluster, FeatureRef[]>();
  for (const f of visible) {
    const arr = grouped.get(f.cluster) ?? [];
    arr.push(f);
    grouped.set(f.cluster, arr);
  }

  const freshCount = FEATURES.filter((f) => f.fresh).length;

  const goTo = (f: FeatureRef) => {
    setActiveTab(f.cluster);
    if (f.anchor && typeof document !== "undefined") {
      // Wait one frame for the tab swap to render the anchor target
      requestAnimationFrame(() => {
        const el = document.getElementById(f.anchor!);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };

  return (
    <section style={containerStyle}>
      <div style={titleRowStyle}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{t("discover.title")}</div>
            <InfoTooltip text={t("discover.tooltip")} />
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            {t("discover.subtitle", { count: FEATURES.length, fresh: freshCount })}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => setFilter("all")}
            style={tabBtn(filter === "all")}
          >
            {t("discover.filterAll")}
          </button>
          <button
            onClick={() => setFilter("fresh")}
            style={tabBtn(filter === "fresh")}
          >
            ✨ {t("discover.filterFresh")}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        {(["overview", "earn", "send", "grow", "security"] as Cluster[]).map((c) => {
          const items = grouped.get(c);
          if (!items || items.length === 0) return null;
          return (
            <div key={c}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#64748b",
                  letterSpacing: 0.5,
                  textTransform: "uppercase" as const,
                  marginBottom: 6,
                }}
              >
                {t(CLUSTER_LABEL_KEY[c])}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 6,
                }}
              >
                {items.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => goTo(f)}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "flex-start",
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: f.fresh
                        ? "1px solid rgba(13,148,136,0.4)"
                        : "1px solid rgba(15,23,42,0.06)",
                      background: f.fresh ? "rgba(13,148,136,0.04)" : "#fff",
                      cursor: "pointer",
                      textAlign: "left" as const,
                      width: "100%",
                    }}
                  >
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{f.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: 4 }}>
                        {t(`discover.${f.id}.label`)}
                        {f.fresh ? (
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 800,
                              color: "#0d9488",
                              padding: "1px 5px",
                              borderRadius: 4,
                              background: "rgba(13,148,136,0.12)",
                              letterSpacing: 0.4,
                              textTransform: "uppercase" as const,
                            }}
                          >
                            {t("discover.newBadge")}
                          </span>
                        ) : null}
                      </div>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, lineHeight: 1.4 }}>
                        {t(`discover.${f.id}.desc`)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const tabBtn = (active: boolean) =>
  ({
    padding: "4px 10px",
    borderRadius: 8,
    border: "1px solid rgba(15,23,42,0.12)",
    background: active ? "#0f172a" : "transparent",
    color: active ? "#fff" : "#475569",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  }) as const;

const containerStyle = {
  border: "1px solid rgba(15,23,42,0.1)",
  borderRadius: 16,
  padding: 20,
  marginBottom: 16,
  background: "linear-gradient(180deg, #ffffff 0%, rgba(14,165,233,0.04) 100%)",
};

const titleRowStyle = {
  display: "flex",
  justifyContent: "space-between" as const,
  alignItems: "flex-start" as const,
  marginBottom: 12,
  gap: 12,
  flexWrap: "wrap" as const,
};
