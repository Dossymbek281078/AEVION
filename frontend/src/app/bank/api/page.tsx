"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { SubrouteFooter } from "../_components/SubrouteFooter";

// Investor / developer-facing snapshot of the AEVION Bank API surface.
// Source of truth for live shapes is /api/openapi.json on the backend
// (linked at the top). This file is hand-curated so it can ship i18n,
// curl examples with substituted vars, and group endpoints into the
// flow that matches the marketing/investor narrative.
//
// Each endpoint shows: method+path, one-line purpose, optional note,
// curl example, sample response. Copy buttons on the curl examples.

type Method = "GET" | "POST";

type Endpoint = {
  method: Method;
  path: string;
  summaryKey: string;
  noteKey?: string;
  authKey?: string;
  exampleCurl: string;
  exampleResponse: string;
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
        authKey: "api.bearer",
        exampleCurl: `curl ${BASE}/api/auth/me \\
  -H 'Authorization: Bearer ${TOKEN}'`,
        exampleResponse: `{ "id": "usr_...", "email": "lana@...", "name": "Lana", "role": "user" }`,
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
        authKey: "api.bearer",
        exampleCurl: `curl ${BASE}/api/qtrade/accounts \\
  -H 'Authorization: Bearer ${TOKEN}'`,
        exampleResponse: `{ "items": [{ "id": "acc_x9", "balance": 142.50, "currency": "AEC", "createdAt": "..." }] }`,
      },
      {
        method: "GET",
        path: "/api/qtrade/accounts/lookup",
        summaryKey: "api.ep.lookup.summary",
        authKey: "api.bearer",
        exampleCurl: `curl '${BASE}/api/qtrade/accounts/lookup?email=bob@example.com' \\
  -H 'Authorization: Bearer ${TOKEN}'`,
        exampleResponse: `{ "id": "acc_y2", "owner": "bob@example.com" }`,
      },
      {
        method: "POST",
        path: "/api/qtrade/topup",
        summaryKey: "api.ep.topup.summary",
        noteKey: "api.note.idempotency",
        authKey: "api.bearer",
        exampleCurl: `curl -X POST ${BASE}/api/qtrade/topup \\
  -H 'Authorization: Bearer ${TOKEN}' \\
  -H 'Content-Type: application/json' \\
  -H 'Idempotency-Key: topup-2026-04-30-001' \\
  -d '{"accountId":"acc_x9","amount":100}'`,
        exampleResponse: `{ "id": "op_...", "balance": 242.50, "updatedAt": "..." }`,
      },
      {
        method: "POST",
        path: "/api/qtrade/transfer",
        summaryKey: "api.ep.transfer.summary",
        noteKey: "api.note.idempotency",
        authKey: "api.bearer",
        exampleCurl: `curl -X POST ${BASE}/api/qtrade/transfer \\
  -H 'Authorization: Bearer ${TOKEN}' \\
  -H 'Content-Type: application/json' \\
  -H 'Idempotency-Key: trf-2026-04-30-001' \\
  -d '{"from":"acc_x9","to":"acc_y2","amount":25}'`,
        exampleResponse: `{ "id": "trf_...", "from": "acc_x9", "to": "acc_y2", "amount": 25 }`,
      },
      {
        method: "GET",
        path: "/api/qtrade/operations",
        summaryKey: "api.ep.operations.summary",
        noteKey: "api.note.cursor",
        authKey: "api.bearer",
        exampleCurl: `curl '${BASE}/api/qtrade/operations?limit=20' \\
  -H 'Authorization: Bearer ${TOKEN}'`,
        exampleResponse: `{ "items": [{ "id": "op_...", "kind": "transfer", "amount": 25, "from": "...", "to": "...", "createdAt": "..." }], "nextCursor": "op_..." }`,
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
        authKey: "api.bearer",
        exampleCurl: `curl -X POST ${BASE}/api/qsign/sign \\
  -H 'Authorization: Bearer ${TOKEN}' \\
  -H 'Content-Type: application/json' \\
  -d '{"payload":{"intent":"transfer","amount":25}}'`,
        exampleResponse: `{ "payload": {...}, "signature": "0xfeed...", "algo": "Ed25519", "createdAt": "..." }`,
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
    groupKey: "api.group.ecosystemEarnings",
    items: [
      {
        method: "GET",
        path: "/api/ecosystem/earnings",
        summaryKey: "api.ep.ecosystemEarnings.summary",
        authKey: "api.bearer",
        exampleCurl: `curl ${BASE}/api/ecosystem/earnings \\
  -H 'Authorization: Bearer ${TOKEN}'`,
        exampleResponse: `{ "totals": { "qright": 12.50, "cyberchess": 30.00, "planet": 3.00, "all": 45.50 }, "perSource": [ { "source": "qright", "amount": 12.50, "count": 2, "last": "..." }, { "source": "cyberchess", ... }, { "source": "planet", ... } ] }`,
      },
      {
        method: "GET",
        path: "/api/qright/royalties",
        summaryKey: "api.ep.qrightRoyalties.summary",
        authKey: "api.bearer",
        exampleCurl: `curl ${BASE}/api/qright/royalties \\
  -H 'Authorization: Bearer ${TOKEN}'`,
        exampleResponse: `{ "items": [{ "id": "roy_...", "productKey": "album-x", "period": "2026-Q1", "amount": 12.34, "paidAt": "..." }] }`,
      },
      {
        method: "GET",
        path: "/api/cyberchess/results",
        summaryKey: "api.ep.chessResults.summary",
        authKey: "api.bearer",
        exampleCurl: `curl ${BASE}/api/cyberchess/results \\
  -H 'Authorization: Bearer ${TOKEN}'`,
        exampleResponse: `{ "items": [{ "id": "prize_...", "tournamentId": "tour_...", "place": 1, "amount": 25, "finalizedAt": "..." }] }`,
      },
      {
        method: "GET",
        path: "/api/cyberchess/upcoming",
        summaryKey: "api.ep.chessUpcoming.summary",
        authKey: "api.public",
        exampleCurl: `curl ${BASE}/api/cyberchess/upcoming`,
        exampleResponse: `{ "items": [{ "id": "tour_...", "startsAt": "...", "format": "Swiss · 3+2 · 7 rounds", "prizePool": 250, "entries": 32, "capacity": 64 }] }`,
      },
      {
        method: "GET",
        path: "/api/planet/payouts",
        summaryKey: "api.ep.planetPayouts.summary",
        authKey: "api.bearer",
        exampleCurl: `curl ${BASE}/api/planet/payouts \\
  -H 'Authorization: Bearer ${TOKEN}'`,
        exampleResponse: `{ "items": [{ "id": "pcert_...", "artifactVersionId": "art_v1", "amount": 3, "certifiedAt": "..." }] }`,
      },
    ],
  },
  {
    groupKey: "api.group.exports",
    items: [
      {
        method: "GET",
        path: "/api/planet/stats",
        summaryKey: "api.ep.planetStats.summary",
        authKey: "api.bearer",
        exampleCurl: `curl ${BASE}/api/planet/stats \\
  -H 'Authorization: Bearer ${TOKEN}'`,
        exampleResponse: `{ "totalArtifacts": 12, "verifiedCount": 8, "trustWeight": 0.62 }`,
      },
      {
        method: "GET",
        path: "/api/qtrade/operations.csv",
        summaryKey: "api.ep.operationsCsv.summary",
        authKey: "api.bearer",
        exampleCurl: `curl ${BASE}/api/qtrade/operations.csv \\
  -H 'Authorization: Bearer ${TOKEN}' -o operations.csv`,
        exampleResponse: `(text/csv) id,kind,amount,from,to,createdAt\\nop_...,transfer,25,...,...,...\\n`,
      },
    ],
  },
  {
    groupKey: "api.group.webhooks",
    items: [
      {
        method: "POST",
        path: "/api/qright/royalties/verify-webhook",
        summaryKey: "api.ep.qrightVerifyWebhook.summary",
        noteKey: "api.note.webhookIdem",
        authKey: "api.auth.qrightSecret",
        exampleCurl: `curl -X POST ${BASE}/api/qright/royalties/verify-webhook \\
  -H 'Content-Type: application/json' \\
  -H 'X-QRight-Secret: $QRIGHT_WEBHOOK_SECRET' \\
  -d '{"eventId":"evt_001","email":"creator@example.com","productKey":"album-x","period":"2026-Q1","amount":12.34}'`,
        exampleResponse: `{ "replayed": false, "id": "roy_...", "eventId": "evt_001", "paidAt": "..." }`,
      },
      {
        method: "POST",
        path: "/api/cyberchess/tournament-finalized",
        summaryKey: "api.ep.chessTournamentFinalized.summary",
        noteKey: "api.note.chessIdem",
        authKey: "api.auth.chessSecret",
        exampleCurl: `curl -X POST ${BASE}/api/cyberchess/tournament-finalized \\
  -H 'Content-Type: application/json' \\
  -H 'X-CyberChess-Secret: $CYBERCHESS_WEBHOOK_SECRET' \\
  -d '{"tournamentId":"tour_001","podium":[{"email":"a@x.com","place":1,"amount":25},{"email":"b@x.com","place":2,"amount":15}]}'`,
        exampleResponse: `{ "tournamentId": "tour_001", "recorded": [...], "replayed": [], "finalizedAt": "..." }`,
      },
      {
        method: "POST",
        path: "/api/planet/payouts/certify-webhook",
        summaryKey: "api.ep.planetCertifyWebhook.summary",
        noteKey: "api.note.webhookIdem",
        authKey: "api.auth.planetSecret",
        exampleCurl: `curl -X POST ${BASE}/api/planet/payouts/certify-webhook \\
  -H 'Content-Type: application/json' \\
  -H 'X-Planet-Secret: $PLANET_WEBHOOK_SECRET' \\
  -d '{"eventId":"cert_001","email":"creator@example.com","artifactVersionId":"art_v1","amount":3}'`,
        exampleResponse: `{ "replayed": false, "id": "pcert_...", "eventId": "cert_001", "certifiedAt": "..." }`,
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
          <Link
            href="/bank/smoke?auto=1"
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid rgba(124,58,237,0.40)",
              background: "linear-gradient(135deg, rgba(124,58,237,0.10), rgba(14,165,233,0.10))",
              color: "#4c1d95",
              fontSize: 12,
              fontWeight: 800,
              textDecoration: "none",
            }}
          >
            ▶ Run live smoke test
          </Link>
          <Link
            href="/bank?investor=1"
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid rgba(94,234,212,0.45)",
              background: "linear-gradient(135deg, rgba(94,234,212,0.12), rgba(13,148,136,0.10))",
              color: "#0f766e",
              fontSize: 12,
              fontWeight: 800,
              textDecoration: "none",
            }}
          >
            ✦ Investor walk-through
          </Link>
          <Link
            href="/bank/diagnostics"
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid rgba(15,23,42,0.15)",
              background: "rgba(15,23,42,0.04)",
              color: "#0f172a",
              fontSize: 12,
              fontWeight: 800,
              textDecoration: "none",
            }}
          >
            ♡ Diagnostics
          </Link>
          <Link
            href="/bank/audit-log"
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid rgba(15,23,42,0.15)",
              background: "rgba(15,23,42,0.04)",
              color: "#0f172a",
              fontSize: 12,
              fontWeight: 800,
              textDecoration: "none",
            }}
          >
            ✎ Audit log
          </Link>
        </div>
      </header>

      <aside
        style={{
          background: "linear-gradient(135deg, rgba(124,58,237,0.06), rgba(14,165,233,0.05))",
          border: "1px solid rgba(124,58,237,0.25)",
          borderRadius: 14,
          padding: "14px 16px",
          marginBottom: 18,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          fontSize: 13,
          color: "#1e1b4b",
        }}
      >
        <span style={{ fontSize: 18 }} aria-hidden="true">✦</span>
        <span style={{ flex: 1, minWidth: 280, lineHeight: 1.55 }}>
          <strong>Live demo in 30 seconds.</strong>{" "}
          Open <code style={{ background: "rgba(15,23,42,0.05)", padding: "1px 6px", borderRadius: 4 }}>/bank?investor=1</code> to
          auto-provision a demo account, run the 14-step smoke runner, and land on a printable
          signed receipt — no signup required, all calls hit the same endpoints documented below.
        </span>
      </aside>

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
                  {ep.authKey ? (
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
                        fontFamily: "ui-monospace, monospace",
                      }}
                    >
                      {t(ep.authKey)}
                    </span>
                  ) : null}
                </header>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: ep.noteKey ? 4 : 10 }}>{t(ep.summaryKey)}</div>
                {ep.noteKey ? (
                  <div
                    style={{
                      fontSize: 11,
                      color: "#7c3aed",
                      background: "rgba(124,58,237,0.06)",
                      borderLeft: "2px solid rgba(124,58,237,0.40)",
                      padding: "4px 8px",
                      borderRadius: 4,
                      marginBottom: 10,
                      lineHeight: 1.5,
                    }}
                  >
                    {t(ep.noteKey)}
                  </div>
                ) : null}
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

      <SubrouteFooter active="/bank/api" />
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
