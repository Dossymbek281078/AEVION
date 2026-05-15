"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "../_lib/CurrencyContext";
import { formatCurrency } from "../_lib/currency";
import { SOURCE_COLOR, SOURCE_LABEL_KEY } from "../_lib/ecosystem";
import { useEcosystemData } from "../_lib/EcosystemDataContext";
import { formatCountdown } from "../_lib/chess";
import type { Operation } from "../_lib/types";
import { SkeletonBlock } from "./Skeleton";

type PulseRow = {
  source: "banking" | "qright" | "chess" | "planet";
  icon: string;
  todayCount: number;
  todayAmount: number;
  primary: string;
  secondary: string;
  href: string;
  cta: string;
};

const SOURCE_ICON: Record<PulseRow["source"], string> = {
  banking: "₳",
  qright: "♪",
  chess: "♞",
  planet: "◉",
};

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function EcosystemPulse({
  accountId,
  operations,
}: {
  accountId: string;
  operations: Operation[];
}) {
  const { t } = useI18n();
  const { royalty, chess, ecosystem } = useEcosystemData();
  const { code } = useCurrency();

  const rows = useMemo<PulseRow[] | null>(() => {
    if (!ecosystem) return null;
    const today = new Date();

    // QRight today
    let qrightCount = 0;
    let qrightAmount = 0;
    for (const ev of royalty?.recentEvents ?? []) {
      const t = new Date(ev.timestamp);
      if (isSameDay(t, today)) {
        qrightCount++;
        qrightAmount += ev.amount;
      }
    }
    const qrightSecondary = royalty
      ? royalty.works.length > 0
        ? t("ep.row.qright.secondary.has", { works: royalty.works.length, ver: royalty.works.reduce((s, w) => s + w.verifications, 0) })
        : t("ep.row.qright.secondary.empty")
      : "—";

    // Chess today / upcoming
    let chessCount = 0;
    let chessAmount = 0;
    if (chess) {
      for (const r of chess.results) {
        const t = new Date(r.finishedAt);
        if (isSameDay(t, today)) {
          chessCount++;
          chessAmount += r.prize;
        }
      }
    }
    const nextUp = chess?.upcoming[0];
    const chessSecondary = nextUp
      ? t("ep.row.chess.secondary.next", { name: nextUp.name, countdown: formatCountdown(nextUp.startsAt, t) })
      : chess
        ? t("ep.row.chess.secondary.rating", { n: chess.currentRating })
        : "—";

    // Planet today
    let planetCount = 0;
    let planetAmount = 0;
    for (const ev of ecosystem.recent) {
      if (ev.source !== "planet") continue;
      const t = new Date(ev.timestamp);
      if (isSameDay(t, today)) {
        planetCount++;
        planetAmount += ev.amount;
      }
    }
    const planetSecondary = t("ep.row.planet.secondary", { amt: ecosystem.perSource.planet.last30d.toFixed(0) });

    // Banking today
    let bankingCount = 0;
    let bankingAmount = 0;
    for (const op of operations) {
      const t = new Date(op.createdAt);
      if (!isSameDay(t, today)) continue;
      if (op.to === accountId || op.from === accountId) {
        bankingCount++;
        if (op.to === accountId) bankingAmount += op.amount;
      }
    }
    const bankingSecondary = t("ep.row.banking.secondary", { amt: ecosystem.perSource.banking.last30d.toFixed(0) });

    return [
      {
        source: "qright",
        icon: SOURCE_ICON.qright,
        todayCount: qrightCount,
        todayAmount: qrightAmount,
        primary: qrightCount > 0 ? t("ep.row.qright.has", { n: qrightCount }) : t("ep.row.qright.empty"),
        secondary: qrightSecondary,
        href: "/qright",
        cta: t("ep.row.qright.cta"),
      },
      {
        source: "chess",
        icon: SOURCE_ICON.chess,
        todayCount: chessCount,
        todayAmount: chessAmount,
        primary: chessCount > 0 ? (chessCount === 1 ? t("ep.row.chess.has.one") : t("ep.row.chess.has.many", { n: chessCount })) : t("ep.row.chess.empty"),
        secondary: chessSecondary,
        href: "/cyberchess",
        cta: t("ep.row.chess.cta"),
      },
      {
        source: "planet",
        icon: SOURCE_ICON.planet,
        todayCount: planetCount,
        todayAmount: planetAmount,
        primary: planetCount > 0 ? (planetCount === 1 ? t("ep.row.planet.has.one") : t("ep.row.planet.has.many", { n: planetCount })) : t("ep.row.planet.empty"),
        secondary: planetSecondary,
        href: "/planet",
        cta: t("ep.row.planet.cta"),
      },
      {
        source: "banking",
        icon: SOURCE_ICON.banking,
        todayCount: bankingCount,
        todayAmount: bankingAmount,
        primary:
          bankingCount > 0
            ? (bankingCount === 1 ? t("ep.row.banking.has.one") : t("ep.row.banking.has.many", { n: bankingCount }))
            : t("ep.row.banking.empty"),
        secondary: bankingSecondary,
        href: "/qtrade",
        cta: t("ep.row.banking.cta"),
      },
    ];
  }, [royalty, chess, ecosystem, operations, accountId, t]);

  if (!rows) {
    return (
      <section
        style={{
          border: "1px solid rgba(15,23,42,0.1)",
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          background: "linear-gradient(180deg, rgba(13,148,136,0.04) 0%, #ffffff 100%)",
        }}
      >
        <SkeletonBlock label={t("ep.loading")} minHeight={180} />
      </section>
    );
  }

  const totalToday = rows.reduce((s, r) => s + r.todayAmount, 0);
  const eventsToday = rows.reduce((s, r) => s + r.todayCount, 0);

  return (
    <section
      style={{
        border: "1px solid rgba(13,148,136,0.22)",
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        background: "linear-gradient(135deg, rgba(13,148,136,0.05), rgba(124,58,237,0.04))",
      }}
      aria-labelledby="ecosystem-pulse-heading"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            aria-hidden="true"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "linear-gradient(135deg, #0d9488, #7c3aed)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              fontWeight: 900,
            }}
          >
            ✺
          </span>
          <div>
            <h2
              id="ecosystem-pulse-heading"
              style={{ fontSize: 16, fontWeight: 900, margin: 0, color: "#134e4a" }}
            >
              {t("ep.title")}
            </h2>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
              {t("ep.subtitle")}
            </div>
          </div>
        </div>
        <div
          style={{
            padding: "6px 12px",
            borderRadius: 999,
            background: "rgba(13,148,136,0.14)",
            color: "#134e4a",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.04em",
          }}
        >
          {t("ep.summary", { events: eventsToday, amt: formatCurrency(totalToday, code, { decimals: 2, sign: totalToday > 0 }) })}
        </div>
      </div>

      <ul
        role="list"
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 10,
        }}
      >
        {rows.map((r) => {
          const color = SOURCE_COLOR[r.source];
          const hasActivity = r.todayCount > 0;
          return (
            <li key={r.source}>
              <Link
                href={r.href}
                aria-label={t("ep.row.aria", { cta: r.cta, primary: r.primary })}
                style={{
                  display: "block",
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: `1px solid ${color}${hasActivity ? "44" : "22"}`,
                  background: hasActivity
                    ? `linear-gradient(135deg, ${color}12, ${color}04)`
                    : "#ffffffcc",
                  textDecoration: "none",
                  color: "inherit",
                  transition: "transform 200ms ease, box-shadow 200ms ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = `0 4px 14px ${color}22`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: `${color}22`,
                      color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: 900,
                      flexShrink: 0,
                    }}
                  >
                    {r.icon}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase" as const,
                        color: "#64748b",
                      }}
                    >
                      {t(SOURCE_LABEL_KEY[r.source])}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 900,
                    color: hasActivity ? color : "#0f172a",
                    marginBottom: 3,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {r.primary}
                </div>
                {hasActivity ? (
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#334155", marginBottom: 4 }}>
                    {formatCurrency(r.todayAmount, code, { sign: r.todayAmount > 0 })}
                  </div>
                ) : null}
                <div
                  style={{
                    fontSize: 11,
                    color: "#64748b",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap" as const,
                  }}
                >
                  {r.secondary}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 11,
                    fontWeight: 800,
                    color,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {r.cta} <span aria-hidden="true">→</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
