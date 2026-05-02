"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";
import { track } from "@/lib/track";
import { usePricingT } from "@/lib/pricingI18n";

type TierId = "free" | "pro" | "business" | "enterprise";
type ModuleKind = "core" | "product" | "service" | "experiment";
type ModuleAvailability = "live" | "beta" | "soon" | "on_request";

interface PricingTier {
  id: TierId;
  name: string;
  tagline: string;
  priceMonthly: number | null;
  priceAnnualPerMonth: number | null;
  features: string[];
  ctaLabel: string;
  highlight?: boolean;
}

interface ModulePrice {
  id: string;
  name: string;
  code: string;
  kind: ModuleKind;
  addonMonthly: number | null;
  includedIn: TierId[];
  availability: ModuleAvailability;
  oneLiner: string;
  tags: string[];
}

interface PricingPayload {
  tiers: PricingTier[];
  modules: ModulePrice[];
  currencies: Record<string, { rate: number; symbol: string; label: string }>;
}

const CARD = "0 4px 20px rgba(15,23,42,0.06)";
const BORDER = "1px solid rgba(15,23,42,0.08)";

const KIND_LABELS: Record<ModuleKind, { ru: string; en: string; color: string }> = {
  core: { ru: "Core / Платформа", en: "Core / Platform", color: "#0d9488" },
  product: { ru: "Продукты", en: "Products", color: "#0ea5e9" },
  service: { ru: "Сервисы", en: "Services", color: "#7c3aed" },
  experiment: { ru: "Эксперименты", en: "Experiments", color: "#f59e0b" },
};

const KIND_ORDER: ModuleKind[] = ["core", "product", "service", "experiment"];

