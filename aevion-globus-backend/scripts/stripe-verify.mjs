#!/usr/bin/env node
/**
 * Stripe verification — checks that Stripe live-mode is fully configured.
 *
 * Run BEFORE flipping BUREAU_PAYMENT_PROVIDER=stripe on Railway. Verifies:
 *  1. Required env vars present and well-formed.
 *  2. Stripe API reachable with the configured secret key.
 *  3. Webhook endpoint signing secret is set.
 *  4. Account is in expected mode (live vs test) matching the key prefix.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_live_... STRIPE_WEBHOOK_SECRET=whsec_... \
 *     node scripts/stripe-verify.mjs
 *
 * Exit codes:
 *   0 — all checks pass, safe to enable live mode
 *   1 — one or more checks failed
 *   2 — script crashed
 */

let passed = 0;
let failed = 0;
function pass(label, extra) { passed++; console.log(`  ✓ ${label}${extra ? "  " + extra : ""}`); }
function fail(label, reason) { failed++; console.error(`  ✗ ${label}${reason ? "  ↳ " + reason : ""}`); }

async function run() {
  console.log("\nStripe go-live verification\n");

  // ── 1. Env vars
  const SECRET = (process.env.STRIPE_SECRET_KEY || "").trim();
  const WEBHOOK = (process.env.STRIPE_WEBHOOK_SECRET || "").trim();
  const PUBLISHABLE = (process.env.STRIPE_PUBLISHABLE_KEY || "").trim();
  const PROVIDER = (process.env.BUREAU_PAYMENT_PROVIDER || "").trim();
  const BASE = (process.env.AEVION_PUBLIC_BASE_URL || "").trim();

  if (!SECRET) { fail("STRIPE_SECRET_KEY env", "not set"); }
  else if (!/^sk_(test|live)_/.test(SECRET)) {
    fail("STRIPE_SECRET_KEY format", "must start with sk_test_ or sk_live_");
  } else {
    pass("STRIPE_SECRET_KEY env", `${SECRET.slice(0, 12)}…`);
  }

  if (!WEBHOOK) { fail("STRIPE_WEBHOOK_SECRET env", "not set — webhook signature verification will fail"); }
  else if (!/^whsec_/.test(WEBHOOK)) {
    fail("STRIPE_WEBHOOK_SECRET format", "must start with whsec_");
  } else {
    pass("STRIPE_WEBHOOK_SECRET env", `${WEBHOOK.slice(0, 10)}…`);
  }

  if (PUBLISHABLE) {
    if (!/^pk_(test|live)_/.test(PUBLISHABLE)) {
      fail("STRIPE_PUBLISHABLE_KEY format", "must start with pk_test_ or pk_live_");
    } else {
      pass("STRIPE_PUBLISHABLE_KEY env", `${PUBLISHABLE.slice(0, 12)}…`);
    }
  } else {
    fail("STRIPE_PUBLISHABLE_KEY env", "missing — frontend cannot mount Stripe Elements without it");
  }

  if (!BASE) {
    fail("AEVION_PUBLIC_BASE_URL env", "not set — Stripe success/cancel URLs will be wrong");
  } else if (!/^https:\/\//.test(BASE)) {
    fail("AEVION_PUBLIC_BASE_URL", "must use https://");
  } else {
    pass("AEVION_PUBLIC_BASE_URL env", BASE);
  }

  // Provider toggle warning (informational — not failure)
  if (PROVIDER === "stripe") {
    pass("BUREAU_PAYMENT_PROVIDER", "stripe (live)");
  } else if (PROVIDER === "stub" || !PROVIDER) {
    console.log(`  ! BUREAU_PAYMENT_PROVIDER  ↳ currently "${PROVIDER || "stub"}" — flip to "stripe" once these checks pass`);
  } else {
    fail("BUREAU_PAYMENT_PROVIDER", `unknown value "${PROVIDER}" — expected "stub" or "stripe"`);
  }

  // Mode consistency
  if (SECRET && PUBLISHABLE) {
    const secretLive = SECRET.startsWith("sk_live_");
    const pubLive = PUBLISHABLE.startsWith("pk_live_");
    if (secretLive !== pubLive) {
      fail("Key mode consistency", `secret ${secretLive ? "live" : "test"} ≠ publishable ${pubLive ? "live" : "test"}`);
    } else {
      pass("Key mode consistency", secretLive ? "both live" : "both test");
    }
  }

  // ── 2. Stripe API reachability
  if (SECRET) {
    try {
      const r = await fetch("https://api.stripe.com/v1/account", {
        headers: { Authorization: `Bearer ${SECRET}` },
        signal: AbortSignal.timeout(8000),
      });
      if (r.ok) {
        const acct = await r.json();
        pass("Stripe API reachable", `account=${acct.id} country=${acct.country} email=${acct.email || "—"}`);
        if (acct.charges_enabled === false) {
          fail("Stripe charges enabled", "account.charges_enabled = false — finish onboarding in Dashboard");
        } else {
          pass("Stripe charges enabled", "true");
        }
        if (acct.payouts_enabled === false) {
          fail("Stripe payouts enabled", "account.payouts_enabled = false");
        } else {
          pass("Stripe payouts enabled", "true");
        }
      } else if (r.status === 401) {
        fail("Stripe API reachable", "401 — invalid secret key");
      } else {
        fail("Stripe API reachable", `${r.status}`);
      }
    } catch (e) {
      fail("Stripe API reachable", e.message || String(e));
    }
  }

  // ── 3. Webhook endpoint discoverability
  if (SECRET) {
    try {
      const r = await fetch("https://api.stripe.com/v1/webhook_endpoints", {
        headers: { Authorization: `Bearer ${SECRET}` },
        signal: AbortSignal.timeout(8000),
      });
      if (r.ok) {
        const list = await r.json();
        const hooks = list?.data || [];
        const aevion = hooks.filter((h) => /aevion\.app|aevion-production-a70c\.up\.railway\.app/.test(h.url || ""));
        if (aevion.length > 0) {
          pass("Webhook endpoint configured", `${aevion.length} AEVION endpoint(s) found`);
          for (const h of aevion) {
            console.log(`     · ${h.url}  events=${(h.enabled_events || []).slice(0, 4).join(",")}${(h.enabled_events || []).length > 4 ? "…" : ""}`);
          }
        } else if (hooks.length > 0) {
          fail("Webhook endpoint configured", `${hooks.length} total endpoints, none point at AEVION`);
        } else {
          fail("Webhook endpoint configured", "no webhook endpoints in Stripe — add via Dashboard");
        }
      }
    } catch (e) {
      fail("Webhook discovery", e.message || String(e));
    }
  }

  console.log(`\n${passed + failed} checks — ${passed} PASS  ${failed} FAIL\n`);
  if (failed === 0) {
    console.log("✓ Stripe is ready. Set BUREAU_PAYMENT_PROVIDER=stripe on Railway to go live.\n");
    process.exit(0);
  } else {
    console.log("✗ Resolve the failures above before flipping to live mode.\n");
    process.exit(1);
  }
}

run().catch((e) => { console.error("crash:", e); process.exit(2); });
