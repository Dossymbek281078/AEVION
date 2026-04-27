"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { InstallBanner } from "../_components/InstallBanner";
import { formatCurrency, loadCurrency, type CurrencyCode } from "../_lib/currency";
import { pick, seeded } from "../_lib/random";
import { TIER_COLOR, TIER_LABEL, type ReferralTier } from "../_lib/referrals";

type Tab = "creators" | "chess" | "referrers";

const TABS: Tab[] = ["creators", "chess", "referrers"];

const FIRST_NAMES = [
  "Lana", "Mikael", "Anya", "Otabek", "Zhanna", "Reina", "Oren", "Sora",
  "Diana", "Emir", "Eka", "Inara", "Nazar", "Saule", "Talia", "Yura",
  "Kassym", "Polina", "Daniyar", "Aizhan", "Marat", "Ayna", "Selim", "Mira",
];

const LAST_INITIALS = ["A.", "K.", "B.", "S.", "T.", "N.", "Z.", "M.", "L.", "R."];

const CREATOR_KINDS = ["Music", "Film", "Code", "Article", "Photo", "Course", "Patent"];
const CHESS_FORMATS = ["Bullet", "Blitz", "Rapid", "Classical"];

type Row = {
  rank: number;
  name: string;
  badge?: string;
  badgeColor?: string;
  primary: string;
  secondary: string;
  highlight?: boolean;
};

const SCALE_PRESETS: Record<Tab, number> = {
  creators: 24_000,
  chess: 8_500,
  referrers: 60,
};

export default function LeaderboardPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("creators");
  const [code] = useState<CurrencyCode>(() =>
    typeof window === "undefined" ? "AEC" : loadCurrency(),
  );

  const rows = useMemo(() => buildRows(tab, code, t), [tab, code, t]);

  return (
    <main
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "32px 16px 56px",
        minHeight: "100vh",
        background: "#f8fafc",
        color: "#0f172a",
      }}
    >
      <Link
        href="/bank"
        style={{ fontSize: 12, color: "#475569", textDecoration: "none", fontWeight: 700 }}
      >
        ← {t("leaderboard.backToBank")}
      </Link>

      <header style={{ marginTop: 14, marginBottom: 22 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, letterSpacing: -0.5 }}>
          {t("leaderboard.title")}
        </h1>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>
          {t("leaderboard.subtitle")}
        </div>
      </header>

      <InstallBanner />

      <div role="tablist" aria-label="Leaderboard category" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {TABS.map((tt) => (
          <button
            key={tt}
            role="tab"
            aria-selected={tt === tab}
            onClick={() => setTab(tt)}
            style={{
              padding: "8px 16px",
              borderRadius: 999,
              border: tt === tab ? "1px solid #0f172a" : "1px solid rgba(15,23,42,0.12)",
              background: tt === tab ? "#0f172a" : "#fff",
              color: tt === tab ? "#fff" : "#475569",
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {t(`leaderboard.tab.${tt}`)}
          </button>
        ))}
      </div>

      <ol
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          background: "#fff",
          borderRadius: 14,
          border: "1px solid rgba(15,23,42,0.08)",
          overflow: "hidden",
        }}
      >
        {rows.map((row) => (
          <li
            key={`${tab}-${row.rank}`}
            style={{
              display: "grid",
              gridTemplateColumns: "44px 1fr auto",
              gap: 14,
              alignItems: "center",
              padding: "12px 14px",
              borderBottom: "1px solid rgba(15,23,42,0.06)",
              background: row.highlight ? "rgba(13,148,136,0.04)" : "transparent",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: 13,
                background: rankBg(row.rank),
                color: row.rank <= 3 ? "#fff" : "#475569",
              }}
            >
              {row.rank}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {row.name}
                </span>
                {row.badge ? (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 900,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      padding: "2px 7px",
                      borderRadius: 999,
                      background: `${row.badgeColor ?? "#475569"}1A`,
                      color: row.badgeColor ?? "#475569",
                    }}
                  >
                    {row.badge}
                  </span>
                ) : null}
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{row.secondary}</div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 900, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
              {row.primary}
            </div>
          </li>
        ))}
      </ol>

      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 12, lineHeight: 1.55 }}>
        {t("leaderboard.disclaimer")}
      </div>
    </main>
  );
}

function rankBg(rank: number): string {
  if (rank === 1) return "linear-gradient(135deg, #fbbf24, #d97706)";
  if (rank === 2) return "linear-gradient(135deg, #cbd5e1, #94a3b8)";
  if (rank === 3) return "linear-gradient(135deg, #d97706, #92400e)";
  return "rgba(15,23,42,0.05)";
}

function buildRows(
  tab: Tab,
  code: CurrencyCode,
  t: (k: string, vars?: Record<string, string | number>) => string,
): Row[] {
  const seed = `aevion:leaderboard:${tab}`;
  const rand = seeded(seed);
  const N = 12;
  const max = SCALE_PRESETS[tab];

  // Distribute scores along a Pareto-ish curve so #1 is meaningfully ahead.
  const scores: number[] = [];
  for (let i = 0; i < N; i++) {
    const base = max / Math.pow(i + 1, 0.62);
    const jitter = 0.85 + rand() * 0.25;
    scores.push(Math.round(base * jitter));
  }

  const out: Row[] = [];
  for (let i = 0; i < N; i++) {
    const name = `${pick(FIRST_NAMES, rand)} ${pick(LAST_INITIALS, rand)}`;
    const rank = i + 1;
    const score = scores[i];
    if (tab === "creators") {
      const kind = pick(CREATOR_KINDS, rand);
      const works = 6 + Math.floor(rand() * 28);
      out.push({
        rank,
        name,
        badge: kind,
        badgeColor: "#0d9488",
        primary: formatCurrency(score, code),
        secondary: t("leaderboard.row.creator", { works, kind }),
        highlight: rank === 1,
      });
    } else if (tab === "chess") {
      const fmt = pick(CHESS_FORMATS, rand);
      const games = 80 + Math.floor(rand() * 600);
      out.push({
        rank,
        name,
        badge: fmt,
        badgeColor: "#0ea5e9",
        primary: formatCurrency(score, code),
        secondary: t("leaderboard.row.chess", { games, fmt }),
        highlight: rank === 1,
      });
    } else {
      const tier = referralTierFor(score);
      const aec = score * 10;
      out.push({
        rank,
        name,
        badge: TIER_LABEL[tier],
        badgeColor: TIER_COLOR[tier],
        primary: t("leaderboard.row.invitedCount", { n: score }),
        secondary: t("leaderboard.row.referrer", { aec: formatCurrency(aec, code) }),
        highlight: rank === 1,
      });
    }
  }
  return out;
}

function referralTierFor(invited: number): ReferralTier {
  if (invited >= 40) return "top-referrer";
  if (invited >= 15) return "ambassador";
  if (invited >= 5) return "advocate";
  return "starter";
}
