"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { track } from "@/lib/track";
import { usePricingT } from "@/lib/pricingI18n";
import { useI18n } from "@/lib/i18n";

type Category = "communication" | "productivity" | "crm" | "automation" | "payments" | "developer";
type Status = "live" | "beta" | "soon";

interface Integration {
  id: string;
  name: string;
  category: Category;
  status: Status;
  modules: string[];
  initials: string;
  color: string;
  oneLinerKey: string;
  /**
   * A one-click setup path, only when one actually exists. Every entry that
   * used to carry this field pointed at a 404 on 2026-08-12 — the six
   * /api/integrations/* routes are not mounted on the backend at all, and
   * zapier.com/apps/aevion, make.com/en/integrations/aevion and
   * github.com/marketplace/aevion are not published listings. Without the
   * field the card falls back to /pricing/contact, which works. Put a URL
   * back only after calling it.
   */
  setupUrl?: string;
}

const INTEGRATIONS: Integration[] = [
  // Communication
  { id: "slack", name: "Slack", category: "communication", status: "live", modules: ["qsign", "qright"], initials: "Sl", color: "#4a154b", oneLinerKey: "slack" },
  { id: "discord", name: "Discord", category: "communication", status: "beta", modules: ["qright", "qsign"], initials: "Dc", color: "#5865f2", oneLinerKey: "discord" },
  { id: "telegram", name: "Telegram Bot", category: "communication", status: "live", modules: ["qsign", "qright", "multichat-engine"], initials: "Tg", color: "#0088cc", oneLinerKey: "telegram" },
  { id: "msteams", name: "Microsoft Teams", category: "communication", status: "soon", modules: ["qsign", "qright"], initials: "MT", color: "#5059c9", oneLinerKey: "msteams", },

  // Productivity
  { id: "google-workspace", name: "Google Workspace", category: "productivity", status: "live", modules: ["qsign", "qright"], initials: "GW", color: "#4285f4", oneLinerKey: "googleWorkspace" },
  { id: "notion", name: "Notion", category: "productivity", status: "beta", modules: ["qright", "multichat-engine"], initials: "No", color: "#000", oneLinerKey: "notion", },
  { id: "linear", name: "Linear", category: "productivity", status: "live", modules: ["qcoreai", "multichat-engine"], initials: "Li", color: "#5e6ad2", oneLinerKey: "linear", },
  { id: "obsidian", name: "Obsidian", category: "productivity", status: "soon", modules: ["qright", "lifebox"], initials: "Ob", color: "#6c31e3", oneLinerKey: "obsidian", },

  // CRM
  { id: "salesforce", name: "Salesforce", category: "crm", status: "live", modules: ["qsign", "qcoreai"], initials: "Sf", color: "#00a1e0", oneLinerKey: "salesforce" },
  { id: "hubspot", name: "HubSpot", category: "crm", status: "live", modules: ["qsign", "qcoreai"], initials: "Hs", color: "#ff7a59", oneLinerKey: "hubspot" },
  { id: "pipedrive", name: "Pipedrive", category: "crm", status: "beta", modules: ["qsign"], initials: "Pd", color: "#1a1a1a", oneLinerKey: "pipedrive", },

  // Automation
  { id: "zapier", name: "Zapier", category: "automation", status: "live", modules: ["qsign", "qright", "qcoreai"], initials: "Zp", color: "#ff4a00", oneLinerKey: "zapier" },
  { id: "make", name: "Make (ex Integromat)", category: "automation", status: "live", modules: ["qsign", "qright"], initials: "Mk", color: "#6d28d9", oneLinerKey: "make" },
  { id: "n8n", name: "n8n", category: "automation", status: "beta", modules: ["qsign", "qright", "qcoreai"], initials: "n8", color: "#ea4b71", oneLinerKey: "n8n", },

  // Payments
  { id: "stripe", name: "Stripe", category: "payments", status: "live", modules: ["qpaynet-embedded", "qsign"], initials: "St", color: "#635bff", oneLinerKey: "stripe", },
  { id: "paypal", name: "PayPal", category: "payments", status: "soon", modules: ["qpaynet-embedded"], initials: "Pp", color: "#003087", oneLinerKey: "paypal", },
  // 18.08.2026: было "beta", то есть «доступно» — фильтр «скрыть недоступные»
  // прячет только "soon". Проверено запросом к живому проду:
  // /api/pricing/checkout/healthz → paybox.configured = false, а запрос чекаута
  // с currency=KZT молча возвращает долларовую ссылку LemonSqueezy. Kaspi не
  // работает ни в каком виде, значит "soon". Вернуть "beta" можно тогда, когда
  // тот же запрос ответит true, а не когда появятся планы.
  { id: "kaspi", name: "Kaspi Pay", category: "payments", status: "soon", modules: ["qpaynet-embedded"], initials: "Ka", color: "#e10000", oneLinerKey: "kaspi", },

  // Developer
  { id: "github", name: "GitHub", category: "developer", status: "live", modules: ["qright", "qsign"], initials: "Gh", color: "#181717", oneLinerKey: "github" },
  { id: "gitlab", name: "GitLab", category: "developer", status: "beta", modules: ["qright", "qsign"], initials: "Gl", color: "#fc6d26", oneLinerKey: "gitlab", },
  { id: "vscode", name: "VS Code", category: "developer", status: "soon", modules: ["qsign", "qcoreai"], initials: "Vs", color: "#007acc", oneLinerKey: "vscode", },
];

