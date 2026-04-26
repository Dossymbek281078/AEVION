"use client";

import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { useEcosystemData } from "../_lib/EcosystemDataContext";
import {
  computeEcosystemTrustScore,
  tierColor,
  tierDescriptionKey,
  tierLabelKey,
  type TrustTier,
} from "../_lib/trust";
import type { Account, Operation } from "../_lib/types";
import { RadarChart } from "./charts";
import { InfoTooltip } from "./InfoTooltip";

export function TrustScoreCard({
  account,
  operations,
}: {
  account: Account;
  operations: Operation[];
}) {
  const { t } = useI18n();
  const { royalty, chess, ecosystem } = useEcosystemData();

  const trust = useMemo(
    () => computeEcosystemTrustScore({ account, operations, royalty, chess, ecosystem }, t),
    [account, operations, royalty, chess, ecosystem, t],
  );

  const color = tierColor[trust.tier];
  const r = 32;
  const circ = 2 * Math.PI * r;
  const dash = (trust.score / 100) * circ;

  const bankingFactors = trust.factors.filter((f) => f.cluster === "banking");
  const ecoFactors = trust.factors.filter((f) => f.cluster === "ecosystem");

  return (
    <section
      style={{
        border: "1px solid rgba(15,23,42,0.1)",
        borderRadius: 16,
        padding: 20,
        background: "#fff",
        marginBottom: 16,
      }}
      aria-labelledby="trust-heading"
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 20,
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ position: "relative" as const, width: 220, height: 220 }}>
            <RadarChart
              axes={trust.factors.map((f) => ({
                key: f.key,
                label: f.label,
                points: f.points,
                max: f.max,
              }))}
              size={220}
              color={color}
              ariaLabel={t("trust.radar.aria", { score: trust.score })}
            />
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
              <div
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: "50%",
                  background: "#fff",
                  border: `2px solid ${color}`,
                  boxShadow: "0 2px 8px rgba(15,23,42,0.06)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", lineHeight: 1 }}>
                  {trust.score}
                </div>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", marginTop: 2 }}>
                  / 100
                </div>
              </div>
            </div>
          </div>
          <svg width={0} height={0} style={{ display: "none" }}>
            <circle r={r} strokeDasharray={`${dash} ${circ}`} />
          </svg>
        </div>
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color,
              marginBottom: 4,
            }}
          >
            <InfoTooltip text={t("tip.trustScore")} side="bottom">
              <span>{t("trust.eyebrow", { tier: t(tierLabelKey[trust.tier]) })}</span>
            </InfoTooltip>
          </div>
          <h2
            id="trust-heading"
            style={{ fontSize: 18, fontWeight: 900, margin: "0 0 6px", color: "#0f172a" }}
          >
            {t("trust.title")}
          </h2>
          <p style={{ fontSize: 13, color: "#334155", lineHeight: 1.6, margin: "0 0 12px" }}>
            {t(tierDescriptionKey[trust.tier])}
          </p>
          <div style={{ display: "grid", gap: 4, fontSize: 12 }}>
            <FactorGroup title={t("trust.group.banking")} color="#0f766e" factors={bankingFactors} />
            <FactorGroup title={t("trust.group.ecosystem")} color={color} factors={ecoFactors} />
          </div>
        </div>
      </div>

      {trust.nextTier ? (
        <TierProgress
          currentTier={trust.tier}
          nextTier={trust.nextTier}
          score={trust.score}
          pointsToGo={trust.pointsToNextTier}
          color={tierColor[trust.nextTier]}
        />
      ) : null}

      {trust.checklist.length > 0 ? (
        <div style={{ marginTop: 14 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color: "#94a3b8",
              marginBottom: 8,
            }}
          >
            {t("trust.fastestWins")}
          </div>
          <ul
            role="list"
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 8,
            }}
          >
            {trust.checklist.map((item) => (
              <li
                key={item.key}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: `1px solid ${color}33`,
                  background: `${color}0a`,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    background: `${color}22`,
                    color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 900,
                    flexShrink: 0,
                  }}
                >
                  →
                </span>
                <span style={{ fontWeight: 700, color: "#0f172a", flex: 1 }}>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function TierProgress({
  currentTier,
  nextTier,
  score,
  pointsToGo,
  color,
}: {
  currentTier: TrustTier;
  nextTier: TrustTier;
  score: number;
  pointsToGo: number;
  color: string;
}) {
  const { t } = useI18n();
  const gateCurrent: Record<TrustTier, number> = { new: 0, growing: 20, trusted: 50, elite: 80 };
  const from = gateCurrent[currentTier];
  const to = gateCurrent[nextTier];
  const pct = Math.max(0, Math.min(100, ((score - from) / (to - from)) * 100));
  return (
    <div
      style={{
        marginTop: 14,
        padding: 12,
        borderRadius: 12,
        border: `1px solid ${color}33`,
        background: `linear-gradient(135deg, ${color}0a, transparent)`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 11,
          marginBottom: 6,
        }}
      >
        <InfoTooltip text={t("tip.trustTier")} side="bottom">
          <span style={{ color: "#64748b", fontWeight: 700 }}>
            {t(tierLabelKey[currentTier])} → <strong style={{ color }}>{t(tierLabelKey[nextTier])}</strong>
          </span>
        </InfoTooltip>
        <span style={{ color, fontWeight: 800 }}>
          {t("trust.tierProgress.suffix", { n: pointsToGo })}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t("trust.tierProgress.aria", { tier: t(tierLabelKey[nextTier]) })}
        style={{
          height: 6,
          borderRadius: 999,
          background: "rgba(15,23,42,0.06)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: `linear-gradient(90deg, ${color}, ${color}bb)`,
            transition: "width 600ms ease",
          }}
        />
      </div>
    </div>
  );
}

function FactorGroup({
  title,
  color,
  factors,
}: {
  title: string;
  color: string;
  factors: Array<{ key: string; label: string; points: number; max: number; hint: string }>;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase" as const,
          color: "#94a3b8",
          marginBottom: 4,
          marginTop: 4,
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 8,
        }}
      >
        {factors.map((f) => {
          const pct = (f.points / f.max) * 100;
          return (
            <div key={f.key}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 4,
                  marginBottom: 3,
                }}
              >
                <span style={{ fontWeight: 700, color: "#0f172a", fontSize: 11 }}>{f.label}</span>
                <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700 }}>
                  {f.points}
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={f.points}
                aria-valuemin={0}
                aria-valuemax={f.max}
                aria-label={`${f.label}: ${f.points} out of ${f.max}`}
                style={{
                  height: 5,
                  borderRadius: 999,
                  background: "rgba(15,23,42,0.06)",
                  overflow: "hidden",
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
              <div style={{ fontSize: 10, color: "#64748b", marginTop: 3 }}>{f.hint}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
