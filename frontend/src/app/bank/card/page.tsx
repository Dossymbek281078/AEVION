"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { InstallBanner } from "../_components/InstallBanner";
import { QRCodeView } from "../_components/QRCode";
import { SubrouteFooter } from "../_components/SubrouteFooter";
import { fetchMe, listAccounts, listOperations } from "../_lib/api";
import { fetchChessSummary, type ChessSummary } from "../_lib/chess";
import { fetchEcosystemEarnings, type EcosystemEarningsSummary } from "../_lib/ecosystem";
import { fetchRoyaltyStream, type RoyaltyStreamSummary } from "../_lib/royalties";
import { formatCurrency, loadCurrency, type CurrencyCode } from "../_lib/currency";
import {
  computeEcosystemTrustScore,
  tierColor,
  tierLabelKey,
  type TrustTier,
} from "../_lib/trust";
import type { Account, Me, Operation } from "../_lib/types";

// Theme palette for the card. Two faces (front/back) share a gradient
// derived from the user's tier so the artefact feels personalised.
const TIER_GRADIENT: Record<TrustTier, string> = {
  new: "linear-gradient(135deg, #1e293b 0%, #475569 60%, #1e293b 100%)",
  growing: "linear-gradient(135deg, #064e3b 0%, #0d9488 55%, #134e4a 100%)",
  trusted: "linear-gradient(135deg, #312e81 0%, #6d28d9 55%, #1e1b4b 100%)",
  elite: "linear-gradient(135deg, #78350f 0%, #d97706 50%, #422006 100%)",
};

const TIER_FOIL: Record<TrustTier, string> = {
  new: "rgba(148,163,184,0.55)",
  growing: "rgba(94,234,212,0.65)",
  trusted: "rgba(196,181,253,0.65)",
  elite: "rgba(252,211,77,0.75)",
};

