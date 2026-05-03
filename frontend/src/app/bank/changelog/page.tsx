"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { InstallBanner } from "../_components/InstallBanner";
import { SubrouteFooter } from "../_components/SubrouteFooter";

type Entry = {
  href?: string;
  titleKey: string;
  hintKey: string;
  tagKey: string;
};

type Group = {
  dateKey: string;
  accent: string;
  entries: Entry[];
};

const GROUPS: Group[] = [
  {
    dateKey: "changelogPage.group.apr28",
    accent: "#5eead4",
    entries: [
      { href: "/bank/budget", titleKey: "changelogPage.entry.budget.title", hintKey: "changelogPage.entry.budget.hint", tagKey: "changelogPage.tag.feature" },
      { href: "/bank/calendar", titleKey: "changelogPage.entry.calendar.title", hintKey: "changelogPage.entry.calendar.hint", tagKey: "changelogPage.tag.feature" },
      { href: "/bank/subscriptions", titleKey: "changelogPage.entry.subscriptions.title", hintKey: "changelogPage.entry.subscriptions.hint", tagKey: "changelogPage.tag.feature" },
      { href: "/bank/forecast", titleKey: "changelogPage.entry.forecast.title", hintKey: "changelogPage.entry.forecast.hint", tagKey: "changelogPage.tag.feature" },
      { href: "/bank/trip", titleKey: "changelogPage.entry.trip.title", hintKey: "changelogPage.entry.trip.hint", tagKey: "changelogPage.tag.page" },
      { href: "/bank/brief", titleKey: "changelogPage.entry.brief.title", hintKey: "changelogPage.entry.brief.hint", tagKey: "changelogPage.tag.page" },
      { href: "/bank/achievements", titleKey: "changelogPage.entry.achievements.title", hintKey: "changelogPage.entry.achievements.hint", tagKey: "changelogPage.tag.page" },
      { href: "/bank/challenges", titleKey: "changelogPage.entry.challenges.title", hintKey: "changelogPage.entry.challenges.hint", tagKey: "changelogPage.tag.page" },
      { href: "/bank/networth", titleKey: "changelogPage.entry.networth.title", hintKey: "changelogPage.entry.networth.hint", tagKey: "changelogPage.tag.page" },
      { href: "/bank/timetravel", titleKey: "changelogPage.entry.timetravel.title", hintKey: "changelogPage.entry.timetravel.hint", tagKey: "changelogPage.tag.page" },
      { href: "/bank/constellation", titleKey: "changelogPage.entry.constellation.title", hintKey: "changelogPage.entry.constellation.hint", tagKey: "changelogPage.tag.page" },
      { href: "/bank/wishlist", titleKey: "changelogPage.entry.wishlist.title", hintKey: "changelogPage.entry.wishlist.hint", tagKey: "changelogPage.tag.page" },
      { href: "/bank/loyalty", titleKey: "changelogPage.entry.loyalty.title", hintKey: "changelogPage.entry.loyalty.hint", tagKey: "changelogPage.tag.page" },
      { href: "/bank/cooldown", titleKey: "changelogPage.entry.cooldown.title", hintKey: "changelogPage.entry.cooldown.hint", tagKey: "changelogPage.tag.page" },
    ],
  },
  {
    dateKey: "changelogPage.group.apr27",
    accent: "#a78bfa",
    entries: [
      { href: "/bank/recurring", titleKey: "changelogPage.entry.recurring.title", hintKey: "changelogPage.entry.recurring.hint", tagKey: "changelogPage.tag.feature" },
      { href: "/bank/insights", titleKey: "changelogPage.entry.insights.title", hintKey: "changelogPage.entry.insights.hint", tagKey: "changelogPage.tag.feature" },
      { href: "/bank/flow", titleKey: "changelogPage.entry.flow.title", hintKey: "changelogPage.entry.flow.hint", tagKey: "changelogPage.tag.feature" },
      { href: "/bank/onboarding", titleKey: "changelogPage.entry.onboarding.title", hintKey: "changelogPage.entry.onboarding.hint", tagKey: "changelogPage.tag.feature" },
      { titleKey: "changelogPage.entry.virtual.title", hintKey: "changelogPage.entry.virtual.hint", tagKey: "changelogPage.tag.feature" },
      { titleKey: "changelogPage.entry.smartWishlist.title", hintKey: "changelogPage.entry.smartWishlist.hint", tagKey: "changelogPage.tag.feature" },
      { titleKey: "changelogPage.entry.coolDown.title", hintKey: "changelogPage.entry.coolDown.hint", tagKey: "changelogPage.tag.feature" },
    ],
  },
  {
    dateKey: "changelogPage.group.apr26",
    accent: "#fbbf24",
    entries: [
      { href: "/bank/about", titleKey: "changelogPage.entry.about.title", hintKey: "changelogPage.entry.about.hint", tagKey: "changelogPage.tag.story" },
      { href: "/bank/trust", titleKey: "changelogPage.entry.trust.title", hintKey: "changelogPage.entry.trust.hint", tagKey: "changelogPage.tag.story" },
      { href: "/bank/security", titleKey: "changelogPage.entry.security.title", hintKey: "changelogPage.entry.security.hint", tagKey: "changelogPage.tag.story" },
      { href: "/bank/help", titleKey: "changelogPage.entry.help.title", hintKey: "changelogPage.entry.help.hint", tagKey: "changelogPage.tag.story" },
      { href: "/bank/glossary", titleKey: "changelogPage.entry.glossary.title", hintKey: "changelogPage.entry.glossary.hint", tagKey: "changelogPage.tag.story" },
      { href: "/bank/savings", titleKey: "changelogPage.entry.savings.title", hintKey: "changelogPage.entry.savings.hint", tagKey: "changelogPage.tag.story" },
      { href: "/bank/circles", titleKey: "changelogPage.entry.circles.title", hintKey: "changelogPage.entry.circles.hint", tagKey: "changelogPage.tag.story" },
      { href: "/bank/card", titleKey: "changelogPage.entry.card.title", hintKey: "changelogPage.entry.card.hint", tagKey: "changelogPage.tag.story" },
    ],
  },
  {
    dateKey: "changelogPage.group.apr22",
    accent: "#0ea5e9",
    entries: [
      { titleKey: "changelogPage.entry.foundation.title", hintKey: "changelogPage.entry.foundation.hint", tagKey: "changelogPage.tag.foundation" },
      { titleKey: "changelogPage.entry.royalty.title", hintKey: "changelogPage.entry.royalty.hint", tagKey: "changelogPage.tag.foundation" },
      { titleKey: "changelogPage.entry.qsign.title", hintKey: "changelogPage.entry.qsign.hint", tagKey: "changelogPage.tag.foundation" },
      { titleKey: "changelogPage.entry.pwa.title", hintKey: "changelogPage.entry.pwa.hint", tagKey: "changelogPage.tag.foundation" },
    ],
  },
];

