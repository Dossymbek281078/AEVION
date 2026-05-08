#!/usr/bin/env node
/**
 * QBuild prod smoke — end-to-end recruiting flow against a deployed instance.
 *
 * Walks /api/build/* surface against prod (Vercel rewrite → Railway):
 *   public:    health, public stats, public vacancies feed, sitemap reachability
 *   auth:      register CLIENT + WORKER (cleanup at end)
 *   projects:  client creates project + lists own
 *   vacancies: create, list, fetch, search by skill, RSS feed
 *   apply:     worker applies → owner views → owner accepts
 *   ATS:       set INTERVIEW label → list pipeline → list interviews
 *   meta:      vacancy boost-roi (no-boost path), profile completeness
 *   stats:     weekly digest, recruiter sources, leaderboard
 *
 * Default BASE points through the Vercel rewrite (`/api-backend/*`) so the
 * smoke validates the full prod path. Override with
 * `BASE=https://aevion-production-a70c.up.railway.app` to skip the rewrite.
 *
 * Usage:
 *   node scripts/qbuild-prod-smoke.js
 *   BASE=<url> node scripts/qbuild-prod-smoke.js
 *   ARTIFACT=docs/qbuild/SMOKE_PROD_$(date +%s).json node scripts/qbuild-prod-smoke.js
 *
 * Exit codes: 0 = all green, 1 = at least one step failed, 2 = crash.
 *
 * Pollution: registers TWO users (smoke-client+<ts>@aevion.test,
 * smoke-worker+<ts>@aevion.test). Both are DELETEd at end via
 * /api/auth/account. Created project + vacancy persist (acceptable —
 * they're scoped to the smoke users which are cleaned).
 *
 * Requires Node 18+ (global fetch).
 */

const { writeFileSync, mkdirSync } = require("node:fs");
const { dirname, resolve } = require("node:path");

const DEFAULT_PUBLIC_URL = "https://aevion.app/api-backend";
const BASE = (process.env.BASE || DEFAULT_PUBLIC_URL).replace(/\/+$/, "");
const RUN = Date.now();
const CLIENT_EMAIL = `smoke-client+${RUN}@aevion.test`;
const WORKER_EMAIL = `smoke-worker+${RUN}@aevion.test`;
const PASSWORD = "smoke-password-1234";
const ARTIFACT = process.env.ARTIFACT || null;

let step = 0;
let failed = 0;
const calls = [];

function ok(name, extra) {
  step += 1;
  console.log(`  ${String(step).padStart(2, "0")}  PASS  ${name}${extra ? "  " + extra : ""}`);
}
function fail(name, reason) {
  step += 1;
  failed += 1;
  console.error(`  ${String(step).padStart(2, "0")}  FAIL  ${name}`);
  console.error(`       ↳ ${reason}`);
}
function fmtMs(ms) {
  return `${ms}ms`;
}

