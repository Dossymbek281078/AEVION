import type { Metadata } from "next";
import Link from "next/link";

// Zone: aevion-core/main owns frontend/src/app/developers/fintech/**

export const metadata: Metadata = {
  title: "AEVION Fintech Troubleshooting — common issues + fixes",
  description:
    "Troubleshooting guide for the AEVION fintech API. Auth failures, idempotency conflicts, webhook delivery issues, chain verification errors, rate-limit handling.",
  alternates: { canonical: "https://aevion.app/developers/fintech/troubleshooting" },
  robots: { index: true, follow: true },
};

const C = {
  bg: "#0f172a", panel: "#1e293b", border: "#334155",
  text: "#f1f5f9", dim: "#94a3b8", faint: "#64748b",
  accent: "#a78bfa", green: "#34d399", red: "#ef4444", yellow: "#fbbf24",
};

const ISSUES = [
  {
    symptom: "401 Unauthorized on writes",
    severity: "high",
    causes: ["Missing or expired JWT", "Wrong token format (must be Bearer)"],
    fix: [
      "Run POST /api/auth/login → returns fresh token",
      "Check Authorization header: `Bearer <token>` (note space)",
      "Tokens expire after 7 days by default — refresh on 401",
    ],
  },
  {
    symptom: "409 Conflict — idempotency key reused",
    severity: "medium",
    causes: ["Replaying request with same Idempotency-Key", "Stripe webhook redelivery"],
    fix: [
      "Treat 409 as success — the original request already succeeded",
      "Response body contains the original result_id",
      "For Stripe replays, use event.id as idempotency key",
    ],
  },
  {
    symptom: "VeilNetX chain verify fails",
    severity: "high",
    causes: ["Tampering attempt", "Database corruption mid-write", "Stale read replica"],
    fix: [
      "First: re-query from primary (not replica) via /chain/verify",
      "If still fails, file an incident report at github.com/Dossymbek281078/AEVION/issues with tag `veilnetx-integrity`",
      "Do NOT auto-correct — chain integrity is single-source-of-truth",
    ],
  },
  {
    symptom: "Webhook not delivered",
    severity: "medium",
    causes: ["Endpoint returned non-2xx", "Endpoint timeout >5s", "DNS resolution failed"],
    fix: [
      "Check delivery log: GET /api/webhooks/log?event=<event_type>",
      "Verify your endpoint returns 200 within 5s",
      "AEVION retries 3 times with exponential backoff (1s, 4s, 16s)",
      "After 3 failures the event is marked failed; re-fire manually via /retry endpoint",
    ],
  },
  {
    symptom: "429 Rate limited",
    severity: "low",
    causes: ["Burst >60 req/min on write endpoints", "Public reads >300 req/min"],
    fix: [
      "Read Retry-After header — wait that many seconds",
      "Implement exponential backoff in your client",
      "Contact support@aevion.app for partner-tier higher limits",
    ],
  },
  {
    symptom: "QGood donation not anchoring to VeilNetX",
    severity: "high",
    causes: ["VeilNetX service down", "Cross-product event lib disabled"],
    fix: [
      "Check /api/veilnetx-ledger/health — should return ok",
      "Look for `[ecosystemEvents] veilnetx emit failed` in server logs",
      "Donations still persist; anchoring is fire-and-forget by design",
      "Manual re-anchor: POST /api/veilnetx-ledger/admin/reanchor with donation_id",
    ],
  },
  {
    symptom: "Z-Tide score not updating after action",
    severity: "low",
    causes: ["weightOverride not set", "User not in ZTideScore table yet"],
    fix: [
      "First action auto-creates ZTideScore row with INSERT…ON CONFLICT",
      "Check kind is in the known list (see ecosystemEvents.ts)",
      "Verify pool connection — emitZTideEvent silently fails on DB errors",
    ],
  },
  {
    symptom: "QChainGov proposal won't execute",
    severity: "medium",
    causes: ["Quorum not reached", "Tied vote (50/50)", "Admin not approved"],
    fix: [
      "Check proposal.status — must be `passed` (not just `closed`)",
      "Run POST /api/qchaingov/proposals/:id/tally to refresh counts",
      "Admin must hit POST /api/qchaingov/proposals/:id/execute to fire side-effects",
    ],
  },
];

function SeverityBadge({ level }: { level: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    high: { bg: "rgba(239,68,68,0.15)", fg: C.red },
    medium: { bg: "rgba(251,191,36,0.15)", fg: C.yellow },
    low: { bg: "rgba(52,211,153,0.15)", fg: C.green },
  };
  const c = colors[level] ?? colors.low;
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 999,
      background: c.bg,
      color: c.fg,
      fontSize: 10,
      fontWeight: 800,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    }}>{level}</span>
  );
}

export default function TroubleshootingPage() {
  return (
    <main style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "system-ui, sans-serif", padding: "32px 16px" }}>
      <article style={{ maxWidth: 780, margin: "0 auto" }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: 12, color: C.faint, marginBottom: 16 }}>
          <Link href="/developers/fintech" style={{ color: C.dim, textDecoration: "none" }}>Fintech API</Link>
          {" / "}<span style={{ color: C.text }}>Troubleshooting</span>
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em", margin: "0 0 8px" }}>
          Troubleshooting
        </h1>
        <p style={{ fontSize: 14, color: C.dim, margin: "0 0 32px", lineHeight: 1.65 }}>
          Common issues across the AEVION fintech surface. Each entry lists the symptom, likely causes, and the fix sequence.
        </p>

        {/* Issues list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {ISSUES.map((iss, i) => (
            <details
              key={i}
              style={{
                background: C.panel,
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: "14px 18px",
              }}
            >
              <summary style={{
                cursor: "pointer",
                listStyle: "none",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}>
                <SeverityBadge level={iss.severity} />
                <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{iss.symptom}</span>
              </summary>
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.faint, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                  Likely causes
                </div>
                <ul style={{ margin: "0 0 12px", paddingLeft: 22, fontSize: 13, color: C.dim, lineHeight: 1.6 }}>
                  {iss.causes.map((c, j) => <li key={j}>{c}</li>)}
                </ul>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.accent, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                  Fix
                </div>
                <ol style={{ margin: 0, paddingLeft: 22, fontSize: 13, color: C.text, lineHeight: 1.65 }}>
                  {iss.fix.map((f, j) => <li key={j}>{f}</li>)}
                </ol>
              </div>
            </details>
          ))}
        </div>

        {/* Still stuck */}
        <div style={{ marginTop: 36, padding: "16px 20px", background: C.panel, borderRadius: 12, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 8 }}>Still stuck?</div>
          <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.65 }}>
            File an issue at{" "}
            <a href="https://github.com/Dossymbek281078/AEVION/issues" style={{ color: C.accent, textDecoration: "none" }}>
              github.com/Dossymbek281078/AEVION/issues
            </a>
            {" "}with tag <code style={{ background: "rgba(255,255,255,0.05)", padding: "1px 5px", borderRadius: 3 }}>fintech-bug</code> or DM AEVION support.
            Include: timestamp (UTC), affected endpoint, request body (redact secrets), and response body.
          </div>
        </div>

        {/* Related */}
        <div style={{ marginTop: 24, display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }}>
          <Link href="/developers/fintech" style={{ color: C.accent, textDecoration: "none" }}>← API Reference</Link>
          <Link href="/developers/fintech/quickstart" style={{ color: C.accent, textDecoration: "none" }}>⚡ Quickstart</Link>
          <Link href="/fintech/status" style={{ color: C.accent, textDecoration: "none" }}>📊 Live Status</Link>
        </div>
      </article>
    </main>
  );
}
