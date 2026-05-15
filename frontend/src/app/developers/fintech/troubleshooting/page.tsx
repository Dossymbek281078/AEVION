import type { Metadata } from "next";
import Link from "next/link";

// Zone: aevion-core/main owns frontend/src/app/developers/fintech/**

export const metadata: Metadata = {
  title: "AEVION Fintech Troubleshooting — issues, fixes, recovery playbooks",
  description:
    "Troubleshooting + ops recovery for the AEVION fintech API. Auth failures, idempotency, webhook delivery, VeilNetX chain rebuild, secret rotation rollback, signature mismatch debug, Z-Tide drift, QMaskCard idempotency.",
  alternates: { canonical: "https://aevion.app/developers/fintech/troubleshooting" },
  robots: { index: true, follow: true },
};

const C = {
  bg: "#0f172a", panel: "#1e293b", border: "#334155",
  text: "#f1f5f9", dim: "#94a3b8", faint: "#64748b",
  accent: "#a78bfa", green: "#34d399", red: "#ef4444", yellow: "#fbbf24",
  code: "#0b1220",
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
    symptom: "409 Conflict / idempotent:true on charge replay",
    severity: "medium",
    causes: ["Replaying request with same paymentRef", "Stripe webhook redelivery", "Network retry after success"],
    fix: [
      "Treat `idempotent:true` (QMaskCard / QPayNet merchant.charge) as a SUCCESSFUL outcome — body contains the original transaction id",
      "For Stripe replays, use event.id as paymentRef",
      "QMaskCard enforces this via a partial unique index on (maskId, paymentRef) — see Playbook B",
    ],
  },
  {
    symptom: "VeilNetX chain verify fails (verified:false)",
    severity: "high",
    causes: ["JSONB key-order drift across pg versions", "Mid-write Postgres crash", "Restored from out-of-band backup"],
    fix: [
      "Don't auto-correct — chain integrity is single source of truth",
      "Run Playbook A (chain breakage recovery) below — diagnose → dry-run rebuild → rebuild → verify",
    ],
  },
  {
    symptom: "Webhook not delivered",
    severity: "medium",
    causes: ["Endpoint returned non-2xx", "Endpoint timeout >10s", "DNS resolution failed"],
    fix: [
      "Check delivery log: GET /api/qpaynet/admin/webhook-deliveries?webhookId=<id>",
      "Verify your endpoint returns 200 within 10s — slow handlers must ack first, work async",
      "AEVION retries 5x with exponential backoff (immediate, 5m, 30m, 2h, 8h)",
      "After 5 failures → dead_letter; manual replay: POST /api/qpaynet/admin/webhook-deliveries/:id/retry",
    ],
  },
  {
    symptom: "Webhook signature mismatch",
    severity: "medium",
    causes: ["Clock drift > 5 min between you and AEVION", "Computed HMAC over parsed body instead of raw bytes", "Forgot to include timestamp in payload prefix", "Secret rotated, your env still on old"],
    fix: [
      "Confirm `Math.abs(now-ts) < 300` first — if not, sync your server's NTP",
      "Compute over `${timestamp}.${rawBodyBytes}` — NEVER over JSON.stringify(parsed)",
      "During rotation, accept BOTH new + old secrets — see Playbook D",
    ],
  },
  {
    symptom: "429 Rate limited",
    severity: "low",
    causes: ["Burst on money endpoints (/transfer, /merchant/charge)", "Public reads burst on /stats"],
    fix: [
      "Read Retry-After header — wait that many seconds",
      "Implement exponential backoff in your client (Stripe-style: 2s, 4s, 8s, 16s, 32s)",
      "Contact support@aevion.app for partner-tier higher limits",
    ],
  },
  {
    symptom: "QGood donation not anchored to VeilNetX",
    severity: "high",
    causes: ["VeilNetX service down at emit time", "Cross-product ecosystemEvents disabled", "Network blip ledger ↔ qgood"],
    fix: [
      "Check /api/veilnetx-ledger/health — should return ok",
      "Look for `[ecosystemEvents] veilnetx emit failed` in server logs",
      "Donations still persist on QGood side — anchoring is fire-and-forget by design",
      "Re-anchor missing entries via Playbook C",
    ],
  },
  {
    symptom: "Z-Tide stats.total_weight != SUM(leaderboard.score)",
    severity: "medium",
    causes: ["Manual SQL write bypassed event log", "Migration script touched ZTideScore without ZTideEvent", "Cache staleness"],
    fix: [
      "Run prod-smoke #25 first — confirms drift",
      "Run Playbook E (Z-Tide reconciliation) below",
    ],
  },
  {
    symptom: "QChainGov proposal won't execute",
    severity: "medium",
    causes: ["Quorum not reached", "Tied vote (50/50 in yes-no mode)", "Admin not approved"],
    fix: [
      "Check proposal.status — must be `passed` (not just `closed`)",
      "Run POST /api/qchaingov/proposals/:id/tally to refresh counts",
      "Admin must hit POST /api/qchaingov/proposals/:id/execute to fire side-effects",
    ],
  },
];

