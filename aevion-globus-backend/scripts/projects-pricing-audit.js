#!/usr/bin/env node
/**
 * projects ↔ pricing consistency audit.
 *
 * Compares the canonical module list in src/data/projects.ts against the
 * pricing matrix in src/data/pricing.ts. Any module that exists in projects
 * but is missing from MODULES_PRICING gets the planGate.ts fallback policy
 * of ["full", "enterprise"], which is fine for customer modules but wrong
 * for internal/admin modules (they get silently 402'd under PAYWALL_MODULES=*).
 *
 * Replaces the ad-hoc grep audit that initially mis-flagged TIER and BUNDLE
 * ids as "orphans" because they share the same `id:` field.
 *
 * Usage:
 *   node scripts/projects-pricing-audit.js          # summary
 *   node scripts/projects-pricing-audit.js --json   # machine-readable
 *
 * Exit codes: 0 = clean, 1 = at least one module missing.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const PROJECTS_TS = path.join(ROOT, "src", "data", "projects.ts");
const PRICING_TS = path.join(ROOT, "src", "data", "pricing.ts");

const wantJson = process.argv.includes("--json");

function readFile(p) {
  if (!fs.existsSync(p)) {
    console.error(`audit: file not found — ${p}`);
    process.exit(2);
  }
  return fs.readFileSync(p, "utf8");
}

/**
 * Project module ids — extract from `projects: GlobusProject[] = [...]` only.
 * That array is the canonical list; we avoid scanning the whole file so any
 * helper consts that happen to use `id:` don't pollute the list.
 */
function extractProjectIds(src) {
  const start = src.indexOf("export const projects");
  if (start < 0) return [];
  // Skip past `= ` so the next `[` is the array literal, not the type
  // annotation `GlobusProject[]`.
  const eq = src.indexOf("=", start);
  if (eq < 0) return [];
  const arrStart = src.indexOf("[", eq);
  if (arrStart < 0) return [];
  // walk balanced brackets to find the matching ']'
  let depth = 0;
  let i = arrStart;
  for (; i < src.length; i++) {
    if (src[i] === "[") depth++;
    else if (src[i] === "]") { depth--; if (depth === 0) break; }
  }
  const slice = src.slice(arrStart, i + 1);
  const ids = new Set();
  const re = /\bid:\s*"([a-z0-9_-]+)"/gi;
  let m;
  while ((m = re.exec(slice)) !== null) ids.add(m[1]);
  return [...ids].sort();
}

/**
 * MODULES_PRICING ids — extract from the MODULES_PRICING array only, NOT
 * from TIERS or BUNDLES which also contain `id:`. Same balanced-bracket walk
 * starting from `MODULES_PRICING: ModulePrice[] = [...]`.
 */
function extractPricingIds(src) {
  const start = src.indexOf("MODULES_PRICING:");
  if (start < 0) return [];
  // Same fix as extractProjectIds — skip past `=` so we don't catch the
  // `ModulePrice[]` type annotation.
  const eq = src.indexOf("=", start);
  if (eq < 0) return [];
  const arrStart = src.indexOf("[", eq);
  if (arrStart < 0) return [];
  let depth = 0;
  let i = arrStart;
  for (; i < src.length; i++) {
    if (src[i] === "[") depth++;
    else if (src[i] === "]") { depth--; if (depth === 0) break; }
  }
  const slice = src.slice(arrStart, i + 1);
  const ids = new Set();
  const re = /\bid:\s*"([a-z0-9_-]+)"/gi;
  let m;
  while ((m = re.exec(slice)) !== null) ids.add(m[1]);
  return [...ids].sort();
}

const projectsSrc = readFile(PROJECTS_TS);
const pricingSrc = readFile(PRICING_TS);
const projectIds = extractProjectIds(projectsSrc);
const pricingIds = extractPricingIds(pricingSrc);

const projectSet = new Set(projectIds);
const pricingSet = new Set(pricingIds);

const missingInPricing = projectIds.filter((id) => !pricingSet.has(id));
const orphansInPricing = pricingIds.filter((id) => !projectSet.has(id));

if (wantJson) {
  console.log(JSON.stringify({
    projectsCount: projectIds.length,
    pricingCount: pricingIds.length,
    missingInPricing,
    orphansInPricing,
  }, null, 2));
} else {
  console.log(`projects.ts:  ${projectIds.length} modules`);
  console.log(`pricing.ts:   ${pricingIds.length} modules in MODULES_PRICING`);
  console.log("");
  if (missingInPricing.length === 0) {
    console.log("✓ Every projects.ts module has a MODULES_PRICING row.");
  } else {
    console.log(`✗ ${missingInPricing.length} module(s) missing from MODULES_PRICING:`);
    for (const id of missingInPricing) console.log(`    - ${id}`);
    console.log("");
    console.log("  These fall through to planGate's default policy");
    console.log("  ['full','enterprise'] and will return 402 to Free/Lite/Medium");
    console.log("  users under PAYWALL_MODULES=*. Either add a pricing row or");
    console.log("  document them as auth-only (not plan-gated).");
  }
  if (orphansInPricing.length > 0) {
    console.log("");
    console.log(`ℹ ${orphansInPricing.length} module(s) in MODULES_PRICING but NOT in projects.ts:`);
    for (const id of orphansInPricing) console.log(`    - ${id}`);
    console.log("  (Acceptable if they're virtual/derived; otherwise drop them.)");
  }
}

process.exit(missingInPricing.length === 0 ? 0 : 1);
