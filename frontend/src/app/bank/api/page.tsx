"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";

// Investor / developer-facing snapshot of the AEVION Bank API surface.
// This is a hand-curated docs view — the source of truth for live shapes
// is /api/openapi.json on the backend. Linked at the top.
//
// Each endpoint shows: method+path, one-line purpose, curl example, sample
// response. Copy buttons on the curl examples.

type Method = "GET" | "POST";

type Endpoint = {
  method: Method;
  path: string;
  summaryKey: string;
  exampleCurl: string;
  exampleResponse: string;
  authed?: boolean;
};

const BASE = "$BASE";
const TOKEN = "$TOKEN";

const ENDPOINTS: Array<{ groupKey: string; items: Endpoint[] }> = [
  {
    groupKey: "api.group.auth",
    items: [
      {
        method: "POST",
        path: "/api/auth/register",
        summaryKey: "api.ep.register.summary",
        exampleCurl: `curl -X POST ${BASE}/api/auth/register \\
  -H 'Content-Type: application/json' \\
  -d '{"email":"lana@example.com","password":"hunter2","name":"Lana"}'`,
        exampleResponse: `{ "token": "eyJhbGciOi...", "user": { "id": "usr_...", "email": "lana@..." } }`,
      },
      {
        method: "POST",
        path: "/api/auth/login",
        summaryKey: "api.ep.login.summary",
        exampleCurl: `curl -X POST ${BASE}/api/auth/login \\
  -H 'Content-Type: application/json' \\
  -d '{"email":"lana@example.com","password":"hunter2"}'`,
        exampleResponse: `{ "token": "eyJhbGciOi...", "user": { "id": "usr_...", "email": "lana@..." } }`,
      },
      {
        method: "GET",
        path: "/api/auth/me",
        summaryKey: "api.ep.me.summary",
        exampleCurl: `curl ${BASE}/api/auth/me \\
  -H 'Authorization: Bearer ${TOKEN}'`,
        exampleResponse: `{ "id": "usr_...", "email": "lana@...", "name": "Lana", "role": "user" }`,
        authed: true,
      },
    ],
  },
  {
    groupKey: "api.group.wallet",
    items: [
      {
        method: "GET",
        path: "/api/qtrade/accounts",
        summaryKey: "api.ep.accounts.summary",
        exampleCurl: `curl ${BASE}/api/qtrade/accounts \\
  -H 'Authorization: Bearer ${TOKEN}'`,
        exampleResponse: `[{ "id": "acc_x9", "balance": 142.50, "currency": "AEC", "createdAt": "..." }]`,
        authed: true,
      },
      {
        method: "POST",
        path: "/api/qtrade/topup",
        summaryKey: "api.ep.topup.summary",
        exampleCurl: `curl -X POST ${BASE}/api/qtrade/topup \\
  -H 'Authorization: Bearer ${TOKEN}' \\
  -H 'Content-Type: application/json' \\
  -d '{"accountId":"acc_x9","amount":100}'`,
        exampleResponse: `{ "id": "op_...", "balance": 242.50, "updatedAt": "..." }`,
        authed: true,
      },
      {
        method: "POST",
        path: "/api/qtrade/transfer",
        summaryKey: "api.ep.transfer.summary",
        exampleCurl: `curl -X POST ${BASE}/api/qtrade/transfer \\
  -H 'Authorization: Bearer ${TOKEN}' \\
  -H 'Content-Type: application/json' \\
  -d '{"from":"acc_x9","to":"acc_y2","amount":25}'`,
        exampleResponse: `{ "id": "trf_...", "from": "acc_x9", "to": "acc_y2", "amount": 25 }`,
        authed: true,
      },
      {
        method: "GET",
        path: "/api/qtrade/operations",
        summaryKey: "api.ep.operations.summary",
        exampleCurl: `curl ${BASE}/api/qtrade/operations \\
  -H 'Authorization: Bearer ${TOKEN}'`,
        exampleResponse: `[{ "id": "op_...", "kind": "transfer", "amount": 25, "from": "...", "to": "...", "createdAt": "..." }]`,
        authed: true,
      },
    ],
  },
  {
    groupKey: "api.group.signing",
    items: [
      {
        method: "POST",
        path: "/api/qsign/sign",
        summaryKey: "api.ep.sign.summary",
        exampleCurl: `curl -X POST ${BASE}/api/qsign/sign \\
  -H 'Authorization: Bearer ${TOKEN}' \\
  -H 'Content-Type: application/json' \\
  -d '{"payload":{"intent":"transfer","amount":25}}'`,
        exampleResponse: `{ "payload": {...}, "signature": "0xfeed...", "algo": "Ed25519", "createdAt": "..." }`,
        authed: true,
      },
      {
        method: "POST",
        path: "/api/qsign/verify",
        summaryKey: "api.ep.verify.summary",
        exampleCurl: `curl -X POST ${BASE}/api/qsign/verify \\
  -H 'Content-Type: application/json' \\
  -d '{"payload":{...},"signature":"0xfeed..."}'`,
        exampleResponse: `{ "valid": true, "expected": "0xfeed...", "provided": "0xfeed..." }`,
      },
    ],
  },
  {
    groupKey: "api.group.ecosystem",
    items: [
      {
        method: "GET",
        path: "/api/planet/stats",
        summaryKey: "api.ep.planetStats.summary",
        exampleCurl: `curl ${BASE}/api/planet/stats \\
  -H 'Authorization: Bearer ${TOKEN}'`,
        exampleResponse: `{ "totalArtifacts": 12, "verifiedCount": 8, "trustWeight": 0.62 }`,
        authed: true,
      },
      {
        method: "GET",
        path: "/api/qtrade/operations.csv",
        summaryKey: "api.ep.operationsCsv.summary",
        exampleCurl: `curl ${BASE}/api/qtrade/operations.csv \\
  -H 'Authorization: Bearer ${TOKEN}' -o operations.csv`,
        exampleResponse: `(text/csv) id,kind,amount,from,to,createdAt\\nop_...,transfer,25,...,...,...\\n`,
        authed: true,
      },
    ],
  },
];

