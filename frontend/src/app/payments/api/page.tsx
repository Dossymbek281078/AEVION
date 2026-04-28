"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

type Endpoint = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  summary: string;
  description: string;
  body?: string;
  resp: string;
};

const ENDPOINTS: Endpoint[] = [
  {
    method: "POST",
    path: "/v1/links",
    summary: "Create a payment link",
    description: "Create a shareable URL that collects a one-time payment.",
    body: `{
  "amount": 9900,
  "currency": "USD",
  "title": "AEVION Pro Monthly",
  "description": "1 month of Pro tier",
  "settlement": "bank",
  "expires_in_days": 7
}`,
    resp: `{
  "id": "pl_q9w2k47abc",
  "url": "https://aevion.app/pay/pl_q9w2k47abc",
  "status": "active",
  "created": 1730073600
}`,
  },
  {
    method: "GET",
    path: "/v1/links/:id",
    summary: "Retrieve a link",
    description: "Look up a link by id, including its current status.",
    resp: `{
  "id": "pl_q9w2k47abc",
  "amount": 9900,
  "currency": "USD",
  "status": "paid",
  "paid_at": 1730080214
}`,
  },
  {
    method: "POST",
    path: "/v1/checkout",
    summary: "Create a checkout session",
    description:
      "Initiate a method-agnostic checkout. The rail handles 3DS, tokenization, and routing internally.",
    body: `{
  "amount": 9900,
  "currency": "USD",
  "settlement": "aevion-bank",
  "methods": ["visa-mc", "apple-pay", "aec-credit"],
  "metadata": { "order_id": "ORD-1042" }
}`,
    resp: `{
  "id": "co_a3f7m1xyz",
  "url": "https://aevion.app/checkout/co_a3f7m1xyz",
  "client_secret": "co_a3f7m1xyz_secret_..."
}`,
  },
  {
    method: "POST",
    path: "/v1/subscriptions",
    summary: "Create a subscription",
    description: "Subscribe a customer to a recurring plan.",
    body: `{
  "customer": "cus_alice",
  "plan_name": "AEVION Pro Monthly",
  "amount": 2900,
  "currency": "USD",
  "interval": "monthly",
  "trial_days": 7
}`,
    resp: `{
  "id": "sub_demo_abc",
  "status": "trialing",
  "current_period_end": 1730678400
}`,
  },
  {
    method: "POST",
    path: "/v1/webhooks",
    summary: "Register a webhook endpoint",
    description: "Subscribe a URL to one or more event types.",
    body: `{
  "url": "https://your-app.com/webhooks/aevion",
  "events": ["checkout.completed", "settlement.paid"]
}`,
    resp: `{
  "id": "we_abc123",
  "secret": "whsec_a1b2c3...",
  "events": ["checkout.completed", "settlement.paid"]
}`,
  },
  {
    method: "GET",
    path: "/v1/settlements",
    summary: "List settlements",
    description:
      "Returns settlements ordered by scheduled date. Filterable by status and currency.",
    resp: `{
  "data": [
    {
      "id": "st_q9w2k4",
      "amount": 124500,
      "currency": "USD",
      "status": "paid",
      "royalty": [
        { "party": "creator_pool", "share": 0.7 },
        { "party": "ip_holder", "share": 0.15 },
        { "party": "platform", "share": 0.1 },
        { "party": "treasury", "share": 0.05 }
      ]
    }
  ],
  "has_more": false
}`,
  },
];

type Lang = "curl" | "node" | "python";

const LANGS: { id: Lang; label: string }[] = [
  { id: "curl", label: "cURL" },
  { id: "node", label: "Node.js" },
  { id: "python", label: "Python" },
];

