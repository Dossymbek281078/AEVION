"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { InstallBanner } from "../_components/InstallBanner";
import { SubrouteFooter } from "../_components/SubrouteFooter";
import { listAccounts, listOperations } from "../_lib/api";
import { fetchChessSummary, type ChessSummary } from "../_lib/chess";
import { fetchEcosystemEarnings, type EcosystemEarningsSummary } from "../_lib/ecosystem";
import { fetchRoyaltyStream, type RoyaltyStreamSummary } from "../_lib/royalties";
import {
  computeEcosystemTrustScore,
  tierColor,
  tierDescriptionKey,
  tierLabelKey,
  type TrustFactor,
  type TrustTier,
} from "../_lib/trust";
import type { Account, Operation } from "../_lib/types";

const TIERS: TrustTier[] = ["new", "growing", "trusted", "elite"];

// Hard-coded perks per tier — reflect the salary advance limits + experience
// claims the rest of the wallet already exposes.
const TIER_PERKS_KEYS: Record<TrustTier, string[]> = {
  new: ["trust.page.perks.new.1", "trust.page.perks.new.2"],
  growing: ["trust.page.perks.growing.1", "trust.page.perks.growing.2"],
  trusted: ["trust.page.perks.trusted.1", "trust.page.perks.trusted.2", "trust.page.perks.trusted.3"],
  elite: ["trust.page.perks.elite.1", "trust.page.perks.elite.2", "trust.page.perks.elite.3"],
};

const TIER_GATE: Record<TrustTier, number> = { new: 0, growing: 20, trusted: 50, elite: 80 };