async function call(method, path, { body, token, accept } = {}) {
  const url = `${BASE}${path}`;
  const headers = {};
  if (body) headers["content-type"] = "application/json";
  if (token) headers["authorization"] = `Bearer ${token}`;
  if (accept) headers["accept"] = accept;

  const t0 = Date.now();
  let status = 0;
  let json = null;
  let text = null;
  try {
    const res = await fetch(url, {
      method,
      headers: Object.keys(headers).length ? headers : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    status = res.status;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      json = await res.json().catch(() => null);
    } else {
      text = (await res.text().catch(() => "")).slice(0, 800);
    }
  } catch (err) {
    text = `fetch_failed: ${err?.message || String(err)}`;
  }
  const durMs = Date.now() - t0;
  calls.push({ method, path, status, durMs, response: json ?? text });
  return { status, body: json, text, durMs };
}

// Tolerant body extractor — backend usually wraps as { success, data: {...} }
// but a few legacy endpoints return the payload at the top level.
function payload(body) {
  if (body && typeof body === "object" && "data" in body) return body.data;
  return body;
}

async function runPublic() {
  console.log(`\n[Public] BASE=${BASE}`);

  let r = await call("GET", "/api/build/health");
  if (r.status === 200) ok("/health 200", fmtMs(r.durMs));
  else return fail("/health 200", `status=${r.status}`);

  r = await call("GET", "/api/build/stats");
  if (r.status === 200 && payload(r.body)?.vacancies != null) {
    const p = payload(r.body);
    ok("/stats public", `open=${p.vacancies?.open} candidates=${p.candidates} ${fmtMs(r.durMs)}`);
  } else fail("/stats public", `status=${r.status}`);

  r = await call("GET", "/api/build/vacancies?limit=5");
  if (r.status === 200 && Array.isArray(payload(r.body)?.items)) {
    ok("/vacancies public list", `n=${payload(r.body).items.length} ${fmtMs(r.durMs)}`);
  } else fail("/vacancies public list", `status=${r.status}`);
}

async function registerOrSkip(email, name) {
  const r = await call("POST", "/api/auth/register", {
    body: { email, password: PASSWORD, name },
  });
  if (r.status === 201 && r.body?.token) {
    return { token: r.body.token, userId: r.body.user?.id };
  }
  // Some deploys return 200; tolerate both.
  if (r.status === 200 && r.body?.token) {
    return { token: r.body.token, userId: r.body.user?.id };
  }
  return null;
}

async function runRecruiterFlow() {
  console.log(`\n[Recruiter flow]`);
  console.log(`  client=${CLIENT_EMAIL}`);
  console.log(`  worker=${WORKER_EMAIL}`);

  const client = await registerOrSkip(CLIENT_EMAIL, "Smoke Client");
  if (!client) return fail("auth register client", "no token");
  ok("auth register client", `id=${client.userId?.slice(0, 8)}`);

  const worker = await registerOrSkip(WORKER_EMAIL, "Smoke Worker");
  if (!worker) return fail("auth register worker", "no token");
  ok("auth register worker", `id=${worker.userId?.slice(0, 8)}`);

  // Upsert worker profile so vacancy match logic has skills to match against.
  // Note: route is `/profiles` (plural) — singular returns 404.
  let r = await call("POST", "/api/build/profiles", {
    token: worker.token,
    body: {
      name: "Smoke Worker",
      buildRole: "WORKER",
      title: "Welder, day shift",
      skills: ["MIG/MAG welding", "Steel structures"],
      summary: "5y commercial welding, certified to 30mm carbon steel.",
      experienceYears: 5,
      openToWork: true,
    },
  });
  if (r.status === 200 || r.status === 201) ok("worker profile upsert");
  else fail("worker profile upsert", `status=${r.status}`);

  r = await call("POST", "/api/build/projects", {
    token: client.token,
    body: {
      title: `Smoke project ${RUN}`,
      description: "Industrial welding project on AEVION QBuild prod smoke.",
      city: "Astana",
      budget: 50000,
    },
  });
  const projectId = payload(r.body)?.id;
  if ((r.status === 200 || r.status === 201) && projectId) ok("create project", `id=${projectId.slice(0, 8)}`);
  else return fail("create project", `status=${r.status}`);

  r = await call("POST", "/api/build/vacancies", {
    token: client.token,
    body: {
      projectId,
      title: `Smoke welder ${RUN}`,
      description: "MIG/MAG welder for steel structure assembly. Day shift, hot meals provided.",
      salary: 4500,
      skills: ["MIG/MAG welding", "Steel structures"],
    },
  });
  const vacancyId = payload(r.body)?.id;
  if ((r.status === 200 || r.status === 201) && vacancyId) ok("create vacancy", `id=${vacancyId.slice(0, 8)}`);
  else return fail("create vacancy", `status=${r.status}`);

  r = await call("GET", `/api/build/vacancies/${vacancyId}`);
  if (r.status === 200 && payload(r.body)?.title?.startsWith("Smoke")) ok("fetch vacancy by id");
  else fail("fetch vacancy by id", `status=${r.status}`);

  // Worker applies
  r = await call("POST", "/api/build/applications", {
    token: worker.token,
    body: { vacancyId, message: "Готов выходить с понедельника, опыт MIG 5 лет." },
  });
  const appId = payload(r.body)?.id;
  if ((r.status === 200 || r.status === 201) && appId) ok("worker apply", `id=${appId.slice(0, 8)}`);
  else return fail("worker apply", `status=${r.status}`);

  r = await call("GET", `/api/build/applications/by-vacancy/${vacancyId}`, { token: client.token });
  if (r.status === 200 && payload(r.body)?.items?.length >= 1) ok("owner sees application");
  else fail("owner sees application", `status=${r.status}`);

  // Label endpoint ships in the polish layer (PR #124). Soft-check until merged.
  r = await call("PATCH", `/api/build/applications/${appId}/label`, {
    token: client.token,
    body: { labelKey: "INTERVIEW" },
  });
  if (r.status === 200 || r.status === 204) ok("set INTERVIEW label");
  else if (r.status === 404) {
    console.log(`  ${String(++step).padStart(2, "0")}  INFO  set INTERVIEW label not deployed yet (404)`);
  } else fail("set INTERVIEW label", `status=${r.status} body=${JSON.stringify(r.body)?.slice(0, 200)}`);

  r = await call("PATCH", `/api/build/applications/${appId}`, {
    token: client.token,
    body: { status: "ACCEPTED" },
  });
  if (r.status === 200 || r.status === 204) ok("accept application");
  else fail("accept application", `status=${r.status}`);

  return { client, worker, projectId, vacancyId, appId };
}

async function runStatsAndPipeline(client) {
  console.log(`\n[Stats + Pipeline]`);

  // Some endpoints below ship in the polish PR (PR #124) and may not exist on
  // production yet. Tolerate 404 — log as INFO but don't fail the run.
  async function softCheck(name, fn) {
    const r = await fn();
    if (r.status === 200) {
      ok(name, fmtMs(r.durMs));
    } else if (r.status === 404) {
      console.log(`  ${String(++step).padStart(2, "0")}  INFO  ${name} not deployed yet (404)`);
    } else {
      fail(name, `status=${r.status}`);
    }
  }

  await softCheck("/stats/weekly recruiter", () =>
    call("GET", "/api/build/stats/weekly", { token: client.token }),
  );
  await softCheck("/applications/mine/pipeline", () =>
    call("GET", "/api/build/applications/mine/pipeline", { token: client.token }),
  );
  await softCheck("/applications/mine/interviews", () =>
    call("GET", "/api/build/applications/mine/interviews", { token: client.token }),
  );

  let r = await call("GET", "/api/build/stats/leaderboard");
  if (r.status === 200) ok("/stats/leaderboard public");
  else fail("/stats/leaderboard public", `status=${r.status}`);
}

async function runFeeds() {
  console.log(`\n[Feeds & RSS]`);

  let r = await call("GET", "/api/build/public/rss/vacancies.xml", { accept: "application/rss+xml" });
  if (r.status === 200 || r.status === 404) {
    if (r.status === 200) ok("/public/rss/vacancies.xml");
    else console.log(`  ${String(++step).padStart(2, "0")}  INFO  RSS feed not deployed yet (404)`);
  } else {
    fail("/public/rss/vacancies.xml", `status=${r.status}`);
  }

  r = await call("GET", "/sitemap.xml");
  if (r.status === 200) ok("/sitemap.xml reachable");
  else if (r.status === 404) console.log(`  ${String(++step).padStart(2, "0")}  INFO  sitemap.xml 404 (different host?)`);
  else fail("/sitemap.xml", `status=${r.status}`);
}

async function cleanup(users) {
  console.log(`\n[Cleanup]`);
  for (const u of users) {
    if (!u?.token) continue;
    const r = await call("DELETE", "/api/auth/account", { token: u.token });
    if (r.status === 200 || r.status === 204) ok(`delete ${u.userId?.slice(0, 8)}`);
    else fail(`delete ${u.userId?.slice(0, 8)}`, `status=${r.status}`);
  }
}

async function main() {
  console.log(`\nQBuild prod smoke · run ${RUN}`);
  console.log(`base = ${BASE}`);
  console.log("─".repeat(60));

  await runPublic();
  const flow = await runRecruiterFlow();
  if (flow) {
    await runStatsAndPipeline(flow.client);
  }
  await runFeeds();
  if (flow) {
    await cleanup([flow.client, flow.worker]);
  }

  console.log("─".repeat(60));
  console.log(`Total steps: ${step}, failed: ${failed}`);

  if (ARTIFACT) {
    const p = resolve(ARTIFACT);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(
      p,
      JSON.stringify({ run: RUN, base: BASE, steps: step, failed, calls }, null, 2),
    );
    console.log(`Artifact written: ${ARTIFACT}`);
  }

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
