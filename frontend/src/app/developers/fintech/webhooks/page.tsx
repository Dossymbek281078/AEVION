import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AEVION Fintech Webhooks — real-time event delivery",
  description: "Set up webhooks to receive real-time events from QPayNet, VeilNetX, QMaskCard, QGood, Z-Tide and QChainGov. HMAC-SHA256 signed, with retry queues.",
  alternates: { canonical: "https://aevion.app/developers/fintech/webhooks" },
};

const C = { bg: "#050810", surface: "#0d1117", border: "#1e2a3a", text: "#e2e8f0", muted: "#64748b", code: "#0f1923", accent: "#6366f1", green: "#10b981", amber: "#f59e0b", red: "#ef4444" };

const EVENTS = [
  { module: "qpaynet", event: "transfer.completed",      desc: "P2P transfer settled successfully" },
  { module: "qpaynet", event: "transfer.failed",         desc: "Transfer failed (insufficient balance etc.)" },
  { module: "qpaynet", event: "request.paid",            desc: "Payment request fulfilled by payer" },
  { module: "qpaynet", event: "request.expired",         desc: "Payment request expired (time or max views)" },
  { module: "qpaynet", event: "deposit.completed",       desc: "Top-up credited to wallet" },
  { module: "qpaynet", event: "merchant.charge.success", desc: "Merchant charge via API key succeeded" },
  { module: "qgood",   event: "donation.received",       desc: "Donation credited to campaign" },
  { module: "qgood",   event: "campaign.goal_reached",   desc: "Campaign hit its target amount" },
  { module: "ztide",   event: "score.updated",           desc: "User's reputation score changed" },
  { module: "ztide",   event: "rank.promoted",           desc: "User moved to a higher rank tier" },
  { module: "qchaingov", event: "proposal.passed",       desc: "Governance proposal reached quorum and passed" },
  { module: "qchaingov", event: "proposal.rejected",     desc: "Proposal failed to reach quorum or majority" },
  { module: "veilnetx",  event: "ledger.entry_added",    desc: "New settlement entry appended to ledger" },
];

const MODULE_COLORS: Record<string, string> = {
  qpaynet: "#6366f1", qgood: "#10b981", ztide: "#f59e0b", qchaingov: "#f472b6", veilnetx: "#8b5cf6",
};

function pre(s: string) { return s.trim(); }