export default function WalletCardPage() {
  const { t, lang } = useI18n();
  const [me, setMe] = useState<Me | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [royalty, setRoyalty] = useState<RoyaltyStreamSummary | null>(null);
  const [chess, setChess] = useState<ChessSummary | null>(null);
  const [ecosystem, setEcosystem] = useState<EcosystemEarningsSummary | null>(null);
  const [code, setCode] = useState<CurrencyCode>("AEC");
  const [hideBalance, setHideBalance] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [origin, setOrigin] = useState<string>("");

  useEffect(() => {
    setCode(loadCurrency());
    if (typeof window !== "undefined") setOrigin(window.location.origin);
    let cancelled = false;
    (async () => {
      try {
        const [m, a, o] = await Promise.all([fetchMe(), listAccounts(), listOperations()]);
        if (cancelled) return;
        setMe(m);
        setAccounts(a);
        setOperations(o);
      } catch {
        // offline ok — render in placeholder mode
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const account = accounts[0] ?? null;

  useEffect(() => {
    if (!account) return;
    let cancelled = false;
    void fetchRoyaltyStream(account.id).then((r) => !cancelled && setRoyalty(r));
    void fetchChessSummary(account.id).then((c) => !cancelled && setChess(c));
    void fetchEcosystemEarnings({ accountId: account.id, operations }).then(
      (e) => !cancelled && setEcosystem(e),
    );
    return () => {
      cancelled = true;
    };
  }, [account, operations]);

  const trust = useMemo(() => {
    if (!account) return null;
    return computeEcosystemTrustScore({ account, operations, royalty, chess, ecosystem }, t);
  }, [account, operations, royalty, chess, ecosystem, t]);

  const tier: TrustTier = trust?.tier ?? "new";
  const score = trust?.score ?? 0;

  // Last-4 of the opaque account uuid — purely cosmetic, but mimics the
  // real-card pattern users instinctively scan for.
  const last4 = useMemo(() => {
    if (!account) return "····";
    const hex = account.id.replace(/[^0-9a-f]/gi, "");
    return hex.slice(-4).toUpperCase().padStart(4, "·");
  }, [account]);

  const ownerName = me?.name || account?.owner || "AEVION USER";
  const memberSince = useMemo(() => {
    if (!account) return "—";
    try {
      const d = new Date(account.createdAt);
      return new Intl.DateTimeFormat(lang === "kk" ? "kk-KZ" : lang === "ru" ? "ru-RU" : "en-US", {
        month: "short",
        year: "2-digit",
      })
        .format(d)
        .toUpperCase();
    } catch {
      return "—";
    }
  }, [account, lang]);

  const balanceText = account
    ? hideBalance
      ? "··· ···"
      : formatCurrency(account.balance, code)
    : "—";

  const cardUrl = origin && account ? `${origin}/bank/share/${last4.toLowerCase()}` : "";

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 50% 0%, rgba(13,148,136,0.16), transparent 60%), linear-gradient(180deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
        color: "#f8fafc",
        padding: "24px 16px 56px",
      }}
    >
      <style>{`
        @media print {
          .card-no-print { display: none !important; }
          body, main { background: #fff !important; }
          .card-stage { perspective: none !important; padding: 0 !important; }
          .card-flipper { transform: none !important; }
          .card-back { display: none !important; }
        }
        @keyframes aevion-card-shimmer {
          0% { transform: translateX(-120%) rotate(8deg); }
          100% { transform: translateX(220%) rotate(8deg); }
        }
      `}</style>

      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <Link
          href="/bank"
          style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", textDecoration: "none", fontWeight: 700 }}
        >
          ← {t("about.backToBank")}
        </Link>

        <header style={{ marginTop: 18, marginBottom: 24 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 6,
              color: "#5eead4",
              textTransform: "uppercase",
            }}
          >
            {t("card.kicker")}
          </div>
          <h1
            style={{
              fontSize: 38,
              fontWeight: 900,
              letterSpacing: -1.2,
              lineHeight: 1.05,
              marginTop: 12,
              marginBottom: 8,
            }}
          >
            {t("card.headline")}
          </h1>
          <div style={{ fontSize: 15, color: "#cbd5e1", lineHeight: 1.55, maxWidth: 600 }}>
            {t("card.lede")}
          </div>
        </header>

        {/* Card stage with flip */}
        <div
          className="card-stage"
          style={{
            perspective: "1400px",
            display: "flex",
            justifyContent: "center",
            padding: "24px 0",
            marginBottom: 8,
          }}
        >
          <div
            className="card-flipper"
            role="button"
            tabIndex={0}
            aria-pressed={flipped}
            aria-label={t("card.flipAria")}
            onClick={() => setFlipped((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setFlipped((v) => !v);
              }
            }}
            style={{
              position: "relative" as const,
              width: "min(420px, 100%)",
              aspectRatio: "1.586 / 1",
              transformStyle: "preserve-3d",
              transition: "transform 700ms cubic-bezier(0.22, 1, 0.36, 1)",
              transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
              cursor: "pointer",
              userSelect: "none" as const,
            }}
          >
            {/* FRONT */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                backfaceVisibility: "hidden" as const,
                borderRadius: 22,
                background: TIER_GRADIENT[tier],
                boxShadow: "0 20px 50px rgba(15,23,42,0.55)",
                padding: 24,
                color: "#fff",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              {/* Foil shimmer */}
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  top: -40,
                  bottom: -40,
                  left: -120,
                  width: 80,
                  background: `linear-gradient(90deg, transparent, ${TIER_FOIL[tier]}, transparent)`,
                  filter: "blur(8px)",
                  animation: "aevion-card-shimmer 5s ease-in-out infinite",
                  opacity: 0.7,
                }}
              />
              {/* Top row: brand + tier */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative" as const, zIndex: 2 }}>
                <div>
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: 4,
                      textTransform: "uppercase",
                      opacity: 0.85,
                    }}
                  >
                    AEVION · BANK
                  </div>
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 900,
                      letterSpacing: -1,
                      lineHeight: 1,
                      marginTop: 4,
                    }}
                  >
                    ₳
                  </div>
                </div>
                <div
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: tierColor[tier],
                    color: "#0f172a",
                    fontSize: 9,
                    fontWeight: 900,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                  }}
                >
                  {t(tierLabelKey[tier])}
                </div>
              </div>

              {/* Chip */}
              <div style={{ position: "relative" as const, zIndex: 2, marginTop: 8 }}>
                <div
                  aria-hidden
                  style={{
                    width: 44,
                    height: 32,
                    borderRadius: 6,
                    background: "linear-gradient(135deg, #fbbf24, #d97706, #fbbf24)",
                    boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.06)",
                    position: "relative" as const,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 4,
                      background:
                        "linear-gradient(0deg, transparent 0, transparent 40%, rgba(0,0,0,0.18) 41%, rgba(0,0,0,0.18) 43%, transparent 44%, transparent 60%, rgba(0,0,0,0.18) 61%, rgba(0,0,0,0.18) 63%, transparent 64%)",
                      borderRadius: 4,
                    }}
                  />
                </div>
              </div>

              {/* Number */}
              <div
                style={{
                  position: "relative" as const,
                  zIndex: 2,
                  fontSize: 18,
                  letterSpacing: 4,
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                  fontWeight: 700,
                }}
              >
                ₳ ··· ··· {last4}
              </div>

              {/* Bottom row */}
              <div
                style={{
                  position: "relative" as const,
                  zIndex: 2,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-end",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 8, letterSpacing: 2, opacity: 0.7, fontWeight: 700, textTransform: "uppercase" }}>
                    {t("card.member")}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1, marginTop: 2, textTransform: "uppercase" }}>
                    {ownerName.toUpperCase()}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 8, letterSpacing: 2, opacity: 0.7, fontWeight: 700, textTransform: "uppercase" }}>
                    {t("card.memberSince")}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, marginTop: 2 }}>
                    {memberSince}
                  </div>
                </div>
              </div>
            </div>

            {/* BACK */}
            <div
              className="card-back"
              style={{
                position: "absolute",
                inset: 0,
                backfaceVisibility: "hidden" as const,
                transform: "rotateY(180deg)",
                borderRadius: 22,
                background: TIER_GRADIENT[tier],
                boxShadow: "0 20px 50px rgba(15,23,42,0.55)",
                color: "#fff",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Magstripe */}
              <div style={{ height: 44, marginTop: 24, background: "rgba(0,0,0,0.65)" }} />
              {/* Body */}
              <div style={{ flex: 1, display: "flex", padding: 20, gap: 16, alignItems: "center" }}>
                <div
                  style={{
                    background: "#fff",
                    padding: 6,
                    borderRadius: 8,
                    flexShrink: 0,
                  }}
                >
                  {cardUrl ? <QRCodeView value={cardUrl} size={84} /> : <div style={{ width: 84, height: 84 }} />}
                </div>
                <div style={{ fontSize: 11, lineHeight: 1.45, opacity: 0.92 }}>
                  <div style={{ fontWeight: 800, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
                    {t("card.back.title")}
                  </div>
                  <div>{t("card.back.body1")}</div>
                  <div style={{ marginTop: 6 }}>{t("card.back.body2")}</div>
                </div>
              </div>
              {/* Strip number */}
              <div
                style={{
                  padding: "8px 20px 16px",
                  fontSize: 9,
                  letterSpacing: 1.5,
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                  opacity: 0.7,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>aevion://card/{last4.toLowerCase()}</span>
                <span>TS·{score}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <section
          className="card-no-print"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 8,
            marginTop: 16,
            marginBottom: 20,
          }}
        >
          <Stat label={t("card.stat.balance")} value={balanceText} accent="#5eead4" />
          <Stat label={t("card.stat.tier")} value={t(tierLabelKey[tier])} accent={tierColor[tier]} />
          <Stat label={t("card.stat.score")} value={`${score}/100`} accent="#a78bfa" />
          <Stat label={t("card.stat.last4")} value={`···· ${last4}`} accent="#fbbf24" />
        </section>

        {/* Action bar */}
        <div
          className="card-no-print"
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "center",
            marginBottom: 24,
          }}
        >
          <button
            type="button"
            onClick={() => setFlipped((v) => !v)}
            style={btnStyle("#0d9488")}
          >
            {flipped ? t("card.action.front") : t("card.action.flip")}
          </button>
          <button
            type="button"
            onClick={() => setHideBalance((v) => !v)}
            style={btnStyle("transparent")}
          >
            {hideBalance ? t("card.action.show") : t("card.action.hide")}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            style={btnStyle("transparent")}
          >
            {t("card.action.print")}
          </button>
          <Link href="/bank/trust" style={{ ...btnStyle("transparent"), textDecoration: "none" }}>
            {t("card.action.score")}
          </Link>
        </div>

        {/* Why this card differs */}
        <section
          style={{
            padding: 22,
            borderRadius: 16,
            background: "rgba(15,23,42,0.55)",
            border: "1px solid rgba(94,234,212,0.18)",
            marginBottom: 18,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "#5eead4",
              marginBottom: 6,
            }}
          >
            {t("card.why.kicker")}
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 900, margin: "0 0 12px 0", lineHeight: 1.2, letterSpacing: -0.3 }}>
            {t("card.why.title")}
          </h2>
          <p style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.6, margin: 0 }}>
            {t("card.why.body")}
          </p>
        </section>

        <div style={{ marginTop: 16 }}>
          <InstallBanner />
        </div>
        <div style={{ marginTop: 16 }}>
          <SubrouteFooter />
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        background: "rgba(15,23,42,0.55)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: 2,
          fontWeight: 800,
          textTransform: "uppercase",
          color: accent,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", marginTop: 4 }}>{value}</div>
    </div>
  );
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    padding: "10px 18px",
    borderRadius: 10,
    background: bg,
    color: "#fff",
    fontSize: 13,
    fontWeight: 800,
    border: bg === "transparent" ? "1px solid rgba(255,255,255,0.18)" : "none",
    cursor: "pointer",
  };
}