const TAG_COLOR: Record<string, string> = {
  "changelogPage.tag.feature": "#5eead4",
  "changelogPage.tag.page": "#a78bfa",
  "changelogPage.tag.story": "#fbbf24",
  "changelogPage.tag.foundation": "#0ea5e9",
};

export default function ChangelogPage() {
  const { t } = useI18n();
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 50% 0%, rgba(94,234,212,0.18), transparent 55%), linear-gradient(180deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
        color: "#f8fafc",
        padding: "32px 16px 56px",
      }}
    >
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <Link href="/bank" style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", textDecoration: "none", fontWeight: 700 }}>
          {`← ${t("about.backToBank")}`}
        </Link>

        <header style={{ marginTop: 18, marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 6, color: "#5eead4", textTransform: "uppercase" }}>
            {t("changelogPage.kicker")}
          </div>
          <h1 style={{ fontSize: 40, fontWeight: 900, letterSpacing: -1.2, lineHeight: 1.05, marginTop: 14, marginBottom: 8 }}>
            {t("changelogPage.headline")}
          </h1>
          <div style={{ fontSize: 15, color: "#cbd5e1", lineHeight: 1.55, maxWidth: 640 }}>
            {t("changelogPage.lede")}
          </div>
        </header>

        {GROUPS.map((g) => (
          <section key={g.dateKey} style={{ marginBottom: 28 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 14,
                paddingBottom: 8,
                borderBottom: `1px solid ${g.accent}33`,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 900,
                  letterSpacing: 3,
                  color: g.accent,
                  textTransform: "uppercase",
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                }}
              >
                {t(g.dateKey)}
              </div>
              <div style={{ flex: 1, height: 1, background: `${g.accent}22` }} />
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontVariantNumeric: "tabular-nums" }}>
                {g.entries.length}
              </div>
            </div>

            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {g.entries.map((e, i) => {
                const tagColor = TAG_COLOR[e.tagKey] ?? "#94a3b8";
                const inner = (
                  <div
                    style={{
                      padding: 14,
                      borderRadius: 12,
                      background: "rgba(15,23,42,0.55)",
                      border: `1px solid ${e.href ? `${tagColor}22` : "rgba(255,255,255,0.06)"}`,
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start",
                      transition: "border-color 200ms ease",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 900,
                        letterSpacing: 1.5,
                        textTransform: "uppercase",
                        padding: "4px 8px",
                        borderRadius: 999,
                        background: `${tagColor}1a`,
                        color: tagColor,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t(e.tagKey)}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{t(e.titleKey)}</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 4, lineHeight: 1.5 }}>
                        {t(e.hintKey)}
                      </div>
                    </div>
                    {e.href ? <span style={{ color: tagColor, fontSize: 18, fontWeight: 800 }}>→</span> : null}
                  </div>
                );
                return (
                  <li key={`${g.dateKey}-${i}`}>
                    {e.href ? (
                      <Link href={e.href} style={{ textDecoration: "none", color: "inherit" }}>
                        {inner}
                      </Link>
                    ) : (
                      inner
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <section
          style={{
            padding: 22,
            borderRadius: 16,
            background: "linear-gradient(135deg, rgba(94,234,212,0.18), rgba(99,102,241,0.10))",
            border: "1px solid rgba(94,234,212,0.30)",
            marginTop: 8,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 4, color: "#5eead4", textTransform: "uppercase" }}>
            {t("changelogPage.cta.kicker")}
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, marginTop: 6, lineHeight: 1.25 }}>{t("changelogPage.cta.title")}</div>
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <Link
              href="/bank/explore"
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
              {t("changelogPage.cta.explore")} →
            </Link>
            <Link
              href="/bank"
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
              {t("changelogPage.cta.bank")} →
            </Link>
          </div>
        </section>

        <div style={{ marginTop: 16 }}><InstallBanner /></div>
        <div style={{ marginTop: 16 }}><SubrouteFooter /></div>
      </div>
    </main>
  );
}
