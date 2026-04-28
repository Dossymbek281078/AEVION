"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { InstallBanner } from "../_components/InstallBanner";
import { SubrouteFooter } from "../_components/SubrouteFooter";

// Catalog hub for all the bank routes shipped this push. Solves the
// discoverability problem (most sub-routes are noindex and live in deep
// query-param URLs) by giving each one a card with a one-line pitch.

type Card = {
  href: string;
  iconBg: string;
  iconChar: string;
  titleKey: string;
  hintKey: string;
  badgeKey?: string;
  external?: boolean;
};

const CARDS: Array<{ groupKey: string; items: Card[] }> = [
  {
    groupKey: "explore.group.story",
    items: [
      {
        href: "/bank/about",
        iconBg: "linear-gradient(135deg, #5eead4, #6366f1)",
        iconChar: "✦",
        titleKey: "explore.card.about.title",
        hintKey: "explore.card.about.hint",
      },
      {
        href: "/bank/trust",
        iconBg: "linear-gradient(135deg, #7c3aed, #a78bfa)",
        iconChar: "◯",
        titleKey: "explore.card.trust.title",
        hintKey: "explore.card.trust.hint",
      },
      {
        href: "/bank/security",
        iconBg: "linear-gradient(135deg, #db2777, #f472b6)",
        iconChar: "⛨",
        titleKey: "explore.card.security.title",
        hintKey: "explore.card.security.hint",
      },
      {
        href: "/bank/card",
        iconBg: "linear-gradient(135deg, #6d28d9, #312e81)",
        iconChar: "▭",
        titleKey: "explore.card.card.title",
        hintKey: "explore.card.card.hint",
      },
      {
        href: "/bank/help",
        iconBg: "linear-gradient(135deg, #0d9488, #5eead4)",
        iconChar: "?",
        titleKey: "explore.card.help.title",
        hintKey: "explore.card.help.hint",
      },
      {
        href: "/bank/glossary",
        iconBg: "linear-gradient(135deg, #475569, #0d9488)",
        iconChar: "≡",
        titleKey: "explore.card.glossary.title",
        hintKey: "explore.card.glossary.hint",
      },
    ],
  },
  {
    groupKey: "explore.group.daily",
    items: [
      {
        href: "/bank",
        iconBg: "linear-gradient(135deg, #0d9488, #0ea5e9)",
        iconChar: "₳",
        titleKey: "explore.card.bank.title",
        hintKey: "explore.card.bank.hint",
      },
      {
        href: "/bank/inbox",
        iconBg: "linear-gradient(135deg, #0ea5e9, #6366f1)",
        iconChar: "✉",
        titleKey: "explore.card.inbox.title",
        hintKey: "explore.card.inbox.hint",
      },
      {
        href: "/bank/statement",
        iconBg: "linear-gradient(135deg, #475569, #0f172a)",
        iconChar: "▤",
        titleKey: "explore.card.statement.title",
        hintKey: "explore.card.statement.hint",
      },
      {
        href: "/bank/notifications",
        iconBg: "linear-gradient(135deg, #d97706, #db2777)",
        iconChar: "✦",
        titleKey: "explore.card.notifications.title",
        hintKey: "explore.card.notifications.hint",
      },
      {
        href: "/bank/savings",
        iconBg: "linear-gradient(135deg, #d97706, #fbbf24)",
        iconChar: "◈",
        titleKey: "explore.card.savings.title",
        hintKey: "explore.card.savings.hint",
      },
    ],
  },
  {
    groupKey: "explore.group.social",
    items: [
      {
        href: "/bank/leaderboard",
        iconBg: "linear-gradient(135deg, #fbbf24, #d97706)",
        iconChar: "★",
        titleKey: "explore.card.leaderboard.title",
        hintKey: "explore.card.leaderboard.hint",
      },
      {
        href: "/bank/share/anon?name=Demo&score=0.62&tier=trusted",
        iconBg: "linear-gradient(135deg, #6366f1, #db2777)",
        iconChar: "@",
        titleKey: "explore.card.share.title",
        hintKey: "explore.card.share.hint",
        badgeKey: "explore.badge.demo",
      },
      {
        href: "/bank/badge",
        iconBg: "linear-gradient(135deg, #0d9488, #0ea5e9)",
        iconChar: "✦",
        titleKey: "explore.card.badge.title",
        hintKey: "explore.card.badge.hint",
      },
    ],
  },
  {
    groupKey: "explore.group.flow",
    items: [
      {
        href: "/bank/pay?to=acc_demo&amount=12.50&label=Demo",
        iconBg: "linear-gradient(135deg, #0d9488, #5eead4)",
        iconChar: "▦",
        titleKey: "explore.card.pay.title",
        hintKey: "explore.card.pay.hint",
        badgeKey: "explore.badge.demo",
      },
      {
        href: "/bank/qr-scan",
        iconBg: "linear-gradient(135deg, #0f172a, #0d9488)",
        iconChar: "⬚",
        titleKey: "explore.card.scan.title",
        hintKey: "explore.card.scan.hint",
      },
      {
        href: "/bank/contacts",
        iconBg: "linear-gradient(135deg, #0d9488, #475569)",
        iconChar: "✉",
        titleKey: "explore.card.contacts.title",
        hintKey: "explore.card.contacts.hint",
      },
      {
        href: "/bank/circles",
        iconBg: "linear-gradient(135deg, #7c3aed, #0d9488)",
        iconChar: "◌",
        titleKey: "explore.card.circles.title",
        hintKey: "explore.card.circles.hint",
      },
      {
        href: "/bank/insights",
        iconBg: "linear-gradient(135deg, #d97706, #db2777)",
        iconChar: "◐",
        titleKey: "explore.card.insights.title",
        hintKey: "explore.card.insights.hint",
      },
      {
        href: "/bank/recurring",
        iconBg: "linear-gradient(135deg, #0d9488, #6366f1)",
        iconChar: "↻",
        titleKey: "explore.card.recurring.title",
        hintKey: "explore.card.recurring.hint",
      },
      {
        href: "/bank/budget",
        iconBg: "linear-gradient(135deg, #d97706, #fbbf24)",
        iconChar: "▣",
        titleKey: "explore.card.budget.title",
        hintKey: "explore.card.budget.hint",
      },
      {
        href: "/bank/calendar",
        iconBg: "linear-gradient(135deg, #0d9488, #5eead4)",
        iconChar: "▦",
        titleKey: "explore.card.calendar.title",
        hintKey: "explore.card.calendar.hint",
      },
      {
        href: "/bank/subscriptions",
        iconBg: "linear-gradient(135deg, #dc2626, #db2777)",
        iconChar: "⚠",
        titleKey: "explore.card.subscriptions.title",
        hintKey: "explore.card.subscriptions.hint",
      },
      {
        href: "/bank/forecast",
        iconBg: "linear-gradient(135deg, #0ea5e9, #5eead4)",
        iconChar: "⇗",
        titleKey: "explore.card.forecast.title",
        hintKey: "explore.card.forecast.hint",
      },
      {
        href: "/bank/trip",
        iconBg: "linear-gradient(135deg, #6366f1, #a78bfa)",
        iconChar: "✈",
        titleKey: "explore.card.trip.title",
        hintKey: "explore.card.trip.hint",
      },
      {
        href: "/bank/brief",
        iconBg: "linear-gradient(135deg, #0ea5e9, #6366f1)",
        iconChar: "📰",
        titleKey: "explore.card.brief.title",
        hintKey: "explore.card.brief.hint",
      },
      {
        href: "/bank/achievements",
        iconBg: "linear-gradient(135deg, #fbbf24, #d97706)",
        iconChar: "★",
        titleKey: "explore.card.achievements.title",
        hintKey: "explore.card.achievements.hint",
      },
      {
        href: "/bank/challenges",
        iconBg: "linear-gradient(135deg, #f87171, #db2777)",
        iconChar: "🏁",
        titleKey: "explore.card.challenges.title",
        hintKey: "explore.card.challenges.hint",
      },
      {
        href: "/bank/networth",
        iconBg: "linear-gradient(135deg, #0d9488, #0ea5e9)",
        iconChar: "📈",
        titleKey: "explore.card.networth.title",
        hintKey: "explore.card.networth.hint",
      },
      {
        href: "/bank/timetravel",
        iconBg: "linear-gradient(135deg, #7c3aed, #a78bfa)",
        iconChar: "⏪",
        titleKey: "explore.card.timetravel.title",
        hintKey: "explore.card.timetravel.hint",
      },
      {
        href: "/bank/constellation",
        iconBg: "linear-gradient(135deg, #6366f1, #db2777)",
        iconChar: "✧",
        titleKey: "explore.card.constellation.title",
        hintKey: "explore.card.constellation.hint",
      },
      {
        href: "/bank/flow",
        iconBg: "linear-gradient(135deg, #0d9488, #f472b6)",
        iconChar: "⤳",
        titleKey: "explore.card.flow.title",
        hintKey: "explore.card.flow.hint",
      },
      {
        href: "/bank/onboarding",
        iconBg: "linear-gradient(135deg, #5eead4, #0ea5e9)",
        iconChar: "▶",
        titleKey: "explore.card.onboarding.title",
        hintKey: "explore.card.onboarding.hint",
      },
      {
        href: "/bank/r/AEDEMO?from=Lana&tier=advocate",
        iconBg: "linear-gradient(135deg, #7c3aed, #db2777)",
        iconChar: "♥",
        titleKey: "explore.card.referral.title",
        hintKey: "explore.card.referral.hint",
        badgeKey: "explore.badge.demo",
      },
      {
        href: "/bank/gift/demo?p=eyJ2IjoxLCJnIjp7ImlkIjoiZGVtbyIsInJlY2lwaWVudEFjY291bnRJZCI6ImRlbW8iLCJyZWNpcGllbnROaWNrbmFtZSI6IkRlbW8iLCJhbW91bnQiOjI1LCJ0aGVtZUlkIjoidGhhbmtzIiwibWVzc2FnZSI6IlRoYW5rIHlvdSEiLCJzZW50QXQiOiIyMDI2LTA0LTI3VDAwOjAwOjAwWiJ9fQ",
        iconBg: "linear-gradient(135deg, #0d9488, #0ea5e9)",
        iconChar: "♥",
        titleKey: "explore.card.gift.title",
        hintKey: "explore.card.gift.hint",
        badgeKey: "explore.badge.demo",
      },
    ],
  },
  {
    groupKey: "explore.group.developers",
    items: [
      {
        href: "/bank/api",
        iconBg: "linear-gradient(135deg, #0f172a, #475569)",
        iconChar: "⌘",
        titleKey: "explore.card.api.title",
        hintKey: "explore.card.api.hint",
      },
      {
        href: "/api/openapi.json",
        iconBg: "linear-gradient(135deg, #475569, #0f172a)",
        iconChar: "{ }",
        titleKey: "explore.card.openapi.title",
        hintKey: "explore.card.openapi.hint",
        external: true,
      },
    ],
  },
];

