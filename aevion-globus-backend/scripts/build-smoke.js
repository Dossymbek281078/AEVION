#!/usr/bin/env node
/**
 * QBuild — end-to-end smoke test.
 *
 * Walks /api/build/* surface against a running backend:
 *   register two users (client + worker) → upsert profile →
 *   create project → create vacancy → list vacancies feed →
 *   load public project view → worker applies → owner accepts →
 *   DM thread → notifications summary → health.
 *
 * Pass/fail per step; exits 1 on first failure.
 *
 * Usage (from aevion-globus-backend/, with `npm run dev` running):
 *   node scripts/build-smoke.js
 *
 * Env overrides:
 *   BASE  default http://127.0.0.1:4001
 *
 * Requires Node 18+ (global fetch).
 */

const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/+$/, "");
const RUN = Date.now();

let step = 0;
let failed = 0;

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

async function call(method, path, body, token) {
  const headers = {};
  if (body) headers["content-type"] = "application/json";
  if (token) headers["authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {/**/}
  return { status: res.status, body: json };
}

function unwrap(r) {
  if (r.body && r.body.success === true) return r.body.data;
  return null;
}

async function main() {
  console.log(`QBuild smoke against ${BASE}\n`);

  // 1. health
  let r = await call("GET", "/api/build/health");
  if (r.status === 200 && unwrap(r)?.service === "qbuild") ok("GET /api/build/health");
  else return fail("health", `status=${r.status}`);

  // 2. register client
  r = await call("POST", "/api/auth/register", {
    email: `client-${RUN}@aevion.test`,
    password: "secret123",
    name: "Smoke Client",
  });
  if (r.status >= 200 && r.status < 300 && r.body?.token) ok("register client", `id=${r.body.user?.id}`);
  else return fail("register client", `status=${r.status} body=${JSON.stringify(r.body)}`);
  const clientToken = r.body.token;
  const clientId = r.body.user.id;

  // 3. register worker
  r = await call("POST", "/api/auth/register", {
    email: `worker-${RUN}@aevion.test`,
    password: "secret123",
    name: "Smoke Worker",
  });
  if (r.status >= 200 && r.status < 300 && r.body?.token) ok("register worker", `id=${r.body.user?.id}`);
  else return fail("register worker", `status=${r.status}`);
  const workerToken = r.body.token;
  const workerId = r.body.user.id;

  // 4. client upserts build profile
  r = await call("POST", "/api/build/profiles", {
    name: "Smoke Client",
    city: "Almaty",
    buildRole: "CLIENT",
  }, clientToken);
  if (r.status === 200 && unwrap(r)?.buildRole === "CLIENT") ok("upsert client profile");
  else return fail("upsert client profile", `status=${r.status}`);

  // 5. worker upserts build profile
  r = await call("POST", "/api/build/profiles", {
    name: "Smoke Worker",
    city: "Almaty",
    buildRole: "WORKER",
  }, workerToken);
  if (r.status === 200 && unwrap(r)?.buildRole === "WORKER") ok("upsert worker profile");
  else return fail("upsert worker profile", `status=${r.status}`);

  // 6. create project
  r = await call("POST", "/api/build/projects", {
    title: `Smoke Project ${RUN}`,
    description: "End-to-end smoke project. Will be re-used between tests.",
    budget: 12000,
    city: "Almaty",
  }, clientToken);
  const project = unwrap(r);
  if (r.status === 201 && project?.id) ok("create project", `id=${project.id}`);
  else return fail("create project", `status=${r.status}`);
  const projectId = project.id;

  // 7. public view (no auth)
  r = await call("GET", `/api/build/projects/${projectId}/public`);
  const pub = unwrap(r);
  if (r.status === 200 && pub?.project?.id === projectId && pub?.client?.name === "Smoke Client") ok("public project view");
  else return fail("public view", `status=${r.status}`);

  // 8. create vacancy
  r = await call("POST", "/api/build/vacancies", {
    projectId,
    title: "Brick layer",
    description: "Need a brick layer for 2 weeks. On-site Almaty.",
    salary: 1500,
  }, clientToken);
  const vacancy = unwrap(r);
  if (r.status === 201 && vacancy?.id) ok("create vacancy", `id=${vacancy.id}`);
  else return fail("create vacancy", `status=${r.status}`);
  const vacancyId = vacancy.id;

  // 9. cross-project vacancies feed picks it up
  r = await call("GET", "/api/build/vacancies?status=OPEN&limit=100");
  const feed = unwrap(r);
  if (r.status === 200 && feed?.items?.some((v) => v.id === vacancyId)) ok("vacancies feed contains new row");
  else return fail("vacancies feed", `status=${r.status}`);

  // 10. worker applies
  r = await call("POST", "/api/build/applications", {
    vacancyId,
    message: "I have 5 years of experience. Available immediately.",
  }, workerToken);
  const app = unwrap(r);
  if (r.status === 201 && app?.id && app?.status === "PENDING") ok("worker applies", `id=${app.id}`);
  else return fail("apply", `status=${r.status}`);
  const applicationId = app.id;

  // 11. owner sees the pending application via notifications
  r = await call("GET", "/api/build/notifications/summary", null, clientToken);
  const notif = unwrap(r);
  if (r.status === 200 && notif?.pendingApplications >= 1) ok("client notifications", `pending=${notif.pendingApplications}`);
  else return fail("client notifications", `status=${r.status} body=${JSON.stringify(r.body)}`);

  // 12. owner accepts the application
  r = await call("PATCH", `/api/build/applications/${applicationId}`, { status: "ACCEPTED" }, clientToken);
  if (r.status === 200 && unwrap(r)?.status === "ACCEPTED") ok("owner accepts application");
  else return fail("accept", `status=${r.status}`);

  // 13. worker sees applicationUpdates
  r = await call("GET", "/api/build/notifications/summary", null, workerToken);
  const wnotif = unwrap(r);
  if (r.status === 200 && wnotif?.applicationUpdates >= 1) ok("worker notifications", `updates=${wnotif.applicationUpdates}`);
  else return fail("worker notifications", `status=${r.status}`);

  // 14. client DMs worker
  r = await call("POST", "/api/build/messages", {
    receiverId: workerId,
    content: "Welcome! Please confirm start date.",
  }, clientToken);
  if (r.status === 201 && unwrap(r)?.id) ok("client → worker DM");
  else return fail("DM send", `status=${r.status}`);

  // 15. worker has unread message
  r = await call("GET", "/api/build/notifications/summary", null, workerToken);
  if (r.status === 200 && unwrap(r)?.unreadMessages >= 1) ok("worker unread message visible");
  else return fail("worker unread", `status=${r.status}`);

  // 16. worker reads thread (marks as read)
  r = await call("GET", `/api/build/messages/${clientId}`, null, workerToken);
  if (r.status === 200 && unwrap(r)?.items?.length >= 1) ok("worker reads thread");
  else return fail("worker reads", `status=${r.status}`);

  // 17. unauth call to /notifications/summary → 401
  r = await call("GET", "/api/build/notifications/summary");
  if (r.status === 401) ok("/notifications/summary requires auth");
  else return fail("notifications auth gate", `expected 401 got ${r.status}`);

  // 18. plans catalog
  r = await call("GET", "/api/build/plans");
  if (r.status === 200 && unwrap(r)?.items?.length >= 4) ok("plans catalog (4 tiers)");
  else return fail("plans catalog", `status=${r.status}`);

  // 19. usage/me on FREE plan baseline
  r = await call("GET", "/api/build/usage/me", null, clientToken);
  if (r.status === 200 && unwrap(r)?.plan?.key === "FREE") ok("usage/me FREE baseline");
  else return fail("usage/me FREE", `plan=${unwrap(r)?.plan?.key}`);

  // 20. bookmark VACANCY toggle on
  r = await call("POST", "/api/build/bookmarks", { kind: "VACANCY", targetId: vacancyId }, workerToken);
  if (r.status === 201 && unwrap(r)?.saved === true) ok("bookmark vacancy added");
  else return fail("bookmark add", `status=${r.status}`);

  // 21. bookmark VACANCY toggle off (idempotent removal)
  r = await call("POST", "/api/build/bookmarks", { kind: "VACANCY", targetId: vacancyId }, workerToken);
  if (r.status === 200 && unwrap(r)?.saved === false) ok("bookmark toggle off (idempotent)");
  else return fail("bookmark toggle off", `status=${r.status}`);

  // 22. bookmarks list (re-add then list)
  await call("POST", "/api/build/bookmarks", { kind: "VACANCY", targetId: vacancyId }, workerToken);
  r = await call("GET", "/api/build/bookmarks?kind=VACANCY", null, workerToken);
  if (r.status === 200 && unwrap(r)?.items?.length >= 1 && unwrap(r).items[0]?.target?.id === vacancyId) ok("bookmarks list hydrated");
  else return fail("bookmarks list", `status=${r.status} items=${unwrap(r)?.items?.length}`);

  // 23. reverse-match: vacancy → top candidates (worker had "5 years" but
  //     no overlapping skills with vacancy — could be 0). Just check 200.
  r = await call("GET", `/api/build/vacancies/${vacancyId}/match-candidates`, null, clientToken);
  if (r.status === 200) ok("reverse match candidates", `total=${unwrap(r)?.total ?? 0}`);
  else return fail("reverse match", `status=${r.status}`);

  // 24. PDF resume export (public, no auth)
  const pdfRes = await fetch(`${BASE}/api/build/profiles/${workerId}/resume.pdf`);
  const ct = pdfRes.headers.get("content-type") || "";
  if (pdfRes.status === 200 && ct.includes("pdf")) ok("PDF resume export", `${ct}`);
  else return fail("PDF resume", `status=${pdfRes.status} type=${ct}`);

  // 25. AI consult — only if ANTHROPIC_API_KEY is configured backend-side.
  //     We probe with a minimal prompt; if it returns ai_consult_failed
  //     with "ANTHROPIC_API_KEY not configured" we treat that as SKIP.
  r = await call("POST", "/api/build/ai/consult", {
    messages: [{ role: "user", content: "Hi, one-liner: am I ready to apply for vacancies?" }],
  }, workerToken);
  if (r.status === 200 && typeof unwrap(r)?.reply === "string") ok("AI consult", `tokens=${unwrap(r)?.usage?.output}`);
  else if (r.body?.details && /ANTHROPIC_API_KEY/i.test(r.body.details)) {
    step += 1;
    console.log(`  ${String(step).padStart(2, "0")}  SKIP  AI consult (ANTHROPIC_API_KEY not set)`);
  } else return fail("AI consult", `status=${r.status} ${r.body?.details || ""}`);

  // suppress unused-variable warning for clientId
  void clientId;
}

main()
  .then(() => {
    console.log(`\n${failed === 0 ? "✅ all steps passed" : `❌ ${failed} step(s) failed`}`);
    process.exit(failed === 0 ? 0 : 1);
  })
  .catch((e) => {
    console.error("smoke crash:", e);
    process.exit(2);
  });
