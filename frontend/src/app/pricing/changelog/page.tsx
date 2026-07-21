"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";
import { track } from "@/lib/track";
import { usePricingT } from "@/lib/pricingI18n";
import { useI18n } from "@/lib/i18n";

type EntryKind = "added" | "changed" | "removed" | "deprecated" | "promo" | "module";

interface ChangeEntry {
  date: string;
  kind: EntryKind;
  title: string;
  body: string;
  scope?: string;
}

interface ChangelogPayload {
  items: ChangeEntry[];
  total: number;
  counts: Partial<Record<EntryKind, number>>;
  kind: EntryKind | null;
  since: string | null;
}

const CARD = "0 4px 20px rgba(15,23,42,0.06)";
const BORDER = "1px solid rgba(15,23,42,0.08)";

const KIND_META: Record<EntryKind, { labelKey: string; bg: string; fg: string }> = {
  added: { labelKey: "pricing.changelog.kind.added", bg: "#d1fae5", fg: "#065f46" },
  changed: { labelKey: "pricing.changelog.kind.changed", bg: "#dbeafe", fg: "#1e40af" },
  removed: { labelKey: "pricing.changelog.kind.removed", bg: "#fee2e2", fg: "#991b1b" },
  deprecated: { labelKey: "pricing.changelog.kind.deprecated", bg: "#fef3c7", fg: "#92400e" },
  promo: { labelKey: "pricing.changelog.kind.promo", bg: "#fce7f3", fg: "#9d174d" },
  module: { labelKey: "pricing.changelog.kind.module", bg: "#e0f2fe", fg: "#075985" },
};

interface ChangeEntrySeed {
  date: string;
  kind: EntryKind;
  titleKey: string;
  bodyKey: string;
  scope?: string;
}

const ENTRIES_FALLBACK_SEED: ChangeEntrySeed[] = [
  {
    date: "2026-04-28",
    kind: "added",
    titleKey: "pricing.changelog.entry.compareMatrix.title",
    bodyKey: "pricing.changelog.entry.compareMatrix.body",
    scope: "compare-page",
  },
  {
    date: "2026-04-28",
    kind: "added",
    titleKey: "pricing.changelog.entry.cases.title",
    bodyKey: "pricing.changelog.entry.cases.body",
    scope: "cases-page",
  },
  {
    date: "2026-04-28",
    kind: "added",
    titleKey: "pricing.changelog.entry.refundPolicy.title",
    bodyKey: "pricing.changelog.entry.refundPolicy.body",
    scope: "refund-policy",
  },
  {
    date: "2026-04-27",
    kind: "added",
    titleKey: "pricing.changelog.entry.securityPage.title",
    bodyKey: "pricing.changelog.entry.securityPage.body",
    scope: "security-page",
  },
  {
    date: "2026-04-27",
    kind: "added",
    titleKey: "pricing.changelog.entry.ogImages.title",
    bodyKey: "pricing.changelog.entry.ogImages.body",
    scope: "seo",
  },
  {
    date: "2026-04-27",
    kind: "added",
    titleKey: "pricing.changelog.entry.roadmapPage.title",
    bodyKey: "pricing.changelog.entry.roadmapPage.body",
    scope: "roadmap-page",
  },
  {
    date: "2026-04-27",
    kind: "added",
    titleKey: "pricing.changelog.entry.customerLogos.title",
    bodyKey: "pricing.changelog.entry.customerLogos.body",
    scope: "logos",
  },
  {
    date: "2026-04-27",
    kind: "added",
    titleKey: "pricing.changelog.entry.i18nLocalization.title",
    bodyKey: "pricing.changelog.entry.i18nLocalization.body",
    scope: "i18n",
  },
  {
    date: "2026-04-27",
    kind: "added",
    titleKey: "pricing.changelog.entry.billingProvisioning.title",
    bodyKey: "pricing.changelog.entry.billingProvisioning.body",
    scope: "billing",
  },
  {
    date: "2026-04-27",
    kind: "added",
    titleKey: "pricing.changelog.entry.trustSignals.title",
    bodyKey: "pricing.changelog.entry.trustSignals.body",
    scope: "trust-signals",
  },
  {
    date: "2026-04-26",
    kind: "promo",
    titleKey: "pricing.changelog.entry.promoCodes.title",
    bodyKey: "pricing.changelog.entry.promoCodes.body",
    scope: "promo",
  },
  {
    date: "2026-04-26",
    kind: "added",
    titleKey: "pricing.changelog.entry.freeTrial.title",
    bodyKey: "pricing.changelog.entry.freeTrial.body",
    scope: "trial",
  },
  {
    date: "2026-04-26",
    kind: "added",
    titleKey: "pricing.changelog.entry.analyticsEvents.title",
    bodyKey: "pricing.changelog.entry.analyticsEvents.body",
    scope: "analytics",
  },
  {
    date: "2026-04-26",
    kind: "added",
    titleKey: "pricing.changelog.entry.stripeCheckout.title",
    bodyKey: "pricing.changelog.entry.stripeCheckout.body",
    scope: "checkout",
  },
  {
    date: "2026-04-26",
    kind: "added",
    titleKey: "pricing.changelog.entry.leadForm.title",
    bodyKey: "pricing.changelog.entry.leadForm.body",
    scope: "leads",
  },
  {
    date: "2026-04-26",
    kind: "added",
    titleKey: "pricing.changelog.entry.industryLandings.title",
    bodyKey: "pricing.changelog.entry.industryLandings.body",
    scope: "industries",
  },
  {
    date: "2026-04-26",
    kind: "added",
    titleKey: "pricing.changelog.entry.competitorCompare.title",
    bodyKey: "pricing.changelog.entry.competitorCompare.body",
    scope: "compare-mini",
  },
  {
    date: "2026-04-26",
    kind: "added",
    titleKey: "pricing.changelog.entry.tierPages.title",
    bodyKey: "pricing.changelog.entry.tierPages.body",
    scope: "tier-pages",
  },
  {
    date: "2026-04-26",
    kind: "added",
    titleKey: "pricing.changelog.entry.gtmApi.title",
    bodyKey: "pricing.changelog.entry.gtmApi.body",
    scope: "core",
  },
];