function snippet(lang: Lang, e: Endpoint, apiKey: string): string {
  const path = e.path;
  const url = `https://api.aevion.app${path.replace(/:id/g, "pl_q9w2k47abc")}`;
  const k = apiKey || "YOUR_AEVION_API_KEY";
  if (lang === "curl") {
    if (e.method === "GET") {
      return `curl -X GET "${url}" \\
  -H "Authorization: Bearer ${k}"`;
    }
    return `curl -X ${e.method} "${url}" \\
  -H "Authorization: Bearer ${k}" \\
  -H "Content-Type: application/json" \\
  -d '${(e.body ?? "{}").replace(/\n\s*/g, " ")}'`;
  }
  if (lang === "node") {
    if (e.method === "GET") {
      return `import { Aevion } from "@aevion/payments";
const aevion = new Aevion("${k}");

const res = await aevion.${pathToMethod(e.path)}.retrieve("pl_q9w2k47abc");`;
    }
    const obj = e.body ? e.body.replace(/^\{/, "{").replace(/\n/g, "\n  ") : "{}";
    return `import { Aevion } from "@aevion/payments";
const aevion = new Aevion("${k}");

const res = await aevion.${pathToMethod(e.path)}.create(${obj});`;
  }
  if (e.method === "GET") {
    return `from aevion import Aevion
aevion = Aevion("${k}")

res = aevion.${pathToMethod(e.path).replace(/-/g, "_")}.retrieve("pl_q9w2k47abc")`;
  }
  return `from aevion import Aevion
aevion = Aevion("${k}")

res = aevion.${pathToMethod(e.path).replace(/-/g, "_")}.create(
    ${(e.body ?? "{}").replace(/\n/g, "\n    ")}
)`;
}

function pathToMethod(p: string) {
  const parts = p.split("/").filter(Boolean);
  if (parts[0] === "v1") parts.shift();
  return parts[0]?.replace(/[^a-z0-9_-]/gi, "") ?? "resource";
}

const methodColor: Record<Endpoint["method"], string> = {
  GET: "#0d9488",
  POST: "#2563eb",
  PATCH: "#f59e0b",
  DELETE: "#dc2626",
};

const KEYS_STORAGE = "aevion.payments.api.keys.v1";

type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  full: string;
  createdAt: number;
  livemode: boolean;
};

function genKey(livemode: boolean) {
  const prefix = livemode ? "sk_live_" : "sk_test_";
  const bytes = new Uint8Array(20);
  if (typeof crypto !== "undefined") crypto.getRandomValues(bytes);
  const tail = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return prefix + tail;
}

