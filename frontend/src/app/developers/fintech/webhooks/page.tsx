import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AEVION Fintech Webhooks — real-time event delivery",
  description: "Set up webhooks to receive real-time events from QPayNet, VeilNetX, QMaskCard, QGood, Z-Tide and QChainGov. HMAC-SHA256 signed with timestamp replay protection, retry queues and secret rotation.",
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
  { module: "qmaskcard", event: "mask.created",          desc: "New virtual mask issued" },
  { module: "qmaskcard", event: "charge.authorized",     desc: "Mask charge authorized (idempotent)" },
  { module: "qmaskcard", event: "charge.declined",       desc: "Mask charge declined (limit/lock/fraud)" },
  { module: "ztide",   event: "score.updated",           desc: "User's reputation score changed" },
  { module: "ztide",   event: "rank.promoted",           desc: "User moved to a higher rank tier" },
  { module: "qchaingov", event: "proposal.passed",       desc: "Governance proposal reached quorum and passed" },
  { module: "qchaingov", event: "proposal.rejected",     desc: "Proposal failed to reach quorum or majority" },
  { module: "veilnetx",  event: "ledger.entry_added",    desc: "New settlement entry appended to ledger" },
  { module: "veilnetx",  event: "ledger.chain_verified", desc: "Periodic chain integrity audit completed" },
];

const MODULE_COLORS: Record<string, string> = {
  qpaynet: "#6366f1", qgood: "#10b981", qmaskcard: "#a78bfa", ztide: "#f59e0b", qchaingov: "#f472b6", veilnetx: "#8b5cf6",
};

const codeBlockStyle: React.CSSProperties = { background: C.code, border: `1px solid ${C.border}`, borderRadius: 8, padding: "1rem 1.25rem", overflowX: "auto", fontSize: "0.78rem", color: "#a5f3fc", fontFamily: "ui-monospace, monospace", whiteSpace: "pre" };
const sectionStyle: React.CSSProperties = { marginTop: 36 };
const h2Style: React.CSSProperties = { fontSize: "1.15rem", fontWeight: 700, color: "#f1f5f9", marginBottom: 12 };
const pMutedStyle: React.CSSProperties = { color: C.muted, fontSize: "0.85rem", marginBottom: 12, lineHeight: 1.6 };
const inlineCode: React.CSSProperties = { background: C.code, padding: "2px 6px", borderRadius: 4, fontSize: "0.78rem" };

function pre(s: string) { return s.trim(); }

