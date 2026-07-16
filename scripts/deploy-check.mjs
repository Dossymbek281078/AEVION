#!/usr/bin/env node
// deploy-check — is prod actually running the latest commit?
//
// Compares the `commit` reported by the backend /health endpoint (added so a
// 200 no longer means "guess the version") against a local git ref. Turns the
// manual "curl /health, eyeball the sha" check into one command any session can
// run after a merge to know whether Railway has picked the deploy up yet.
//
// Usage:
//   node scripts/deploy-check.mjs                  # prod vs origin/main
//   node scripts/deploy-check.mjs <ref>            # prod vs <ref> (e.g. HEAD, a sha)
//   HEALTH_URL=https://host/health node scripts/deploy-check.mjs   # override endpoint
//
// Exit: 0 = live (prod == ref), 1 = behind/deploying/unknown, 2 = error.
// Uses process.exitCode + natural drain (not process.exit) to avoid a libuv
// assert on Windows when undici's keep-alive socket is still closing.

import { execSync } from "node:child_process";

const HEALTH_URL =
  process.env.HEALTH_URL || "https://aevion.vercel.app/api-backend/health";
const ref = process.argv[2] || "origin/main";

function sh(cmd) {
  return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

async function main() {
  // Expected commit from git.
  try { sh("git fetch origin main --quiet"); } catch { /* offline — use local */ }
  let expected;
  try {
    expected = sh(`git rev-parse ${ref}`);
  } catch (e) {
    console.error(`Cannot resolve git ref "${ref}": ${e.message}`);
    return 2;
  }

  // Live commit from prod /health (cleared AbortController timer, no dangling handle).
  let health;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(HEALTH_URL, { signal: ctrl.signal });
    health = await res.json();
  } catch (e) {
    console.error(`Cannot reach ${HEALTH_URL}: ${e.message}`);
    return 2;
  } finally {
    clearTimeout(to);
  }

  const live = String(health.commit || "unknown");
  console.log(`prod      : ${live}  (booted ${health.bootedAt || "?"}, up ${health.uptimeSec ?? "?"}s)`);
  console.log(`${ref} : ${expected.slice(0, 12)}`);

  if (live === "unknown") {
    console.log("⚠️  prod /health has no commit — old build, or RAILWAY_GIT_COMMIT_SHA/GIT_SHA unset. Redeploy to populate.");
    return 1;
  }
  // `live` is the first 12 chars of the deployed sha; `expected` is the full sha.
  if (expected.startsWith(live)) {
    console.log(`✅ LIVE — prod is running ${ref}.`);
    return 0;
  }
  console.log(`⏳ BEHIND — prod commit differs from ${ref}. Wait for Railway auto-deploy or trigger a redeploy.`);
  return 1;
}

main().then((code) => { process.exitCode = code; });
