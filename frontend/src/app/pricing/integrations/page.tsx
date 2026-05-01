"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { track } from "@/lib/track";
import { usePricingT } from "@/lib/pricingI18n";

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
  oneLiner: string;
  setupUrl?: string;
}

const INTEGRATIONS: Integration[] = [
  // Communication
  { id: "slack", name: "Slack", category: "communication", status: "live", modules: ["qsign", "qright"], initials: "Sl", color: "#4a154b", oneLiner: "Уведомления о подписях, новых регистрациях IP, alerts по compliance.", setupUrl: "/api/integrations/slack/install" },
  { id: "discord", name: "Discord", category: "communication", status: "beta", modules: ["qright", "qsign"], initials: "Dc", color: "#5865f2", oneLiner: "Webhook-нотификации в каналы команд для creator-сообществ.", setupUrl: "/api/integrations/discord/install" },
  { id: "telegram", name: "Telegram Bot", category: "communication", status: "live", modules: ["qsign", "qright", "multichat-engine"], initials: "Tg", color: "#0088cc", oneLiner: "Подпись и регистрация прямо из Telegram через @aevionbot.", setupUrl: "/api/integrations/telegram" },
  { id: "msteams", name: "Microsoft Teams", category: "communication", status: "soon", modules: ["qsign", "qright"], initials: "MT", color: "#5059c9", oneLiner: "Approval-flow для подписей внутри Teams-чата.", },

  // Productivity
  { id: "google-workspace", name: "Google Workspace", category: "productivity", status: "live", modules: ["qsign", "qright"], initials: "GW", color: "#4285f4", oneLiner: "Подпись Docs / Sheets / Drive файлов в один клик.", setupUrl: "/api/integrations/google/install" },
  { id: "notion", name: "Notion", category: "productivity", status: "beta", modules: ["qright", "multichat-engine"], initials: "No", color: "#000", oneLiner: "Регистрация авторства Notion-страниц и баз данных в QRight.", },
  { id: "linear", name: "Linear", category: "productivity", status: "live", modules: ["qcoreai", "multichat-engine"], initials: "Li", color: "#5e6ad2", oneLiner: "AI-агент QCoreAI создаёт issues и triage из багрепортов.", },
  { id: "obsidian", name: "Obsidian", category: "productivity", status: "soon", modules: ["qright", "lifebox"], initials: "Ob", color: "#6c31e3", oneLiner: "Plugin для регистрации vault-snapshot в LifeBox.", },

  // CRM
  { id: "salesforce", name: "Salesforce", category: "crm", status: "live", modules: ["qsign", "qcoreai"], initials: "Sf", color: "#00a1e0", oneLiner: "Подпись контрактов из Opportunity, AI-агент анализирует сделки.", setupUrl: "/api/integrations/salesforce/install" },
  { id: "hubspot", name: "HubSpot", category: "crm", status: "live", modules: ["qsign", "qcoreai"], initials: "Hs", color: "#ff7a59", oneLiner: "Auto-sign контрактов из deal-flow и lead-нотифации.", setupUrl: "/api/integrations/hubspot/install" },
  { id: "pipedrive", name: "Pipedrive", category: "crm", status: "beta", modules: ["qsign"], initials: "Pd", color: "#1a1a1a", oneLiner: "Подпись proposal'ов и quote'ов прямо из pipeline.", },

  // Automation
  { id: "zapier", name: "Zapier", category: "automation", status: "live", modules: ["qsign", "qright", "qcoreai"], initials: "Zp", color: "#ff4a00", oneLiner: "5000+ триггеров и actions: AEVION в любой workflow без кода.", setupUrl: "https://zapier.com/apps/aevion" },
  { id: "make", name: "Make (ex Integromat)", category: "automation", status: "live", modules: ["qsign", "qright"], initials: "Mk", color: "#6d28d9", oneLiner: "Visual-builder для AEVION-флоу и интеграций.", setupUrl: "https://www.make.com/en/integrations/aevion" },
  { id: "n8n", name: "n8n", category: "automation", status: "beta", modules: ["qsign", "qright", "qcoreai"], initials: "n8", color: "#ea4b71", oneLiner: "Self-hosted automation для enterprise-клиентов с on-prem AEVION.", },

  // Payments
  { id: "stripe", name: "Stripe", category: "payments", status: "live", modules: ["qpaynet-embedded", "qsign"], initials: "St", color: "#635bff", oneLiner: "Биллинг подписок AEVION + Stripe Connect для аффилиатов.", },
  { id: "paypal", name: "PayPal", category: "payments", status: "soon", modules: ["qpaynet-embedded"], initials: "Pp", color: "#003087", oneLiner: "Альтернативный биллинг для регионов без Stripe.", },
  { id: "kaspi", name: "Kaspi Pay", category: "payments", status: "beta", modules: ["qpaynet-embedded"], initials: "Ka", color: "#e10000", oneLiner: "Локальные платежи в Казахстане через Kaspi.", },

  // Developer
  { id: "github", name: "GitHub", category: "developer", status: "live", modules: ["qright", "qsign"], initials: "Gh", color: "#181717", oneLiner: "QRight регистрация commit-snapshot, QSign для releases.", setupUrl: "https://github.com/marketplace/aevion" },
  { id: "gitlab", name: "GitLab", category: "developer", status: "beta", modules: ["qright", "qsign"], initials: "Gl", color: "#fc6d26", oneLiner: "CI-job для подписи артефактов и регистрации релизов.", },
  { id: "vscode", name: "VS Code", category: "developer", status: "soon", modules: ["qsign", "qcoreai"], initials: "Vs", color: "#007acc", oneLiner: "Extension для подписи коммитов и AI-агента в редакторе.", },
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
            label={`${CATEGORY_LABEL[k].ru} · ${counts[k] ?? 0}`}
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
                      {cat.ru.toUpperCase()}
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
                <p style={{ margin: 0, fontSize: 12, color: "#475569", lineHeight: 1.5, flex: 1 }}>{i.oneLiner}</p>
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
