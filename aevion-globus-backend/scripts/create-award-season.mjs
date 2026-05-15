#!/usr/bin/env node
/**
 * One-shot script: create an AwardSeason via the live API.
 *
 * Requires:
 *   BASE           backend URL (default https://aevion-production-a70c.up.railway.app)
 *   ADMIN_EMAIL    yahiin1978@gmail.com (must match AWARDS_ADMIN_EMAILS on Railway)
 *   ADMIN_PASS     your account password
 *
 * Usage (PowerShell):
 *   $env:ADMIN_EMAIL="yahiin1978@gmail.com"; $env:ADMIN_PASS="<pass>"; node scripts/create-award-season.mjs
 *
 * Usage (bash):
 *   ADMIN_EMAIL=yahiin1978@gmail.com ADMIN_PASS=<pass> node scripts/create-award-season.mjs
 *
 * Seasons to create (Q2 2026):
 *   aevion-music-2026-q2  — music
 *   aevion-film-2026-q2   — film
 *   aevion-code-2026-q2   — code
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
  const r = await fetch(`${BASE}${path}`, { method: "POST", headers: h, body: JSON.stringify(body) });
  const json = await r.json().catch(() => ({}));
  return { status: r.status, body: json };
}

const SEASONS = [
  {
    code: "aevion-music-2026-q2",
    type: "music",
    title: "AEVION Music Awards — Q2 2026",
    status: "open",
    startsAt: "2026-05-01T00:00:00Z",
    endsAt:   "2026-07-31T23:59:59Z",
  },
  {
    code: "aevion-film-2026-q2",
    type: "film",
    title: "AEVION Film Awards — Q2 2026",
    status: "open",
    startsAt: "2026-05-01T00:00:00Z",
    endsAt:   "2026-07-31T23:59:59Z",
  },
  {
    code: "aevion-code-2026-q2",
    type: "code",
    title: "AEVION Code Awards — Q2 2026",
    status: "open",
    startsAt: "2026-05-01T00:00:00Z",
    endsAt:   "2026-07-31T23:59:59Z",
  },
];

async function run() {
  console.log(`\nCreating award seasons on ${BASE}\n`);

  // 1. Login
  const login = await post("/api/auth/login", { email: EMAIL, password: PASS });
  if (login.status !== 200 || !login.body?.token) {
    console.error("❌  Login failed:", login.status, JSON.stringify(login.body));
    process.exit(1);
  }
  const token = login.body.token;
  console.log(`  ✓ Logged in as ${EMAIL}`);

  // 2. Create each season
  for (const s of SEASONS) {
    const r = await post("/api/awards/admin/seasons", s, token);
    if (r.status === 201) {
      console.log(`  ✓ Created ${s.code}  id=${r.body.id}`);
    } else if (r.status === 409) {
      console.log(`  ~ Already exists: ${s.code}  (${r.body.error})`);
    } else {
      console.error(`  ✗ Failed ${s.code}: ${r.status}`, JSON.stringify(r.body));
    }
  }

  console.log("\nDone.\n");
}

run().catch(e => { console.error("crash:", e); process.exit(2); });
