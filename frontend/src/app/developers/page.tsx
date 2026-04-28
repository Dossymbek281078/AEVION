import type { Metadata } from "next";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";

export const metadata: Metadata = {
  title: "AEVION Developers — APIs, SDKs, webhooks, sandbox",
  description:
    "Build on AEVION: registry, signature, bureau, validators, bank, awards. REST APIs, TypeScript SDKs, webhook delivery with retry, sandbox keys, full OpenAPI 3.0 spec.",
  alternates: { canonical: "/developers" },
  openGraph: {
    title: "AEVION Developers",
    description: "REST APIs · TS SDKs · webhooks · sandbox · OpenAPI 3.0.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: { card: "summary_large_image", title: "AEVION Developers", description: "Build on the Trust OS." },
};

const APIS = [
  {
    name: "QRight",
    color: "#7dd3fc",
    href: "/qright",
    desc: "Authorship registration. SHA-256 + HMAC + Quantum Shield key derivation. Returns timestamped certificate ID.",
    endpoints: ["POST /api/qright/register", "GET /api/qright/certificates/:id", "POST /api/qright/verify"],
  },
  {
    name: "QSign",
    color: "#a78bfa",
    href: "/qsign",
    desc: "Cryptographic signatures. Ed25519 + Dilithium preview. Idempotency keys, request-id middleware, OpenAPI 3.0 + Prometheus /metrics.",
    endpoints: ["POST /api/qsign/sign", "POST /api/qsign/verify", "POST /api/qsign/batch", "POST /api/qsign/file"],
  },
  {
    name: "Bureau",
    color: "#f472b6",
    href: "/bureau",
    desc: "Court-grade certificates. Cites Berne/WIPO/TRIPS/eIDAS on issuance. ETag/304, batch protect, enriched /health.",
    endpoints: ["POST /api/bureau/protect", "POST /api/bureau/protect-batch", "GET /api/bureau/certificates/:id"],
  },
  {
    name: "Planet",
    color: "#86efac",
    href: "/planet",
    desc: "Validator quorum. Submit artifacts (music/film/code/web), retrieve verdicts, public artifact pages.",
    endpoints: ["GET /api/planet/stats", "GET /api/planet/artifacts/recent", "GET /api/planet/artifacts/:id/public", "POST /api/planet/submit"],
  },
  {
    name: "QTrade",
    color: "#fb7185",
    href: "/qtrade",
    desc: "Wallet, transfers, royalties. Per-account ledger with CSV export, summary, top-up, transfer. AEC native.",
    endpoints: ["GET /api/qtrade/accounts[.csv]", "GET /api/qtrade/transfers[.csv]", "POST /api/qtrade/topup", "POST /api/qtrade/transfer"],
  },
  {
    name: "Quantum Shield",
    color: "#5eead4",
    href: "/quantum-shield",
    desc: "Threshold key management. Shamir's Secret Sharing (k of n). Shard rotation, recovery, post-quantum-ready KDF.",
    endpoints: ["POST /api/quantum-shield/derive", "POST /api/quantum-shield/recover", "POST /api/quantum-shield/rotate"],
  },
];

const SDKS = [
  {
    name: "@aevion/qsign",
    lang: "TypeScript",
    desc: "Sign, verify, batch, file signing, webhook receiver. Idempotency-key support, retry-aware.",
    install: "npm install @aevion/qsign",
  },
  {
    name: "@aevion/webhook-receiver",
    lang: "TypeScript",
    desc: "HMAC-verified webhook handler with Express/Next/Hono adapters. Replay-safe with idempotency cache.",
    install: "npm install @aevion/webhook-receiver",
  },
];

const QUICKSTART = `// 1. Authenticate (POST /api/auth/login → JWT bearer)
const token = (await fetch("https://aevion.app/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
}).then(r => r.json())).token;

// 2. Register IP in QRight
const cert = await fetch("https://aevion.app/api/qright/register", {
  method: "POST",
  headers: {
    "Authorization": "Bearer " + token,
    "Content-Type": "application/json",
    "Idempotency-Key": crypto.randomUUID(),
  },
  body: JSON.stringify({
    title: "My AI Track",
    description: "Generated 2026-04-28",
    kind: "music",
  }),
}).then(r => r.json());

// 3. Sign the certificate ID with QSign
const signed = await fetch("https://aevion.app/api/qsign/sign", {
  method: "POST",
  headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
  body: JSON.stringify({ payload: cert.id }),
}).then(r => r.json());

// 4. Submit to Planet for validation
await fetch("https://aevion.app/api/planet/submit", {
  method: "POST",
  headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
  body: JSON.stringify({
    artifactType: "music",
    qrightCertId: cert.id,
    qsignReceiptId: signed.id,
  }),
});`;

const FACTS = [
  { kicker: "Auth",       value: "JWT Bearer",            note: "Short-lived + refresh, passkey-ready stack" },
  { kicker: "Idempotency", value: "Idempotency-Key",      note: "Header-based, 24h replay window" },
  { kicker: "Rate limit",  value: "Per-key + per-IP",     note: "X-RateLimit-* headers, 429 with Retry-After" },
  { kicker: "Webhooks",    value: "HMAC-SHA256",          note: "Delivery log + retry + replay-safe" },
  { kicker: "OpenAPI",     value: "/api/openapi.json",    note: "Single source of truth, 3.0 spec" },
  { kicker: "Metrics",     value: "/metrics (Prometheus)",note: "Latency, error rates, request-id propagation" },
];

export default function DevelopersPage() {
  return (
    <main style={{ background: "linear-gradient(180deg, #f8fafc 0%, #fff 200px)", minHeight: "100vh" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "32px 20px 64px" }}>
        <Wave1Nav />

        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.22em", color: "#0d9488", margin: "0 0 8px", textTransform: "uppercase" }}>
            Build on AEVION
          </p>
          <h1 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.04em", margin: "0 0 12px", color: "#0f172a" }}>
            REST + SDK + webhooks.
          </h1>
          <p style={{ fontSize: 15, color: "#475569", margin: 0, lineHeight: 1.6, maxWidth: 720 }}>
            Six APIs, two TypeScript SDKs, HMAC-signed webhooks with retry, sandbox keys, full
            OpenAPI 3.0 spec. Authenticate once, ship across the whole Trust OS.
          </p>
        </div>

        <section style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          {FACTS.map((f) => (
            <div key={f.kicker} style={{ padding: "12px 14px", borderRadius: 12, background: "#fff", border: "1px solid rgba(15,23,42,0.08)" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", letterSpacing: "0.14em", textTransform: "uppercase" }}>{f.kicker}</div>
              <div style={{ marginTop: 4, fontSize: 15, fontWeight: 800, color: "#0d9488", fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>{f.value}</div>
              <div style={{ marginTop: 4, fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>{f.note}</div>
            </div>
          ))}
        </section>

        <section style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 14px" }}>APIs</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {APIS.map((api) => (
              <Link
                key={api.name}
                href={api.href}
                style={{
                  display: "block",
                  padding: 22,
                  borderRadius: 14,
                  background: "#fff",
                  border: `1px solid ${api.color}33`,
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 280 }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 4 }}>{api.name}</div>
                    <div style={{ fontSize: 14, color: "#475569", lineHeight: 1.6 }}>{api.desc}</div>
                  </div>
                  <div
                    style={{
                      padding: "4px 10px",
                      borderRadius: 999,
                      background: `${api.color}1A`,
                      color: api.color,
                      fontSize: 12,
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Open module →
                  </div>
                </div>
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4, fontFamily: "ui-monospace, SFMono-Regular, monospace", fontSize: 12 }}>
                  {api.endpoints.map((ep) => (
                    <div key={ep} style={{ color: "#64748b" }}>
                      <span style={{ color: api.color, fontWeight: 700 }}>{ep.split(" ")[0]}</span>
                      {" "}{ep.split(" ").slice(1).join(" ")}
                    </div>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 14px" }}>Quick-start</h2>
          <div
            style={{
              borderRadius: 14,
              overflow: "hidden",
              border: "1px solid rgba(15,23,42,0.1)",
              background: "#0f172a",
            }}
          >
            <div style={{ padding: "8px 14px", fontSize: 11, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.14em", textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              JavaScript / TypeScript
            </div>
            <pre
              style={{
                margin: 0,
                padding: "16px 18px",
                fontSize: 12.5,
                lineHeight: 1.65,
                color: "#e2e8f0",
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                overflowX: "auto",
              }}
            >
              {QUICKSTART}
            </pre>
          </div>
        </section>

        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 14px" }}>SDKs</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {SDKS.map((sdk) => (
              <div key={sdk.name} style={{ padding: 18, borderRadius: 12, background: "#fff", border: "1px solid rgba(15,23,42,0.08)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>{sdk.name}</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#0d9488", letterSpacing: "0.12em", textTransform: "uppercase" }}>{sdk.lang}</div>
                </div>
                <div style={{ marginTop: 6, fontSize: 13, color: "#475569", lineHeight: 1.55 }}>{sdk.desc}</div>
                <div style={{ marginTop: 10, padding: "6px 10px", borderRadius: 6, background: "rgba(13,148,136,0.06)", border: "1px solid rgba(13,148,136,0.18)", fontFamily: "ui-monospace, SFMono-Regular, monospace", fontSize: 12, color: "#0d9488", display: "inline-block" }}>
                  {sdk.install}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section
          style={{
            marginTop: 24,
            padding: 22,
            borderRadius: 16,
            background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
            color: "#fff",
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 8px", color: "#fff" }}>Sandbox & support</h2>
          <div style={{ fontSize: 14, lineHeight: 1.65, opacity: 0.95 }}>
            Sandbox API keys, OpenAPI spec download, integration help —{" "}
            <a href="mailto:yahiin1978@gmail.com?subject=AEVION%20developer%20access" style={{ color: "#fff", fontWeight: 800 }}>
              yahiin1978@gmail.com
            </a>
            {" "}with subject &quot;developer access&quot;. Reply within 24h.
            <br />
            Status & changelog:{" "}
            <Link href="/changelog" style={{ color: "#fff", fontWeight: 800, textDecoration: "underline" }}>
              /changelog
            </Link>
            {" "}· Bank API deep-dive:{" "}
            <Link href="/bank/api" style={{ color: "#fff", fontWeight: 800, textDecoration: "underline" }}>
              /bank/api
            </Link>
            .
          </div>
        </section>
      </div>
    </main>
  );
}
