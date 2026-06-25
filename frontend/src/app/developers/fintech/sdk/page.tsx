import type { Metadata } from "next";
import Link from "next/link";
import { getApiBase } from "@/lib/apiBase";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "AEVION Fintech SDK Reference",
  description: "TypeScript/JavaScript SDK for AEVION fintech APIs: QPayNet, VeilNetX, QMaskCard, QGood, Z-Tide, QChainGov.",
  alternates: { canonical: "https://aevion.app/developers/fintech/sdk" },
};

const C = {
  bg: "#050810",
  surface: "#0d1117",
  border: "#1e2a3a",
  text: "#e2e8f0",
  muted: "#64748b",
  code: "#0f1923",
  accent: "#6366f1",
  green: "#10b981",
  amber: "#f59e0b",
};

interface LiveSdk {
  id: string;
  name: string;
  version: string;
  description: string;
  install: string;
  registry: string;
  modules: string[];
  license: string;
  downloadsLastWeek?: number | null;
  lastPublished?: string | null;
}

interface SdksResponse {
  total: number;
  sdks: LiveSdk[];
  totalDownloadsLastWeek?: number | null;
}

async function fetchSdks(): Promise<SdksResponse | null> {
  try {
    const r = await fetch(`${getApiBase()}/api/aevion/sdks`, { next: { revalidate: 3600 } });
    if (!r.ok) return null;
    return (await r.json()) as SdksResponse;
  } catch {
    return null;
  }
}

