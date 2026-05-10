#!/usr/bin/env node
/**
 * Pre-deploy environment validator. Reads NODE_ENV; when production,
 * enforces every "REQUIRED to boot" variable from docs/PROD_ENV_CHECKLIST.md
 * § 1 plus shape constraints (length / format).
 *
 * Exit 0 — safe to deploy.
 * Exit 1 — one or more vars missing/malformed; list printed.
 *
 * Usage:
 *   NODE_ENV=production node scripts/check-prod-env.js
 *   npm run check:prod-env
 *
 * Conditional vars (🟡) are not enforced here — they gate features, not
 * boot. Add them as your deploy enables those features.
 */

const NODE_ENV = process.env.NODE_ENV || "development";

/** @type {Array<{ name: string, validate: (v: string | undefined) => string | null }>} */
const REQUIRED = [
  {
    name: "DATABASE_URL",
    validate: (v) => {
      if (!v) return "missing";
      if (!/^postgres(ql)?:\/\//.test(v)) return "must start with postgres:// or postgresql://";
      return null;
    },
  },
  {
    name: "AUTH_JWT_SECRET",
    validate: (v) => {
      if (!v) return "missing";
      if (v.length < 32) return `too short (${v.length} chars, need >=32)`;
      if (v.startsWith("dev-")) return "starts with 'dev-' — refusing in prod";
      return null;
    },
  },
  {
    name: "JWT_SECRET",
    validate: (v) => {
      if (!v) return "missing — falls back to 'dev-secret-change-me' in code, forge-anyone vector";
      if (v.length < 16) return `too short (${v.length} chars, need >=16)`;
      if (v === "dev-secret-change-me") return "literal dev fallback string — must be replaced";
      return null;
    },
  },
  {
    name: "QSIGN_HMAC_V1_SECRET",
    validate: (v) => {
      if (!v) return "missing — backend uses ephemeral key, signatures unverifiable across restarts";
      if (v.length < 16) return `too short (${v.length} chars, need >=16)`;
      return null;
    },
  },
  {
    name: "QSIGN_ED25519_V1_PRIVATE",
    validate: (v) => {
      if (!v) return "missing — backend uses ephemeral key, signatures unverifiable across restarts";
      if (!/^[0-9a-f]{64}$/i.test(v)) return "must be 64-char hex (32-byte seed)";
      return null;
    },
  },
  {
    name: "QSIGN_SECRET",
    validate: (v) => {
      if (!v) return "missing — pipeline + planet HMAC verification will fail";
      if (v.length < 16) return `too short (${v.length} chars, need >=16)`;
      return null;
    },
  },
  {
    name: "SHARD_HMAC_SECRET",
    validate: (v) => {
      if (!v) return "missing — Shamir shard authentication off, forging possible";
      if (v.length < 16) return `too short (${v.length} chars, need >=16)`;
      return null;
    },
  },
];

/** Conditional vars — only checked when their gate is on. */
const CONDITIONAL = [
  {
    name: "CORS_ALLOWED_ORIGINS",
    when: () => Boolean(process.env.PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL),
    validate: (v) => (v ? null : "missing — public origin set but no CORS allow-list"),
  },
];

if (NODE_ENV !== "production") {
  console.log(`[check-prod-env] NODE_ENV=${NODE_ENV} — running in advisory mode (no exit code).`);
}

const failures = [];

for (const row of REQUIRED) {
  const err = row.validate(process.env[row.name]);
  if (err) failures.push({ name: row.name, err, severity: "REQUIRED" });
}

for (const row of CONDITIONAL) {
  if (!row.when()) continue;
  const err = row.validate(process.env[row.name]);
  if (err) failures.push({ name: row.name, err, severity: "CONDITIONAL" });
}

if (failures.length === 0) {
  console.log("[check-prod-env] ✅ all required env vars set and well-formed.");
  process.exit(0);
}

console.error(`[check-prod-env] ❌ ${failures.length} env issue(s):\n`);
for (const f of failures) {
  console.error(`  ${f.severity.padEnd(11)}  ${f.name.padEnd(28)}  ${f.err}`);
}
console.error("\nSee docs/PROD_ENV_CHECKLIST.md for the full list and generator commands.");

if (NODE_ENV === "production") {
  process.exit(1);
}
console.error("\n[check-prod-env] NODE_ENV != production — not failing the run.");
process.exit(0);