export default function PricingComparePage() {
  const tp = usePricingT();
  const [data, setData] = useState<PricingPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterKind, setFilterKind] = useState<ModuleKind | null>(null);
  const [hideUnavailable, setHideUnavailable] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    fetch(apiUrl("/api/pricing"))
      .then((r) => r.json())
      .then((j: PricingPayload) => setData(j))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    track({ type: "page_view", source: "pricing/compare" });
  }, []);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 240);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const grouped = useMemo(() => {
    if (!data) return [];
    const by: Record<ModuleKind, ModulePrice[]> = {
      core: [],
      product: [],
      service: [],
      experiment: [],
    };
    for (const m of data.modules) {
      if (filterKind && m.kind !== filterKind) continue;
      if (hideUnavailable && (m.availability === "soon" || m.availability === "on_request")) continue;
      by[m.kind].push(m);
    }
    return KIND_ORDER.map((k) => ({ kind: k, items: by[k] })).filter((g) => g.items.length > 0);
  }, [data, filterKind, hideUnavailable]);

  const counts = useMemo(() => {
    if (!data) return { core: 0, product: 0, service: 0, experiment: 0 };
    return data.modules.reduce<Record<ModuleKind, number>>(
      (acc, m) => {
        acc[m.kind] = (acc[m.kind] ?? 0) + 1;
        return acc;
      },
      { core: 0, product: 0, service: 0, experiment: 0 },
    );
  }, [data]);

  if (error) {
    return (
      <ProductPageShell>
        <div
          style={{
            padding: 24,
            background: "#fee2e2",
            border: "1px solid #fca5a5",
            borderRadius: 12,
            color: "#991b1b",
          }}
        >
          <h2 style={{ margin: 0, marginBottom: 8 }}>{tp("error.unavailable")}</h2>
          <p style={{ margin: 0 }}>/api/pricing — {error}</p>
        </div>
      </ProductPageShell>
    );
  }

  if (!data) {
    return (
      <ProductPageShell>
        <div style={{ padding: 60, textAlign: "center", color: "#64748b" }}>
          {tp("loading.pricing")}
        </div>
      </ProductPageShell>
    );
  }

  const tierOrder: TierId[] = ["free", "pro", "business", "enterprise"];
  const tiers = tierOrder
    .map((id) => data.tiers.find((t) => t.id === id))
    .filter((t): t is PricingTier => Boolean(t));

  return (
    <ProductPageShell maxWidth={1280}>
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
          {tp("compareFull.badge")}
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
          {tp("compareFull.title")}
        </h1>
        <p
          style={{
            fontSize: 16,
            color: "#475569",
            maxWidth: 680,
            margin: "0 auto",
            lineHeight: 1.5,
          }}
        >
          {tp("compareFull.subtitle")}
        </p>
      </section>

      {/* Filters */}
      <section
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 20,
          padding: "12px 14px",
          background: "rgba(13,148,136,0.04)",
          borderRadius: 10,
          border: "1px solid rgba(13,148,136,0.12)",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: "#475569",
            letterSpacing: "0.06em",
            marginRight: 4,
          }}
        >
          {tp("compareFull.filterLabel")}
        </span>
        <FilterChip
          active={filterKind === null}
          onClick={() => setFilterKind(null)}
          label={`${tp("compareFull.filterAll")} · ${data.modules.length}`}
        />
        {KIND_ORDER.map((k) => (
          <FilterChip
            key={k}
            active={filterKind === k}
            onClick={() => setFilterKind(k)}
            label={`${KIND_LABELS[k].ru} · ${counts[k]}`}
            color={KIND_LABELS[k].color}
          />
        ))}
        <label
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "#475569",
            fontWeight: 700,
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          <input
            type="checkbox"
            checked={hideUnavailable}
            onChange={(e) => setHideUnavailable(e.target.checked)}
            style={{ accentColor: "#0d9488" }}
          />
          {tp("compareFull.hideUnavailable")}
        </label>
      </section>

      {/* Sticky tier headers (compact) */}
      {scrolled && (
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 20,
            background: "#fff",
            padding: "8px 0",
            borderBottom: "1px solid rgba(15,23,42,0.08)",
            marginBottom: 8,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(220px, 1.6fr) repeat(4, minmax(110px, 1fr))",
              gap: 6,
              fontSize: 11,
              fontWeight: 800,
              alignItems: "center",
            }}
          >
            <span style={{ color: "#94a3b8", letterSpacing: "0.06em" }}>
              {tp("compareFull.stickyHeader")}
            </span>
            {tiers.map((t) => (
              <span
                key={t.id}
                style={{
                  textAlign: "center",
                  color: t.highlight ? "#0d9488" : "#0f172a",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {t.name}
                {t.highlight && (
                  <span style={{ marginLeft: 4, fontSize: 9, color: "#f59e0b" }}>★</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tier headers (top) */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(220px, 1.6fr) repeat(4, minmax(160px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div />
        {tiers.map((t) => {
          const price = t.priceAnnualPerMonth ?? t.priceMonthly;
          return (
            <Link
              key={t.id}
              href={`/pricing/${t.id}`}
              style={{
                position: "relative",
                background: t.highlight ? "linear-gradient(180deg, #0f172a, #1e293b)" : "#fff",
                color: t.highlight ? "#f8fafc" : "#0f172a",
                border: t.highlight ? "none" : BORDER,
                borderRadius: 14,
                padding: "16px 14px",
                boxShadow: t.highlight ? "0 12px 40px rgba(15,23,42,0.25)" : CARD,
                textAlign: "center",
                textDecoration: "none",
              }}
            >
              {t.highlight && (
                <div
                  style={{
                    position: "absolute",
                    top: -10,
                    right: 12,
                    background: "linear-gradient(135deg, #f59e0b, #ef4444)",
                    color: "#fff",
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: "0.06em",
                    padding: "3px 8px",
                    borderRadius: 999,
                  }}
                >
                  {tp("tier.popular")}
                </div>
              )}
              <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: "-0.02em" }}>{t.name}</div>
              <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900, letterSpacing: "-0.02em" }}>
                {price === null ? (
                  <span style={{ fontSize: 14 }}>{tp("tier.byRequest")}</span>
                ) : price === 0 ? (
                  <span style={{ fontSize: 14 }}>{tp("tier.free")}</span>
                ) : (
                  <>
                    ${price}
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: t.highlight ? "#94a3b8" : "#64748b",
                        marginLeft: 2,
                      }}
                    >
                      {tp("tier.perMonth")}
                    </span>
                  </>
                )}
              </div>
            </Link>
          );
        })}
      </section>

      {/* Matrix groups */}
      {grouped.map((group) => {
        const meta = KIND_LABELS[group.kind];
        return (
          <section key={group.kind} style={{ marginBottom: 28 }}>
            <h2
              style={{
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: "0.08em",
                color: meta.color,
                margin: 0,
                marginBottom: 10,
                textTransform: "uppercase",
              }}
            >
              {meta.ru} · {group.items.length}
            </h2>
            <div
              style={{
                background: "#fff",
                border: BORDER,
                borderRadius: 12,
                overflow: "hidden",
                boxShadow: CARD,
              }}
            >
              {group.items.map((m, i) => (
                <div
                  key={m.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(220px, 1.6fr) repeat(4, minmax(110px, 1fr))",
                    gap: 6,
                    padding: "12px 14px",
                    borderTop: i === 0 ? "none" : "1px solid rgba(15,23,42,0.05)",
                    alignItems: "center",
                    background: i % 2 === 1 ? "#fafbfd" : "#fff",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{m.name}</span>
                      <AvailabilityDot a={m.availability} />
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "#64748b",
                        marginTop: 2,
                        lineHeight: 1.4,
                      }}
                    >
                      {m.oneLiner}
                    </div>
                    <div
                      style={{
                        fontSize: 9,
                        color: "#94a3b8",
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                        marginTop: 2,
                      }}
                    >
                      {m.code}
                    </div>
                  </div>
                  {tiers.map((t) => (
                    <MatrixCell key={t.id} module={m} tierId={t.id} highlight={!!t.highlight} />
                  ))}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {/* CTA row at bottom */}
      <section
        style={{
          marginTop: 40,
          marginBottom: 56,
          padding: 28,
          background: "linear-gradient(135deg, #0f172a, #1e293b)",
          borderRadius: 16,
          color: "#f8fafc",
          textAlign: "center",
        }}
      >
        <h3 style={{ fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 8, letterSpacing: "-0.02em" }}>
          {tp("compareFull.ctaTitle")}
        </h3>
        <p style={{ color: "#94a3b8", margin: 0, marginBottom: 18, fontSize: 14 }}>
          {tp("compareFull.ctaSubtitle")}
        </p>
        <div style={{ display: "inline-flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <Link
            href="/pricing#calculator"
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
            {tp("compareFull.ctaCalculator")}
          </Link>
          <Link
            href="/pricing/contact"
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
            {tp("compareFull.ctaSales")}
          </Link>
        </div>
      </section>

      {/* Legend */}
      <section
        style={{
          marginBottom: 40,
          padding: 16,
          background: "#f8fafc",
          borderRadius: 10,
          border: BORDER,
        }}
      >
        <h3 style={{ fontSize: 12, fontWeight: 800, color: "#475569", margin: 0, marginBottom: 8, letterSpacing: "0.06em" }}>
          {tp("compareFull.legendTitle")}
        </h3>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: "#475569" }}>
          <LegendItem cell={<CheckMark />} label={tp("compareFull.legendIncluded")} />
          <LegendItem cell={<span style={{ fontWeight: 800, color: "#0ea5e9" }}>+$9</span>} label={tp("compareFull.legendAddon")} />
          <LegendItem cell={<span style={{ color: "#94a3b8" }}>—</span>} label={tp("compareFull.legendUnavailable")} />
          <LegendItem
            cell={<AvailabilityDot a="live" />}
            label={tp("compareFull.legendLive")}
          />
          <LegendItem
            cell={<AvailabilityDot a="beta" />}
            label={tp("compareFull.legendBeta")}
          />
          <LegendItem
            cell={<AvailabilityDot a="soon" />}
            label={tp("compareFull.legendSoon")}
          />
        </div>
      </section>
    </ProductPageShell>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  color = "#0d9488",
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 12px",
        fontSize: 12,
        fontWeight: 800,
        borderRadius: 999,
        border: active ? "none" : "1px solid rgba(15,23,42,0.12)",
        cursor: "pointer",
        background: active ? color : "#fff",
        color: active ? "#fff" : "#475569",
        letterSpacing: "0.02em",
      }}
    >
      {label}
    </button>
  );
}

function MatrixCell({
  module: m,
  tierId,
  highlight,
}: {
  module: ModulePrice;
  tierId: TierId;
  highlight: boolean;
}) {
  const included = m.includedIn.includes(tierId);
  const isEnterpriseSlot = tierId === "enterprise";

  let content: React.ReactNode;
  let tone: "good" | "muted" | "neutral" = "neutral";

  if (included) {
    content = <CheckMark />;
    tone = "good";
  } else if (m.addonMonthly === null) {
    if (isEnterpriseSlot) {
      content = <span style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed" }}>by request</span>;
    } else {
      content = <span style={{ color: "#cbd5e1", fontSize: 16 }}>—</span>;
      tone = "muted";
    }
  } else if (m.addonMonthly === 0) {
    content = <span style={{ fontSize: 11, fontWeight: 800, color: "#0d9488" }}>FREE</span>;
    tone = "good";
  } else {
    content = (
      <span style={{ fontSize: 12, fontWeight: 800, color: "#0ea5e9" }}>
        +${m.addonMonthly}
        <span style={{ fontSize: 9, fontWeight: 700, color: "#64748b", marginLeft: 2 }}>/mo</span>
      </span>
    );
  }

  return (
    <div
      style={{
        textAlign: "center",
        padding: "6px 4px",
        borderRadius: 8,
        background:
          tone === "good" && highlight
            ? "rgba(13,148,136,0.12)"
            : tone === "good"
              ? "rgba(13,148,136,0.06)"
              : "transparent",
      }}
    >
      {content}
    </div>
  );
}

function CheckMark() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 22,
        height: 22,
        borderRadius: "50%",
        background: "#0d9488",
        color: "#fff",
        fontSize: 13,
        fontWeight: 900,
      }}
    >
      ✓
    </span>
  );
}

function AvailabilityDot({ a }: { a: ModuleAvailability }) {
  const map: Record<ModuleAvailability, { bg: string; fg: string; label: string }> = {
    live: { bg: "#d1fae5", fg: "#065f46", label: "LIVE" },
    beta: { bg: "#dbeafe", fg: "#1e40af", label: "BETA" },
    soon: { bg: "#fef3c7", fg: "#92400e", label: "SOON" },
    on_request: { bg: "#e9d5ff", fg: "#6b21a8", label: "REQ" },
  };
  const m = map[a];
  return (
    <span
      style={{
        background: m.bg,
        color: m.fg,
        fontSize: 9,
        fontWeight: 800,
        padding: "1px 5px",
        borderRadius: 3,
        letterSpacing: "0.04em",
      }}
    >
      {m.label}
    </span>
  );
}

function LegendItem({ cell, label }: { cell: React.ReactNode; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {cell}
      <span>{label}</span>
    </span>
  );
}