function relAge(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (!Number.isFinite(days)) return null;
  if (days < 1) return "today";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

const pre = (s: string) => s.trim();

function sdkSections(fintechPkg: string) {
  return [
    {
      id: "install",
      title: "Installation",
      code: pre(`npm install ${fintechPkg}
# or
yarn add ${fintechPkg}
# or
pnpm add ${fintechPkg}`),
      lang: "bash",
    },
    {
      id: "init",
      title: "Initialization",
      code: pre(`import { AevionFintech } from "${fintechPkg}";

const fintech = new AevionFintech({
  apiKey: process.env.AEVION_API_KEY!,  // aev_live_... or aev_test_...
  baseUrl: "https://api.aevion.app",     // optional, defaults to prod
});`),
      lang: "ts",
    },
    {
      id: "qpaynet",
      title: "QPayNet — Wallets",
      code: pre(`// Create a wallet
const wallet = await fintech.qpaynet.wallets.create({
  name: "Customer wallet",
  currency: "KZT",
});

// Transfer between wallets
const tx = await fintech.qpaynet.transfer({
  fromWalletId: wallet.id,
  toWalletId: "wallet_recipient_id",
  amount: 5000,          // KZT in tiin (×100)
  description: "Order #123 payment",
});

// Create payment request (generates shareable link)
const req = await fintech.qpaynet.requests.create({
  toWalletId: wallet.id,
  amount: 12500,
  description: "Invoice #456",
  expiresAt: new Date(Date.now() + 86400_000).toISOString(),
});
console.log(req.payUrl); // https://aevion.app/qpaynet/r/TOKEN`),
      lang: "ts",
    },
    {
      id: "veilnetx",
      title: "VeilNetX — Settlement",
      code: pre(`// Subscribe to waitlist
const entry = await fintech.veilnetx.waitlist.subscribe({
  email: "ops@company.com",
  useCase: "settlement-routing",
});

// Check ledger status
const status = await fintech.veilnetx.ledger.status();
console.log(status.blockHeight, status.tps);`),
      lang: "ts",
    },
    {
      id: "ztide",
      title: "Z-Tide — Reputation",
      code: pre(`// Get reputation score for a user
const score = await fintech.ztide.scores.get(userId);
console.log(score.total, score.rank, score.tier);

// Submit a contribution event
await fintech.ztide.events.submit({
  userId,
  type: "task_completed",
  weight: 1.0,
  metadata: { taskId: "task_123" },
});

// Get leaderboard
const board = await fintech.ztide.leaderboard({ limit: 10, category: "global" });`),
      lang: "ts",
    },
    {
      id: "webhooks",
      title: "Webhooks",
      code: pre(`// All fintech modules fire events to your webhook URL
// Set endpoint in: https://aevion.app/qpaynet/settings/webhooks

// Validate HMAC signature (Express example)
import crypto from "node:crypto";

app.post("/webhooks/aevion", express.raw({ type: "*/*" }), (req, res) => {
  const sig = req.headers["x-aevion-signature"] as string;
  const expected = crypto
    .createHmac("sha256", process.env.AEVION_WEBHOOK_SECRET!)
    .update(req.body)
    .digest("hex");
  if (sig !== \`sha256=\${expected}\`) return res.status(401).end();

  const event = JSON.parse(req.body.toString());
  // event.type: "transfer.completed" | "request.paid" | "score.changed" | ...
  res.status(200).end();
});`),
      lang: "ts",
    },
    {
      id: "errors",
      title: "Error handling",
      code: pre(`import { AevionFintechError } from "${fintechPkg}";

try {
  await fintech.qpaynet.transfer({ ... });
} catch (err) {
  if (err instanceof AevionFintechError) {
    console.error(err.code);    // "insufficient_balance" | "rate_limited" | ...
    console.error(err.status);  // 400 | 402 | 429 | 500
    console.error(err.module);  // "qpaynet" | "veilnetx" | ...
  }
}`),
      lang: "ts",
    },
  ];
}

function CodeBlock({ code }: { code: string; lang: string }) {
  return (
    <pre style={{ background: C.code, border: `1px solid ${C.border}`, borderRadius: 8, padding: "1rem 1.25rem", overflowX: "auto", fontSize: "0.8rem", lineHeight: 1.6, color: "#a5f3fc", fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>
      <code>{code}</code>
    </pre>
  );
}

export default async function FintechSdkPage() {
  const data = await fetchSdks();
  const fintechSdk = data?.sdks.find(s => s.id === "fintech-sdk");
  const fintechPkg = fintechSdk?.name ?? "@aevion-io/fintech-sdk";
  const fintechVersion = fintechSdk?.version ?? null;
  const npmHref = fintechSdk?.registry ?? `https://www.npmjs.com/package/${fintechPkg}`;
  const sections = sdkSections(fintechPkg);

  return (
    <main style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ padding: "3rem 1.5rem 2rem", maxWidth: 900, margin: "0 auto" }}>
        <Link href="/developers/fintech" style={{ color: C.muted, fontSize: "0.8rem", textDecoration: "none", display: "inline-block", marginBottom: 16 }}>← Fintech Docs</Link>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#f1f5f9", margin: 0 }}>
          Fintech SDK
          {fintechVersion && <span style={{ fontSize: "0.85rem", fontWeight: 500, color: C.muted, marginLeft: 12 }}>v{fintechVersion}</span>}
        </h1>
        <p style={{ color: C.muted, fontSize: "0.9rem", marginTop: 8 }}>
          Official TypeScript SDK for AEVION fintech modules. Wraps REST APIs with types, retries, and HMAC webhook validation.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
          {[
            { label: "npm package", href: npmHref, color: C.green, external: true },
            { label: "API reference", href: "/developers/fintech", color: C.accent, external: false },
            { label: "Error codes", href: "/developers/fintech/errors", color: C.amber, external: false },
            { label: "Changelog", href: "/changelog", color: C.muted, external: false },
          ].map(l => l.external ? (
            <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.78rem", color: l.color, textDecoration: "none", borderBottom: `1px solid ${l.color}60` }}>{l.label} ↗</a>
          ) : (
            <Link key={l.label} href={l.href} style={{ fontSize: "0.78rem", color: l.color, textDecoration: "none", borderBottom: `1px solid ${l.color}60` }}>{l.label} ↗</Link>
          ))}
        </div>
      </div>

      {/* Live published packages */}
      {data && data.sdks.length > 0 && (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 1.5rem 2rem" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#f1f5f9", marginBottom: "0.75rem" }}>
            Published packages
            {typeof data.totalDownloadsLastWeek === "number" && data.totalDownloadsLastWeek > 0 && (
              <span style={{ fontSize: "0.75rem", fontWeight: 500, color: C.green, marginLeft: 10 }}>
                · {data.totalDownloadsLastWeek.toLocaleString("en-US")} dl/wk total
              </span>
            )}
          </h2>
          <div style={{ display: "grid", gap: 10 }}>
            {data.sdks.map(sdk => {
              const age = relAge(sdk.lastPublished);
              return (
                <a
                  key={sdk.id}
                  href={sdk.registry}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    padding: "10px 14px",
                    textDecoration: "none",
                    color: C.text,
                  }}
                >
                  <code style={{ fontSize: "0.85rem", fontWeight: 600, color: "#f1f5f9", flex: 1 }}>{sdk.name}</code>
                  <span style={{ fontSize: "0.75rem", color: C.muted }}>v{sdk.version}</span>
                  {typeof sdk.downloadsLastWeek === "number" && (
                    <span style={{ fontSize: "0.72rem", color: C.green, fontVariantNumeric: "tabular-nums", minWidth: 70, textAlign: "right" }}>
                      {sdk.downloadsLastWeek.toLocaleString("en-US")} dl/wk
                    </span>
                  )}
                  {age && (
                    <span style={{ fontSize: "0.72rem", color: C.muted, minWidth: 60, textAlign: "right" }}>{age}</span>
                  )}
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* SDK sections */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 1.5rem 4rem" }}>
        <div style={{ display: "grid", gap: "2.5rem" }}>
          {sections.map(s => (
            <div key={s.id} id={s.id}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#f1f5f9", marginBottom: "0.75rem" }}>{s.title}</h2>
              <CodeBlock code={s.code} lang={s.lang} />
            </div>
          ))}
        </div>

        {/* Rate limits note */}
        <div style={{ marginTop: 40, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "1.5rem" }}>
          <h3 style={{ fontSize: "0.9rem", fontWeight: 700, color: C.amber, marginBottom: 8 }}>Rate limits & retry policy</h3>
          <p style={{ fontSize: "0.8rem", color: C.muted, lineHeight: 1.6 }}>
            The SDK auto-retries on 429 and 5xx with exponential backoff (3 attempts, max 8s delay). Use{" "}
            <code style={{ background: C.code, padding: "2px 6px", borderRadius: 4, fontSize: "0.78rem" }}>{"{ retries: 0 }"}</code>{" "}
            to disable. See{" "}
            <Link href="/fintech/compare" style={{ color: C.accent, textDecoration: "none" }}>tier limits →</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
