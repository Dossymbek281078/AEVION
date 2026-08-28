"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { track } from "@/lib/track";
import { usePricingT } from "@/lib/pricingI18n";
import { useI18n } from "@/lib/i18n";

const CARD = "0 4px 20px rgba(15,23,42,0.06)";
const BORDER = "1px solid rgba(15,23,42,0.08)";

type Endpoint = {
  id: string;
  group: "qsign" | "qright" | "bureau" | "qcore" | "core";
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  name: string;
  freeQuota: string;
  pricePer1k: string;
};

const ENDPOINTS: Endpoint[] = [
  { id: "qsignSign", group: "qsign", method: "POST", path: "/api/qsign/v2/sign", name: "Создать подпись", freeQuota: "100/мес", pricePer1k: "$3.00" },
  { id: "qsignVerify", group: "qsign", method: "POST", path: "/api/qsign/v2/verify", name: "Проверить подпись", freeQuota: "1 000/мес", pricePer1k: "$0.30" },
  { id: "qsignBatch", group: "qsign", method: "POST", path: "/api/qsign/v2/sign/batch", name: "Batch-подпись (до 100)", freeQuota: "10/мес", pricePer1k: "$30.00" },
  { id: "qsignAudit", group: "qsign", method: "GET", path: "/api/qsign/v2/audit", name: "Audit-trail записи", freeQuota: "Unlimited", pricePer1k: "Free" },
  { id: "qrightRegister", group: "qright", method: "POST", path: "/api/qright/objects", name: "Зарегистрировать объект", freeQuota: "10/мес", pricePer1k: "$15.00" },
  { id: "qrightGet", group: "qright", method: "GET", path: "/api/qright/objects/:id", name: "Получить объект", freeQuota: "Unlimited", pricePer1k: "Free" },
  { id: "qrightEmbed", group: "qright", method: "GET", path: "/api/qright/embed/:id", name: "Embed JSON для widget", freeQuota: "Unlimited", pricePer1k: "Free" },
  { id: "qrightBadge", group: "qright", method: "GET", path: "/api/qright/badge/:id.svg", name: "SVG-бейдж", freeQuota: "Unlimited", pricePer1k: "Free" },
  { id: "bureauProtect", group: "bureau", method: "POST", path: "/api/pipeline/protect", name: "Защитить артефакт", freeQuota: "5/мес", pricePer1k: "$25.00" },
  { id: "bureauProtectBatch", group: "bureau", method: "POST", path: "/api/pipeline/protect-batch", name: "Batch-защита (до 50)", freeQuota: "1/мес", pricePer1k: "$200.00" },
  { id: "bureauCertificate", group: "bureau", method: "GET", path: "/api/pipeline/certificate/:certId/pdf", name: "PDF-сертификат", freeQuota: "10/мес", pricePer1k: "$5.00" },
  { id: "qcoreChat", group: "qcore", method: "POST", path: "/api/qcoreai/chat", name: "LLM chat completion", freeQuota: "100k токенов", pricePer1k: "$0.50/1k tok" },
  { id: "qcoreAgent", group: "qcore", method: "POST", path: "/api/qcoreai/multi-agent", name: "Agent-вызов с tool-use", freeQuota: "1k вызовов", pricePer1k: "$5.00" },
    // ⚠️ 28.08.2026: строка продавала квоту «1M токенов» за $0.05/1k на ручку,
  // которой НЕТ. Проверено: POST /api/qcore/embed -> route_not_found, а слово
  // embedding во всём бэкенде встречается только в смысле «вставить виджет на
  // чужой сайт», не векторных эмбеддингов. Кода нет вовсе.
  // Строку не удалил (состав предложения — решение владельца) и не оставил
  // продающей: цена и квота сняты, в имени честная пометка. Завести ручку
  // технически можно: ключи OpenAI и Gemini есть, оба провайдера это умеют.
  { id: "qcoreEmbed", group: "qcore", method: "POST", path: "/api/qcore/embed", name: "Embeddings (в плане)", freeQuota: "—", pricePer1k: "—" },
  { id: "coreOpenapi", group: "core", method: "GET", path: "/api/openapi.json", name: "OpenAPI-спецификация", freeQuota: "Unlimited", pricePer1k: "Free" },
  { id: "coreWebhook", group: "core", method: "POST", path: "/api/lemonsqueezy/webhook", name: "Webhook listener", freeQuota: "Unlimited", pricePer1k: "Free" },
];