export default function FintechWebhooksPage() {
  return (
    <main style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "3rem 1.5rem 4rem" }}>
        <Link href="/developers/fintech" style={{ color: C.muted, fontSize: "0.8rem", textDecoration: "none", display: "inline-block", marginBottom: 16 }}>← Fintech Docs</Link>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#f1f5f9", margin: 0 }}>Webhooks</h1>
        <p style={{ color: C.muted, fontSize: "0.9rem", marginTop: 8, maxWidth: 600, lineHeight: 1.6 }}>
          AEVION delivers signed webhook events for all fintech modules. Each request carries an <code style={{ background: C.code, padding: "2px 6px", borderRadius: 4, fontSize: "0.78rem" }}>X-Aevion-Signature</code> header you must verify before processing.
        </p>

        {/* Setup */}
        <section style={{ marginTop: 36 }}>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#f1f5f9", marginBottom: 12 }}>1 · Register your endpoint</h2>
          <p style={{ color: C.muted, fontSize: "0.85rem", marginBottom: 12, lineHeight: 1.6 }}>
            Go to <Link href="/qpaynet/settings/webhooks" style={{ color: C.accent, textDecoration: "none" }}>QPayNet → Settings → Webhooks</Link> and add your HTTPS endpoint URL. You can subscribe to individual event types or all events.
          </p>
          <pre style={{ background: C.code, border: `1px solid ${C.border}`, borderRadius: 8, padding: "1rem 1.25rem", overflowX: "auto", fontSize: "0.78rem", color: "#a5f3fc", fontFamily: "ui-monospace, monospace" }}>
{pre(`POST https://api.aevion.app/api/qpaynet/me/webhook

{
  "url": "https://your-server.com/webhooks/aevion",
  "secret": "your-random-32-byte-hex-secret",
  "events": ["transfer.completed", "request.paid"]
  // or omit events to subscribe to ALL
}`)}
          </pre>
        </section>

        {/* Signature verification */}
        <section style={{ marginTop: 36 }}>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#f1f5f9", marginBottom: 12 }}>2 · Verify the HMAC signature</h2>
          <p style={{ color: C.muted, fontSize: "0.85rem", marginBottom: 12, lineHeight: 1.6 }}>
            Every delivery includes <code style={{ background: C.code, padding: "2px 5px", borderRadius: 4, fontSize: "0.78rem" }}>X-Aevion-Signature: sha256=&lt;hex&gt;</code> computed over the raw request body.
          </p>
          <pre style={{ background: C.code, border: `1px solid ${C.border}`, borderRadius: 8, padding: "1rem 1.25rem", overflowX: "auto", fontSize: "0.78rem", color: "#a5f3fc", fontFamily: "ui-monospace, monospace" }}>
{pre(`// Express + TypeScript
import crypto from "node:crypto";
import express from "express";

const app = express();

app.post(
  "/webhooks/aevion",
  express.raw({ type: "*/*" }),   // must receive raw body
  (req, res) => {
    const sig = req.headers["x-aevion-signature"] as string ?? "";
    const expected = "sha256=" + crypto
      .createHmac("sha256", process.env.AEVION_WEBHOOK_SECRET!)
      .update(req.body)          // Buffer
      .digest("hex");

    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return res.status(401).send("Bad signature");
    }

    const event = JSON.parse(req.body.toString());
    // event.type  → "transfer.completed" | "request.paid" | ...
    // event.data  → payload specific to the event type
    // event.id    → idempotency key (deduplicate retries)
    // event.sentAt → ISO timestamp

    res.status(200).end();   // acknowledge quickly; do heavy work async
  }
);`)}
          </pre>
        </section>

        {/* Event payload */}
        <section style={{ marginTop: 36 }}>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#f1f5f9", marginBottom: 12 }}>3 · Event payload shape</h2>
          <pre style={{ background: C.code, border: `1px solid ${C.border}`, borderRadius: 8, padding: "1rem 1.25rem", overflowX: "auto", fontSize: "0.78rem", color: "#a5f3fc", fontFamily: "ui-monospace, monospace" }}>
{pre(`{
  "id":     "evt_01JXYZ...",   // unique event ID — use for deduplication
  "type":   "transfer.completed",
  "module": "qpaynet",
  "sentAt": "2026-05-12T09:41:00Z",
  "data": {
    // module-specific payload, e.g. for transfer.completed:
    "txId":        "uuid",
    "fromWallet":  "uuid",
    "toWallet":    "uuid",
    "amountKzt":   5000,
    "feeKzt":      5,
    "description": "Order #123 payment"
  }
}`)}
          </pre>
        </section>

        {/* Retry policy */}
        <section style={{ marginTop: 36 }}>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#f1f5f9", marginBottom: 12 }}>4 · Retry policy</h2>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "1rem 1.25rem", fontSize: "0.83rem", color: C.muted, lineHeight: 1.7 }}>
            <p>AEVION retries failed deliveries with exponential backoff:</p>
            <ul style={{ paddingLeft: 16, marginTop: 6 }}>
              <li>Attempt 1 — immediately</li>
              <li>Attempt 2 — 5 minutes later</li>
              <li>Attempt 3 — 30 minutes later</li>
              <li>Attempt 4 — 2 hours later</li>
              <li>Attempt 5 — 8 hours later (final)</li>
            </ul>
            <p style={{ marginTop: 8 }}>A delivery is considered failed if your endpoint returns a non-2xx status or times out (10s). After 5 failures the event is marked <code style={{ background: C.code, padding: "2px 5px", borderRadius: 4, fontSize: "0.75rem" }}>dead_letter</code>. You can manually retry dead letters from the Webhooks dashboard.</p>
          </div>
        </section>

        {/* Event catalogue */}
        <section style={{ marginTop: 36 }}>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#f1f5f9", marginBottom: 12 }}>Event catalogue</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <th style={{ textAlign: "left", padding: "8px 12px", color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Event</th>
                  <th style={{ textAlign: "left", padding: "8px 12px", color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", width: 100 }}>Module</th>
                  <th style={{ textAlign: "left", padding: "8px 12px", color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Description</th>
                </tr>
              </thead>
              <tbody>
                {EVENTS.map((e, i) => (
                  <tr key={e.event} style={{ borderBottom: `1px solid ${C.border}20`, background: i % 2 === 0 ? "transparent" : `${C.surface}50` }}>
                    <td style={{ padding: "8px 12px", fontFamily: "ui-monospace, monospace", color: "#a5f3fc" }}>{e.event}</td>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: `${MODULE_COLORS[e.module] ?? "#64748b"}25`, color: MODULE_COLORS[e.module] ?? "#64748b" }}>{e.module}</span>
                    </td>
                    <td style={{ padding: "8px 12px", color: C.muted }}>{e.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div style={{ marginTop: 40, display: "flex", gap: 20, flexWrap: "wrap", fontSize: "0.8rem", color: C.muted }}>
          <Link href="/developers/fintech/sdk" style={{ color: C.accent, textDecoration: "none" }}>SDK reference →</Link>
          <Link href="/developers/fintech/errors" style={{ color: C.accent, textDecoration: "none" }}>Error codes →</Link>
          <Link href="/qpaynet/settings/webhooks" style={{ color: C.accent, textDecoration: "none" }}>Manage webhooks →</Link>
        </div>
      </div>
    </main>
  );
}
