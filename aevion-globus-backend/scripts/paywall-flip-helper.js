#!/usr/bin/env node
/**
 * Paywall flip helper — single command the operator runs to walk through
 * a Railway PAYWALL_MODULES flip from start to finish.
 *
 * What it does:
 *   1. Runs the pre-flip checks (audit:projects-pricing exit 0, current
 *      paywall state is dormant).
 *   2. Prints the exact env var to add on Railway + the dashboard URL.
 *   3. Waits (polls /api/paywall/policy every 10s) until the expected
 *      enforcement state matches.
 *   4. Re-runs the full smoke for belt-and-braces confirmation.
 *   5. Exits 0 on success, 1 on any failure.
 *
 * Usage:
 *   node scripts/paywall-flip-helper.js qcoreai,qfusionai,multichat-engine,healthai
 *
 *   # against a preview Railway:
 *   BASE=https://<preview>.up.railway.app \
 *     node scripts/paywall-flip-helper.js qcoreai
 *
 * Environment:
 *   BASE              — Railway URL (default https://aevion.app/api-backend)
 *   WAIT_TIMEOUT_MS   — how long to wait for the env to propagate (default 600000 = 10 min)
 *   SKIP_AUDIT        — set to "1" to skip step 1 (when audit isn't installed yet)
 */

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const BASE = (process.env.BASE || "https://aevion.app/api-backend").replace(/\/+$/, "");
const WAIT_TIMEOUT_MS = parseInt(process.env.WAIT_TIMEOUT_MS || "600000", 10);
const SKIP_AUDIT = process.env.SKIP_AUDIT === "1";

const modulesArg = process.argv[2];
if (!modulesArg) {
  console.error("usage: paywall-flip-helper.js <module1,module2,...>");
  console.error("example: paywall-flip-helper.js qcoreai,qfusionai");
  process.exit(2);
}

const modules = modulesArg.split(",").map((s) => s.trim()).filter(Boolean);

function step(n, title) {
  console.log("");
  console.log(`────── ${n}. ${title} ──────`);
}

function runNode(script, env = {}) {
  const res = spawnSync(
    "node",
    [path.join(__dirname, script)],
    { stdio: "inherit", env: { ...process.env, ...env } },
  );
  return res.status === 0;
}

(async () => {
  console.log(`Paywall flip helper`);
  console.log(`  BASE:      ${BASE}`);
  console.log(`  Enforcing: ${modules.join(", ")}`);
  console.log(`  Timeout:   ${Math.round(WAIT_TIMEOUT_MS / 1000)}s`);

  // Step 1 — pre-flip audit
  if (!SKIP_AUDIT) {
    step(1, "projects↔pricing audit");
    if (!runNode("projects-pricing-audit.js")) {
      console.error("✗ audit failed — fix MODULES_PRICING gaps before flipping");
      process.exit(1);
    }
  } else {
    step(1, "projects↔pricing audit (SKIPPED — SKIP_AUDIT=1)");
  }

  // Step 2 — confirm current state is what we think (NOT the target yet)
  step(2, "current policy state");
  if (!runNode("paywall-policy-smoke.js", { BASE })) {
    console.error("✗ baseline smoke failed — the /paywall/policy endpoint isn't healthy. Fix that first.");
    process.exit(1);
  }

  // Step 3 — operator action prompt
  step(3, "Operator action — set the env on Railway");
  console.log("");
  console.log("  Open the Railway dashboard:");
  console.log("    https://railway.app/dashboard");
  console.log("");
  console.log("  Service → Variables → Add (or update):");
  console.log("");
  console.log(`    PAYWALL_MODULES=${modules.join(",")}`);
  console.log("");
  console.log("  Then Redeploy (Railway picks env changes up on next deploy).");
  console.log("");
  console.log("  This helper will now poll the policy endpoint until the flip lands.");
  console.log("  If you change your mind: set PAYWALL_DISABLED=1 instead. Reversible <2 min.");

  // Step 4 — wait for the flip to take effect
  step(4, `wait for enforcement to match [${modules.join(", ")}]`);
  const waitOk = runNode("paywall-policy-smoke.js", {
    BASE,
    EXPECT_ENFORCED: modules.join(","),
    WAIT_TIMEOUT_MS: String(WAIT_TIMEOUT_MS),
  });
  // The wait flag is positional, so re-run via spawnSync with the flag:
  const wait = spawnSync(
    "node",
    [path.join(__dirname, "paywall-policy-smoke.js"), "--wait"],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        BASE,
        EXPECT_ENFORCED: modules.join(","),
        WAIT_TIMEOUT_MS: String(WAIT_TIMEOUT_MS),
      },
    },
  );
  if (wait.status !== 0) {
    console.error("");
    console.error("✗ wait timed out — Railway didn't pick up the env, or the modules are wrong.");
    console.error("  Verify on Railway dashboard that PAYWALL_MODULES is set + service redeployed.");
    process.exit(1);
  }

  // Step 5 — final confirmation
  step(5, "post-flip confirmation");
  if (!runNode("paywall-policy-smoke.js", {
    BASE,
    EXPECT_ENFORCED: modules.join(","),
  })) {
    console.error("✗ post-flip smoke disagreed with --wait. Re-investigate.");
    process.exit(1);
  }

  console.log("");
  console.log(`✓ Flip complete. Enforced modules: ${modules.join(", ")}`);
  console.log("");
  console.log("Next steps (manual):");
  console.log("  - UX check: log in as free-tier on the frontend, visit /<module>");
  console.log("    → expect <PaywallScreen> or <PaywallModal> with chips → CTA → /pricing");
  console.log("  - If anything is wrong: set PAYWALL_DISABLED=1 on Railway. Reversible <2 min.");
  console.log("");
})().catch((e) => {
  console.error("Crash:", e);
  process.exit(2);
});