/** Endpoint names that are (partly) Russian prose; look up the i18n key instead of the raw literal. */
const ENDPOINT_NAME_KEY: Partial<Record<string, string>> = {
  qsignSign: "pricing.apiPricing.endpoint.qsignSign.name",
  qsignVerify: "pricing.apiPricing.endpoint.qsignVerify.name",
  qsignBatch: "pricing.apiPricing.endpoint.qsignBatch.name",
  qsignAudit: "pricing.apiPricing.endpoint.qsignAudit.name",
  qrightRegister: "pricing.apiPricing.endpoint.qrightRegister.name",
  qrightGet: "pricing.apiPricing.endpoint.qrightGet.name",
  qrightEmbed: "pricing.apiPricing.endpoint.qrightEmbed.name",
  qrightBadge: "pricing.apiPricing.endpoint.qrightBadge.name",
  bureauProtect: "pricing.apiPricing.endpoint.bureauProtect.name",
  bureauProtectBatch: "pricing.apiPricing.endpoint.bureauProtectBatch.name",
  bureauCertificate: "pricing.apiPricing.endpoint.bureauCertificate.name",
  qcoreAgent: "pricing.apiPricing.endpoint.qcoreAgent.name",
  coreOpenapi: "pricing.apiPricing.endpoint.coreOpenapi.name",
};

/** Raw freeQuota strings (Russian units) mapped to their i18n key. Values shared across endpoints reuse one key. */
const QUOTA_KEY: Record<string, string> = {
  "100/мес": "pricing.apiPricing.quota.per100Month",
  "1 000/мес": "pricing.apiPricing.quota.per1000Month",
  "10/мес": "pricing.apiPricing.quota.per10Month",
  "5/мес": "pricing.apiPricing.quota.per5Month",
  "1/мес": "pricing.apiPricing.quota.per1Month",
  "100k токенов": "pricing.apiPricing.quota.per100kTokens",
  "1k вызовов": "pricing.apiPricing.quota.per1kCalls",
  "1M токенов": "pricing.apiPricing.quota.per1mTokens",
};

const GROUP_META: Record<Endpoint["group"], { color: string; bg: string }> = {
  qsign: { color: "#0d9488", bg: "rgba(13,148,136,0.06)" },
  qright: { color: "#0ea5e9", bg: "rgba(14,165,233,0.06)" },
  bureau: { color: "#7c3aed", bg: "rgba(124,58,237,0.06)" },
  qcore: { color: "#f59e0b", bg: "rgba(245,158,11,0.06)" },
  core: { color: "#475569", bg: "rgba(71,85,105,0.06)" },
};

const GROUP_LABEL_KEY: Record<Endpoint["group"], string> = {
  qsign: "pricing.apiPricing.group.qsign",
  qright: "pricing.apiPricing.group.qright",
  bureau: "pricing.apiPricing.group.bureau",
  qcore: "pricing.apiPricing.group.qcore",
  core: "pricing.apiPricing.group.core",
};

type VolumeTier = {
  id: string;
  name: string;
  quotaKey: string;
  /** Raw currency amount (not translated), e.g. "$49". Omitted when priceAmountKey is used instead. */
  priceAmount?: string;
  /** i18n key for the whole price label, used when it's prose rather than a currency amount (e.g. "by request"). */
  priceAmountKey?: string;
  /** i18n key for a suffix appended after priceAmount, e.g. "/mo". */
  priceSuffixKey?: string;
  perCallKey: string;
  /** i18n key for the note. Omitted (with `note` literal) when the note has no Cyrillic to translate. */
  noteKey?: string;
  note?: string;
};