export default function TrustPage() {
  const { t } = useI18n();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [royalty, setRoyalty] = useState<RoyaltyStreamSummary | null>(null);
  const [chess, setChess] = useState<ChessSummary | null>(null);
  const [ecosystem, setEcosystem] = useState<EcosystemEarningsSummary | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [a, o] = await Promise.all([listAccounts(), listOperations()]);
        if (cancelled) return;
        setAccounts(a);
        setOperations(o);
      } catch {
        // offline ok
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

  const score = trust?.score ?? 0;
  const tier = trust?.tier ?? ("new" as TrustTier);
  const color = tierColor[tier];

  const banking = trust?.factors.filter((f) => f.cluster === "banking") ?? [];
  const eco = trust?.factors.filter((f) => f.cluster === "ecosystem") ?? [];

  // Big ring math — 280 px diameter, stroke 18.
  const r = 124;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 50% 0%, rgba(13,148,136,0.18), transparent 60%), linear-gradient(180deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
        color: "#f8fafc",
        padding: "32px 16px 56px",
      }}
    >
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <Link
          href="/bank"
          style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", textDecoration: "none", fontWeight: 700 }}
        >
          ← {t("about.backToBank")}
        </Link>

        <header style={{ marginTop: 18, marginBottom: 28 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 6,
              color: "#5eead4",
              textTransform: "uppercase",
            }}
          >
            {t("trust.page.kicker")}
          </div>
          <h1
            style={{
              fontSize: 44,
              fontWeight: 900,
              letterSpacing: -1.2,
              lineHeight: 1.05,
              marginTop: 14,
              marginBottom: 10,
            }}
          >
            {t("trust.page.headline")}
          </h1>
          <div style={{ fontSize: 16, color: "#cbd5e1", lineHeight: 1.55, maxWidth: 640 }}>
            {t("trust.page.lede")}
          </div>
        </header>

        {/* Hero score */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(260px, 320px) 1fr",
            gap: 28,
            alignItems: "center",
            padding: 24,
            borderRadius: 20,
            background: "rgba(15,23,42,0.55)",
            border: "1px solid rgba(94,234,212,0.18)",
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ position: "relative" as const, width: 280, height: 280 }}>
              <svg width={280} height={280} viewBox="0 0 280 280" aria-hidden>
                <circle
                  cx={140}
                  cy={140}
                  r={r}
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth={18}
                />
                <circle
                  cx={140}
                  cy={140}
                  r={r}
                  fill="none"
                  stroke={color}
                  strokeWidth={18}
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${circ - dash}`}
                  transform="rotate(-90 140 140)"
                  style={{ transition: "stroke-dasharray 600ms ease-out, stroke 300ms ease" }}
                />
              </svg>
              <div
                style={{
                  position: "absolute" as const,
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div style={{ fontSize: 64, fontWeight: 900, lineHeight: 1, color: "#fff" }}>
                  {loaded ? score : "—"}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 11,
                    letterSpacing: 4,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.55)",
                  }}
                >
                  {t("trust.page.outOf100")}
                </div>
                <div
                  style={{
                    marginTop: 12,
                    padding: "6px 14px",
                    borderRadius: 999,
                    background: color,
                    color: "#0f172a",
                    fontSize: 12,
                    fontWeight: 900,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                  }}
                >
                  {t(tierLabelKey[tier])}
                </div>
              </div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>
              {t("trust.page.currentTier")}
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, marginTop: 6, lineHeight: 1.2, color }}>
              {t(tierLabelKey[tier])}
            </div>
            <div style={{ fontSize: 14, color: "#cbd5e1", marginTop: 10, lineHeight: 1.55 }}>
              {t(tierDescriptionKey[tier])}
            </div>
            {trust?.nextTier ? (
              <div
                style={{
                  marginTop: 16,
                  padding: 12,
                  borderRadius: 12,
                  background: "rgba(94,234,212,0.08)",
                  border: "1px solid rgba(94,234,212,0.18)",
                  fontSize: 13,
                  color: "#cbd5e1",
                  lineHeight: 1.5,
                }}
              >
                {t("trust.page.nextTier", {
                  points: trust.pointsToNextTier,
                  tier: t(tierLabelKey[trust.nextTier]),
                })}
              </div>
            ) : (
              <div
                style={{
                  marginTop: 16,
                  padding: 12,
                  borderRadius: 12,
                  background: "linear-gradient(135deg, rgba(217,119,6,0.16), rgba(251,191,36,0.10))",
                  border: "1px solid rgba(217,119,6,0.28)",
                  fontSize: 13,
                  color: "#fde68a",
                  fontWeight: 700,
                  lineHeight: 1.5,
                }}
              >
                {t("trust.page.eliteAchieved")}
              </div>
            )}
          </div>
        </section>

        {/* Tier ladder */}
        <SectionTitle kicker={t("trust.page.ladder.kicker")} title={t("trust.page.ladder.title")} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            marginBottom: 28,
          }}
        >
          {TIERS.map((tt) => {
            const active = tt === tier;
            const c = tierColor[tt];
            return (
              <div
                key={tt}
                style={{
                  padding: 16,
                  borderRadius: 14,
                  background: active ? "rgba(15,23,42,0.85)" : "rgba(15,23,42,0.45)",
                  border: active ? `2px solid ${c}` : "1px solid rgba(255,255,255,0.08)",
                  position: "relative" as const,
                }}
              >
                {active && (
                  <div
                    style={{
                      position: "absolute" as const,
                      top: 10,
                      right: 10,
                      fontSize: 9,
                      letterSpacing: 2,
                      color: c,
                      fontWeight: 900,
                      textTransform: "uppercase",
                    }}
                  >
                    {t("trust.page.youAreHere")}
                  </div>
                )}
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: 3,
                    textTransform: "uppercase",
                    color: c,
                  }}
                >
                  {t(tierLabelKey[tt])}
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4, color: "#fff" }}>
                  {TIER_GATE[tt]}+
                </div>
                <ul style={{ margin: "10px 0 0 0", padding: 0, listStyle: "none" }}>
                  {TIER_PERKS_KEYS[tt].map((k) => (
                    <li
                      key={k}
                      style={{
                        fontSize: 12,
                        color: "#cbd5e1",
                        lineHeight: 1.5,
                        paddingLeft: 14,
                        position: "relative" as const,
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ position: "absolute", left: 0, color: c }}>·</span>
                      {t(k)}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Banking factors */}
        <SectionTitle
          kicker={t("trust.page.banking.kicker")}
          title={t("trust.page.banking.title")}
          accent="#5eead4"
        />
        <FactorBars factors={banking} accent="#5eead4" />

        {/* Ecosystem factors */}
        <SectionTitle
          kicker={t("trust.page.ecosystem.kicker")}
          title={t("trust.page.ecosystem.title")}
          accent="#a78bfa"
        />
        <FactorBars factors={eco} accent="#a78bfa" />

        {/* Quick wins */}
        {trust && trust.checklist.length > 0 && (
          <>
            <SectionTitle
              kicker={t("trust.page.wins.kicker")}
              title={t("trust.page.wins.title")}
              accent="#fbbf24"
            />
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: "0 0 28px 0",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {trust.checklist.map((c) => (
                <li
                  key={c.key}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    background: "rgba(15,23,42,0.55)",
                    border: "1px solid rgba(251,191,36,0.20)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ fontSize: 14, color: "#fde68a" }}>{c.label}</div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: "#fbbf24",
                      letterSpacing: 1.5,
                      textTransform: "uppercase",
                    }}
                  >
                    +{c.delta} {t("trust.page.points")}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* Methodology */}
        <SectionTitle
          kicker={t("trust.page.method.kicker")}
          title={t("trust.page.method.title")}
          accent="#f472b6"
        />
        <p style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.6, marginTop: 0, marginBottom: 28 }}>
          {t("trust.page.method.body")}
        </p>

        {/* CTA */}
        <section
          style={{
            marginTop: 8,
            padding: 24,
            borderRadius: 18,
            background: "linear-gradient(135deg, rgba(13,148,136,0.18), rgba(99,102,241,0.10))",
            border: "1px solid rgba(94,234,212,0.30)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "#5eead4",
            }}
          >
            {t("trust.page.cta.kicker")}
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6, lineHeight: 1.25 }}>
            {t("trust.page.cta.title")}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            <Link
              href="/bank"
              style={{
                padding: "12px 20px",
                borderRadius: 12,
                background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 800,
                textDecoration: "none",
              }}
            >
              {t("about.cta.openBank")}
            </Link>
            <Link
              href="/bank/about"
              style={{
                padding: "12px 20px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.04)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 800,
                textDecoration: "none",
              }}
            >
              {t("trust.page.cta.aboutLink")}
            </Link>
          </div>
        </section>

        <div style={{ marginTop: 24 }}>
          <InstallBanner />
        </div>
        <div style={{ marginTop: 16 }}>
          <SubrouteFooter />
        </div>
      </div>
    </main>
  );
}

function SectionTitle({
  kicker,
  title,
  accent,
}: {
  kicker: string;
  title: string;
  accent?: string;
}) {
  return (
    <div style={{ marginTop: 8, marginBottom: 14 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 4,
          textTransform: "uppercase",
          color: accent ?? "#5eead4",
        }}
      >
        {kicker}
      </div>
      <h2
        style={{
          fontSize: 22,
          fontWeight: 900,
          margin: "4px 0 0 0",
          lineHeight: 1.2,
          letterSpacing: -0.3,
        }}
      >
        {title}
      </h2>
    </div>
  );
}

function FactorBars({ factors, accent }: { factors: TrustFactor[]; accent: string }) {
  if (factors.length === 0) return null;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: 10,
        marginBottom: 28,
      }}
    >
      {factors.map((f) => {
        const pct = Math.max(0, Math.min(100, f.points));
        return (
          <div
            key={f.key}
            style={{
              padding: 14,
              borderRadius: 12,
              background: "rgba(15,23,42,0.55)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 12,
                marginBottom: 8,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{f.label}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 700 }}>
                {f.hint}
              </div>
            </div>
            <div
              style={{
                position: "relative" as const,
                height: 10,
                borderRadius: 999,
                background: "rgba(255,255,255,0.06)",
                overflow: "hidden",
              }}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              aria-label={f.label}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${accent}, ${accent}cc)`,
                  borderRadius: 999,
                  transition: "width 600ms ease-out",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 8,
                fontSize: 11,
                color: "rgba(255,255,255,0.55)",
                fontWeight: 600,
              }}
            >
              <span>
                {pct} / 100 · ×{f.weight.toFixed(1)}
              </span>
              {f.nextMilestone && <span style={{ color: accent }}>{f.nextMilestone}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
