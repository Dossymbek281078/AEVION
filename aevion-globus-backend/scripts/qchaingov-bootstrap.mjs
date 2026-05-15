#!/usr/bin/env node
/**
 * One-shot script: seed AEVION QChainGov with 3 launch proposals via the live API.
 *
 * Requires:
 *   BASE           backend URL (default https://aevion-production-a70c.up.railway.app)
 *   ADMIN_EMAIL    yahiin1978@gmail.com (must match QCHAINGOV_ADMIN_EMAILS on Railway)
 *   ADMIN_PASS     your account password
 *
 * Usage (PowerShell):
 *   $env:ADMIN_EMAIL="yahiin1978@gmail.com"; $env:ADMIN_PASS="<pass>"; node scripts/qchaingov-bootstrap.mjs
 *
 * Usage (bash):
 *   ADMIN_EMAIL=yahiin1978@gmail.com ADMIN_PASS=<pass> node scripts/qchaingov-bootstrap.mjs
 *
 * Proposals created (all opened immediately after creation):
 *   1. Treasury allocation (weighted, 14d)
 *   2. VeilNetX Ledger v2 QSign anchoring (yes/no/abstain, 10d)
 *   3. Promote QMaskCard MVP → Working v1 (yes/no/abstain, 7d)
 */

const BASE  = (process.env.BASE || "https://aevion-production-a70c.up.railway.app").replace(/\/+$/, "");
const EMAIL = process.env.ADMIN_EMAIL;
const PASS  = process.env.ADMIN_PASS;

if (!EMAIL || !PASS) {
  console.error("❌  Set ADMIN_EMAIL and ADMIN_PASS env vars before running.");
  process.exit(1);
}

async function post(path, body, token) {
  const h = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: h,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await r.json().catch(() => ({}));
  return { status: r.status, body: json };
}

const now = new Date();
const isoNow = now.toISOString();
const isoPlusDays = (d) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000).toISOString();

const PROPOSALS = [
  {
    label: "treasury",
    title: "Q3 2026 ecosystem treasury allocation",
    summary: "Allocate Q3 treasury across QPayNet liquidity, QGood matching fund, and AEV mining rewards.",
    body: [
      "AEVION's Q3 2026 treasury cycle requires explicit allocation across three demand sinks that are currently competing for the same pool: QPayNet escrow liquidity, QGood matching donations, and AEV mining emissions. With 27 modules now live and QPayNet handling real merchant volume, the default split inherited from Q2 no longer reflects on-chain reality and must be re-ratified by holders.",
      "Option A (qpaynet-liquidity-40) directs 40% of the quarterly outflow to widening QPayNet escrow caps. This unlocks larger merchant deposits — currently capped at the per-wallet ceiling — and reduces the rate of payment-request expirations we've observed on /qpaynet/requests. Trade-off: less capital for non-revenue programs.",
      "Option B (qgood-matching-30) routes 30% to the QGood matching fund, doubling donor contributions up to a quarterly ceiling. This is the only allocation that directly improves AEVION's stewardship score in the Planet compliance layer and is the cheapest way to grow active wallets via the campaigns surface. Trade-off: matching payouts do not return to treasury.",
      "Option C (aev-mining-30) funds the Play / Compute / Stewardship / Streak engines that mint AEV against the 21M cap. Continuing emission at current rates sustains CyberChess and QTrade activity but accelerates the path to halving. Trade-off: post-halving the same USD subsidy buys half the AEV-denominated incentive.",
      "Voters weight these three options; weights are summed and normalized. Quorum 15%, pass threshold 50% on the leading option. Outcome binds the treasury multisig for Q3 disbursements.",
    ].join("\n\n"),
    category: "treasury",
    voteMode: "weighted",
    options: ["qpaynet-liquidity-40", "qgood-matching-30", "aev-mining-30"],
    quorumPercent: 15,
    passThreshold: 50,
    votesOpenAt: isoNow,
    votesCloseAt: isoPlusDays(14),
  },
  {
    label: "protocol",
    title: "VeilNetX Ledger v2 — add per-entry QSign anchoring",
    summary: "Upgrade settlement chain to optionally anchor each entry with a QSign v2 signature so external verifiers can audit without trusting the API.",
    body: [
      "VeilNetX Ledger v1 protects integrity through a hash chain rooted in the API process: each settlement entry links to the previous via contentHash, and the chain head is published in /api/veilnetx/head. External verifiers today must trust that the backend has not silently re-keyed the chain. This works for an internal audit but does not scale to third-party auditors or regulators.",
      "Ledger v2 introduces an optional QSign v2 anchor per entry. When enabled, the API signs the canonical JSON of every new entry using the production Dilithium key (FIPS 204 ML-DSA-65, already in use by QSign v2 since PR #21). The signature, key id, and algorithm tag are persisted alongside the entry and exposed in the public read endpoint. Verifiers can then reconstruct each entry's canonical form, fetch the published key, and verify without API trust.",
      "Migration: existing entries remain v1 (hash-only). New entries default to v2 once the flag QSIGN_ANCHOR_LEDGER=1 is set on Railway. A backfill script (scripts/veilnetx-anchor-backfill.mjs) is provided but optional — running it costs one signature per historical entry and is only needed if auditors demand uniform proof depth across the whole chain.",
      "Compatibility: the v1 hash chain is preserved unchanged. Reading clients that ignore the new fields continue to work. SDK @aevion/veilnetx-client v0.3 (pending) exposes verifyEntry() that handles both v1 and v2 transparently.",
    ].join("\n\n"),
    category: "protocol",
    voteMode: "yes-no-abstain",
    options: ["yes", "no", "abstain"],
    quorumPercent: 10,
    passThreshold: 60,
    votesOpenAt: isoNow,
    votesCloseAt: isoPlusDays(10),
  },
  {
    label: "module",
    title: "Promote QMaskCard from MVP to Working v1",
    summary: "Allocate engineering bandwidth to harden QMaskCard for production: Stripe issuing integration, KYC gate for high-limit masks, fraud-score ML model.",
    body: [
      "QMaskCard MVP currently issues disposable masked card numbers via the in-memory issuer and serves a working demo at /qmaskcard. Daily limit is fixed at $200 per mask, all masks are software-only (no real card-network rails), and there is no fraud signal beyond rate limiting. This is sufficient for showcase but blocks real merchant adoption — three QPayNet partners have asked specifically for high-limit single-use cards.",
      "Working v1 milestones: (1) Stripe Issuing integration behind feature flag QMASKCARD_ISSUER=stripe so real virtual cards back the masks; (2) KYC gate that requires verified identity (reuse existing QRight verification path) before a wallet can mint masks above the $500 limit; (3) fraud-score model trained on the QPayNet transaction stream that flags suspicious mask usage in real-time and freezes the underlying card via Stripe webhook.",
      "Engineering estimate: ~3 weeks for one engineer including Stripe sandbox provisioning, KYC plumbing, model training on existing logs, and the /qmaskcard/admin surface needed for ops. This vote authorizes the bandwidth allocation; it does not commit treasury funds (Stripe issuing fees are pass-through to mask users).",
    ].join("\n\n"),
    category: "module",
    voteMode: "yes-no-abstain",
    options: ["yes", "no", "abstain"],
    quorumPercent: 10,
    passThreshold: 50,
    votesOpenAt: isoNow,
    votesCloseAt: isoPlusDays(7),
  },
];

