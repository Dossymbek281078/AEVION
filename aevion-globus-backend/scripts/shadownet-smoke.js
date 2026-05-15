#!/usr/bin/env node
/**
 * ShadowNet smoke test — threat models / routing sim / posts.
 * Usage: BASE=http://localhost:4001 node scripts/shadownet-smoke.js
 */
const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/$/, "");
let passed = 0, failed = 0;
function assert(label, cond, info = "") {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}${info ? " — " + info : ""}`); failed++; }
}
async function req(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(8000) };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  const text = await r.text();
  try { return { status: r.status, body: JSON.parse(text) }; } catch { return { status: r.status, body: text }; }
}
async function run() {
  console.log(`\nShadowNet smoke → ${BASE}\n`);

  const h = await req("GET", "/api/shadownet/health");
  assert("health → 200", h.status === 200, String(h.status));
  assert("ok true", h.body?.ok === true);

  const tm = await req("GET", "/api/shadownet/threat-models");
  assert("GET /threat-models → 200", tm.status === 200);
  const tmList = tm.body?.data ?? tm.body;
  assert("4 threat models", Array.isArray(tmList) && tmList.length === 4);

  const route = await req("POST", "/api/shadownet/route", { hops: 5 });
  assert("POST /route → 200", route.status === 200);
  const r = route.body?.data ?? route.body;
  assert("nodes is array", Array.isArray(r?.nodes));
  assert("5 nodes returned", r?.nodes?.length === 5);
  assert("totalLatencyMs > 0", (r?.totalLatencyMs ?? 0) > 0);
  assert("anonymityScore present", typeof r?.anonymityScore === "number");

  const score = await req("POST", "/api/shadownet/score", {
    features: { tor: true, vpn: true, dns: true, browser: false, e2e: true },
  });
  assert("POST /score → 200", score.status === 200);
  const s = score.body?.data ?? score.body;
  assert("score 0-100", typeof s?.score === "number" && s.score >= 0 && s.score <= 100);

  const alias = `smoke-${Date.now()}`;
  const post = await req("POST", "/api/shadownet/posts", {
    alias, ciphertext: "Y2lwaGVydGV4dA==", iv: "aXY=", salt: "c2FsdA==",
  });
  assert("POST /posts → 200/201", [200,201].includes(post.status));

  const posts = await req("GET", `/api/shadownet/posts/${alias}`);
  assert("GET /posts/:alias → 200", posts.status === 200);

  const stats = await req("GET", "/api/shadownet/stats");
  assert("GET /stats → 200", stats.status === 200);

  console.log(`\nShadowNet: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
run().catch(e => { console.error(e); process.exit(1); });
