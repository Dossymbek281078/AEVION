"use client";

import { useMemo } from "react";
import { useEcosystemData } from "../_lib/EcosystemDataContext";
import { computePeerStanding, topPercentLabel, type PeerRank } from "../_lib/peerRanks";
import { computeEcosystemTrustScore } from "../_lib/trust";
import type { Account, Operation } from "../_lib/types";
import { SkeletonBlock } from "./Skeleton";
import { InfoTooltip } from "./InfoTooltip";
import { useI18n } from "@/lib/i18n";

export function PeerStanding({
  account,
  operations,
}: {
  account: Account;
  operations: Operation[];
}) {
  const { t } = useI18n();
  const { royalty, chess, ecosystem, loaded } = useEcosystemData();

  const ranks = useMemo<PeerRank[] | null>(() => {
    if (!loaded && !ecosystem) return null;
    const trust = computeEcosystemTrustScore(
      {
        account,
        operations,
        royalty,
        chess,
        ecosystem,
      },
      t,
    );
    return computePeerStanding({
      account,
      operations,
      trustScore: trust.score,
      royalty,
      chess,
      ecosystem,
    });
  }, [account, operations, royalty, chess, ecosystem, loaded, t]);

  if (!ranks) {
    return (
      <section
        style={{
          border: "1px solid rgba(15,23,42,0.1)",
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          background: "linear-gradient(180deg, rgba(124,58,237,0.03) 0%, #ffffff 100%)",
        }}
      >
        <SkeletonBlock label={t("peer.loading")} minHeight={200} />
      </section>
    );
  }

  // Best placement among 4 dimensions — used in the header pill.
  const best = ranks.reduce(
    (acc, r) => (r.percentile > acc.percentile ? r : acc),
    ranks[0],
  );

  return (
    <section
      style={{
        border: "1px solid rgba(124,58,237,0.2)",
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        background: "linear-gradient(180deg, rgba(124,58,237,0.04) 0%, #ffffff 100%)",
      }}
      aria-labelledby="peer-standing-heading"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
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
              background: "linear-gradient(135deg, #7c3aed, #0ea5e9)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              fontWeight: 900,
            }}
          >
            ▲
          </span>
          <div>
            <h2
              id="peer-standing-heading"
              style={{ fontSize: 16, fontWeight: 900, margin: 0, color: "#4c1d95" }}
            >
              <InfoTooltip text={t("tip.peerStanding")} side="bottom">
                <span>{t("peer.title")}</span>
              </InfoTooltip>
            </h2>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
              {t("peer.subtitle", { total: ranks[0].total.toLocaleString() })}
            </div>
          </div>
        </div>
        <div
          style={{
            padding: "6px 12px",
            borderRadius: 999,
            background: "rgba(124,58,237,0.14)",
            color: "#4c1d95",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.04em",
          }}
        >
          {t("peer.bestDim", { label: t(best.labelKey), pct: topPercentLabel(best.percentile, t) })}
        </div>
      </div>

      <ul
        role="list"
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 10,
        }}
      >
        {ranks.map((r) => (
          <RankRow key={r.dimension} r={r} />
        ))}
      </ul>

      <div
        style={{
          marginTop: 10,
          fontSize: 11,
          color: "#64748b",
          lineHeight: 1.45,
        }}
      >
        {t("peer.footer")}
      </div>
    </section>
  );
}

function RankRow({ r }: { r: PeerRank }) {
  const { t } = useI18n();
  const pct = r.percentile * 100;
  const medianPos = Math.min(95, Math.max(5, 50));
  return (
    <li
      style={{
        padding: 12,
        borderRadius: 12,
        border: `1px solid ${r.color}33`,
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span
          aria-hidden="true"
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            background: `${r.color}22`,
            color: r.color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 900,
            flexShrink: 0,
          }}
        >
          {r.icon}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: "#0f172a",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap" as const,
            }}
          >
            {t(r.labelKey)}
          </div>
          <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>
            {t("peer.row.youMedian", {
              you: r.userValueLabelKey ? t(r.userValueLabelKey, r.userValueLabelVars) : r.userValueLabel,
              median: r.peerMedianLabelKey ? t(r.peerMedianLabelKey, r.peerMedianLabelVars) : r.peerMedianLabel,
            })}
          </div>
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 900,
            color: r.color,
            whiteSpace: "nowrap" as const,
          }}
        >
          {topPercentLabel(r.percentile, t)}
        </div>
      </div>

      <div
        style={{
          position: "relative" as const,
          height: 8,
          borderRadius: 999,
          background: "rgba(15,23,42,0.06)",
          overflow: "hidden",
        }}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t("peer.row.aria", { label: t(r.labelKey), n: pct.toFixed(0) })}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: `linear-gradient(90deg, ${r.color}, ${r.color}bb)`,
            transition: "width 600ms ease",
          }}
        />
        <span
          aria-hidden="true"
          style={{
            position: "absolute" as const,
            left: `${medianPos}%`,
            top: -2,
            width: 2,
            height: 12,
            background: "rgba(15,23,42,0.35)",
            transform: "translateX(-50%)",
          }}
          title={t("peer.row.medianTitle")}
        />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 10,
          color: "#64748b",
          marginTop: 4,
        }}
      >
        <span>{t("peer.row.rank", { rank: r.rank.toLocaleString(), total: r.total.toLocaleString() })}</span>
        <span style={{ fontWeight: 800, color: r.color }}>{pct.toFixed(0)}{t("peer.row.percentSuffix")}</span>
      </div>
    </li>
  );
}
