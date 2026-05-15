"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

// Mini-nav for the standalone bank sub-routes. Each row has a
// back-to-bank link at the top — this footer adds lateral movement so
// the user doesn't have to bounce through /bank to reach a sibling page.
//
// Rendered at the bottom of every standalone subroute page; if the
// user is already on one of the listed routes that link is muted.

const ITEMS = [
  { href: "/bank",               labelKey: "subnav.bank",          icon: "₳" },
  { href: "/bank/inbox",         labelKey: "subnav.inbox",         icon: "✉" },
  { href: "/bank/notifications", labelKey: "subnav.notifications", icon: "✦" },
  { href: "/bank/leaderboard",   labelKey: "subnav.leaderboard",   icon: "★" },
  { href: "/bank/explore",       labelKey: "subnav.explore",       icon: "◫" },
] as const;

export function SubrouteFooter({ active }: { active?: string }) {
  const { t } = useI18n();
  return (
    <nav
      aria-label={t("subnav.aria")}
      style={{
        marginTop: 32,
        paddingTop: 16,
        borderTop: "1px solid rgba(15,23,42,0.08)",
        display: "flex",
        gap: 6,
        flexWrap: "wrap",
        justifyContent: "center",
      }}
    >
      {ITEMS.map((item) => {
        const isActive = active === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 999,
              border: isActive ? "1px solid rgba(15,23,42,0.20)" : "1px solid rgba(15,23,42,0.08)",
              background: isActive ? "rgba(15,23,42,0.04)" : "transparent",
              color: isActive ? "#94a3b8" : "#475569",
              fontSize: 11,
              fontWeight: 700,
              textDecoration: "none",
              cursor: isActive ? "default" : "pointer",
              pointerEvents: isActive ? "none" : "auto",
            }}
          >
            <span aria-hidden="true" style={{ fontSize: 12, fontWeight: 900, color: isActive ? "#cbd5e1" : "#64748b" }}>
              {item.icon}
            </span>
            <span>{t(item.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
