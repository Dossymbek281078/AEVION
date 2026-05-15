"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  INVITEE_BOOST_AEC,
  REFERRAL_BONUS_AEC,
  TIER_COLOR,
  TIER_LABEL,
  type ReferralTier,
} from "../../_lib/referrals";

const PENDING_REF_KEY = "aevion_bank_pending_ref_v1";
const TOKEN_KEY = "aevion_auth_token_v1";

const TIERS: ReferralTier[] = ["starter", "advocate", "ambassador", "top-referrer"];

function isReferralTier(x: string | null): x is ReferralTier {
  return x !== null && (TIERS as string[]).includes(x);
}

export default function ReferralLandingPage() {
  const params = useParams();
  const search = useSearchParams();
  const { t } = useI18n();

  const code = (typeof params?.code === "string" ? params.code : "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 16);
  const fromRaw = (search?.get("from") ?? "").slice(0, 28);
  const fromName = fromRaw || null;
  const tierParam = search?.get("tier");
  const tier: ReferralTier | null = isReferralTier(tierParam ?? null) ? (tierParam as ReferralTier) : null;

  const [authed, setAuthed] = useState<boolean>(false);
  const [revealed, setRevealed] = useState<boolean>(false);

  // Persist the code so the auth flow can apply the bonus once
  // POST /api/referrals/claim lands on the backend.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setAuthed(Boolean(localStorage.getItem(TOKEN_KEY)));
    if (code) {
      try {
        localStorage.setItem(
          PENDING_REF_KEY,
          JSON.stringify({ code, from: fromName, savedAt: new Date().toISOString() }),
        );
      } catch {
        // ignore quota / unavailability — flow still works without persistence
      }
    }
  }, [code, fromName]);

  useEffect(() => {
    const handle = window.setTimeout(() => setRevealed(true), 250);
    return () => window.clearTimeout(handle);
  }, []);

  if (!code) {
    return <Bad t={t} />;
  }

  const continueUrl = authed ? "/bank?ref=" + code : "/auth?ref=" + code;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f172a 0%, #134e4a 50%, #1e1b4b 100%)",
        color: "#f8fafc",
        padding: "32px 16px 56px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          marginTop: 24,
          padding: "32px 28px",
          borderRadius: 24,
          background: "rgba(255,255,255,0.06)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.40)",
          transform: revealed ? "translateY(0) scale(1)" : "translateY(16px) scale(0.97)",
          opacity: revealed ? 1 : 0,
          transition: "transform 480ms cubic-bezier(0.18,0.9,0.3,1), opacity 480ms ease",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "#5eead4",
            marginBottom: 16,
          }}
        >
          AEVION · Bank
        </div>

        <h1
          style={{
            fontSize: 40,
            fontWeight: 900,
            margin: 0,
            letterSpacing: -1,
            lineHeight: 1.1,
          }}
        >
          {fromName
            ? t("referralLanding.headlineNamed", { name: fromName })
            : t("referralLanding.headline")}
        </h1>

        <div style={{ fontSize: 15, color: "#cbd5e1", marginTop: 14, lineHeight: 1.55 }}>
          {t("referralLanding.body", {
            invitee: String(INVITEE_BOOST_AEC),
            referrer: String(REFERRAL_BONUS_AEC),
          })}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            margin: "22px 0",
            padding: "14px 16px",
            borderRadius: 14,
            background: "rgba(15,23,42,0.55)",
            border: "1px solid rgba(94,234,212,0.20)",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: tier ? TIER_COLOR[tier] : "#475569",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 900,
              flexShrink: 0,
            }}
          >
            ★
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 800, letterSpacing: 2, textTransform: "uppercase" }}>
              {t("referralLanding.codeLabel")}
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, fontFamily: "ui-monospace, monospace", letterSpacing: 1 }}>
              {code}
            </div>
            {tier ? (
              <div style={{ fontSize: 11, color: TIER_COLOR[tier], fontWeight: 800, marginTop: 4, textTransform: "uppercase", letterSpacing: 1 }}>
                {TIER_LABEL[tier]}
              </div>
            ) : null}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Link
            href={continueUrl}
            style={{
              display: "block",
              padding: "14px 22px",
              borderRadius: 12,
              background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
              color: "#fff",
              fontSize: 15,
              fontWeight: 800,
              textDecoration: "none",
              textAlign: "center",
              letterSpacing: 0.3,
              boxShadow: "0 8px 24px rgba(14,165,233,0.30)",
            }}
          >
            {authed ? t("referralLanding.cta.continue") : t("referralLanding.cta.signup")}
          </Link>
          {!authed ? (
            <Link
              href={`/auth?ref=${code}&login=1`}
              style={{
                display: "block",
                padding: "12px 22px",
                borderRadius: 12,
                background: "transparent",
                color: "#cbd5e1",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
                textAlign: "center",
                border: "1px solid rgba(255,255,255,0.18)",
              }}
            >
              {t("referralLanding.cta.login")}
            </Link>
          ) : null}
        </div>
      </div>

      <div
        style={{
          marginTop: 22,
          maxWidth: 560,
          width: "100%",
          padding: "16px 18px",
          borderRadius: 14,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          fontSize: 12,
          color: "#94a3b8",
          lineHeight: 1.55,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#5eead4", marginBottom: 6 }}>
          {t("referralLanding.about.label")}
        </div>
        {t("referralLanding.about.body")}
      </div>

      <Link
        href="/"
        style={{ marginTop: 22, fontSize: 11, color: "rgba(255,255,255,0.55)", textDecoration: "none" }}
      >
        ← {t("referralLanding.backHome")}
      </Link>
    </main>
  );
}

function Bad({ t }: { t: (k: string) => string }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f172a",
        color: "#fff",
        padding: 24,
      }}
    >
      <div style={{ fontSize: 48, opacity: 0.3, marginBottom: 12 }} aria-hidden="true">
        ⊘
      </div>
      <div style={{ fontSize: 18, fontWeight: 800 }}>{t("referralLanding.bad.title")}</div>
      <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 6, maxWidth: 400, textAlign: "center" }}>
        {t("referralLanding.bad.body")}
      </div>
      <Link
        href="/auth"
        style={{
          marginTop: 18,
          padding: "10px 20px",
          borderRadius: 10,
          background: "#0d9488",
          color: "#fff",
          fontSize: 13,
          fontWeight: 800,
          textDecoration: "none",
        }}
      >
        {t("referralLanding.bad.cta")}
      </Link>
    </main>
  );
}