export default function ExplorePage() {
  const { t } = useI18n();
  return (
    <main
      style={{
        maxWidth: 920,
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
        ← {t("explore.backToBank")}
      </Link>

      <header style={{ marginTop: 14, marginBottom: 22 }}>
        <h1 style={{ fontSize: 30, fontWeight: 900, margin: 0, letterSpacing: -0.5 }}>
          {t("explore.title")}
        </h1>
        <div style={{ fontSize: 14, color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>
          {t("explore.subtitle")}
        </div>
      </header>

      <InstallBanner />

      {CARDS.map((group, gi) => (
        <section key={gi} style={{ marginBottom: 24 }}>
          <h2
            style={{
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#64748b",
              margin: "0 0 10px 0",
            }}
          >
            {t(group.groupKey)}
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 10,
            }}
          >
            {group.items.map((card, ci) => (
              <CardLink
                key={`${gi}-${ci}`}
                card={card}
                title={t(card.titleKey)}
                hint={t(card.hintKey)}
                badge={card.badgeKey ? t(card.badgeKey) : null}
              />
            ))}
          </div>
        </section>
      ))}

      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 12, lineHeight: 1.55 }}>
        {t("explore.disclaimer")}
      </div>

      <SubrouteFooter active="/bank/explore" />
    </main>
  );
}

