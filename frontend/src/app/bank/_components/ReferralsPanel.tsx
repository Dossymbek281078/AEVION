"use client";

import { useEffect, useMemo, useState } from "react";
import { useCurrency } from "../_lib/CurrencyContext";
import { formatCurrency } from "../_lib/currency";
import { formatRelative } from "../_lib/format";
import {
  computeReferralStats,
  INVITEE_BOOST_AEC,
  REFERRAL_BONUS_AEC,
  TIER_COLOR,
  TIER_DESCRIPTION,
  TIER_LABEL,
  type ReferralStats,
  type ReferralTier,
} from "../_lib/referrals";
import type { Account } from "../_lib/types";
import { Money } from "./Money";

type Notify = (msg: string, type?: "success" | "error" | "info") => void;

export function ReferralsPanel({
  account,
  notify,
}: {
  account: Account;
  notify: Notify;
}) {
  const [origin, setOrigin] = useState<string>("");
  useEffect(() => {
    if (typeof window === "undefined") return;
    setOrigin(window.location.origin);
  }, []);

  const { code } = useCurrency();

  const stats: ReferralStats = useMemo(
    () => computeReferralStats(account.id, origin || "https://aevion.bank"),
    [account.id, origin],
  );

  const accent = TIER_COLOR[stats.tier];
  const pct = stats.nextTierThreshold
    ? Math.min(100, (stats.invited / stats.nextTierThreshold) * 100)
    : 100;

  const copy = async (value: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(value);
      notify(msg, "success");
    } catch {
      notify("Clipboard blocked — copy manually", "error");
    }
  };

  const shareNative = async () => {
    const payload = {
      title: "Join me on AEVION Bank",
      text: `Use my code ${stats.code} — we both earn AEC when you join.`,
      url: stats.shareUrl,
    };
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share(payload);
      } catch {
        // user cancelled or share unsupported — fallback to clipboard
        await copy(stats.shareUrl, "Invite link copied");
      }
    } else {
      await copy(stats.shareUrl, "Invite link copied");
    }
  };

  return (
    <section
      style={{
        border: `1px solid ${accent}33`,
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        background: `linear-gradient(135deg, ${accent}08, rgba(14,165,233,0.04))`,
      }}
      aria-labelledby="referrals-heading"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            aria-hidden="true"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: accent,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              fontWeight: 900,
            }}
          >
            ✦
          </span>
          <div>
            <h2
              id="referrals-heading"
              style={{ fontSize: 16, fontWeight: 900, margin: 0, color: "#0f172a" }}
            >
              Invite & earn
            </h2>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
              Share your code — get <strong>{REFERRAL_BONUS_AEC} AEC</strong> per joiner, they get{" "}
              <strong>{INVITEE_BOOST_AEC} AEC</strong> on first top-up.
            </div>
          </div>
        </div>
        <TierBadge tier={stats.tier} color={accent} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 14,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            padding: 14,
            borderRadius: 12,
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color: "#64748b",
              marginBottom: 6,
            }}
          >
            Your referral code
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
            }}
          >
            <code
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                fontSize: 24,
                fontWeight: 900,
                color: accent,
                letterSpacing: "0.08em",
                padding: "4px 10px",
                borderRadius: 8,
                background: `${accent}12`,
                flex: 1,
                textAlign: "center" as const,
              }}
            >
              {stats.code}
            </code>
            <button
              onClick={() => void copy(stats.code, "Code copied")}
              aria-label="Copy referral code"
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.12)",
                background: "#fff",
                fontSize: 12,
                fontWeight: 800,
                color: "#334155",
                cursor: "pointer",
              }}
            >
              Copy
            </button>
          </div>
          <div
            style={{
              fontSize: 11,
              color: "#64748b",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap" as const,
              marginBottom: 10,
            }}
            title={stats.shareUrl}
          >
            {stats.shareUrl || "—"}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button
              onClick={() => void shareNative()}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: "none",
                background: accent,
                color: "#fff",
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: `0 4px 14px ${accent}44`,
              }}
            >
              Share link
            </button>
            <button
              onClick={() => void copy(stats.shareUrl, "Invite link copied")}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.12)",
                background: "#fff",
                color: "#0f172a",
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Copy link
            </button>
          </div>
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: 12,
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 10,
            }}
          >
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: "0.06em" }}>
                INVITED
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: "#0f172a",
                  letterSpacing: "-0.02em",
                  marginTop: 2,
                }}
              >
                {stats.invited}
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8" }}>people</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: "0.06em" }}>
                EARNED
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: accent,
                  letterSpacing: "-0.02em",
                  marginTop: 2,
                }}
              >
                <Money aec={stats.earnedAec} decimals={0} />
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8" }}>
                {formatCurrency(stats.earnedAec, code, { decimals: 0 })}
              </div>
            </div>
          </div>
          {stats.nextTierThreshold && stats.nextTierLabel ? (
            <>
              <div
                style={{
                  height: 6,
                  borderRadius: 999,
                  background: "rgba(15,23,42,0.06)",
                  overflow: "hidden",
                  marginBottom: 4,
                }}
                role="progressbar"
                aria-valuenow={Math.round(pct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Progress to ${TIER_LABEL[stats.nextTierLabel]} tier`}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    background: `linear-gradient(90deg, ${accent}, ${accent}bb)`,
                    transition: "width 600ms ease",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11,
                  color: "#64748b",
                }}
              >
                <span>
                  {stats.invitesToNextTier} invite
                  {stats.invitesToNextTier === 1 ? "" : "s"} to{" "}
                  <strong style={{ color: accent }}>{TIER_LABEL[stats.nextTierLabel]}</strong>
                </span>
                <span style={{ fontWeight: 800, color: accent }}>{pct.toFixed(0)}%</span>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 11, color: accent, fontWeight: 800 }}>
              You&apos;re already at the top tier — thanks for growing AEVION.
            </div>
          )}
        </div>
      </div>

      {stats.recent.length > 0 ? (
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color: "#94a3b8",
              marginBottom: 6,
            }}
          >
            Recently joined via your code
          </div>
          <ul
            role="list"
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "grid",
              gap: 6,
            }}
          >
            {stats.recent.map((r, i) => (
              <li
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(15,23,42,0.06)",
                  background: "#ffffffcc",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: `${accent}22`,
                    color: accent,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 900,
                  }}
                >
                  {r.nickname.charAt(0)}
                </span>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                  {r.nickname}
                  <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: 6 }}>
                    joined {formatRelative(r.joinedAt)}
                  </span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 900, color: accent }}>
                  +<Money aec={r.bonus} decimals={0} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div
          style={{
            padding: 14,
            fontSize: 12,
            color: "#64748b",
            border: "1px dashed rgba(15,23,42,0.1)",
            borderRadius: 10,
            lineHeight: 1.5,
          }}
        >
          No joiners yet. Share the code with friends — each joiner earns you{" "}
          <strong>{REFERRAL_BONUS_AEC} AEC</strong> once they top up.
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
        {TIER_DESCRIPTION[stats.tier]} Referral credits land automatically via{" "}
        <code>POST /api/referrals/claim</code> once the endpoint ships.
      </div>
    </section>
  );
}

function TierBadge({ tier, color }: { tier: ReferralTier; color: string }) {
  return (
    <span
      style={{
        padding: "6px 12px",
        borderRadius: 999,
        background: `${color}14`,
        color,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.06em",
        textTransform: "uppercase" as const,
      }}
    >
      {TIER_LABEL[tier]}
    </span>
  );
}
