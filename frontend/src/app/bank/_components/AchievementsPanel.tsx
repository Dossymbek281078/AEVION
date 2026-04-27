"use client";

import { useEffect, useMemo, useState } from "react";
import {
  achievementStats,
  CATEGORY_COLOR,
  CATEGORY_LABEL_KEY,
  evaluateAchievements,
  TIER_COLOR,
  type Achievement,
  type AchievementCategory,
} from "../_lib/achievements";
import { loadAdvance } from "../_lib/advance";
import { useBiometric } from "../_lib/BiometricContext";
import { CIRCLES_EVENT, loadCircles } from "../_lib/circles";
import { useEcosystemData } from "../_lib/EcosystemDataContext";
import { GOALS_EVENT, loadGoals } from "../_lib/savings";
import { loadSignatures, SIGNATURE_EVENT } from "../_lib/signatures";
import type { Account, Operation } from "../_lib/types";
import { useI18n } from "@/lib/i18n";

const FILTERS: Array<{ key: AchievementCategory | "all"; labelKey: string }> = [
  { key: "all", labelKey: "ach.filter.all" },
  { key: "banking", labelKey: "ach.filter.banking" },
  { key: "creator", labelKey: "ach.filter.creator" },
  { key: "ecosystem", labelKey: "ach.filter.ecosystem" },
  { key: "security", labelKey: "ach.filter.security" },
];

export function AchievementsPanel({
  account,
  operations,
}: {
  account: Account;
  operations: Operation[];
}) {
  const { t } = useI18n();
  const { royalty, chess, ecosystem } = useEcosystemData();
  const { settings: biometric } = useBiometric();
  const [goals, setGoals] = useState<ReturnType<typeof loadGoals>>([]);
  const [circles, setCircles] = useState<ReturnType<typeof loadCircles>>([]);
  const [signatures, setSignatures] = useState<ReturnType<typeof loadSignatures>>([]);
  const [advance, setAdvance] = useState<ReturnType<typeof loadAdvance>>(null);
  const [filter, setFilter] = useState<AchievementCategory | "all">("all");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => {
      setGoals(loadGoals());
      setCircles(loadCircles());
      setSignatures(loadSignatures());
      setAdvance(loadAdvance());
    };
    sync();
    const onFocus = () => sync();
    const onStorage = () => sync();
    // focus + storage cover cross-tab refresh; custom events cover same-tab
    // updates from useSavings / useSplits / useCircles / useSignatures.
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    window.addEventListener(SIGNATURE_EVENT, sync);
    window.addEventListener(GOALS_EVENT, sync);
    window.addEventListener(CIRCLES_EVENT, sync);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(SIGNATURE_EVENT, sync);
      window.removeEventListener(GOALS_EVENT, sync);
      window.removeEventListener(CIRCLES_EVENT, sync);
    };
  }, []);

  const list = useMemo(
    () =>
      evaluateAchievements({
        account,
        operations,
        royalty,
        chess,
        ecosystem,
        goals,
        circles,
        signatures,
        advance,
        biometricEnrolled: biometric !== null,
      }),
    [account, operations, royalty, chess, ecosystem, goals, circles, signatures, advance, biometric],
  );

  const stats = useMemo(() => achievementStats(list), [list]);

  const filtered = useMemo(() => {
    const base = filter === "all" ? list : list.filter((a) => a.category === filter);
    return [...base].sort((a, b) => {
      if (a.earned !== b.earned) return a.earned ? -1 : 1;
      return b.progress - a.progress;
    });
  }, [list, filter]);

  return (
    <section
      style={{
        border: "1px solid rgba(15,23,42,0.1)",
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        background: "#fff",
      }}
      aria-labelledby="achievements-heading"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            aria-hidden="true"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "linear-gradient(135deg, #d97706, #7c3aed)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              fontWeight: 900,
            }}
          >
            ★
          </span>
          <div>
            <h2 id="achievements-heading" style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>
              {t("ach.title")}
            </h2>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
              {t("ach.subtitle", { earned: stats.earned, total: stats.total, pct: stats.pct.toFixed(0) })}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }} role="tablist" aria-label="Filter">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            const accent = f.key === "all" ? "#0f172a" : CATEGORY_COLOR[f.key as AchievementCategory];
            return (
              <button
                key={f.key}
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(f.key)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 999,
                  border: active ? `1px solid ${accent}` : "1px solid rgba(15,23,42,0.12)",
                  background: active ? accent : "#fff",
                  color: active ? "#fff" : "#334155",
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {t(f.labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div
          role="progressbar"
          aria-valuenow={Math.round(stats.pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t("ach.aria.progress", { earned: stats.earned, total: stats.total })}
          style={{
            height: 8,
            borderRadius: 999,
            background: "rgba(15,23,42,0.06)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${stats.pct}%`,
              height: "100%",
              background: "linear-gradient(90deg, #d97706, #7c3aed)",
              transition: "width 600ms ease",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginTop: 8,
            fontSize: 11,
            color: "#64748b",
          }}
        >
          {(Object.keys(stats.perCategory) as AchievementCategory[]).map((cat) => {
            const s = stats.perCategory[cat];
            return (
              <span
                key={cat}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: `${CATEGORY_COLOR[cat]}12`,
                  color: CATEGORY_COLOR[cat],
                  fontWeight: 700,
                }}
              >
                {t(CATEGORY_LABEL_KEY[cat])} {s.earned}/{s.total}
              </span>
            );
          })}
        </div>
      </div>

      <ul
        role="list"
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 10,
        }}
      >
        {filtered.map((a) => (
          <AchievementCard key={a.id} achievement={a} />
        ))}
      </ul>
    </section>
  );
}