function CardLink({
  card,
  title,
  hint,
  badge,
}: {
  card: Card;
  title: string;
  hint: string;
  badge: string | null;
}) {
  const inner = (
    <div
      style={{
        background: "#fff",
        borderRadius: 14,
        border: "1px solid rgba(15,23,42,0.08)",
        padding: 14,
        display: "grid",
        gridTemplateColumns: "44px 1fr",
        gap: 12,
        alignItems: "flex-start",
        height: "100%",
        boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
        transition: "transform 200ms ease, box-shadow 200ms ease",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 6px 16px rgba(15,23,42,0.10)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(15,23,42,0.04)";
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: card.iconBg,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          fontWeight: 900,
          boxShadow: "0 4px 10px rgba(15,23,42,0.12)",
        }}
      >
        {card.iconChar}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{title}</div>
          {badge ? (
            <span
              style={{
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: 1,
                textTransform: "uppercase",
                padding: "2px 6px",
                borderRadius: 999,
                background: "rgba(13,148,136,0.10)",
                color: "#0d9488",
              }}
            >
              {badge}
            </span>
          ) : null}
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, lineHeight: 1.45 }}>
          {hint}
        </div>
      </div>
    </div>
  );

  if (card.external) {
    return (
      <a href={card.href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", color: "inherit" }}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={card.href} style={{ textDecoration: "none", color: "inherit" }}>
      {inner}
    </Link>
  );
}
