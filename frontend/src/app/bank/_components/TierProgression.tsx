"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useEcosystemData } from "../_lib/EcosystemDataContext";
import {
  CATEGORY_COLOR,
  CATEGORY_LABEL_KEY,
  perksByTier,
  TIER_GATE,
  TIER_ORDER,
  tierIndex,
  type Perk,
  type PerkCategory,
} from "../_lib/tierPerks";
import {
  computeEcosystemTrustScore,
  tierColor,
  tierDescriptionKey,
  tierLabelKey,
  type TrustTier,
} from "../_lib/trust";
import type { Account, Operation } from "../_lib/types";

const LAST_TIER_KEY = "aevion_bank_last_tier_v1";
type Notify = (msg: string, type?: "success" | "error" | "info") => void;

export function TierProgression({
  account,
  operations,
  notify,
}: {
  account: Account;
  operations: Operation[];
  notify: Notify;
}) {
  const { t } = useI18n();
  const { royalty, chess, ecosystem } = useEcosystemData();

  const trust = useMemo(
    () => computeEcosystemTrustScore({ account, operations, royalty, chess, ecosystem }, t),
    [account, operations, royalty, chess, ecosystem, t],
  );

  const currentIdx = tierIndex(trust.tier);
  const nextTier = trust.nextTier;

  // Tier-achievement watcher: first-mount primes the baseline (no toast for
  // existing tier), subsequent upgrades trigger toast + celebrate state.
  const [celebrate, setCelebrate] = useState<boolean>(false);
  const primedRef = useRef<boolean>(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    let stored: TrustTier | null = null;
    try {
      const raw = localStorage.getItem(LAST_TIER_KEY);
      if (raw === "new" || raw === "growing" || raw === "trusted" || raw === "elite") {
        stored = raw;
      }
    } catch {
      /* ignore */
    }
    if (!primedRef.current) {
      primedRef.current = true;
      if (!stored) {
        try {
          localStorage.setItem(LAST_TIER_KEY, trust.tier);
        } catch {
          /* ignore */
        }
        return;
      }
    }
    if (!stored) return;
    const storedIdx = tierIndex(stored);
    if (currentIdx > storedIdx) {
      try {
        localStorage.setItem(LAST_TIER_KEY, trust.tier);
      } catch {
        /* ignore */
      }
      const perksUnlocked = perksByTier(trust.tier).length;
      notify(
        t("tiers.toast.tierUp", { tier: t(tierLabelKey[trust.tier]), n: perksUnlocked }),
        "success",
      );
      setCelebrate(true);
      const id = window.setTimeout(() => setCelebrate(false), 2800);
      return () => window.clearTimeout(id);
    }
    if (currentIdx < storedIdx) {
      // Rare — e.g. Trust Score dropped. Silently update baseline.
      try {
        localStorage.setItem(LAST_TIER_KEY, trust.tier);
      } catch {
        /* ignore */
      }
    }
  }, [trust.tier, currentIdx, notify, t]);

  // Position marker on the timeline — score % of max (100).
  const markerPct = Math.min(100, Math.max(0, trust.score));

  return (
    <section
      aria-labelledby="tiers-heading"
      style={{
        border: celebrate
          ? `2px solid ${tierColor[trust.tier]}`
          : "1px solid rgba(15,23,42,0.1)",
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        background: celebrate
          ? `radial-gradient(ellipse at top, ${tierColor[trust.tier]}15, #fff 70%)`
          : "#fff",
        boxShadow: celebrate
          ? `0 0 0 4px ${tierColor[trust.tier]}22, 0 8px 32px ${tierColor[trust.tier]}33`
          : undefined,
        transition: "box-shadow 400ms ease, border-color 400ms ease",
        position: "relative",
      }}
    >
      {celebrate ? (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            textAlign: "center",
            padding: "4px 12px",
            fontSize: 11,
            fontWeight: 900,
            color: "#fff",
            background: `linear-gradient(90deg, ${tierColor[trust.tier]}, ${tierColor[trust.tier]}aa)`,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            borderTopLeftRadius: 14,
            borderTopRightRadius: 14,
          }}
        >
          {t("tiers.celebrate", { tier: t(tierLabelKey[trust.tier]) })}
        </div>
      ) : null}
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
              width: 30,
              height: 30,
              borderRadius: 9,
              background: `linear-gradient(135deg, ${tierColor[trust.tier]}, ${tierColor[trust.tier]}bb)`,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: 14,
            }}
          >
            ◆
          </span>
          <div>
            <h2 id="tiers-heading" style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>
              {t("tiers.title")}
            </h2>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
              {t("tiers.subtitle")}
              {nextTier
                ? t("tiers.subtitle.toNext", { pts: trust.pointsToNextTier, tier: t(tierLabelKey[nextTier]) })
                : t("tiers.subtitle.peak")}
            </div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 11,
            fontWeight: 800,
          }}
        >
          <span
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              background: `${tierColor[trust.tier]}22`,
              color: tierColor[trust.tier],
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {t(tierLabelKey[trust.tier])} · {trust.score}
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div style={{ position: "relative", margin: "8px 0 22px", padding: "0 6px" }}>
        <div
          style={{
            position: "relative",
            height: 6,
            borderRadius: 999,
            background: "rgba(15,23,42,0.05)",
            overflow: "visible",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: `${markerPct}%`,
              height: "100%",
              borderRadius: 999,
              background: `linear-gradient(90deg, ${tierColor.new}, ${tierColor[trust.tier]})`,
              transition: "width 600ms ease",
            }}
          />
          {TIER_ORDER.map((tier) => {
            const pct = TIER_GATE[tier];
            const reached = trust.score >= pct;
            return (
              <div
                key={tier}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: `${pct}%`,
                  transform: "translate(-50%, -50%)",
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: reached ? tierColor[tier] : "#fff",
                  border: `2px solid ${reached ? tierColor[tier] : "rgba(15,23,42,0.2)"}`,
                  boxShadow: reached ? `0 0 0 3px ${tierColor[tier]}22` : "none",
                  transition: "background 200ms ease",
                }}
                aria-label={t("tiers.gate.aria", { tier: t(tierLabelKey[tier]), pct })}
              />
            );
          })}
          {/* "You are here" pointer */}
          <div
            style={{
              position: "absolute",
              top: -22,
              left: `${markerPct}%`,
              transform: "translateX(-50%)",
              fontSize: 9,
              fontWeight: 900,
              color: tierColor[trust.tier],
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              transition: "left 600ms ease",
            }}
          >
            {t("tiers.youHere", { score: trust.score })}
          </div>
        </div>
        {/* Labels under dots */}
        <div style={{ position: "relative", height: 16, marginTop: 6 }}>
          {TIER_ORDER.map((tier) => {
            const pct = TIER_GATE[tier];
            const reached = trust.score >= pct;
            return (
              <div
                key={`${tier}-label`}
                style={{
                  position: "absolute",
                  left: `${pct}%`,
                  transform: "translateX(-50%)",
                  fontSize: 10,
                  fontWeight: 800,
                  color: reached ? tierColor[tier] : "#94a3b8",
                  whiteSpace: "nowrap",
                }}
              >
                {t(tierLabelKey[tier])} <span style={{ opacity: 0.6, fontWeight: 600 }}>({pct})</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tier cards — 4 columns on desktop, stacks on mobile */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 10,
        }}
      >
        {TIER_ORDER.map((tier, i) => {
          const perks = perksByTier(tier);
          const isCurrent = tier === trust.tier;
          const isNext = nextTier === tier;
          const unlocked = i <= currentIdx;
          return (
            <TierCard
              key={tier}
              tier={tier}
              perks={perks}
              isCurrent={isCurrent}
              isNext={isNext}
              unlocked={unlocked}
              nextMilestone={isNext ? trust.checklist[0]?.label ?? null : null}
              pointsToGate={isNext ? trust.pointsToNextTier : 0}
            />
          );
        })}
      </div>

      {/* Next milestone strip */}
      {nextTier && trust.checklist.length > 0 ? (
        <div
          style={{
            marginTop: 14,
            padding: "10px 12px",
            borderRadius: 10,
            background: `${tierColor[nextTier]}0a`,
            border: `1px solid ${tierColor[nextTier]}33`,
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: tierColor[nextTier],
            }}
          >
            {t("tiers.fastestPath", { tier: t(tierLabelKey[nextTier]) })}
          </span>
          {trust.checklist.slice(0, 3).map((c, i) => (
            <span
              key={c.key}
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#334155",
                padding: "3px 9px",
                borderRadius: 999,
                background: "#fff",
                border: "1px solid rgba(15,23,42,0.08)",
              }}
            >
              {i + 1}. {c.label}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function TierCard({
  tier,
  perks,
  isCurrent,
  isNext,
  unlocked,
  nextMilestone,
  pointsToGate,
}: {
  tier: TrustTier;
  perks: Perk[];
  isCurrent: boolean;
  isNext: boolean;
  unlocked: boolean;
  nextMilestone: string | null;
  pointsToGate: number;
}) {
  const { t } = useI18n();
  const color = tierColor[tier];
  const description = t(tierDescriptionKey[tier]);

  return (
    <article
      style={{
        border: isCurrent
          ? `2px solid ${color}`
          : isNext
            ? `1px solid ${color}55`
            : "1px solid rgba(15,23,42,0.08)",
        borderRadius: 12,
        padding: 12,
        background: isCurrent
          ? `${color}08`
          : isNext
            ? `${color}05`
            : unlocked
              ? "#fff"
              : "rgba(15,23,42,0.02)",
        opacity: unlocked ? 1 : 0.78,
        display: "grid",
        gap: 8,
        minHeight: 180,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          aria-hidden="true"
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            background: unlocked ? color : "rgba(15,23,42,0.08)",
            color: unlocked ? "#fff" : "#94a3b8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 900,
          }}
        >
          {unlocked ? "✓" : TIER_GATE[tier]}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 900,
              color: unlocked ? "#0f172a" : "#64748b",
              letterSpacing: "0.02em",
            }}
          >
            {t(tierLabelKey[tier])}
          </div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: color,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {isCurrent
              ? t("tiers.card.here")
              : isNext
                ? t("tiers.card.next", { pts: pointsToGate })
                : unlocked
                  ? t("tiers.card.unlocked")
                  : t("tiers.card.locked")}
          </div>
        </div>
      </div>
      <div
        style={{
          fontSize: 10,
          color: "#64748b",
          lineHeight: 1.4,
          minHeight: 26,
        }}
      >
        {description}
      </div>
      <ul role="list" style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 4 }}>
        {perks.map((p) => (
          <PerkRow key={p.id} perk={p} unlocked={unlocked} />
        ))}
      </ul>
      {isNext && nextMilestone ? (
        <div
          style={{
            fontSize: 10,
            color: color,
            fontWeight: 800,
            marginTop: 2,
            padding: "4px 8px",
            borderRadius: 6,
            background: `${color}10`,
          }}
        >
          ⤴ {nextMilestone}
        </div>
      ) : null}
    </article>
  );
}

function PerkRow({ perk, unlocked }: { perk: Perk; unlocked: boolean }) {
  const { t } = useI18n();
  const catColor = CATEGORY_COLOR[perk.category as PerkCategory];
  return (
    <li
      style={{
        display: "grid",
        gridTemplateColumns: "18px 1fr",
        gap: 8,
        alignItems: "flex-start",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 18,
          height: 18,
          borderRadius: 5,
          background: unlocked ? `${catColor}22` : "rgba(15,23,42,0.05)",
          color: unlocked ? catColor : "#94a3b8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          fontWeight: 900,
          marginTop: 1,
        }}
      >
        {perk.icon}
      </span>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: unlocked ? "#0f172a" : "#64748b",
            lineHeight: 1.3,
          }}
          title={t(CATEGORY_LABEL_KEY[perk.category as PerkCategory])}
        >
          {t(perk.labelKey)}
        </div>
        <div
          style={{
            fontSize: 10,
            color: unlocked ? "#64748b" : "#94a3b8",
            lineHeight: 1.35,
            marginTop: 1,
          }}
        >
          {t(perk.hintKey)}
        </div>
      </div>
    </li>
  );
}