export default function ApiPage() {
  const [tab, setTab] = useState<Lang>("curl");
  const [activeEndpoint, setActiveEndpoint] = useState<number>(0);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("Production");
  const [newKeyLive, setNewKeyLive] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(KEYS_STORAGE);
      if (raw) setKeys(JSON.parse(raw));
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(KEYS_STORAGE, JSON.stringify(keys));
    } catch {
      // ignore
    }
  }, [keys, hydrated]);

  const usableKey = useMemo(() => {
    return keys[0]?.full ?? "";
  }, [keys]);

  const e = ENDPOINTS[activeEndpoint];

  function createKey() {
    if (!newKeyName.trim()) return;
    const full = genKey(newKeyLive);
    const key: ApiKey = {
      id: `key_${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 8)}`,
      name: newKeyName.trim(),
      prefix: full.slice(0, 12) + "…",
      full,
      createdAt: Date.now(),
      livemode: newKeyLive,
    };
    setKeys((prev) => [key, ...prev]);
    setRevealed(key.id);
  }

  function revoke(id: string) {
    if (!window.confirm("Revoke this API key? This cannot be undone.")) return;
    setKeys((prev) => prev.filter((k) => k.id !== id));
  }

  function copy(value: string, marker: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(marker);
      setTimeout(() => setCopied((c) => (c === marker ? null : c)), 1400);
    });
  }

  return (
    <main style={{ padding: 0 }}>
      <section
        style={{
          background:
            "linear-gradient(145deg, #0f172a 0%, #312e81 48%, #4f46e5 100%)",
          color: "#fff",
          padding: "32px 24px 38px",
        }}
      >
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <Link
            href="/payments"
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "rgba(255,255,255,0.75)",
              textDecoration: "none",
            }}
          >
            ← Payments Rail
          </Link>
          <h1
            style={{
              fontSize: "clamp(22px, 3.6vw, 34px)",
              fontWeight: 800,
              margin: "10px 0 8px",
              letterSpacing: "-0.03em",
            }}
          >
            Developer API
          </h1>
          <p
            style={{
              fontSize: "clamp(13px, 1.8vw, 16px)",
              opacity: 0.92,
              maxWidth: 720,
              lineHeight: 1.55,
              margin: 0,
            }}
          >
            REST + JSON, idempotency keys, OpenAPI 3.1 spec, official SDKs for
            Node and Python. One key works across all surfaces — links,
            checkouts, subscriptions, webhooks, settlements.
          </p>
        </div>
      </section>

      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: 24,
          display: "grid",
          gridTemplateColumns: "minmax(0, 240px) minmax(0, 1fr)",
          gap: 24,
          alignItems: "start",
        }}
      >
        <aside
          style={{
            position: "sticky",
            top: 16,
            display: "grid",
            gap: 4,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#4f46e5",
              padding: "0 10px 8px",
            }}
          >
            Endpoints
          </div>
          {ENDPOINTS.map((ep, i) => (
            <button
              key={ep.path}
              type="button"
              onClick={() => setActiveEndpoint(i)}
              style={{
                textAlign: "left",
                padding: "10px 12px",
                borderRadius: 10,
                border: "none",
                background: activeEndpoint === i ? "rgba(79,70,229,0.08)" : "transparent",
                color: activeEndpoint === i ? "#3730a3" : "#0f172a",
                cursor: "pointer",
                display: "grid",
                gap: 2,
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    padding: "1px 6px",
                    borderRadius: 4,
                    background: methodColor[ep.method] + "22",
                    color: methodColor[ep.method],
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: "0.04em",
                  }}
                >
                  {ep.method}
                </span>
                <span
                  style={{
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {ep.path}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "#64748b" }}>{ep.summary}</div>
            </button>
          ))}
        </aside>

        <section style={{ display: "grid", gap: 18, minWidth: 0 }}>
          <article
            style={{
              padding: 22,
              borderRadius: 16,
              border: "1px solid rgba(15,23,42,0.1)",
              background: "#fff",
              boxShadow: "0 2px 12px rgba(15,23,42,0.05)",
              display: "grid",
              gap: 12,
            }}
          >
            <header style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  background: methodColor[e.method] + "22",
                  color: methodColor[e.method],
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                }}
              >
                {e.method}
              </span>
              <span
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 16,
                  fontWeight: 800,
                  color: "#0f172a",
                }}
              >
                {e.path}
              </span>
            </header>
            <div style={{ fontSize: 14, color: "#475569", lineHeight: 1.55 }}>
              {e.description}
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {LANGS.map((l) => {
                const active = tab === l.id;
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setTab(l.id)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 8,
                      border: active ? "1px solid #4f46e5" : "1px solid rgba(15,23,42,0.15)",
                      background: active ? "#4f46e5" : "#fff",
                      color: active ? "#fff" : "#0f172a",
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    {l.label}
                  </button>
                );
              })}
              <span style={{ flex: 1 }} />
              <button
                type="button"
                onClick={() => copy(snippet(tab, e, usableKey), `req_${activeEndpoint}_${tab}`)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  background: copied === `req_${activeEndpoint}_${tab}` ? "#059669" : "#0f172a",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 12,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {copied === `req_${activeEndpoint}_${tab}` ? "Copied ✓" : "Copy"}
              </button>
            </div>

            <pre style={codeStyle}>{snippet(tab, e, usableKey)}</pre>

            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#475569",
              }}
            >
              Response · 200 OK
            </div>
            <pre style={codeStyle}>{e.resp}</pre>
          </article>

          <article
            style={{
              padding: 22,
              borderRadius: 16,
              border: "1px solid rgba(15,23,42,0.1)",
              background: "#fff",
              boxShadow: "0 2px 12px rgba(15,23,42,0.05)",
              display: "grid",
              gap: 12,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#4f46e5",
              }}
            >
              API keys
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto auto",
                gap: 8,
                alignItems: "end",
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 800,
                    color: "#475569",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: 6,
                  }}
                >
                  Key name
                </label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="Production / staging / etc."
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid rgba(15,23,42,0.15)",
                    fontSize: 13,
                    color: "#0f172a",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => setNewKeyLive((v) => !v)}
                style={{
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: newKeyLive ? "1px solid #dc2626" : "1px solid rgba(15,23,42,0.15)",
                  background: newKeyLive ? "rgba(220,38,38,0.08)" : "#fff",
                  color: newKeyLive ? "#b91c1c" : "#0f172a",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {newKeyLive ? "Live mode" : "Test mode"}
              </button>
              <button
                type="button"
                onClick={createKey}
                style={{
                  padding: "9px 16px",
                  borderRadius: 8,
                  background: "#4f46e5",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 12,
                  border: "none",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Generate
              </button>
            </div>

            {keys.length === 0 ? (
              <div
                style={{
                  padding: "20px 16px",
                  borderRadius: 10,
                  border: "1px dashed rgba(15,23,42,0.2)",
                  textAlign: "center",
                  color: "#64748b",
                  fontSize: 13,
                  background: "rgba(15,23,42,0.02)",
                }}
              >
                No API keys yet. Generate one above — its full value is shown
                only once at creation time.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {keys.map((k) => (
                  <div
                    key={k.id}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(15,23,42,0.1)",
                      background: "#fff",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 5,
                        background: k.livemode
                          ? "rgba(220,38,38,0.12)"
                          : "rgba(13,148,136,0.12)",
                        color: k.livemode ? "#b91c1c" : "#0f766e",
                        fontSize: 10,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {k.livemode ? "live" : "test"}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>
                      {k.name}
                    </span>
                    <span
                      style={{
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                        fontSize: 12,
                        color: "#64748b",
                        flex: 1,
                        minWidth: 0,
                        wordBreak: "break-all",
                      }}
                    >
                      {revealed === k.id ? k.full : k.prefix}
                    </span>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => setRevealed((s) => (s === k.id ? null : k.id))}
                        style={smallBtn("#4f46e5", true)}
                      >
                        {revealed === k.id ? "Hide" : "Reveal"}
                      </button>
                      <button
                        type="button"
                        onClick={() => copy(k.full, `key_${k.id}`)}
                        style={smallBtn("#4f46e5")}
                      >
                        {copied === `key_${k.id}` ? "Copied ✓" : "Copy"}
                      </button>
                      <button
                        type="button"
                        onClick={() => revoke(k.id)}
                        style={smallBtn("#dc2626", true)}
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <FactCard label="Base URL" value="api.aevion.app/v1" />
            <FactCard label="Auth" value="Bearer token" />
            <FactCard label="Rate limit" value="100 req/sec" />
            <FactCard label="Idempotency" value="Idempotency-Key header" />
            <FactCard label="OpenAPI 3.1" value="api.aevion.app/openapi.json" />
            <FactCard label="SDKs" value="Node 22+ · Python 3.11+" />
          </div>
        </section>
      </div>
    </main>
  );
}

const codeStyle: CSSProperties = {
  margin: 0,
  padding: "14px 16px",
  borderRadius: 10,
  background: "#0f172a",
  color: "#e2e8f0",
  fontSize: 12,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  overflow: "auto",
  lineHeight: 1.65,
  border: "1px solid rgba(255,255,255,0.06)",
};

function FactCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        background: "rgba(79,70,229,0.05)",
        border: "1px solid rgba(79,70,229,0.18)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#4f46e5",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 800,
          color: "#0f172a",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          wordBreak: "break-all",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function smallBtn(color: string, ghost = false): CSSProperties {
  return {
    padding: "5px 10px",
    borderRadius: 7,
    background: ghost ? "transparent" : color,
    color: ghost ? color : "#fff",
    fontWeight: 700,
    fontSize: 11,
    border: ghost ? `1px solid ${color}55` : "none",
    cursor: "pointer",
  };
}