/* ─── Recovery Playbooks ──────────────────────────────────────────────────── */

type Playbook = {
  id: string;
  title: string;
  when: string;
  severity: "high" | "medium" | "low";
  steps: { title: string; body?: string; code?: string; lang?: string }[];
};

const PLAYBOOKS: Playbook[] = [
  {
    id: "A",
    title: "VeilNetX chain breakage recovery",
    when: "GET /chain/verify returns verified:false and you've ruled out client tampering. Most common cause: JSONB canonicalization drift after a pg minor upgrade, or a partially-applied DB restore.",
    severity: "high",
    steps: [
      {
        title: "1. Diagnose — find the exact entry where the chain broke",
        body: "chain-doctor walks the chain, recomputes each link's hash, and points at the first mismatch with full context.",
        code: "npm run veilnetx:doctor\n# or directly:\nnode aevion-globus-backend/scripts/veilnetx-chain-doctor.js\n\n# Output:\n#   chain length: 6\n#   walking entries…\n#   ✗ break at index 1: stored hash a5d6571627f4… expected ce8f01abff32…\n#     entry id: f3e2-…  kind: deposit  ts: 2026-05-12T09:41:00Z\n#     suspect: canonical-JSON key order (meta has {b, a} vs {a, b})",
        lang: "bash",
      },
      {
        title: "2. Dry-run rebuild — confirm what would change without writing",
        body: "Recomputes every hash with the canonical (sorted-keys) serializer. Prints a diff: old hash → new hash per entry. Database is NOT touched.",
        code: "npm run veilnetx:rebuild-dry\n# or:\nnode aevion-globus-backend/scripts/rebuild-veilnetx-chain.js --dry-run\n\n# Inspect the diff. If only canonicalization is changing, proceed.\n# If amounts or payloads changed, STOP — that indicates tampering, not drift.",
        lang: "bash",
      },
      {
        title: "3. Take a Postgres backup before mutating",
        body: "The rebuild script is idempotent, but always snapshot first.",
        code: "pg_dump $DATABASE_URL --table='VeilNetXEntry' --data-only -f veilnetx-backup-$(date +%Y%m%d-%H%M%S).sql",
        lang: "bash",
      },
      {
        title: "4. Apply the rebuild",
        body: "Runs the same logic as --dry-run but writes the recomputed hash chain back. New chain is immediately verifiable.",
        code: "npm run veilnetx:rebuild\n\n# Then verify:\ncurl -s $BASE/api/veilnetx-ledger/chain/verify | jq .verified\n# expected: true",
        lang: "bash",
      },
      {
        title: "5. Record the incident",
        body: "Open a GitHub issue with the doctor output, rebuild diff, and root-cause hypothesis. Tag `veilnetx-integrity`. Even when fix is clean, the audit trail matters for future drift investigations.",
      },
    ],
  },
  {
    id: "B",
    title: "QMaskCard suspected double-charge",
    when: "Customer reports two debits with one purchase, or your reconciliation shows two QMaskCardCharge rows for one paymentRef.",
    severity: "high",
    steps: [
      {
        title: "1. Look up by paymentRef — should be exactly one row",
        body: "QMaskCard has a partial unique index on (maskId, paymentRef) WHERE status='authorized'. Two authorized rows for the same pair is impossible at the DB layer.",
        code: "SELECT id, \"maskId\", \"paymentRef\", \"amountCents\", status, \"createdAt\"\n  FROM \"QMaskCardCharge\"\n WHERE \"paymentRef\" = $1\n ORDER BY \"createdAt\";",
        lang: "sql",
      },
      {
        title: "2. If only one row exists — replay returned idempotent:true (expected)",
        body: "Confirm the second customer-side debit was your client retrying. Replay returns `idempotent:true` and the original charge id, NOT a new charge.",
        code: "// expected response shape from POST /api/qmaskcard/charges replay:\n{ id: \"<original-uuid>\", status: \"authorized\", idempotent: true, amountCents: 500 }",
        lang: "json",
      },
      {
        title: "3. If two rows exist — partial-index missing",
        body: "Should not happen post-2026-05-12 (fix commit 933c797c). If you see it, the index was never deployed.",
        code: "-- Verify the index exists\nSELECT indexname, indexdef\n  FROM pg_indexes\n WHERE tablename = 'QMaskCardCharge'\n   AND indexname LIKE '%paymentRef%';\n\n-- Expected:\n--   qmaskcard_charge_idempotency_idx\n--   CREATE UNIQUE INDEX … ON \"QMaskCardCharge\" (\"maskId\", \"paymentRef\") WHERE status = 'authorized'",
        lang: "sql",
      },
      {
        title: "4. Recreate the index if missing, then audit historical doubles",
        code: "CREATE UNIQUE INDEX CONCURRENTLY qmaskcard_charge_idempotency_idx\n    ON \"QMaskCardCharge\" (\"maskId\", \"paymentRef\")\n WHERE status = 'authorized';\n\n-- Then find historical doubles:\nSELECT \"maskId\", \"paymentRef\", COUNT(*) AS n, SUM(\"amountCents\") AS total\n  FROM \"QMaskCardCharge\"\n WHERE status = 'authorized'\n GROUP BY 1, 2\nHAVING COUNT(*) > 1;",
        lang: "sql",
      },
    ],
  },
  {
    id: "C",
    title: "Re-anchor missed events to VeilNetX",
    when: "QGood donation, QPayNet transfer, or Z-Tide promotion succeeded on its own module, but never landed in VeilNetX (visible as gap between module count and ledger count for that kind).",
    severity: "medium",
    steps: [
      {
        title: "1. Find the gap — count divergence",
        code: "-- Example: QGood donations vs VeilNetX-anchored donations\nSELECT (SELECT COUNT(*) FROM \"QGoodDonation\") AS qgood_count,\n       (SELECT COUNT(*) FROM \"VeilNetXEntry\" WHERE kind = 'qgood:donation') AS anchored_count;",
        lang: "sql",
      },
      {
        title: "2. List the un-anchored ones",
        code: "SELECT d.id, d.\"campaignId\", d.\"amountCents\", d.\"createdAt\"\n  FROM \"QGoodDonation\" d\n  LEFT JOIN \"VeilNetXEntry\" v\n    ON v.\"sourceId\" = d.id::text AND v.kind = 'qgood:donation'\n WHERE v.id IS NULL\n ORDER BY d.\"createdAt\" DESC\n LIMIT 100;",
        lang: "sql",
      },
      {
        title: "3. Re-emit through the canonical event lib (NOT raw insert)",
        body: "Direct INSERT into VeilNetXEntry bypasses canonicalization and breaks the chain. Always call emitVeilNetX() so canonical-JSON + sequential hashing applies.",
        code: "// scripts/reanchor-qgood.ts\nimport { emitVeilNetX } from \"../src/lib/ecosystemEvents\";\n// fetch un-anchored donations, then:\nfor (const d of missing) {\n  await emitVeilNetX({\n    kind: \"qgood:donation\",\n    sourceId: d.id,\n    actorEmail: d.donor_email_hash ?? null,\n    amountCents: d.amountCents,\n    currency: d.currency,\n    meta: { campaignId: d.campaignId },\n  });\n}",
        lang: "ts",
      },
      {
        title: "4. Verify chain still intact",
        code: "curl -s $BASE/api/veilnetx-ledger/chain/verify | jq .verified  # expect true\nnpm run veilnetx:stats   # confirm count matches qgood total",
        lang: "bash",
      },
    ],
  },
  {
    id: "D",
    title: "Webhook secret rotation — and rollback if new secret is bad",
    when: "Rotating endpoint secret without dropping in-flight deliveries. Or: you rotated, receiver is now rejecting signatures, you need to revert.",
    severity: "medium",
    steps: [
      {
        title: "1. Pre-stage receiver with two secrets (new + old)",
        body: "Deploy receiver code that accepts both. AEVION's verifier supports this via previousSecrets[] — see /developers/fintech/webhooks#6 secret rotation. Deploy this FIRST before changing secrets on AEVION's side.",
      },
      {
        title: "2. Change the secret on AEVION",
        code: "PATCH /api/qpaynet/me/webhook\nAuthorization: Bearer <jwt>\n\n{ \"secret\": \"<new-32-byte-hex>\" }\n\n# AEVION starts signing with NEW immediately; OLD is no longer used outbound.",
        lang: "http",
      },
      {
        title: "3. Watch receiver logs for 24h",
        body: "If you see `secretIndex > 0` in your verify logs, that means a delivery still used the old secret — either an in-flight retry, or AEVION hasn't fully propagated. Wait another retry window before continuing.",
      },
      {
        title: "4. ROLLBACK — if new secret is bad (e.g. typo, leaked)",
        body: "Switch BACK to the old secret on AEVION (still valid in your receiver thanks to step 1). Then mint a fresh new one and restart the rotation.",
        code: "# Revert outbound secret to the prior value:\nPATCH /api/qpaynet/me/webhook\n\n{ \"secret\": \"<the-old-value-still-in-AEVION_WEBHOOK_SECRET_OLD>\" }\n\n# Receiver still verifies because both are in previousSecrets.",
        lang: "http",
      },
      {
        title: "5. Cleanup — drop old secret from receiver",
        body: "After 48h with no secretIndex > 0 hits, remove the old secret from receiver env and redeploy. Rotation complete.",
      },
    ],
  },
  {
    id: "E",
    title: "Z-Tide score drift reconciliation",
    when: "Smoke #25 reports `Z-Tide aggregate drift sum=X vs total_weight=Y`. Means ZTideScore rows no longer sum to the recorded event total.",
    severity: "medium",
    steps: [
      {
        title: "1. Confirm drift direction — events vs scores",
        code: "SELECT (SELECT COALESCE(SUM(weight),0) FROM \"ZTideEvent\") AS event_sum,\n       (SELECT COALESCE(SUM(score),0)  FROM \"ZTideScore\") AS score_sum;",
        lang: "sql",
      },
      {
        title: "2. Find users whose score doesn't match their event sum",
        code: "SELECT s.\"userId\", s.score AS score_now,\n       COALESCE(SUM(e.weight), 0) AS expected\n  FROM \"ZTideScore\" s\n  LEFT JOIN \"ZTideEvent\" e ON e.\"userId\" = s.\"userId\"\n GROUP BY s.\"userId\", s.score\nHAVING s.score != COALESCE(SUM(e.weight), 0)\n ORDER BY ABS(s.score - COALESCE(SUM(e.weight), 0)) DESC;",
        lang: "sql",
      },
      {
        title: "3. Rebuild scores from events (single atomic update)",
        code: "BEGIN;\nUPDATE \"ZTideScore\" s\n   SET score = COALESCE(sub.s, 0),\n       \"updatedAt\" = NOW()\n  FROM (\n    SELECT \"userId\", SUM(weight) AS s\n      FROM \"ZTideEvent\"\n     GROUP BY \"userId\"\n  ) AS sub\n WHERE sub.\"userId\" = s.\"userId\";\n-- Verify before commit:\nSELECT SUM(score) FROM \"ZTideScore\";\n-- Should now equal SUM(weight) from ZTideEvent.\nCOMMIT;",
        lang: "sql",
      },
      {
        title: "4. Re-run prod-smoke #25 to confirm reconciliation",
        code: "BASE=$YOUR_BASE node aevion-globus-backend/scripts/fintech-prod-smoke.js | grep \"Z-Tide:\"",
        lang: "bash",
      },
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

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  return (
    <pre style={{
      background: C.code,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      padding: "12px 14px",
      overflowX: "auto",
      fontSize: 12,
      lineHeight: 1.55,
      color: "#a5f3fc",
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      whiteSpace: "pre",
      margin: "8px 0 0",
    }}>
      {lang ? <span style={{ display: "block", fontSize: 10, color: C.faint, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{lang}</span> : null}
      {code}
    </pre>
  );
}

export default function TroubleshootingPage() {
  return (
    <main style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "system-ui, sans-serif", padding: "32px 16px" }}>
      <article style={{ maxWidth: 860, margin: "0 auto" }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: 12, color: C.faint, marginBottom: 16 }}>
          <Link href="/developers/fintech" style={{ color: C.dim, textDecoration: "none" }}>Fintech API</Link>
          {" / "}<span style={{ color: C.text }}>Troubleshooting</span>
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em", margin: "0 0 8px" }}>
          Troubleshooting &amp; Recovery
        </h1>
        <p style={{ fontSize: 14, color: C.dim, margin: "0 0 32px", lineHeight: 1.65 }}>
          Quick issues on top, full operational recovery playbooks below — chain breakage, idempotency, re-anchoring missed events, secret rotation rollback, score reconciliation.
        </p>

        {/* Quick issues */}
        <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: "0 0 12px" }}>Quick issues</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 40 }}>
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

        {/* Recovery playbooks */}
        <h2 style={{ fontSize: 20, fontWeight: 900, color: C.text, margin: "0 0 6px" }}>Recovery playbooks</h2>
        <p style={{ fontSize: 13, color: C.dim, margin: "0 0 18px", lineHeight: 1.6 }}>
          Step-by-step operational runbooks for the 5 most consequential incidents. Run them in order — each playbook&apos;s last step is verification.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {PLAYBOOKS.map((pb) => (
            <section
              key={pb.id}
              id={`playbook-${pb.id.toLowerCase()}`}
              style={{
                background: C.panel,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                padding: "20px 22px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <span style={{
                  background: "rgba(167,139,250,0.15)",
                  color: C.accent,
                  borderRadius: 6,
                  padding: "3px 9px",
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 0.5,
                }}>Playbook {pb.id}</span>
                <SeverityBadge level={pb.severity} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: "0 0 8px" }}>
                {pb.title}
              </h3>
              <p style={{ fontSize: 13, color: C.dim, margin: "0 0 16px", lineHeight: 1.65 }}>
                <span style={{ color: C.faint, fontWeight: 700, textTransform: "uppercase", fontSize: 10, letterSpacing: 0.5, marginRight: 6 }}>When</span>
                {pb.when}
              </p>
              <ol style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
                {pb.steps.map((s, j) => (
                  <li key={j} style={{ marginBottom: 18 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                      <span style={{
                        background: "rgba(255,255,255,0.05)",
                        color: C.text,
                        borderRadius: 999,
                        minWidth: 22,
                        height: 22,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 800,
                      }}>{j + 1}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>{s.title}</div>
                        {s.body ? <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.65 }}>{s.body}</div> : null}
                        {s.code ? <CodeBlock code={s.code} lang={s.lang} /> : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
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
            {" "}with tag <code style={{ background: "rgba(255,255,255,0.05)", padding: "1px 5px", borderRadius: 3 }}>fintech-bug</code>.
            Include: timestamp (UTC), affected endpoint, request body (redact secrets), response body, and which playbook step you reached.
          </div>
        </div>

        {/* Related */}
        <div style={{ marginTop: 24, display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }}>
          <Link href="/developers/fintech" style={{ color: C.accent, textDecoration: "none" }}>← API Reference</Link>
          <Link href="/developers/fintech/quickstart" style={{ color: C.accent, textDecoration: "none" }}>⚡ Quickstart</Link>
          <Link href="/developers/fintech/webhooks" style={{ color: C.accent, textDecoration: "none" }}>🔔 Webhooks</Link>
          <Link href="/fintech/status" style={{ color: C.accent, textDecoration: "none" }}>📊 Live Status</Link>
        </div>
      </article>
    </main>
  );
}