const VOLUME_TIERS: VolumeTier[] = [
  {
    id: "dev",
    name: "Developer",
    quotaKey: "pricing.apiPricing.tier.dev.quota",
    priceAmount: "$0",
    perCallKey: "pricing.apiPricing.tier.dev.perCall",
    noteKey: "pricing.apiPricing.tier.dev.note",
  },
  {
    id: "build",
    name: "Build",
    quotaKey: "pricing.apiPricing.tier.build.quota",
    priceAmount: "$49",
    priceSuffixKey: "tier.perMonth",
    perCallKey: "pricing.apiPricing.tier.build.perCall",
    noteKey: "pricing.apiPricing.tier.build.note",
  },
  {
    id: "scale",
    name: "Scale",
    quotaKey: "pricing.apiPricing.tier.scale.quota",
    priceAmount: "$249",
    priceSuffixKey: "tier.perMonth",
    perCallKey: "pricing.apiPricing.tier.scale.perCall",
    noteKey: "pricing.apiPricing.tier.scale.note",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    quotaKey: "pricing.apiPricing.tier.enterprise.quota",
    priceAmountKey: "pricing.apiPricing.tier.enterprise.price",
    perCallKey: "pricing.apiPricing.tier.enterprise.perCall",
    note: "SLA, on-prem, BYO-key",
  },
];

