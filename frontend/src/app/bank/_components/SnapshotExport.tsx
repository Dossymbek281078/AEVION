"use client";

import { useMemo, useState } from "react";
import { achievementStats, evaluateAchievements } from "../_lib/achievements";
import { loadAdvance } from "../_lib/advance";
import { useBiometric } from "../_lib/BiometricContext";
import { loadCircles } from "../_lib/circles";
import { useCurrency } from "../_lib/CurrencyContext";
import { formatCurrency } from "../_lib/currency";
import { useEcosystemData } from "../_lib/EcosystemDataContext";
import { computePeerStanding, topPercentLabel } from "../_lib/peerRanks";
import { loadGoals } from "../_lib/savings";
import { loadSignatures } from "../_lib/signatures";
import {
  buildSnapshotSVG,
  buildSnapshotText,
  downloadSnapshot,
  type SnapshotData,
} from "../_lib/snapshot";
import { computeEcosystemTrustScore } from "../_lib/trust";
import type { Account, Operation } from "../_lib/types";

type Notify = (msg: string, type?: "success" | "error" | "info") => void;

export function SnapshotExport({
  account,
  operations,
  notify,
}: {
  account: Account;
  operations: Operation[];
  notify: Notify;
}) {
  const { royalty, chess, ecosystem } = useEcosystemData();
  const { settings: biometric } = useBiometric();
  const { code } = useCurrency();
  const [busy, setBusy] = useState<"svg" | "text" | null>(null);

  const snapshot = useMemo<SnapshotData>(() => {
    const trust = computeEcosystemTrustScore({
      account,
      operations,
      royalty,
      chess,
      ecosystem,
    });
    const peers = computePeerStanding({
      account,
      operations,
      trustScore: trust.score,
      royalty,
      chess,
      ecosystem,
    });
    const best = peers.reduce(
      (acc, r) => (r.percentile > acc.percentile ? r : acc),
      peers[0],
    );
    const achievements = evaluateAchievements({
      account,
      operations,
      royalty,
      chess,
      ecosystem,
      goals: loadGoals(),
      circles: loadCircles(),
      signatures: loadSignatures(),
      advance: loadAdvance(),
      biometricEnrolled: biometric !== null,
    });
    const stats = achievementStats(achievements);

    const earnings30d = ecosystem
      ? ecosystem.perSource.banking.last30d +
        ecosystem.perSource.qright.last30d +
        ecosystem.perSource.chess.last30d +
        ecosystem.perSource.planet.last30d
      : 0;

    return {
      accountIdShort: account.id.slice(0, 14),
      generatedAt: new Date().toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      balanceLabel: formatCurrency(account.balance, code, { decimals: 2 }),
      currencyCode: code,
      trustScore: trust.score,
      trustTier: trust.tier,
      earnings30dLabel: formatCurrency(earnings30d, code, { decimals: 0 }),
      achievementsEarned: stats.earned,
      achievementsTotal: stats.total,
      perCategory: stats.perCategory,
      peerBestLabel: best?.label ?? "",
      peerBestValue: best ? topPercentLabel(best.percentile) : "",
      peerRanks: peers,
    };
  }, [account, operations, royalty, chess, ecosystem, biometric, code]);

  const onDownload = () => {
    setBusy("svg");
    try {
      const svg = buildSnapshotSVG(snapshot);
      downloadSnapshot(svg, `aevion-snapshot-${snapshot.accountIdShort}.svg`);
      notify("Snapshot downloaded", "success");
    } catch {
      notify("Snapshot generation failed", "error");
    } finally {
      setBusy(null);
    }
  };

  const onCopyText = async () => {
    setBusy("text");
    try {
      const text = buildSnapshotText(snapshot);
      await navigator.clipboard.writeText(text);
      notify("Text summary copied", "success");
    } catch {
      notify("Clipboard blocked — try downloading SVG", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section
      style={{
        border: "1px solid rgba(14,165,233,0.22)",
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        background: "linear-gradient(135deg, rgba(14,165,233,0.06), rgba(124,58,237,0.04))",
      }}
      aria-labelledby="snapshot-heading"
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 18,
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span
              aria-hidden="true"
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "linear-gradient(135deg, #0ea5e9, #7c3aed)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                fontWeight: 900,
              }}
            >
              ⇪
            </span>
            <h2 id="snapshot-heading" style={{ fontSize: 16, fontWeight: 900, margin: 0, scrollMarginTop: 80 }}>
              Snapshot export
            </h2>
          </div>
          <p style={{ fontSize: 13, color: "#334155", lineHeight: 1.6, margin: "0 0 12px" }}>
            One-click SVG of your wallet state — balance, Trust Score, peer percentiles and
            achievements in a single shareable card. Drop it into a pitch deck, a tweet or a DM.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={onDownload}
              disabled={busy !== null}
              aria-label="Download snapshot as SVG"
              style={{
                padding: "10px 18px",
                borderRadius: 10,
                border: "none",
                background:
                  busy !== null
                    ? "#94a3b8"
                    : "linear-gradient(135deg, #0ea5e9, #7c3aed)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 800,
                cursor: busy !== null ? "default" : "pointer",
                boxShadow: "0 4px 14px rgba(14,165,233,0.3)",
              }}
            >
              {busy === "svg" ? "Generating…" : "Download SVG"}
            </button>
            <button
              onClick={() => void onCopyText()}
              disabled={busy !== null}
              aria-label="Copy summary as text"
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.12)",
                background: "#fff",
                color: "#0f172a",
                fontSize: 12,
                fontWeight: 800,
                cursor: busy !== null ? "default" : "pointer",
              }}
            >
              {busy === "text" ? "…" : "Copy summary"}
            </button>
          </div>
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: 12,
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.06)",
            boxShadow: "0 4px 14px rgba(15,23,42,0.06)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.08em",
              color: "#0369a1",
              marginBottom: 6,
            }}
          >
            AEVION BANK · SNAPSHOT PREVIEW
          </div>
          <div
            style={{
              fontSize: 11,
              color: "#64748b",
              fontFamily: "ui-monospace, monospace",
              marginBottom: 10,
            }}
          >
            {snapshot.accountIdShort}… · {snapshot.generatedAt}
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 900,
              letterSpacing: "-0.02em",
              color: "#0f172a",
              marginBottom: 4,
            }}
          >
            {snapshot.balanceLabel}
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10 }}>
            Trust {snapshot.trustScore}/100 · {snapshot.trustTier.toUpperCase()} · 30d earnings{" "}
            {snapshot.earnings30dLabel}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 6,
              fontSize: 11,
              color: "#334155",
            }}
          >
            <div style={{ fontWeight: 700 }}>
              Best: {snapshot.peerBestLabel}
              <br />
              <span style={{ color: "#0369a1", fontWeight: 800 }}>{snapshot.peerBestValue}</span>
            </div>
            <div style={{ fontWeight: 700, textAlign: "right" as const }}>
              Achievements
              <br />
              <span style={{ color: "#0f172a", fontWeight: 900, fontSize: 14 }}>
                {snapshot.achievementsEarned}
              </span>{" "}
              / {snapshot.achievementsTotal}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