export default function FintechWebhooksPage() {
  return (
    <main style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "3rem 1.5rem 4rem" }}>
        <Link href="/developers/fintech" style={{ color: C.muted, fontSize: "0.8rem", textDecoration: "none", display: "inline-block", marginBottom: 16 }}>← Fintech Docs</Link>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#f1f5f9", margin: 0 }}>Webhooks</h1>
        <p style={{ color: C.muted, fontSize: "0.9rem", marginTop: 8, maxWidth: 600, lineHeight: 1.6 }}>
          AEVION delivers signed webhook events for all fintech modules. Each request carries an <code style={inlineCode}>X-Aevion-Signature</code> and <code style={inlineCode}>X-Aevion-Timestamp</code> — verify both before processing.
        </p>

        {/* Setup */}
        <section style={sectionStyle}>
          <h2 style={h2Style}>1 · Register your endpoint</h2>
          <p style={pMutedStyle}>
            Go to <Link href="/qpaynet/settings/webhooks" style={{ color: C.accent, textDecoration: "none" }}>QPayNet → Settings → Webhooks</Link> and add your HTTPS endpoint URL. You can subscribe to individual event types or all events.
          </p>
          <pre style={codeBlockStyle}>
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
        <section style={sectionStyle}>
          <h2 style={h2Style}>2 · Verify the HMAC signature</h2>
          <p style={pMutedStyle}>
            Every delivery includes <code style={inlineCode}>X-Aevion-Signature: sha256=&lt;hex&gt;</code> and <code style={inlineCode}>X-Aevion-Timestamp: &lt;unix-seconds&gt;</code>. The signature is computed over <code style={inlineCode}>{`${"$"}{timestamp}.${"$"}{rawBody}`}</code> using HMAC-SHA256 with your endpoint secret. Reject requests where the timestamp drifts by more than 5 minutes — this prevents replay of old captures.
          </p>

          <h3 style={{ fontSize: "0.9rem", color: "#cbd5e1", margin: "16px 0 8px" }}>Node.js / TypeScript (Express)</h3>
          <pre style={codeBlockStyle}>
{pre(`import crypto from "node:crypto";
import express from "express";

const TOLERANCE_SEC = 300;
const app = express();

app.post(
  "/webhooks/aevion",
  express.raw({ type: "*/*" }),  // must receive raw body
  (req, res) => {
    const sigHeader = (req.headers["x-aevion-signature"] as string) || "";
    const ts = Number(req.headers["x-aevion-timestamp"] || 0);
    const raw = req.body as Buffer;

    if (!ts || Math.abs(Date.now() / 1000 - ts) > TOLERANCE_SEC) {
      return res.status(401).send("timestamp out of tolerance");
    }

    const expected = crypto
      .createHmac("sha256", process.env.AEVION_WEBHOOK_SECRET!)
      .update(\`\${ts}.\${raw.toString("utf8")}\`)
      .digest("hex");
    const provided = sigHeader.replace(/^sha256=/, "");

    if (provided.length !== expected.length ||
        !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) {
      return res.status(401).send("bad signature");
    }

    const event = JSON.parse(raw.toString("utf8"));
    // event.id      → idempotency key (deduplicate retries)
    // event.type    → "transfer.completed" | "request.paid" | ...
    // event.module  → "qpaynet" | "qgood" | "qmaskcard" | ...
    // event.sentAt  → ISO timestamp
    // event.data    → module-specific payload

    res.status(200).end();   // ack quickly; do heavy work async
  }
);`)}
          </pre>

          <h3 style={{ fontSize: "0.9rem", color: "#cbd5e1", margin: "16px 0 8px" }}>Python (Flask)</h3>
          <pre style={codeBlockStyle}>
{pre(`import hmac, hashlib, os, time
from flask import Flask, request, abort

TOLERANCE_SEC = 300
SECRET = os.environ["AEVION_WEBHOOK_SECRET"].encode()
app = Flask(__name__)

@app.post("/webhooks/aevion")
def receive():
    raw = request.get_data()  # bytes — DO NOT use request.json before verify
    sig = (request.headers.get("X-Aevion-Signature") or "").removeprefix("sha256=")
    ts = int(request.headers.get("X-Aevion-Timestamp") or 0)

    if not ts or abs(time.time() - ts) > TOLERANCE_SEC:
        abort(401, "timestamp out of tolerance")

    payload = f"{ts}.".encode() + raw
    expected = hmac.new(SECRET, payload, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(sig, expected):
        abort(401, "bad signature")

    event = request.get_json(force=True)
    # event["id"], event["type"], event["module"], event["data"]
    return "", 200`)}
          </pre>

          <h3 style={{ fontSize: "0.9rem", color: "#cbd5e1", margin: "16px 0 8px" }}>Go (net/http)</h3>
          <pre style={codeBlockStyle}>
{pre(`package main

import (
  "crypto/hmac"
  "crypto/sha256"
  "encoding/hex"
  "io"
  "net/http"
  "os"
  "strconv"
  "strings"
  "time"
)

const toleranceSec = 300

func handler(w http.ResponseWriter, r *http.Request) {
  raw, _ := io.ReadAll(r.Body)
  sig := strings.TrimPrefix(r.Header.Get("X-Aevion-Signature"), "sha256=")
  ts, _ := strconv.ParseInt(r.Header.Get("X-Aevion-Timestamp"), 10, 64)

  skew := time.Now().Unix() - ts
  if skew < 0 { skew = -skew }
  if ts == 0 || skew > toleranceSec {
    http.Error(w, "timestamp out of tolerance", 401); return
  }

  payload := strconv.FormatInt(ts, 10) + "." + string(raw)
  mac := hmac.New(sha256.New, []byte(os.Getenv("AEVION_WEBHOOK_SECRET")))
  mac.Write([]byte(payload))
  expected := hex.EncodeToString(mac.Sum(nil))

  if !hmac.Equal([]byte(sig), []byte(expected)) {
    http.Error(w, "bad signature", 401); return
  }

  // parse + handle event …
  w.WriteHeader(200)
}`)}
          </pre>
        </section>

        {/* Event payload */}
        <section style={sectionStyle}>
          <h2 style={h2Style}>3 · Event payload shape</h2>
          <pre style={codeBlockStyle}>
{pre(`{
  "id":     "evt_01JXYZ...",   // unique event ID — use for deduplication
  "type":   "transfer.completed",
  "module": "qpaynet",
  "sentAt": "2026-05-12T09:41:00Z",
  "data": {
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

        {/* Idempotency */}
        <section style={sectionStyle}>
          <h2 style={h2Style}>4 · Idempotency &amp; deduplication</h2>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "1rem 1.25rem", fontSize: "0.83rem", color: C.muted, lineHeight: 1.7 }}>
            <p>Retries arrive with the <strong>same <code style={inlineCode}>event.id</code></strong>. Store it on receipt and reject duplicates — that keeps your handler crash-safe under network blips:</p>
            <pre style={{ ...codeBlockStyle, marginTop: 10, fontSize: "0.75rem" }}>
{pre(`-- Postgres dedup table
CREATE TABLE webhook_seen (
  event_id TEXT PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- On handler entry, before doing real work:
INSERT INTO webhook_seen (event_id) VALUES ($1)
  ON CONFLICT (event_id) DO NOTHING
  RETURNING 1;  -- returns 0 rows on dup → ack 200 and skip`)}
            </pre>
            <p style={{ marginTop: 10 }}>QMaskCard <code style={inlineCode}>charge.authorized</code> events expose the same partial-unique-index idempotency on <code style={inlineCode}>(maskId, paymentRef)</code> — a replay returns <code style={inlineCode}>idempotent:true</code> with the original charge id.</p>
          </div>
        </section>

        {/* Retry policy */}
        <section style={sectionStyle}>
          <h2 style={h2Style}>5 · Retry policy</h2>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "1rem 1.25rem", fontSize: "0.83rem", color: C.muted, lineHeight: 1.7 }}>
            <p>AEVION retries failed deliveries with exponential backoff:</p>
            <ul style={{ paddingLeft: 16, marginTop: 6 }}>
              <li>Attempt 1 — immediately</li>
              <li>Attempt 2 — 5 minutes later</li>
              <li>Attempt 3 — 30 minutes later</li>
              <li>Attempt 4 — 2 hours later</li>
              <li>Attempt 5 — 8 hours later (final)</li>
            </ul>
            <p style={{ marginTop: 8 }}>A delivery is failed if your endpoint returns non-2xx or times out (10s). After 5 failures the event is marked <code style={inlineCode}>dead_letter</code>. Manually retry from the Webhooks dashboard.</p>
          </div>
        </section>

        {/* Secret rotation */}
        <section style={sectionStyle}>
          <h2 style={h2Style}>6 · Secret rotation</h2>
          <p style={pMutedStyle}>
            Rotate without downtime by accepting <strong>two secrets</strong> at once during a transition window. Run both for 24-48h, then drop the old one:
          </p>
          <pre style={codeBlockStyle}>
{pre(`// Receiver: try the new secret first, fall back to old during rotation
const secrets = [
  process.env.AEVION_WEBHOOK_SECRET_NEW!,  // current
  process.env.AEVION_WEBHOOK_SECRET_OLD,    // accepted until cutover (optional)
].filter(Boolean) as string[];

const provided = sigHeader.replace(/^sha256=/, "");
const payload = \`\${ts}.\${raw.toString("utf8")}\`;

const matchedIndex = secrets.findIndex((secret) => {
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return provided.length === expected.length &&
         crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
});

if (matchedIndex === -1) return res.status(401).send("bad signature");
if (matchedIndex > 0) {
  // log: still seeing old secret in flight — finish migration soon
  console.warn("[webhook] verified with rotated secret index", matchedIndex);
}`)}
          </pre>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "1rem 1.25rem", fontSize: "0.83rem", color: C.muted, lineHeight: 1.7, marginTop: 12 }}>
            <p><strong>Recommended cutover:</strong></p>
            <ol style={{ paddingLeft: 18, marginTop: 6 }}>
              <li>Generate a new 32-byte random secret on your side.</li>
              <li>POST <code style={inlineCode}>/api/qpaynet/me/webhook</code> with <code style={inlineCode}>{`{"secret": "<new>"}`}</code> — AEVION starts signing with new immediately.</li>
              <li>Deploy receiver code that accepts both new + old secrets.</li>
              <li>Wait 24h — verify logs show no <code style={inlineCode}>secretIndex &gt; 0</code> hits.</li>
              <li>Remove <code style={inlineCode}>AEVION_WEBHOOK_SECRET_OLD</code> and redeploy.</li>
            </ol>
          </div>
        </section>

        {/* Local testing */}
        <section style={sectionStyle}>
          <h2 style={h2Style}>7 · Local testing</h2>
          <p style={pMutedStyle}>
            Use <code style={inlineCode}>ngrok</code> (or any HTTPS tunnel) to receive on your laptop. To generate a fixture signature for unit tests:
          </p>
          <pre style={codeBlockStyle}>
{pre(`// Mirrors AEVION's signer exactly
import crypto from "node:crypto";

function signFixture(body: object, secret: string) {
  const ts = Math.floor(Date.now() / 1000);
  const payload = \`\${ts}.\${JSON.stringify(body)}\`;
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return {
    "X-Aevion-Signature": \`sha256=\${sig}\`,
    "X-Aevion-Timestamp": String(ts),
  };
}`)}
          </pre>
        </section>

        {/* Event catalogue */}
        <section style={sectionStyle}>
          <h2 style={h2Style}>Event catalogue</h2>
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
          <Link href="/developers/fintech/troubleshooting" style={{ color: C.accent, textDecoration: "none" }}>Troubleshooting →</Link>
          <Link href="/qpaynet/settings/webhooks" style={{ color: C.accent, textDecoration: "none" }}>Manage webhooks →</Link>
        </div>
      </div>
    </main>
  );
}