export default function PricingApiPage() {
  const tp = usePricingT();
  const { t: gt } = useI18n();
  const [filterGroup, setFilterGroup] = useState<Endpoint["group"] | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  useEffect(() => {
    track({ type: "page_view", source: "pricing/api-pricing" });
  }, []);

  const grouped = useMemo(() => {
    const order: Endpoint["group"][] = ["qsign", "qright", "bureau", "qcore", "core"];
    return order
      .map((g) => ({
        group: g,
        items: ENDPOINTS.filter((e) => e.group === g && (filterGroup === null || filterGroup === g)),
      }))
      .filter((x) => x.items.length > 0);
  }, [filterGroup]);

  const counts = useMemo(() => {
    const m: Partial<Record<Endpoint["group"], number>> = {};
    for (const e of ENDPOINTS) m[e.group] = (m[e.group] ?? 0) + 1;
    return m;
  }, []);

  const snippet = [
    gt("pricing.apiPricing.snippet.installSdk"),
    `npm install @aevion-io/fintech-sdk`,
    ``,
    gt("pricing.apiPricing.snippet.inCode"),
    `import { QPayNet, signWebhookPayload } from "@aevion-io/fintech-sdk";`,
    `const qpaynet = new QPayNet({ apiKey: process.env.AEVION_API_KEY });`,
    ``,
    gt("pricing.apiPricing.snippet.transferComment"),
    `const tx = await qpaynet.transfer({`,
    `  fromWalletId: "wlt_alice",`,
    `  toWalletId: "wlt_bob",`,
    `  amount: 5000,            // ${gt("pricing.apiPricing.snippet.tiyinComment")}`,
    `  description: "Order #123",`,
    `});`,
    ``,
    gt("pricing.apiPricing.snippet.requestComment"),
    `const req = await qpaynet.requests.create({`,
    `  toWalletId: "wlt_alice",`,
    `  amount: 12500,`,
    `  description: "Invoice #456",`,
    `});`,
    `console.log(req.payUrl);   // https://aevion.app/qpaynet/r/TOKEN`,
  ].join("\n");

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
          {tp("api.badge")}
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
          {tp("api.title")}
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
          {tp("api.subtitle")}
        </p>
      </section>

      {/* Volume tiers */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
          marginBottom: 36,
        }}
      >
        {VOLUME_TIERS.map((t, i) => (
          <div
            key={t.name}
            style={{
              padding: 18,
              background: i === 1 ? "linear-gradient(180deg, #0f172a, #1e293b)" : "#fff",
              color: i === 1 ? "#f8fafc" : "#0f172a",
              border: i === 1 ? "none" : BORDER,
              borderRadius: 14,
              boxShadow: i === 1 ? "0 12px 40px rgba(15,23,42,0.25)" : CARD,
              position: "relative",
            }}
          >
            {i === 1 && (
              <div
                style={{
                  position: "absolute",
                  top: -10,
                  right: 14,
                  background: "linear-gradient(135deg, #f59e0b, #ef4444)",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  padding: "3px 10px",
                  borderRadius: 999,
                }}
              >
                {gt("pricing.apiPricing.popular")}
              </div>
            )}
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.06em",
                color: i === 1 ? "#94a3b8" : "#64748b",
                marginBottom: 6,
              }}
            >
              {t.name.toUpperCase()}
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.02em", marginBottom: 6 }}>
              {t.priceAmountKey ? gt(t.priceAmountKey) : t.priceAmount}
              {t.priceSuffixKey ? tp(t.priceSuffixKey) : ""}
            </div>
            <div style={{ fontSize: 12, color: i === 1 ? "#94a3b8" : "#64748b", marginBottom: 8 }}>
              {gt(t.quotaKey)}
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: i === 1 ? "#5eead4" : "#0d9488",
                marginBottom: 8,
              }}
            >
              {gt(t.perCallKey)}
            </div>
            <div style={{ fontSize: 11, color: i === 1 ? "#cbd5e1" : "#475569", lineHeight: 1.4 }}>
              {t.noteKey ? gt(t.noteKey) : t.note}
            </div>
          </div>
        ))}
      </section>

      {/* Quickstart */}
      <section
        style={{
          marginBottom: 36,
          padding: 24,
          background: "linear-gradient(135deg, #0f172a, #1e293b)",
          borderRadius: 16,
          color: "#f8fafc",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, letterSpacing: "-0.02em" }}>
            {tp("api.quickstart.title")}
          </h2>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(snippet).catch(() => {});
              setCopiedSnippet(true);
              setTimeout(() => setCopiedSnippet(false), 1500);
            }}
            style={{
              padding: "6px 12px",
              fontSize: 11,
              fontWeight: 800,
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.2)",
              background: copiedSnippet ? "#0d9488" : "rgba(255,255,255,0.06)",
              color: "#fff",
              cursor: "pointer",
              letterSpacing: "0.04em",
            }}
          >
            {copiedSnippet ? tp("api.quickstart.copied") : tp("api.quickstart.copy")}
          </button>
        </div>
        <pre
          style={{
            margin: 0,
            padding: 16,
            background: "rgba(0,0,0,0.4)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 10,
            fontSize: 12,
            lineHeight: 1.55,
            color: "#cbd5e1",
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
            overflowX: "auto",
          }}
        >
          {snippet}
        </pre>
        <div style={{ marginTop: 12, fontSize: 12, color: "#94a3b8" }}>
          {tp("api.quickstart.note")}{" "}
          <Link href="/api/openapi.json" style={{ color: "#5eead4", fontWeight: 700 }}>
            /api/openapi.json
          </Link>
        </div>
      </section>

      {/* Filter */}
      <section
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 16,
          padding: "12px 14px",
          background: "rgba(13,148,136,0.04)",
          borderRadius: 10,
          border: "1px solid rgba(13,148,136,0.12)",
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 800, color: "#475569", letterSpacing: "0.06em" }}>
          {tp("api.filter")}
        </span>
        <button
          onClick={() => setFilterGroup(null)}
          style={{
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: 800,
            borderRadius: 999,
            border: filterGroup === null ? "none" : "1px solid rgba(15,23,42,0.12)",
            cursor: "pointer",
            background: filterGroup === null ? "#0d9488" : "#fff",
            color: filterGroup === null ? "#fff" : "#475569",
          }}
        >
          {tp("api.filterAll")} · {ENDPOINTS.length}
        </button>
        {(Object.keys(GROUP_META) as Endpoint["group"][]).map((g) => {
          const meta = GROUP_META[g];
          const c = counts[g] ?? 0;
          if (c === 0) return null;
          return (
            <button
              key={g}
              onClick={() => setFilterGroup(filterGroup === g ? null : g)}
              style={{
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 800,
                borderRadius: 999,
                border: filterGroup === g ? "none" : "1px solid rgba(15,23,42,0.12)",
                cursor: "pointer",
                background: filterGroup === g ? meta.color : "#fff",
                color: filterGroup === g ? "#fff" : meta.color,
              }}
            >
              {gt(GROUP_LABEL_KEY[g])} · {c}
            </button>
          );
        })}
      </section>

      {/* Endpoints */}
      <section style={{ marginBottom: 36 }}>
        {grouped.map((g) => {
          const meta = GROUP_META[g.group];
          return (
            <div key={g.group} style={{ marginBottom: 24 }}>
              <h2
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  color: meta.color,
                  margin: 0,
                  marginBottom: 8,
                  textTransform: "uppercase",
                }}
              >
                {gt(GROUP_LABEL_KEY[g.group])}
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
                {g.items.map((e, i) => (
                  <div
                    key={e.path + e.method}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr auto auto",
                      gap: 14,
                      padding: "12px 14px",
                      borderTop: i === 0 ? "none" : "1px solid rgba(15,23,42,0.05)",
                      alignItems: "center",
                      background: i % 2 === 1 ? "#fafbfd" : "#fff",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: "3px 8px",
                        borderRadius: 4,
                        background: meta.bg,
                        color: meta.color,
                        letterSpacing: "0.04em",
                        minWidth: 50,
                        textAlign: "center",
                      }}
                    >
                      {e.method}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <code
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#0f172a",
                          fontFamily: "ui-monospace, monospace",
                        }}
                      >
                        {e.path}
                      </code>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                        {ENDPOINT_NAME_KEY[e.id] ? gt(ENDPOINT_NAME_KEY[e.id]!) : e.name}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#0d9488",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {QUOTA_KEY[e.freeQuota] ? gt(QUOTA_KEY[e.freeQuota]) : e.freeQuota}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: e.pricePer1k === "Free" ? "#0d9488" : "#0f172a",
                        whiteSpace: "nowrap",
                        minWidth: 90,
                        textAlign: "right",
                      }}
                    >
                      {e.pricePer1k === "Free" ? "Free" : e.pricePer1k}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {/* CTA */}
      <section
        style={{
          marginBottom: 56,
          padding: 28,
          background: "linear-gradient(135deg, rgba(13,148,136,0.06), rgba(14,165,233,0.06))",
          border: "1px solid rgba(13,148,136,0.15)",
          borderRadius: 16,
          textAlign: "center",
        }}
      >
        <h3 style={{ fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 8, letterSpacing: "-0.02em", color: "#0f172a" }}>
          {tp("api.cta.title")}
        </h3>
        <p style={{ color: "#475569", margin: 0, marginBottom: 18, fontSize: 14, maxWidth: 560, marginLeft: "auto", marginRight: "auto" }}>
          {tp("api.cta.subtitle")}
        </p>
        <div style={{ display: "inline-flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <Link
            href="/pricing/contact?source=api"
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
            {tp("api.cta.contact")}
          </Link>
          <Link
            href="/api/openapi.json"
            style={{
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 800,
              borderRadius: 10,
              background: "#fff",
              color: "#0d9488",
              textDecoration: "none",
              border: "1px solid rgba(13,148,136,0.3)",
            }}
          >
            {tp("api.cta.openapi")}
          </Link>
          <Link
            href="/pricing/calculator/embed"
            style={{
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 800,
              borderRadius: 10,
              background: "#fff",
              color: "#0ea5e9",
              textDecoration: "none",
              border: "1px solid rgba(14,165,233,0.3)",
            }}
          >
            {gt("pricing.apiPricing.embedCalculator")}
          </Link>
        </div>
      </section>
    </ProductPageShell>
  );
}