export default function BankApiDocsPage() {
  const { t } = useI18n();
  const [base, setBase] = useState<string>("https://aevion.app");
  const [token, setToken] = useState<string>("YOUR_TOKEN");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const subst = (s: string) => s.replaceAll(BASE, base).replaceAll(TOKEN, token);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // ignore
    }
  };

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
      <Link href="/bank" style={{ fontSize: 12, color: "#475569", textDecoration: "none", fontWeight: 700 }}>
        ← {t("api.backToBank")}
      </Link>

      <header style={{ marginTop: 14, marginBottom: 22 }}>
        <h1 style={{ fontSize: 30, fontWeight: 900, margin: 0, letterSpacing: -0.5 }}>
          {t("api.title")}
        </h1>
        <div style={{ fontSize: 14, color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>
          {t("api.subtitle")}
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a
            href="/api/openapi.json"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid rgba(15,23,42,0.15)",
              background: "#fff",
              color: "#0f172a",
              fontSize: 12,
              fontWeight: 800,
              textDecoration: "none",
            }}
          >
            {t("api.openapi.cta")}
          </a>
        </div>
      </header>

      <section
        style={{
          background: "#fff",
          borderRadius: 14,
          border: "1px solid rgba(15,23,42,0.08)",
          padding: 16,
          marginBottom: 18,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b", marginBottom: 8 }}>
          {t("api.varsLabel")}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Var label="$BASE" value={base} onChange={setBase} />
          <Var label="$TOKEN" value={token} onChange={setToken} />
        </div>
      </section>

      {ENDPOINTS.map((group, gi) => (
        <section key={gi} style={{ marginBottom: 22 }}>
          <h2 style={{ fontSize: 15, fontWeight: 900, margin: "0 0 10px 0", letterSpacing: 0.2, color: "#475569", textTransform: "uppercase" }}>
            {t(group.groupKey)}
          </h2>
          {group.items.map((ep, ei) => {
            const key = `${gi}-${ei}`;
            const curl = subst(ep.exampleCurl);
            const resp = ep.exampleResponse;
            return (
              <article
                key={key}
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  border: "1px solid rgba(15,23,42,0.08)",
                  padding: 14,
                  marginBottom: 10,
                }}
              >
                <header style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                  <span
                    style={{
                      padding: "3px 10px",
                      borderRadius: 7,
                      background: ep.method === "GET" ? "rgba(13,148,136,0.12)" : "rgba(124,58,237,0.12)",
                      color: ep.method === "GET" ? "#0d9488" : "#7c3aed",
                      fontSize: 11,
                      fontWeight: 900,
                      letterSpacing: 1,
                    }}
                  >
                    {ep.method}
                  </span>
                  <code style={{ fontSize: 13, fontWeight: 800, fontFamily: "ui-monospace, monospace", color: "#0f172a" }}>{ep.path}</code>
                  {ep.authed ? (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        letterSpacing: 1,
                        textTransform: "uppercase",
                        padding: "2px 7px",
                        borderRadius: 999,
                        background: "rgba(15,23,42,0.06)",
                        color: "#475569",
                      }}
                    >
                      {t("api.bearer")}
                    </span>
                  ) : null}
                </header>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>{t(ep.summaryKey)}</div>
                <CodeBlock
                  label={t("api.curl")}
                  code={curl}
                  copied={copiedKey === `${key}-curl`}
                  onCopy={() => copy(curl, `${key}-curl`)}
                  copyLabel={t("api.copy")}
                  copiedLabel={t("api.copied")}
                />
                <CodeBlock
                  label={t("api.response")}
                  code={resp}
                  copied={copiedKey === `${key}-resp`}
                  onCopy={() => copy(resp, `${key}-resp`)}
                  copyLabel={t("api.copy")}
                  copiedLabel={t("api.copied")}
                />
              </article>
            );
          })}
        </section>
      ))}

      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 12, lineHeight: 1.55 }}>
        {t("api.disclaimer")}
      </div>
    </main>
  );
}

function Var({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: "#475569", fontFamily: "ui-monospace, monospace" }}>{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px solid rgba(15,23,42,0.15)",
          fontSize: 12,
          fontFamily: "ui-monospace, monospace",
        }}
      />
    </label>
  );
}

function CodeBlock({
  label,
  code,
  copied,
  onCopy,
  copyLabel,
  copiedLabel,
}: {
  label: string;
  code: string;
  copied: boolean;
  onCopy: () => void;
  copyLabel: string;
  copiedLabel: string;
}) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "#94a3b8" }}>
          {label}
        </span>
        <button
          type="button"
          onClick={onCopy}
          style={{
            padding: "3px 10px",
            borderRadius: 7,
            border: "1px solid rgba(15,23,42,0.15)",
            background: copied ? "#059669" : "#0f172a",
            color: "#fff",
            fontSize: 10,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>
      <pre
        style={{
          margin: 0,
          padding: 10,
          borderRadius: 8,
          background: "#0f172a",
          color: "#e2e8f0",
          fontSize: 11,
          fontFamily: "ui-monospace, monospace",
          overflow: "auto",
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
          lineHeight: 1.4,
        }}
      >
        {code}
      </pre>
    </div>
  );
}