function AchievementCard({ achievement }: { achievement: Achievement }) {
  const { t } = useI18n();
  const { earned } = achievement;
  const tierColor = TIER_COLOR[achievement.tier];
  const catColor = CATEGORY_COLOR[achievement.category];
  const pct = Math.round(achievement.progress * 100);

  return (
    <li
      style={{
        padding: 14,
        borderRadius: 12,
        border: earned ? `1px solid ${tierColor}44` : "1px solid rgba(15,23,42,0.08)",
        background: earned
          ? `linear-gradient(135deg, ${tierColor}10, ${catColor}08)`
          : "#fafafa",
        opacity: earned ? 1 : 0.88,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        position: "relative" as const,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          aria-hidden="true"
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: earned ? tierColor : "rgba(15,23,42,0.08)",
            color: earned ? "#fff" : "#94a3b8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            fontWeight: 900,
            flexShrink: 0,
            boxShadow: earned ? `0 2px 8px ${tierColor}55` : "none",
          }}
        >
          {achievement.icon}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 900,
              color: "#0f172a",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap" as const,
            }}
          >
            {t(achievement.labelKey)}
          </div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase" as const,
              color: earned ? tierColor : "#94a3b8",
              marginTop: 1,
            }}
          >
            {achievement.tier} · {t(CATEGORY_LABEL_KEY[achievement.category])}
          </div>
        </div>
        {earned ? (
          <span
            aria-label={t("ach.card.unlocked.aria")}
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "#059669",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 900,
              flexShrink: 0,
            }}
          >
            ✓
          </span>
        ) : null}
      </div>
      <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.45 }}>
        {t(achievement.descriptionKey)}
      </div>
      <div>
        <div
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t("ach.card.aria.progress", { label: t(achievement.labelKey), pct })}
          style={{
            height: 4,
            borderRadius: 999,
            background: "rgba(15,23,42,0.06)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: earned ? tierColor : catColor,
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
            marginTop: 3,
          }}
        >
          <span>
            {achievement.progressLabelKey
              ? t(achievement.progressLabelKey, achievement.progressLabelVars)
              : achievement.progressLabel}
          </span>
          <span style={{ fontWeight: 700, color: earned ? tierColor : "#64748b" }}>{pct}%</span>
        </div>
      </div>
    </li>
  );
}
