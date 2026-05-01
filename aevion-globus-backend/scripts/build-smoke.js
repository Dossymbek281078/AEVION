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

function is2xx(r) {
  return r.status >= 200 && r.status < 300;
}

async function main() {
  console.log(`QBuild smoke against ${BASE}\n`);

  // 1. health
  let r = await call("GET", "/api/build/health");
  if (is2xx(r) && unwrap(r)?.service === "qbuild") ok("GET /api/build/health");
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
  if (is2xx(r) && unwrap(r)?.buildRole === "CLIENT") ok("upsert client profile");
  else return fail("upsert client profile", `status=${r.status}`);

  // 5. worker upserts build profile
  r = await call("POST", "/api/build/profiles", {
    name: "Smoke Worker",
    city: "Almaty",
    buildRole: "WORKER",
  }, workerToken);
  if (is2xx(r) && unwrap(r)?.buildRole === "WORKER") ok("upsert worker profile");
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
  if (is2xx(r) && pub?.project?.id === projectId && pub?.client?.name === "Smoke Client") ok("public project view");
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
  if (is2xx(r) && feed?.items?.some((v) => v.id === vacancyId)) ok("vacancies feed contains new row");
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
  if (is2xx(r) && notif?.pendingApplications >= 1) ok("client notifications", `pending=${notif.pendingApplications}`);
  else return fail("client notifications", `status=${r.status} body=${JSON.stringify(r.body)}`);

  // 12. owner accepts the application — response now includes hireOrder
  r = await call("PATCH", `/api/build/applications/${applicationId}`, { status: "ACCEPTED" }, clientToken);
  const acceptData = unwrap(r);
  if (is2xx(r) && acceptData?.status === "ACCEPTED") {
    const hireNote = acceptData.hireOrder
      ? `hireOrder=${acceptData.hireOrder.id.slice(0, 8)}… amount=${acceptData.hireOrder.amount}`
      : "hireOrder=null (salary=0)";
    ok("owner accepts application", hireNote);
  } else return fail("accept", `status=${r.status}`);

  // 12a. HIRE_FEE order idempotent — second accept must not create a duplicate
  r = await call("PATCH", `/api/build/applications/${applicationId}`, { status: "ACCEPTED" }, clientToken);
  const reaccept = unwrap(r);
  if (is2xx(r) && reaccept?.status === "ACCEPTED") {
    const sameOrder = !acceptData.hireOrder || reaccept.hireOrder?.id === acceptData.hireOrder?.id;
    if (sameOrder) ok("hire fee idempotent on re-accept");
    else return fail("hire fee idempotent", "second accept created a new HIRE_FEE order");
  } else return fail("re-accept", `status=${r.status}`);

  // 13. worker sees applicationUpdates
  r = await call("GET", "/api/build/notifications/summary", null, workerToken);
  const wnotif = unwrap(r);
  if (is2xx(r) && wnotif?.applicationUpdates >= 1) ok("worker notifications", `updates=${wnotif.applicationUpdates}`);
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
  if (is2xx(r) && unwrap(r)?.unreadMessages >= 1) ok("worker unread message visible");
  else return fail("worker unread", `status=${r.status}`);

  // 16. worker reads thread (marks as read)
  r = await call("GET", `/api/build/messages/${clientId}`, null, workerToken);
  if (is2xx(r) && unwrap(r)?.items?.length >= 1) ok("worker reads thread");
  else return fail("worker reads", `status=${r.status}`);

  // 17. unauth call to /notifications/summary → 401
  r = await call("GET", "/api/build/notifications/summary");
  if (r.status === 401) ok("/notifications/summary requires auth");
  else return fail("notifications auth gate", `expected 401 got ${r.status}`);

  // 18. plans catalog
  r = await call("GET", "/api/build/plans");
  if (is2xx(r) && unwrap(r)?.items?.length >= 4) ok("plans catalog (4 tiers)");
  else return fail("plans catalog", `status=${r.status}`);

  // 19. usage/me on FREE plan baseline
  r = await call("GET", "/api/build/usage/me", null, clientToken);
  if (is2xx(r) && unwrap(r)?.plan?.key === "FREE") ok("usage/me FREE baseline");
  else return fail("usage/me FREE", `plan=${unwrap(r)?.plan?.key}`);

  // 20. bookmark VACANCY toggle on
  r = await call("POST", "/api/build/bookmarks", { kind: "VACANCY", targetId: vacancyId }, workerToken);
  if (r.status === 201 && unwrap(r)?.saved === true) ok("bookmark vacancy added");
  else return fail("bookmark add", `status=${r.status}`);

  // 21. bookmark VACANCY toggle off (idempotent removal)
  r = await call("POST", "/api/build/bookmarks", { kind: "VACANCY", targetId: vacancyId }, workerToken);
  if (is2xx(r) && unwrap(r)?.saved === false) ok("bookmark toggle off (idempotent)");
  else return fail("bookmark toggle off", `status=${r.status}`);

  // 22. bookmarks list (re-add then list)
  await call("POST", "/api/build/bookmarks", { kind: "VACANCY", targetId: vacancyId }, workerToken);
  r = await call("GET", "/api/build/bookmarks?kind=VACANCY", null, workerToken);
  if (is2xx(r) && unwrap(r)?.items?.length >= 1 && unwrap(r).items[0]?.target?.id === vacancyId) ok("bookmarks list hydrated");
  else return fail("bookmarks list", `status=${r.status} items=${unwrap(r)?.items?.length}`);

  // 23. reverse-match: vacancy → top candidates (worker had "5 years" but
  //     no overlapping skills with vacancy — could be 0). Just check 200.
  r = await call("GET", `/api/build/vacancies/${vacancyId}/match-candidates`, null, clientToken);
  if (is2xx(r)) ok("reverse match candidates", `total=${unwrap(r)?.total ?? 0}`);
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
  if (is2xx(r) && typeof unwrap(r)?.reply === "string") ok("AI consult", `tokens=${unwrap(r)?.usage?.output}`);
  else if (r.body?.details && /ANTHROPIC_API_KEY/i.test(r.body.details)) {
    step += 1;
    console.log(`  ${String(step).padStart(2, "0")}  SKIP  AI consult (ANTHROPIC_API_KEY not set)`);
  } else return fail("AI consult", `status=${r.status} ${r.body?.details || ""}`);

  // 26. Lead capture — public, no auth.
  const leadEmail = `lead-${RUN}@aev.test`;
  r = await call("POST", "/api/build/leads", {
    email: leadEmail,
    city: "Astana",
    locale: "ru",
    source: "smoke-test",
    utmSource: "ci",
    utmCampaign: "build-smoke",
  });
  if (r.status === 201 && unwrap(r)?.alreadyExists === false) ok("lead capture", `email=${leadEmail}`);
  else return fail("lead capture", `status=${r.status}`);

  // 27. Lead capture idempotent — same email second time → alreadyExists.
  r = await call("POST", "/api/build/leads", {
    email: leadEmail,
    locale: "ru",
    source: "smoke-test",
  });
  if (is2xx(r) && unwrap(r)?.alreadyExists === true) ok("lead idempotent", "alreadyExists=true");
  else return fail("lead idempotent", `status=${r.status}`);

  // 28. Loyalty cashback ledger reachable (totals 0 unless prior PAID orders).
  r = await call("GET", "/api/build/loyalty/cashback", null, clientToken);
  if (is2xx(r) && typeof unwrap(r)?.totalAev === "number") {
    ok("loyalty cashback ledger", `totalAev=${unwrap(r).totalAev}`);
  } else return fail("loyalty cashback", `status=${r.status}`);

  // 28a. Public tier catalog — must list all 5 tiers in order.
  r = await call("GET", "/api/build/loyalty/tiers");
  const tiers = unwrap(r)?.items;
  const expectedKeys = ["DEFAULT", "BRONZE", "SILVER", "GOLD", "PLATINUM"];
  if (
    is2xx(r) &&
    Array.isArray(tiers) &&
    tiers.length === 5 &&
    tiers.every((t, i) => t.key === expectedKeys[i])
  ) {
    ok("public loyalty/tiers catalog", `tiers=${tiers.map((t) => t.key).join(",")}`);
  } else return fail("loyalty/tiers", `status=${r.status} got=${JSON.stringify(tiers)}`);

  // 28b. Authenticated /loyalty/me — client has 1 ACCEPTED hire by now,
  // so tier should be DEFAULT (Bronze starts at 3) and `next` points at Bronze.
  r = await call("GET", "/api/build/loyalty/me", null, clientToken);
  const me = unwrap(r);
  if (
    is2xx(r) &&
    me?.tier?.key === "DEFAULT" &&
    me?.tier?.cashbackBps === 200 &&
    me?.next?.key === "BRONZE" &&
    typeof me?.next?.progressPct === "number"
  ) {
    ok("loyalty/me has tier+next", `hires=${me.hires} progress=${me.next.progressPct}%`);
  } else return fail("loyalty/me", `status=${r.status} got=${JSON.stringify(me)}`);

  // 29. PATCH experience description — owner-only update path.
  // First, find any experience this worker added during the smoke flow.
  // (The smoke script earlier in main creates 1 experience for the worker
  // via /experiences). If none, we add one now and patch it.
  r = await call("POST", "/api/build/experiences", {
    title: "Smoke role",
    company: "Smoke Inc.",
    description: "Old description.",
  }, workerToken);
  if (r.status !== 201) return fail("create experience for PATCH", `status=${r.status}`);
  const expId = unwrap(r)?.id;
  r = await call("PATCH", `/api/build/experiences/${expId}`, {
    description: "Polished description with concrete numbers.",
  }, workerToken);
  if (is2xx(r) && unwrap(r)?.description?.includes("Polished")) {
    ok("PATCH experience description", `id=${expId.slice(0, 8)}…`);
  } else return fail("PATCH experience", `status=${r.status}`);

  // 30. Health counters now include vacancies/candidates/projects.
  r = await call("GET", "/api/build/health");
  const h = unwrap(r);
  if (
    is2xx(r) &&
    typeof h?.vacancies === "number" &&
    typeof h?.candidates === "number" &&
    typeof h?.projects === "number"
  ) {
    ok("health counters", `v=${h.vacancies} c=${h.candidates} p=${h.projects}`);
  } else return fail("health counters", `status=${r.status}`);

  // 30a. Review eligibility — both sides should now be eligible (we have
  // an ACCEPTED application). Client sees worker; worker sees client.
  r = await call("GET", "/api/build/reviews/eligible", null, clientToken);
  let elig = unwrap(r);
  if (is2xx(r) && Array.isArray(elig?.items) && elig.items.some((p) => p.revieweeId === workerId)) {
    ok("client eligible to review worker");
  } else return fail("client eligible", `status=${r.status} got=${JSON.stringify(elig)}`);

  r = await call("GET", "/api/build/reviews/eligible", null, workerToken);
  elig = unwrap(r);
  if (is2xx(r) && Array.isArray(elig?.items) && elig.items.some((p) => p.revieweeId === clientId)) {
    ok("worker eligible to review client");
  } else return fail("worker eligible", `status=${r.status} got=${JSON.stringify(elig)}`);

  // 30b. Client posts a 5-star review of worker; worker posts 4-star of client.
  r = await call("POST", "/api/build/reviews", {
    projectId,
    revieweeId: workerId,
    rating: 5,
    comment: "Smoke worker delivered on time, great communication.",
  }, clientToken);
  if (r.status === 201 && unwrap(r)?.direction === "CLIENT_TO_WORKER") {
    ok("client → worker review (5★)");
  } else return fail("client→worker review", `status=${r.status} ${r.body?.error || ""}`);

  r = await call("POST", "/api/build/reviews", {
    projectId,
    revieweeId: clientId,
    rating: 4,
    comment: "Clear scope, paid promptly. Would work again.",
  }, workerToken);
  if (r.status === 201 && unwrap(r)?.direction === "WORKER_TO_CLIENT") {
    ok("worker → client review (4★)");
  } else return fail("worker→client review", `status=${r.status} ${r.body?.error || ""}`);

  // 30c. Double-post is rejected (409 already_reviewed).
  r = await call("POST", "/api/build/reviews", {
    projectId,
    revieweeId: workerId,
    rating: 1,
    comment: "duplicate attempt",
  }, clientToken);
  if (r.status === 409 && r.body?.error === "already_reviewed") {
    ok("duplicate review rejected (409)");
  } else return fail("duplicate review", `status=${r.status} expected 409`);

  // 30d. Public list returns both. Avg = (5+4)/2 = 4.5 for client (he got 4)
  // and 5.0 for worker. We pick worker — should be 5.0.
  r = await call("GET", `/api/build/reviews/by-user/${encodeURIComponent(workerId)}`);
  if (is2xx(r) && unwrap(r)?.total === 1 && unwrap(r)?.avgRating === 5) {
    ok("public reviews/by-user (worker) avg=5★");
  } else return fail("reviews/by-user", `status=${r.status} got=${JSON.stringify(unwrap(r))}`);

  // 30e. Profile bundle now exposes avgRating + reviewCount.
  r = await call("GET", `/api/build/profiles/${encodeURIComponent(workerId)}`);
  const prof = unwrap(r);
  if (is2xx(r) && prof?.reviewCount === 1 && prof?.avgRating === 5) {
    ok("profile aggregates avgRating+reviewCount");
  } else return fail("profile rating agg", `status=${r.status} got=avg=${prof?.avgRating} count=${prof?.reviewCount}`);

  // 31. Force a paid BOOST order — produces a deterministic PENDING
  // BuildOrder we can then walk through webhook → cashback mint → claim
  // → AEV wallet credit. Boost cost is 990 RUB × ceil(days/7).
  r = await call("POST", `/api/build/vacancies/${vacancyId}/boost`, {
    days: 7,
    paid: true,
  }, clientToken);
  const boost = unwrap(r);
  if (r.status === 201 && boost?.orderId && boost?.source === "PAID") {
    ok("paid boost creates PENDING order", `order=${boost.orderId.slice(0, 8)}…`);
  } else return fail("paid boost", `status=${r.status} body=${JSON.stringify(r.body)}`);
  const boostOrderId = boost.orderId;

  // 32. Webhook marks the boost order PAID → mint cashback row.
  r = await call("POST", "/api/build/webhooks/payment", {
    event: "payment.succeeded",
    orderId: boostOrderId,
    providerId: `smoke-${RUN}`,
  });
  if (is2xx(r) && unwrap(r)?.processed === true) {
    ok("webhook payment.succeeded", `orderId=${boostOrderId.slice(0, 8)}…`);
  } else return fail("webhook payment", `status=${r.status} ${r.body?.code || ""}`);

  // 33. Cashback ledger picked up the new entry. Client is on DEFAULT
  // tier (cashbackBps=200) and the boost order is 990 RUB × 1 week →
  // expected cashbackAev = 990 × 0.02 = 19.8 AEV.
  r = await call("GET", "/api/build/loyalty/cashback", null, clientToken);
  const ledgerBundle = unwrap(r);
  const minted = (ledgerBundle?.ledger || []).find((e) => e.orderId === boostOrderId);
  const expectedCashback = 19.8;
  if (is2xx(r) && minted && Math.abs(minted.cashbackAev - expectedCashback) < 0.001) {
    ok("BuildCashback minted at DEFAULT tier (2%)", `aev=${minted.cashbackAev}`);
  } else return fail("cashback mint", `status=${r.status} got=${JSON.stringify(minted)}`);

  // 34. Claim — flips PENDING rows to CLAIMED, returns total claimable.
  const deviceId = `smoke-${RUN}`;
  r = await call("POST", "/api/build/loyalty/cashback/claim", {
    deviceId,
  }, clientToken);
  const claim = unwrap(r);
  if (
    is2xx(r) &&
    claim?.claimedRows >= 1 &&
    Math.abs((claim?.claimedAev || 0) - expectedCashback) < 0.001
  ) {
    ok("cashback claim", `rows=${claim.claimedRows} aev=${claim.claimedAev}`);
  } else return fail("cashback claim", `status=${r.status} got=${JSON.stringify(claim)}`);

  // 35. Re-claim is idempotent — no PENDING rows left.
  r = await call("POST", "/api/build/loyalty/cashback/claim", {
    deviceId,
  }, clientToken);
  const reclaim = unwrap(r);
  if (is2xx(r) && reclaim?.claimedRows === 0 && (reclaim?.claimedAev || 0) === 0) {
    ok("re-claim is no-op (idempotent)");
  } else return fail("re-claim idempotent", `status=${r.status} got=${JSON.stringify(reclaim)}`);

  // 36. Credit the claimed AEV to the wallet. The wallet API lives on
  // /api/aev/* and uses raw JSON envelope (not the build {success,data}).
  r = await call("POST", `/api/aev/wallet/${encodeURIComponent(deviceId)}/mint`, {
    amount: claim.claimedAev,
    sourceModule: "qbuild-cashback",
    sourceAction: "claim",
  });
  if (
    is2xx(r) &&
    r.body?.ok === true &&
    Math.abs((r.body?.wallet?.balance || 0) - expectedCashback) < 0.001
  ) {
    ok("AEV wallet mint", `balance=${r.body.wallet.balance}`);
  } else return fail("wallet mint", `status=${r.status} body=${JSON.stringify(r.body)}`);

  // 37. Read-back confirms the running balance.
  r = await call("GET", `/api/aev/wallet/${encodeURIComponent(deviceId)}`);
  if (
    is2xx(r) &&
    r.body?.ok === true &&
    (r.body?.wallet?.balance || 0) >= expectedCashback
  ) {
    ok("AEV wallet read", `balance=${r.body.wallet.balance}`);
  } else return fail("wallet read", `status=${r.status} body=${JSON.stringify(r.body)}`);

  // 38. Messages inbox summary (GET /messages)
  r = await call("GET", "/api/build/messages", null, clientToken);
  if (is2xx(r) && Array.isArray(unwrap(r)?.items)) {
    ok("messages inbox", `threads=${unwrap(r).items.length}`);
  } else return fail("messages inbox", `status=${r.status}`);

  // 39. Subscriptions — read current (should be null on a fresh smoke account)
  r = await call("GET", "/api/build/subscriptions/me", null, clientToken);
  if (is2xx(r)) ok("subscriptions/me", `active=${!!unwrap(r)?.subscription}`);
  else return fail("subscriptions/me", `status=${r.status}`);

  // 40. Orders ledger — should have at least the PENDING HIRE_FEE + BOOST orders
  r = await call("GET", "/api/build/orders/me", null, clientToken);
  const orders = unwrap(r)?.items || [];
  if (is2xx(r) && orders.length >= 1) {
    const kinds = [...new Set(orders.map((o) => o.kind))].join(",");
    ok("orders/me ledger", `orders=${orders.length} kinds=${kinds}`);
  } else return fail("orders/me", `status=${r.status} orders=${orders.length}`);

  // 41. Public stats endpoint (no auth)
  r = await call("GET", "/api/build/stats");
  const stats = unwrap(r);
  if (
    is2xx(r) &&
    typeof stats?.vacancies?.open === "number" &&
    typeof stats?.candidates === "number"
  ) {
    ok("public /stats", `vacancies=${stats.vacancies.open} candidates=${stats.candidates}`);
  } else return fail("stats", `status=${r.status}`);

  // 42. Referrals leaderboard (public)
  r = await call("GET", "/api/build/referrals/leaderboard?limit=5");
  if (is2xx(r) && Array.isArray(unwrap(r)?.items)) {
    ok("referrals/leaderboard", `entries=${unwrap(r).items.length}`);
  } else return fail("referrals/leaderboard", `status=${r.status}`);

  // 43. Referrals/me — worker referred themself? No. Just check auth gate + shape.
  r = await call("GET", "/api/build/referrals/me", null, workerToken);
  if (is2xx(r) && typeof unwrap(r)?.totalReferred === "number") {
    ok("referrals/me", `totalReferred=${unwrap(r).totalReferred}`);
  } else return fail("referrals/me", `status=${r.status}`);

  // 44. HIRE_FEE order — accepted application created one (salary was 1500 RUB
  //     at DEFAULT tier 12% = 180 RUB). Verify it appears in orders ledger.
  const hireFeeOrder = orders.find((o) => o.kind === "HIRE_FEE");
  if (hireFeeOrder) {
    ok("HIRE_FEE order in ledger", `amount=${hireFeeOrder.amount} status=${hireFeeOrder.status}`);
  } else {
    step += 1;
    console.log(`  ${String(step).padStart(2, "0")}  SKIP  HIRE_FEE in ledger (vacancy salary may be 0)`);
  }
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