const CATEGORY_LABEL: Record<Category, { ru: string; en: string; color: string }> = {
  communication: { ru: "Коммуникации", en: "Communication", color: "#0d9488" },
  productivity: { ru: "Продуктивность", en: "Productivity", color: "#0ea5e9" },
  crm: { ru: "CRM", en: "CRM", color: "#7c3aed" },
  automation: { ru: "Автоматизация", en: "Automation", color: "#f59e0b" },
  payments: { ru: "Платежи", en: "Payments", color: "#be185d" },
  developer: { ru: "Разработчикам", en: "Developer", color: "#475569" },
};

const STATUS_BADGE: Record<Status, { bg: string; fg: string; label: string }> = {
  live: { bg: "#d1fae5", fg: "#065f46", label: "LIVE" },
  beta: { bg: "#dbeafe", fg: "#1e40af", label: "BETA" },
  soon: { bg: "#fef3c7", fg: "#92400e", label: "SOON" },
};

const CARD = "0 4px 20px rgba(15,23,42,0.06)";
const BORDER = "1px solid rgba(15,23,42,0.08)";

export default function PricingIntegrationsPage() {
  const tp = usePricingT();
  const { t } = useI18n();
  const [filterCategory, setFilterCategory] = useState<Category | null>(null);
  const [hideUnavailable, setHideUnavailable] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    track({ type: "page_view", source: "pricing/integrations" });
  }, []);

  const filtered = useMemo(() => {
    return INTEGRATIONS.filter((i) => {
      if (filterCategory && i.category !== filterCategory) return false;
      if (hideUnavailable && i.status === "soon") return false;
      if (search.trim() && !i.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [filterCategory, hideUnavailable, search]);

  const counts = useMemo(() => {
    const m: Partial<Record<Category, number>> = {};
    for (const i of INTEGRATIONS) m[i.category] = (m[i.category] ?? 0) + 1;
    return m;
  }, []);

  const liveCount = INTEGRATIONS.filter((i) => i.status === "live").length;

  return (
    <ProductPageShell maxWidth={1080}>
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
          {tp("integrations.badge", { live: liveCount, total: INTEGRATIONS.length })}
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
          {tp("integrations.title")}
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
          {tp("integrations.subtitle")}
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
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={tp("integrations.searchPlaceholder")}
 placeholder={tp("integrations.searchPlaceholder")}
          style={{
            flex: "1 1 200px",
            padding: "8px 12px",
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 8,
            border: "1px solid rgba(15,23,42,0.12)",
            background: "#fff",
            color: "#0f172a",
            outline: "none",
            minWidth: 0,
          }}
        />
        <FilterChip
          active={filterCategory === null}
          onClick={() => setFilterCategory(null)}
          label={`${tp("integrations.filterAll")} · ${INTEGRATIONS.length}`}
        />
        {(Object.keys(CATEGORY_LABEL) as Category[]).map((k) => (
          <FilterChip
            key={k}
            active={filterCategory === k}
            onClick={() => setFilterCategory(filterCategory === k ? null : k)}
            label={`${t(`pricing.integrations.category.${k}`)} · ${counts[k] ?? 0}`}
            color={CATEGORY_LABEL[k].color}
          />
        ))}
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "#475569",
            fontWeight: 700,
            cursor: "pointer",
            userSelect: "none",
            marginLeft: "auto",
          }}
        >
          <input
            type="checkbox"
            checked={hideUnavailable}
            onChange={(e) => setHideUnavailable(e.target.checked)}
            style={{ accentColor: "#0d9488" }}
          />
          {tp("integrations.hideSoon")}
        </label>
      </section>

      {/* Grid */}
      {filtered.length === 0 ? (
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
          {tp("integrations.empty")}
        </div>
      ) : (
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 14,
            marginBottom: 36,
          }}
        >
          {filtered.map((i) => {
            const cat = CATEGORY_LABEL[i.category];
            const status = STATUS_BADGE[i.status];
            return (
              <article
                key={i.id}
                style={{
                  padding: 18,
                  background: "#fff",
                  border: BORDER,
                  borderRadius: 14,
                  boxShadow: CARD,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: i.color,
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: 900,
                      letterSpacing: "0.04em",
                    }}
                  >
                    {i.initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.01em" }}>
                      {i.name}
                    </h3>
                    <div style={{ fontSize: 10, fontWeight: 700, color: cat.color, marginTop: 2, letterSpacing: "0.04em" }}>
                      {t(`pricing.integrations.category.${i.category}`).toUpperCase()}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: status.bg,
                      color: status.fg,
                      letterSpacing: "0.04em",
                    }}
                  >
                    {status.label}
                  </span>
                </header>
                <p style={{ margin: 0, fontSize: 12, color: "#475569", lineHeight: 1.5, flex: 1 }}>{t(`pricing.integrations.oneLiner.${i.oneLinerKey}`)}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {i.modules.map((m) => (
                    <span
                      key={m}
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        padding: "2px 6px",
                        background: "#f1f5f9",
                        color: "#475569",
                        borderRadius: 4,
                        letterSpacing: "0.04em",
                        fontFamily: "ui-monospace, monospace",
                      }}
                    >
                      {m.toUpperCase()}
                    </span>
                  ))}
                </div>
                {i.setupUrl && i.status !== "soon" ? (
                  <a
                    href={i.setupUrl}
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: "#0d9488",
                      textDecoration: "none",
                      paddingTop: 4,
                      borderTop: "1px solid rgba(15,23,42,0.05)",
                      marginTop: 4,
                    }}
                  >
                    {i.status === "live" ? tp("integrations.setup") : tp("integrations.joinBeta")} →
                  </a>
                ) : (
                  <Link
                    href="/pricing/contact?source=integration"
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: "#94a3b8",
                      textDecoration: "none",
                      paddingTop: 4,
                      borderTop: "1px solid rgba(15,23,42,0.05)",
                      marginTop: 4,
                    }}
                  >
                    {tp("integrations.notify")} →
                  </Link>
                )}
              </article>
            );
          })}
        </section>
      )}

      {/* Request CTA */}
      <section
        style={{
          marginBottom: 56,
          padding: 28,
          background: "linear-gradient(135deg, #0f172a, #1e293b)",
          borderRadius: 16,
          color: "#f8fafc",
          textAlign: "center",
        }}
      >
        <h3 style={{ fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 8, letterSpacing: "-0.02em" }}>
          {tp("integrations.cta.title")}
        </h3>
        <p style={{ color: "#94a3b8", margin: 0, marginBottom: 18, fontSize: 14, maxWidth: 540, marginLeft: "auto", marginRight: "auto" }}>
          {tp("integrations.cta.subtitle")}
        </p>
        <div style={{ display: "inline-flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <Link
            href="/pricing/contact?source=integration-request"
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
            {tp("integrations.cta.request")}
          </Link>
          <Link
            href="/pricing/api-pricing"
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
            {tp("integrations.cta.api")}
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
      }}
    >
      {label}
    </button>
  );
}
