"use client";

import { useState } from "react";
import Link from "next/link";

const C = {
  bg: "#050810", surface: "#0d1117", border: "#1e2a3a",
  text: "#e2e8f0", muted: "#64748b", code: "#0b0f1a",
  accent: "#6366f1", green: "#10b981",
};

const EXAMPLES = [
  {
    id: "payment-request",
    title: "Create & pay a payment request",
    module: "QPayNet",
    color: "#06b6d4",
    steps: [
      { label: "1. Create a payment request", lang: "bash", code: `curl -X POST https://api.aevion.app/api/qpaynet/requests \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "toWalletId": "WALLET_ID",
    "amount": 5000,
    "description": "Invoice #001",
    "expiresAt": "2026-06-01T00:00:00Z"
  }'
# → { "id": "...", "token": "abc123", "payUrl": "https://aevion.app/qpaynet/r/abc123" }` },
      { label: "2. Send the payUrl to the payer", lang: "bash", code: `# The payer opens:  https://aevion.app/qpaynet/r/abc123
# Or call directly:
curl -X POST https://api.aevion.app/api/qpaynet/requests/abc123/pay \\
  -H "Authorization: Bearer $PAYER_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{ "fromWalletId": "PAYER_WALLET_ID" }'
# → { "ok": true, "txId": "...", "newBalance": 4995.0 }` },
    ],
  },
  {
    id: "reputation-score",
    title: "Fetch & display a Z-Tide score",
    module: "Z-Tide",
    color: "#fbbf24",
    steps: [
      { label: "Fetch score (public endpoint)", lang: "bash", code: `curl https://api.aevion.app/api/ztide/users/USER_ID/score
# → { "total": 1240.5, "rank": "silver", "tier": 3, "percentile": 82 }` },
      { label: "Render the rank pill (React)", lang: "tsx", code: `import { ZTideRankPill } from "@/components/fintech/ZTideRankPill";

// In your component:
<ZTideRankPill userId={user.id} />
// Renders: ⚡ Silver  (live-fetched, cached 60s)` },
    ],
  },
  {
    id: "governance-vote",
    title: "Submit a governance vote",
    module: "QChainGov",
    color: "#f472b6",
    steps: [
      { label: "List open proposals", lang: "bash", code: `curl https://api.aevion.app/api/qchaingov/proposals?status=open
# → { "items": [{ "id": "prop_01", "title": "...", "status": "open" }] }` },
      { label: "Cast a vote", lang: "bash", code: `curl -X POST https://api.aevion.app/api/qchaingov/proposals/PROP_ID/vote \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{ "choice": "yes", "weight": 100 }'
# weight = your AEV balance used for this vote
# → { "ok": true, "voteId": "vote_01", "runningTally": { "yes": 1420, "no": 380 } }` },
    ],
  },
  {
    id: "webhook-verify",
    title: "Receive & verify a webhook",
    module: "Webhooks",
    color: "#6366f1",
    steps: [
      { label: "Express handler (TypeScript)", lang: "ts", code: `import crypto from "node:crypto";
import express from "express";
const app = express();

app.post("/webhooks/aevion",
  express.raw({ type: "*/*" }),
  (req, res) => {
    const sig = req.headers["x-aevion-signature"] as string;
    const expected = "sha256=" + crypto
      .createHmac("sha256", process.env.WEBHOOK_SECRET!)
      .update(req.body).digest("hex");

    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
      return res.status(401).end();

    const event = JSON.parse(req.body.toString());
    if (event.type === "transfer.completed") {
      console.log("Received", event.data.amountKzt, "KZT");
    }
    res.status(200).end();
  }
);` },
    ],
  },
  {
    id: "charity-donation",
    title: "Donate to a QGood campaign",
    module: "QGood",
    color: "#34d399",
    steps: [
      { label: "Find active campaigns", lang: "bash", code: `curl https://api.aevion.app/api/qgood/campaigns?status=active
# → { "items": [{ "id": "camp_01", "goal_cents": 100000, "raised_cents": 45230 }] }` },
      { label: "Submit a donation", lang: "bash", code: `curl -X POST https://api.aevion.app/api/qgood/campaigns/CAMP_ID/donate \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{ "walletId": "YOUR_WALLET", "amountCents": 5000 }'
# → { "donationId": "don_01", "aecMinted": 50, "receipt": "..." }
# AEC bonus minted proportional to donation size` },
    ],
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="text-[10px] font-semibold px-2 py-1 rounded-md transition-colors"
      style={{ background: copied ? "#10b98130" : "#1e293b", color: copied ? "#34d399" : "#64748b", border: "1px solid #1e2a3a" }}
    >
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

export default function FintechExamplesPage() {
  const [active, setActive] = useState("payment-request");
  const example = EXAMPLES.find(e => e.id === active)!;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "3rem 1.5rem 2rem" }}>
        <Link href="/developers/fintech" style={{ color: C.muted, fontSize: "0.8rem", textDecoration: "none", display: "inline-block", marginBottom: 12 }}>← Fintech Docs</Link>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#f1f5f9", margin: 0 }}>Code Examples</h1>
        <p style={{ color: C.muted, fontSize: "0.9rem", marginTop: 8 }}>
          Copy-paste examples for the most common AEVION fintech integrations.
        </p>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 1.5rem 4rem", display: "grid", gridTemplateColumns: "220px 1fr", gap: 24 }}>
        {/* Sidebar */}
        <nav style={{ position: "sticky", top: 24, height: "fit-content" }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
            {EXAMPLES.map(e => (
              <button
                key={e.id}
                onClick={() => setActive(e.id)}
                style={{
                  width: "100%", textAlign: "left", padding: "10px 14px", background: "none",
                  border: "none", cursor: "pointer", borderBottom: `1px solid ${C.border}`,
                  background: active === e.id ? `${e.color}15` : "transparent",
                  borderLeft: active === e.id ? `3px solid ${e.color}` : "3px solid transparent",
                }}
              >
                <p style={{ fontSize: "0.8rem", fontWeight: active === e.id ? 700 : 500, color: active === e.id ? C.text : C.muted, margin: 0, lineHeight: 1.3 }}>{e.title}</p>
                <span style={{ fontSize: "0.68rem", color: e.color, fontWeight: 600 }}>{e.module}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: `${example.color}20`, color: example.color }}>{example.module}</span>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#f1f5f9", margin: 0 }}>{example.title}</h2>
          </div>

          <div style={{ display: "grid", gap: 20 }}>
            {example.steps.map((step, i) => (
              <div key={i}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <p style={{ fontSize: "0.85rem", fontWeight: 600, color: C.text, margin: 0 }}>{step.label}</p>
                  <CopyButton text={step.code} />
                </div>
                <pre style={{
                  background: C.code, border: `1px solid ${C.border}`, borderRadius: 8,
                  padding: "1rem 1.25rem", overflowX: "auto", fontSize: "0.78rem",
                  color: "#a5f3fc", fontFamily: "ui-monospace, SFMono-Regular, monospace",
                  lineHeight: 1.6, margin: 0,
                }}>
                  <code>{step.code}</code>
                </pre>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 28, padding: "14px 18px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: "0.82rem", color: C.muted }}>
            <strong style={{ color: C.text }}>Full API reference:</strong>{" "}
            <Link href="/developers/fintech" style={{ color: C.accent, textDecoration: "none" }}>REST endpoints →</Link>
            {" · "}
            <Link href="/developers/fintech/sdk" style={{ color: C.accent, textDecoration: "none" }}>TypeScript SDK →</Link>
            {" · "}
            <Link href="/developers/fintech/errors" style={{ color: C.accent, textDecoration: "none" }}>Error codes →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