async function run() {
  console.log(`\nSeeding QChainGov proposals on ${BASE}\n`);

  // 1. Login
  const login = await post("/api/auth/login", { email: EMAIL, password: PASS });
  if (login.status !== 200 || !login.body?.token) {
    console.error("❌  Login failed:", login.status, JSON.stringify(login.body));
    process.exit(1);
  }
  const token = login.body.token;
  console.log(`  ✓ Logged in as ${EMAIL}\n`);

  let created = 0;
  let opened  = 0;
  let failed  = 0;
  const createdIds = [];

  // 2. Create each proposal in draft
  for (const p of PROPOSALS) {
    const payload = {
      title: p.title,
      summary: p.summary,
      body: p.body,
      category: p.category,
      voteMode: p.voteMode,
      options: p.options,
      quorumPercent: p.quorumPercent,
      passThreshold: p.passThreshold,
      votesOpenAt: p.votesOpenAt,
      votesCloseAt: p.votesCloseAt,
    };
    const r = await post("/api/qchaingov/proposals", payload, token);
    if (r.status === 200 || r.status === 201) {
      const id = r.body?.id || r.body?.proposal?.id;
      if (id) {
        console.log(`  ✓ Created ${p.label} proposal id=${String(id).slice(0, 8)}…`);
        created++;
        createdIds.push({ id, label: p.label });
      } else {
        console.error(`  ✗ Failed ${p.label}: created but no id in response`, JSON.stringify(r.body));
        failed++;
      }
    } else if (r.status === 409) {
      console.log(`  ~ Already exists: ${p.label}  (${r.body?.error || "duplicate"})`);
    } else {
      console.error(`  ✗ Failed ${p.label}: ${r.status}`, JSON.stringify(r.body));
      failed++;
    }
  }

  console.log("");

  // 3. Open each created proposal (admin-only)
  for (const c of createdIds) {
    const r = await post(`/api/qchaingov/proposals/${c.id}/open`, undefined, token);
    if (r.status === 200 && (r.body?.ok || r.body?.proposal)) {
      console.log(`  ✓ Opened ${c.label} id=${String(c.id).slice(0, 8)}…`);
      opened++;
    } else if (r.status === 403) {
      console.error(`  ✗ Open ${c.label}: 403 forbidden — add ${EMAIL} to QCHAINGOV_ADMIN_EMAILS on Railway and re-run open step.`);
      failed++;
    } else {
      console.error(`  ✗ Open ${c.label}: ${r.status}`, JSON.stringify(r.body));
      failed++;
    }
  }

  console.log(`\nCreated ${created} · Opened ${opened} · Failed ${failed}\n`);
}

run().catch(e => { console.error("crash:", e); process.exit(2); });
