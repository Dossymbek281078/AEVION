import type { Metadata } from "next";
import Link from "next/link";

// Zone: aevion-core/main owns frontend/src/app/developers/fintech/**

export const metadata: Metadata = {
  title: "AEVION Stripe Verifier — webhook signature verification guide",
  description:
    "How to verify Stripe webhook signatures against the AEVION Stripe verifier endpoint. Examples in curl + Node + Python. Production-ready signing model with HMAC-SHA256.",
  alternates: { canonical: "https://aevion.app/developers/fintech/stripe-verifier" },
  robots: { index: true, follow: true },
};

const C = {
  bg: "#0f172a", panel: "#1e293b", border: "#334155",
  text: "#f1f5f9", dim: "#94a3b8", faint: "#64748b",
  accent: "#a78bfa", green: "#34d399", code: "#a5f3fc",
};

function Code({ children }: { children: React.ReactNode }) {
  return <code style={{ background: "rgba(255,255,255,0.07)", padding: "1px 6px", borderRadius: 4, fontFamily: "ui-monospace, monospace", fontSize: 12, color: C.code }}>{children}</code>;
}
function Pre({ children }: { children: React.ReactNode }) {
  return (
    <pre style={{
      background: "rgba(0,0,0,0.4)",
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      padding: "12px 16px",
      fontSize: 12,
      color: C.code,
      fontFamily: "ui-monospace, monospace",
      lineHeight: 1.55,
      overflow: "auto",
      margin: "0 0 16px",
    }}>{children}</pre>
  );
}
function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 20, fontWeight: 900, color: C.text, margin: "32px 0 12px", letterSpacing: "-0.02em" }}>{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 14, lineHeight: 1.65, color: C.dim, margin: "0 0 14px" }}>{children}</p>;
}

export default function StripeVerifierPage() {
  return (
    <main style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "system-ui, sans-serif", padding: "32px 16px" }}>
      <article style={{ maxWidth: 760, margin: "0 auto" }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: 12, color: C.faint, marginBottom: 16 }}>
          <Link href="/developers/fintech" style={{ color: C.dim, textDecoration: "none" }}>Fintech API</Link>
          {" / "}<span style={{ color: C.text }}>Stripe Verifier</span>
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 8px" }}>
          Stripe Webhook Verifier
        </h1>
        <P>
          AEVION exposes a thin verifier for Stripe webhook signatures so partner services can
          re-confirm event authenticity before acting on them. This is independent of Stripe's own
          signature scheme — it&apos;s a second-factor that anchors webhook events into the AEVION
          settlement layer.
        </P>

        <H2>How it works</H2>
        <P>
          Stripe POSTs an event to your endpoint with a <Code>Stripe-Signature</Code> header.
          You verify against Stripe (HMAC-SHA256 with your <Code>STRIPE_WEBHOOK_SECRET</Code>),
          then optionally re-anchor to AEVION via <Code>POST /api/qpaynet/stripe/verify</Code>.
          The AEVION verifier returns <Code>ok: true</Code> only if the event payload + Stripe-signature
          combination is verifiable and the event hasn&apos;t already been processed.
        </P>

        <H2>1. Verify with Stripe SDK (Node)</H2>
        <Pre>{`import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const sig = request.headers["stripe-signature"];
const event = stripe.webhooks.constructEvent(
  rawBody,
  sig,
  process.env.STRIPE_WEBHOOK_SECRET!
);
// At this point Stripe's signature has verified. Now anchor to AEVION:`}</Pre>

        <H2>2. Re-anchor with AEVION verifier</H2>
        <Pre>{`const r = await fetch("https://api.aevion.app/api/qpaynet/stripe/verify", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": \`Bearer \${process.env.AEV_TOKEN}\`,
  },
  body: JSON.stringify({
    event_id: event.id,
    event_type: event.type,
    raw_payload: rawBody,
    stripe_signature: sig,
  }),
});
const result = await r.json();
// result: { ok: true, anchored: true, veilnetx_id: "...", idempotent: false }
// Idempotent=true means this event was already processed.`}</Pre>

        <H2>3. Python equivalent</H2>
        <Pre>{`import stripe, requests, os
stripe.api_key = os.environ["STRIPE_SECRET_KEY"]
sig = request.headers.get("Stripe-Signature")
event = stripe.Webhook.construct_event(
    raw_body, sig, os.environ["STRIPE_WEBHOOK_SECRET"]
)
r = requests.post(
    "https://api.aevion.app/api/qpaynet/stripe/verify",
    headers={"Authorization": f"Bearer {os.environ['AEV_TOKEN']}"},
    json={
        "event_id": event.id,
        "event_type": event.type,
        "raw_payload": raw_body.decode(),
        "stripe_signature": sig,
    },
)
print(r.json())`}</Pre>

        <H2>4. Idempotency</H2>
        <P>
          The verifier deduplicates by <Code>event_id</Code> — Stripe&apos;s globally-unique event
          identifier. Replaying the same event later (e.g., via Stripe&apos;s &quot;Resend&quot; button)
          returns <Code>idempotent: true</Code> and does not double-anchor to VeilNetX. This makes
          it safe to call the verifier from inside your webhook handler even on retries.
        </P>

        <H2>5. Failure modes</H2>
        <ul style={{ fontSize: 14, color: C.dim, lineHeight: 1.7, paddingLeft: 20 }}>
          <li><Code>401</Code> — missing or invalid Bearer token</li>
          <li><Code>400</Code> — malformed body, missing fields, or signature mismatch</li>
          <li><Code>409</Code> — event already processed (idempotency conflict, rare)</li>
          <li><Code>500</Code> — verifier-side error; safe to retry with exponential backoff</li>
        </ul>

        <H2>Related endpoints</H2>
        <ul style={{ fontSize: 14, lineHeight: 1.7, paddingLeft: 20 }}>
          <li><Code>POST /api/qpaynet/deposit</Code> — initiate Stripe checkout, returns session URL</li>
          <li><Code>POST /api/qpaynet/stripe/webhook</Code> — Stripe&apos;s direct callback target</li>
          <li><Code>GET /api/qpaynet/me/deposits</Code> — your deposit history (auth required)</li>
        </ul>

        {/* Back link */}
        <div style={{ marginTop: 40, padding: "12px 16px", background: C.panel, borderRadius: 10, border: `1px solid ${C.border}` }}>
          <Link href="/developers/fintech" style={{ color: C.accent, fontSize: 13, textDecoration: "none" }}>
            ← Back to Fintech API Reference
          </Link>
        </div>
      </article>
    </main>
  );
}