export default function PricingChangelogPage() {
  const tp = usePricingT();
  const { t } = useI18n();
  const fallbackEntries = useMemo<ChangeEntry[]>(
    () =>
      ENTRIES_FALLBACK_SEED.map((seed) => ({
        date: seed.date,
        kind: seed.kind,
        scope: seed.scope,
        title: t(seed.titleKey),
        body: t(seed.bodyKey),
      })),
    [t],
  );
  const [filter, setFilter] = useState<EntryKind | null>(null);
  const [entries, setEntries] = useState<ChangeEntry[]>(fallbackEntries);
  const [usingFallback, setUsingFallback] = useState(true);
  const [counts, setCounts] = useState<Partial<Record<EntryKind, number>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (usingFallback) setEntries(fallbackEntries);
  }, [fallbackEntries, usingFallback]);

  useEffect(() => {
    track({ type: "page_view", source: "pricing/changelog" });
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const url = apiUrl("/api/pricing/changelog") + "?limit=500" + (filter ? `&kind=${filter}` : "");
        const r = await fetch(url);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = (await r.json()) as ChangelogPayload;
        if (cancelled) return;
        setEntries(j.items);
        setUsingFallback(false);
        setCounts(j.counts);
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setUsingFallback(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, ChangeEntry[]>();
    for (const e of entries) {
      const month = e.date.slice(0, 7);
      const arr = map.get(month) ?? [];
      arr.push(e);
      map.set(month, arr);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries]);

  const totalForFilter = entries.length;

  return (
    <ProductPageShell maxWidth={920}>
      <div style={{ marginBottom: 16 }}>
        <Link
          href="/pricing"
          style={{ color: "#64748b", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
        >
          {tp("back.allTiers")}
        </Link>
      </div>

      {/* Hero */}
      <section style={{ textAlign: "center", padding: "32px 0 24px" }}>
        <div
          style={{
            display: "inline-block",
            padding: "4px 12px",
            background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.06em",
            borderRadius: 999,
            marginBottom: 16,
          }}
        >
          {tp("changelog.badge")}
        </div>
        <h1
          style={{
            fontSize: 40,
            fontWeight: 900,
            margin: 0,
            marginBottom: 12,
            letterSpacing: "-0.025em",
            color: "#0f172a",
          }}
        >
          {tp("changelog.title")}
        </h1>
        <p
          style={{
            fontSize: 16,
            color: "#475569",
            maxWidth: 640,
            margin: "0 auto",
            lineHeight: 1.5,
          }}
        >
          {tp("changelog.subtitle")}
        </p>
      </section>

      {/* Filters */}
      <section
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 24,
          padding: "12px 14px",
          background: "rgba(13,148,136,0.04)",
          borderRadius: 10,
          border: "1px solid rgba(13,148,136,0.12)",
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 800, color: "#475569", letterSpacing: "0.06em" }}>
          {tp("changelog.filter")}
        </span>
        <FilterChip
          active={filter === null}
          onClick={() => setFilter(null)}
          label={`${tp("changelog.filterAll")} · ${filter === null ? totalForFilter : Object.values(counts).reduce((a, b) => a + (b ?? 0), 0)}`}
        />
        {(Object.keys(KIND_META) as EntryKind[]).map((k) => {
          const c = counts[k] ?? 0;
          if (c === 0) return null;
          const meta = KIND_META[k];
          return (
            <FilterChip
              key={k}
              active={filter === k}
              onClick={() => setFilter(filter === k ? null : k)}
              label={`${t(meta.labelKey)} · ${c}`}
              tint={meta.fg}
            />
          );
        })}
      </section>

      {error && (
        <div
          style={{
            padding: 12,
            marginBottom: 16,
            background: "#fef3c7",
            color: "#92400e",
            borderRadius: 8,
            fontSize: 12,
          }}
        >
          {t("pricing.changelog.fetchError", { error })}
        </div>
      )}

      {loading && entries.length === 0 && (
        <div
          style={{
            padding: 24,
            background: "#f8fafc",
            border: BORDER,
            borderRadius: 12,
            textAlign: "center",
            color: "#64748b",
            fontSize: 13,
          }}
        >
          {t("pricing.changelog.loadingEntries")}
        </div>
      )}

      {/* Timeline grouped by month */}
      <section style={{ marginBottom: 32 }}>
        {grouped.length === 0 ? (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              color: "#64748b",
              background: "#f8fafc",
              borderRadius: 12,
              border: BORDER,
            }}
          >
            {tp("changelog.empty")}
          </div>
        ) : (
          grouped.map(([month, items]) => (
            <div key={month} style={{ marginBottom: 28 }}>
              <h2
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  color: "#94a3b8",
                  margin: 0,
                  marginBottom: 10,
                  textTransform: "uppercase",
                }}
              >
                {monthLabel(month, t)} ·{" "}
                {items.length === 1
                  ? t("pricing.changelog.entriesCountOne", { count: items.length })
                  : t("pricing.changelog.entriesCountMany", { count: items.length })}
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((e, i) => {
                  const meta = KIND_META[e.kind];
                  return (
                    <article
                      key={`${e.date}-${i}`}
                      style={{
                        background: "#fff",
                        border: BORDER,
                        borderRadius: 12,
                        padding: "14px 18px",
                        boxShadow: CARD,
                        display: "grid",
                        gridTemplateColumns: "auto 1fr",
                        gap: 16,
                        alignItems: "start",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start", minWidth: 100 }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            color: "#475569",
                            fontFamily: "ui-monospace, monospace",
                            letterSpacing: "0.04em",
                          }}
                        >
                          {e.date}
                        </span>
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 800,
                            padding: "2px 6px",
                            borderRadius: 4,
                            letterSpacing: "0.06em",
                            background: meta.bg,
                            color: meta.fg,
                          }}
                        >
                          {t(meta.labelKey)}
                        </span>
                      </div>
                      <div>
                        <h3
                          style={{
                            fontSize: 15,
                            fontWeight: 800,
                            margin: 0,
                            marginBottom: 4,
                            color: "#0f172a",
                            letterSpacing: "-0.01em",
                          }}
                        >
                          {e.title}
                        </h3>
                        <p style={{ margin: 0, fontSize: 13, color: "#475569", lineHeight: 1.55 }}>{e.body}</p>
                        {e.scope && (
                          <span
                            style={{
                              display: "inline-block",
                              marginTop: 6,
                              fontSize: 10,
                              fontWeight: 700,
                              color: "#94a3b8",
                              fontFamily: "ui-monospace, monospace",
                              letterSpacing: "0.04em",
                            }}
                          >
                            {e.scope}
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </section>

      {/* Subscribe CTA */}
      <section
        style={{
          marginBottom: 56,
          padding: 24,
          background: "linear-gradient(135deg, #0f172a, #1e293b)",
          borderRadius: 16,
          color: "#f8fafc",
          textAlign: "center",
        }}
      >
        <h3 style={{ fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 8, letterSpacing: "-0.02em" }}>
          {tp("changelog.subscribeTitle")}
        </h3>
        <p style={{ color: "#94a3b8", margin: 0, marginBottom: 18, fontSize: 14 }}>
          {tp("changelog.subscribeSubtitle")}
        </p>
        <div style={{ display: "inline-flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <Link
            href="/pricing#newsletter"
            style={{
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 800,
              borderRadius: 10,
              background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
              color: "#fff",
              textDecoration: "none",
            }}
          >
            {tp("changelog.subscribeCta")}
          </Link>
          <Link
            href="/pricing/roadmap"
            style={{
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 800,
              borderRadius: 10,
              background: "rgba(255,255,255,0.1)",
              color: "#fff",
              textDecoration: "none",
              border: "1px solid rgba(255,255,255,0.2)",
            }}
          >
            {tp("changelog.roadmapCta")}
          </Link>
        </div>
      </section>
    </ProductPageShell>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  tint = "#0d9488",
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  tint?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 12px",
        fontSize: 11,
        fontWeight: 800,
        borderRadius: 999,
        border: active ? "none" : "1px solid rgba(15,23,42,0.12)",
        cursor: "pointer",
        background: active ? tint : "#fff",
        color: active ? "#fff" : "#475569",
        letterSpacing: "0.04em",
      }}
    >
      {label}
    </button>
  );
}

function monthLabel(month: string, t: (key: string, vars?: Record<string, string | number>) => string): string {
  const [y, m] = month.split("-").map((s) => parseInt(s, 10));
  const key = `pricing.changelog.month.${String(((m - 1) % 12) + 1).padStart(2, "0")}`;
  return `${t(key)} ${y}`;
}
