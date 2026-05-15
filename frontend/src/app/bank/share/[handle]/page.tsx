"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { TIER_COLOR, TIER_LABEL, type ReferralTier } from "../../_lib/referrals";

// Public profile / "Linktree-for-AEVION" landing page. The badge endpoint
// links here, gift links link to /bank/gift/[id], and the user can copy
// /bank/share/<handle>?score=…&tier=…&name=…&bio=… to drop in social bios.
//
// Until we have a server-side public-projection of profile data, the URL
// itself carries the snapshot. Visitors who care can verify by going
// straight to /bank — the visit is what matters for ecosystem traction.

const TRUST_TIERS = ["new", "growing", "trusted", "elite"] as const;
type TrustTier = (typeof TRUST_TIERS)[number];

type ReferralTierForLookup = ReferralTier;

const TRUST_LABEL: Record<TrustTier, string> = {
  new: "Newcomer",
  growing: "Growing",
  trusted: "Trusted",
  elite: "Elite",
};

const TRUST_COLOR: Record<TrustTier, string> = {
  new: "#94a3b8",
  growing: "#0ea5e9",
  trusted: "#0d9488",
  elite: "#d97706",
};

function isTrustTier(x: string | null): x is TrustTier {
  return x !== null && (TRUST_TIERS as readonly string[]).includes(x);
}

function isReferralTier(x: string | null): x is ReferralTierForLookup {
  return x !== null && (["starter", "advocate", "ambassador", "top-referrer"] as string[]).includes(x);
}

function gradientFor(seed: string): string {
  // Two hues derived from a quick FNV-1a so the avatar is stable per handle.
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  const a = ((h >>> 0) % 360);
  const b = (a + 60) % 360;
  return `linear-gradient(135deg, hsl(${a} 70% 55%), hsl(${b} 70% 45%))`;
}

function initialsOf(s: string): string {
  const cleaned = s.replace(/[^A-Za-zА-Яа-яҚқҒғҢңӘәӨөҰұҮүІі ]/g, "").trim();
  if (!cleaned) return s.slice(0, 2).toUpperCase();
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function ShareProfilePage() {
  const params = useParams();
  const search = useSearchParams();
  const { t } = useI18n();

  const handle = (typeof params?.handle === "string" ? params.handle : "")
    .replace(/[^A-Za-z0-9_-]/g, "")
    .slice(0, 32);

  const name = (search?.get("name") ?? "").slice(0, 36);
  const bio = (search?.get("bio") ?? "").slice(0, 280);
  const scoreRaw = parseFloat(search?.get("score") ?? "");
  const score = Number.isFinite(scoreRaw) ? Math.max(0, Math.min(1, scoreRaw)) : null;
  const tierParam = search?.get("tier");
  const trustTier: TrustTier | null = isTrustTier(tierParam ?? null) ? (tierParam as TrustTier) : null;
  const refTier: ReferralTierForLookup | null = isReferralTier(tierParam ?? null) ? (tierParam as ReferralTierForLookup) : null;

  const display = name || handle || "anon";
  const avatarBg = useMemo(() => gradientFor(display), [display]);
  const initials = useMemo(() => initialsOf(display), [display]);

  const badgeUrl = useMemo(() => {
    const u = new URLSearchParams();
    u.set("score", (score ?? 0).toFixed(3));
    u.set("tier", trustTier ?? "new");
    if (name) u.set("name", name);
    return `/bank/badge/${encodeURIComponent(handle || "anon")}?${u.toString()}`;
  }, [handle, score, trustTier, name]);

  const payUrl = useMemo(() => {
    const u = new URLSearchParams();
    u.set("to", handle || "anon");
    if (name) u.set("label", name);
    return `/bank/pay?${u.toString()}`;
  }, [handle, name]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)",
        color: "#f8fafc",
        padding: "32px 16px 56px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <Link
        href="/bank"
        style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", textDecoration: "none", fontWeight: 700, marginBottom: 22 }}
      >
        ← {t("share.backToBank")}
      </Link>

      <section
        style={{
          width: "100%",
          maxWidth: 480,
          padding: "32px 24px 28px",
          borderRadius: 22,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.10)",
          backdropFilter: "blur(8px)",
          boxShadow: "0 30px 60px rgba(0,0,0,0.40)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
          textAlign: "center" as const,
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 96,
            height: 96,
            borderRadius: "50%",
            background: avatarBg,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 32,
            fontWeight: 900,
            letterSpacing: -1,
            boxShadow: "0 12px 30px rgba(0,0,0,0.40)",
          }}
        >
          {initials}
        </div>
        <div>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.5 }}>{display}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontFamily: "ui-monospace, monospace", marginTop: 4 }}>
            @{handle || "anon"}
          </div>
        </div>

        {score != null || trustTier ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 16px",
              borderRadius: 14,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.10)",
              minWidth: 240,
              justifyContent: "center",
            }}
          >
            {score != null ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", letterSpacing: 2, textTransform: "uppercase", fontWeight: 800 }}>
                  {t("share.scoreLabel")}
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#fff", lineHeight: 1 }}>
                  {Math.round(score * 100)}
                </div>
              </div>
            ) : null}
            {trustTier ? (
              <div
                style={{
                  padding: "5px 12px",
                  borderRadius: 999,
                  background: `${TRUST_COLOR[trustTier]}26`,
                  color: TRUST_COLOR[trustTier],
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                {TRUST_LABEL[trustTier]}
              </div>
            ) : null}
            {refTier && !trustTier ? (
              <div
                style={{
                  padding: "5px 12px",
                  borderRadius: 999,
                  background: `${TIER_COLOR[refTier]}26`,
                  color: TIER_COLOR[refTier],
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                {TIER_LABEL[refTier]}
              </div>
            ) : null}
          </div>
        ) : null}

        {bio ? (
          <p style={{ fontSize: 14, lineHeight: 1.55, color: "#cbd5e1", margin: 0, maxWidth: 380 }}>{bio}</p>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
          <Link
            href={payUrl}
            style={{
              padding: "12px 20px",
              borderRadius: 12,
              background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 800,
              textDecoration: "none",
              textAlign: "center",
              boxShadow: "0 6px 18px rgba(14,165,233,0.30)",
            }}
          >
            {t("share.cta.send", { name: display })}
          </Link>
          <Link
            href={badgeUrl}
            style={{
              padding: "10px 20px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "transparent",
              color: "#e2e8f0",
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
              textAlign: "center",
            }}
          >
            {t("share.cta.viewBadge")}
          </Link>
          <Link
            href="/bank"
            style={{
              padding: "10px 20px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "transparent",
              color: "rgba(255,255,255,0.7)",
              fontSize: 12,
              fontWeight: 700,
              textDecoration: "none",
              textAlign: "center",
            }}
          >
            {t("share.cta.about")}
          </Link>
        </div>
      </section>

      <div
        style={{
          marginTop: 14,
          fontSize: 11,
          color: "rgba(255,255,255,0.45)",
          maxWidth: 480,
          textAlign: "center" as const,
          lineHeight: 1.55,
        }}
      >
        {t("share.disclaimer")}
      </div>
    </main>
  );
}
