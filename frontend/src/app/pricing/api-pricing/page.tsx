"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { track } from "@/lib/track";
import { usePricingT } from "@/lib/pricingI18n";

const CARD = "0 4px 20px rgba(15,23,42,0.06)";
const BORDER = "1px solid rgba(15,23,42,0.08)";

type Endpoint = {
  group: "qsign" | "qright" | "bureau" | "qcore" | "core";
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  name: string;
  freeQuota: string;
  pricePer1k: string;
};

const ENDPOINTS: Endpoint[] = [
  { group: "qsign", method: "POST", path: "/api/qsign/sign", name: "Создать подпись", freeQuota: "100/мес", pricePer1k: "$3.00" },
  { group: "qsign", method: "POST", path: "/api/qsign/verify", name: "Проверить подпись", freeQuota: "1 000/мес", pricePer1k: "$0.30" },
  { group: "qsign", method: "POST", path: "/api/qsign/batch", name: "Batch-подпись (до 100)", freeQuota: "10/мес", pricePer1k: "$30.00" },
  { group: "qsign", method: "GET", path: "/api/qsign/audit/:id", name: "Audit-trail записи", freeQuota: "Unlimited", pricePer1k: "Free" },
  { group: "qright", method: "POST", path: "/api/qright/register", name: "Зарегистрировать объект", freeQuota: "10/мес", pricePer1k: "$15.00" },
  { group: "qright", method: "GET", path: "/api/qright/:id", name: "Получить объект", freeQuota: "Unlimited", pricePer1k: "Free" },
  { group: "qright", method: "GET", path: "/api/qright/embed/:id", name: "Embed JSON для widget", freeQuota: "Unlimited", pricePer1k: "Free" },
  { group: "qright", method: "GET", path: "/api/qright/badge/:id.svg", name: "SVG-бейдж", freeQuota: "Unlimited", pricePer1k: "Free" },
  { group: "bureau", method: "POST", path: "/api/bureau/protect", name: "Защитить артефакт", freeQuota: "5/мес", pricePer1k: "$25.00" },
  { group: "bureau", method: "POST", path: "/api/bureau/protect-batch", name: "Batch-защита (до 50)", freeQuota: "1/мес", pricePer1k: "$200.00" },
  { group: "bureau", method: "GET", path: "/api/bureau/certificate/:id.pdf", name: "PDF-сертификат", freeQuota: "10/мес", pricePer1k: "$5.00" },
  { group: "qcore", method: "POST", path: "/api/qcore/chat", name: "LLM chat completion", freeQuota: "100k токенов", pricePer1k: "$0.50/1k tok" },
  { group: "qcore", method: "POST", path: "/api/qcore/agent", name: "Agent-вызов с tool-use", freeQuota: "1k вызовов", pricePer1k: "$5.00" },
  { group: "qcore", method: "POST", path: "/api/qcore/embed", name: "Embeddings", freeQuota: "1M токенов", pricePer1k: "$0.05/1k tok" },
  { group: "core", method: "GET", path: "/api/openapi.json", name: "OpenAPI-спецификация", freeQuota: "Unlimited", pricePer1k: "Free" },
  { group: "core", method: "POST", path: "/api/webhooks/stripe", name: "Webhook listener", freeQuota: "Unlimited", pricePer1k: "Free" },
];

const GROUP_META: Record<Endpoint["group"], { label: string; color: string; bg: string }> = {
  qsign: { label: "QSign · Подписи", color: "#0d9488", bg: "rgba(13,148,136,0.06)" },
  qright: { label: "QRight · Цифровая собственность", color: "#0ea5e9", bg: "rgba(14,165,233,0.06)" },
  bureau: { label: "IP Bureau · Электронное патентное", color: "#7c3aed", bg: "rgba(124,58,237,0.06)" },
  qcore: { label: "QCoreAI · LLM и агенты", color: "#f59e0b", bg: "rgba(245,158,11,0.06)" },
  core: { label: "Core · Спецификация и webhooks", color: "#475569", bg: "rgba(71,85,105,0.06)" },
};

const VOLUME_TIERS = [
  { name: "Developer", quota: "до 10k вызовов/мес", price: "$0", perCall: "по rate-card", note: "Для прототипов и SDK-тестов" },
  { name: "Build", quota: "до 100k вызовов/мес", price: "$49/мес", perCall: "−15% от rate-card", note: "Для запуска и MVP" },
  { name: "Scale", quota: "до 1M вызовов/мес", price: "$249/мес", perCall: "−30% от rate-card", note: "Для production-нагрузки" },
  { name: "Enterprise", quota: "1M+/мес или dedicated", price: "по запросу", perCall: "−50% и выше", note: "SLA, on-prem, BYO-key" },
];

export default function PricingApiPage() {
  const tp = usePricingT();
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

  const snippet = `# Установить SDK
npm install @aevion/sdk

# В коде
import { Aevion } from "@aevion/sdk";
const a = new Aevion({ apiKey: process.env.AEVION_API_KEY });

// Подписать документ
const sig = await a.qsign.sign({
  payload: pdfBuffer,
  signers: ["alice@acme.io"],
});

// Зарегистрировать IP-объект
const obj = await a.qright.register({
  title: "Aevion mascot v3",
  kind: "image",
  hash: sha256,
});`;

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
                ПОПУЛЯРНО
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
              {t.price}
            </div>
            <div style={{ fontSize: 12, color: i === 1 ? "#94a3b8" : "#64748b", marginBottom: 8 }}>
              {t.quota}
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: i === 1 ? "#5eead4" : "#0d9488",
                marginBottom: 8,
              }}
            >
              {t.perCall}
            </div>
            <div style={{ fontSize: 11, color: i === 1 ? "#cbd5e1" : "#475569", lineHeight: 1.4 }}>
              {t.note}
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
              {meta.label} · {c}
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
                {meta.label}
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
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{e.name}</div>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#0d9488",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {e.freeQuota}
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
        </div>
      </section>
    </ProductPageShell>
  );
}
