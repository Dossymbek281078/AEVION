#!/usr/bin/env node
/**
 * Constitution prod smoke — end-to-end exercise of the Constitution stack.
 *
 *   Public API    : regimes / presets / countries / sliders-spec + cache headers
 *   Scenarios     : POST + GET + concept-stats (mvpConcepts surface)
 *   Planet artifacts: POST signed envelope → list → /:id → stats + ?regime filter
 *   Social        : vote (POST + DELETE toggle) + comment + /social aggregate
 *   AI            : POST /ai-suggest (stub-safe) + SSE /ai-suggest-stream
 *
 * Default BASE goes through Vercel rewrite (/api-backend/*) so this validates
 * the FULL prod path: browser → Vercel → Railway → Express → router. Override
 * with BASE=https://aevion-production-a70c.up.railway.app to bypass Vercel.
 *
 * Usage:
 *   node scripts/constitution-prod-smoke.js
 *   BASE=<url> node scripts/constitution-prod-smoke.js
 *   ARTIFACT=docs/constitution/SMOKE_$(date +%s).json node scripts/constitution-prod-smoke.js
 *
 * Exit codes: 0 = all green, 1 = ≥1 assertion failed, 2 = crash.
 */

const { writeFileSync, mkdirSync } = require("node:fs");
const { dirname, resolve } = require("node:path");
const { createHmac } = require("node:crypto");

const DEFAULT_PUBLIC_URL = "https://aevion.app/api-backend";
const BASE = (process.env.BASE || DEFAULT_PUBLIC_URL).replace(/\/+$/, "");
const ARTIFACT = process.env.ARTIFACT || null;
const SKIP_AI = process.env.SKIP_AI === "1";

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

async function call(method, path, { body, token, accept } = {}) {
  const url = `${BASE}${path}`;
  const headers = {};
  if (body) headers["content-type"] = "application/json";
  if (token) headers["authorization"] = `Bearer ${token}`;
  if (accept) headers["accept"] = accept;
  const t0 = Date.now();
  let res, raw, json;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    raw = await res.text();
    try { json = raw ? JSON.parse(raw) : null; } catch { json = null; }
  } catch (e) {
    return { error: e.message ?? String(e), durationMs: Date.now() - t0 };
  }
  const entry = {
    method, url, status: res.status,
    durationMs: Date.now() - t0,
    cacheControl: res.headers.get("cache-control") || null,
  };
  calls.push(entry);
  return { res, raw, json, ...entry };
}

async function callSSE(path, body) {
  const url = `${BASE}${path}`;
  const t0 = Date.now();
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify(body),
    });
    const ct = r.headers.get("content-type") || "";
    if (!r.ok) {
      return { ok: false, status: r.status, reason: `HTTP ${r.status}`, durationMs: Date.now() - t0 };
    }
    // Read up to 8KB of stream or first kind:"sliders" event
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let chunks = 0;
    let gotText = false;
    let gotSliders = false;
    let gotDone = false;
    const start = Date.now();
    while (Date.now() - start < 30000) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks += 1;
      buffer += decoder.decode(value, { stream: true });
      if (buffer.includes('"kind":"text"')) gotText = true;
      if (buffer.includes('"kind":"sliders"')) gotSliders = true;
      if (buffer.includes('"kind":"done"') || buffer.includes("[DONE]")) gotDone = true;
      if (gotSliders && gotDone) break;
      if (buffer.length > 32000) break;
    }
    try { reader.cancel(); } catch {}
    return {
      ok: true,
      status: r.status,
      contentType: ct,
      chunks,
      gotText,
      gotSliders,
      gotDone,
      isStub: !ct.startsWith("text/event-stream"),
      durationMs: Date.now() - t0,
    };
  } catch (e) {
    return { ok: false, reason: e.message ?? String(e), durationMs: Date.now() - t0 };
  }
}

(async () => {
  console.log(`\n=== Constitution prod smoke — BASE=${BASE} ===\n`);

  /* ─── 1. Public REST ──────────────────────────────────────────────── */
  const reg = await call("GET", "/api/constitution/public/regimes");
  if (reg.status === 200 && Array.isArray(reg.json?.items) && reg.json.items.length >= 10) {
    ok("public/regimes returns ≥10 items", `${reg.json.count} items`);
  } else fail("public/regimes returns ≥10 items", `status ${reg.status}, count=${reg.json?.count}`);

  if (reg.cacheControl && /max-age=\d+/.test(reg.cacheControl)) {
    ok("public/regimes has Cache-Control", reg.cacheControl);
  } else fail("public/regimes has Cache-Control", `header=${reg.cacheControl}`);

  const requiredRegimeIds = ["open-access", "nordic", "totalitarian", "feudalism", "modern-liberal"];
  const presentRegimeIds = (reg.json?.items ?? []).map((r) => r.id);
  const missingRegimes = requiredRegimeIds.filter((id) => !presentRegimeIds.includes(id));
  if (missingRegimes.length === 0) ok("public/regimes contains canonical IDs");
  else fail("public/regimes contains canonical IDs", `missing: ${missingRegimes.join(", ")}`);

  const pres = await call("GET", "/api/constitution/public/presets");
  if (pres.status === 200 && Array.isArray(pres.json?.items) && pres.json.items.length >= 10) {
    ok("public/presets returns ≥10 items");
  } else fail("public/presets returns ≥10 items", `status ${pres.status}`);

  const cts = await call("GET", "/api/constitution/public/countries");
  if (cts.status === 200 && cts.json?.items?.length === 15) {
    ok("public/countries returns exactly 15 items");
  } else fail("public/countries returns exactly 15 items", `got ${cts.json?.items?.length}`);

  const norway = (cts.json?.items ?? []).find((c) => c.code === "no");
  if (norway && norway.sliders?.floor >= 80) ok("Norway has high floor (≥80)");
  else fail("Norway has high floor (≥80)", `floor=${norway?.sliders?.floor}`);

  const spec = await call("GET", "/api/constitution/public/sliders-spec");
  if (spec.status === 200 && spec.json?.items?.length === 8) {
    ok("public/sliders-spec returns 8 dimensions");
  } else fail("public/sliders-spec returns 8 dimensions", `got ${spec.json?.items?.length}`);

  /* ─── 2. Scenarios (mvpConcepts surface) ──────────────────────────── */
  const ts = Date.now();
  const scenarioTitle = `prod-smoke-${ts}`;
  const create = await call("POST", "/api/constitution/scenarios", {
    body: {
      title: scenarioTitle,
      sliders: { floor: 60, ruleOfLaw: 70, rotation: 30, transparency: 65,
                 multiStatus: 55, skinInGame: 40, polycentricity: 40, positiveSum: 70 },
      regime: "Smoke Regime",
      metrics: { innovation: 60 },
      tags: ["governance", "smoke"],
    },
  });
  if (create.status === 201 && create.json?.id) ok("POST /scenarios creates item", create.json.id.slice(0, 8));
  else fail("POST /scenarios creates item", `status ${create.status}`);

  const list = await call("GET", "/api/constitution/scenarios?limit=5");
  if (list.status === 200 && Array.isArray(list.json?.items)) ok("GET /scenarios returns items");
  else fail("GET /scenarios returns items", `status ${list.status}`);

  const stats = await call("GET", "/api/constitution/concept-stats");
  if (stats.status === 200 && typeof stats.json?.total === "number") {
    ok("GET /concept-stats has total", `total=${stats.json.total}`);
  } else fail("GET /concept-stats has total", `status ${stats.status}`);

  /* ─── 3. Planet artifacts: publish + read ────────────────────────── */
  const envelope = {
    spec: "aevion.constitution/v1+qsign",
    algo: "HMAC-SHA256",
    signedAt: new Date().toISOString(),
    signature: createHmac("sha256", "smoke-test").update(scenarioTitle).digest("hex"),
    payload: {
      title: scenarioTitle,
      regime: { id: "modern-liberal", name: "Smoke Liberal", era: "smoke" },
      sliders: { floor: 50, ruleOfLaw: 75, rotation: 30, transparency: 65,
                 multiStatus: 55, skinInGame: 40, polycentricity: 50, positiveSum: 70 },
      metrics: { innovation: 60, stability: 65 },
      issuedAt: new Date().toISOString(),
    },
  };
  const publish = await call("POST", "/api/planet/constitution-artifacts", { body: { envelope } });
  if (publish.status === 201 && publish.json?.artifact?.id) {
    ok("POST artifact publishes", `storage=${publish.json.storage}`);
  } else fail("POST artifact publishes", `status ${publish.status}`);
  const publishedId = publish.json?.artifact?.id;

  if (publishedId) {
    const one = await call("GET", `/api/planet/constitution-artifacts/${publishedId}`);
    if (one.status === 200 && one.json?.id === publishedId) ok("GET artifact by id");
    else fail("GET artifact by id", `status ${one.status}`);
  } else fail("GET artifact by id", "no publishedId from create step");

  const listArt = await call("GET", "/api/planet/constitution-artifacts?limit=10");
  if (listArt.status === 200 && Array.isArray(listArt.json?.items)) ok("GET artifacts list");
  else fail("GET artifacts list", `status ${listArt.status}`);

  const filtered = await call("GET", "/api/planet/constitution-artifacts?regime=modern-liberal&limit=5");
  if (filtered.status === 200) {
    const allMatch = (filtered.json?.items ?? []).every((it) => it.regimeId === "modern-liberal");
    if (allMatch) ok("?regime= filter returns only matching items");
    else fail("?regime= filter returns only matching items", "got mixed regimeIds");
  } else fail("?regime= filter returns only matching items", `status ${filtered.status}`);

  const artStats = await call("GET", "/api/planet/constitution-artifacts/stats");
  if (artStats.status === 200 && typeof artStats.json?.total === "number"
      && Array.isArray(artStats.json?.byRegime) && Array.isArray(artStats.json?.sliders)) {
    ok("/artifacts/stats has total/byRegime/sliders", `total=${artStats.json.total}`);
  } else fail("/artifacts/stats has total/byRegime/sliders", `status ${artStats.status}`);

  if (artStats.json?.sliders?.length === 8) ok("/artifacts/stats has 8 slider aggregates");
  else fail("/artifacts/stats has 8 slider aggregates", `got ${artStats.json?.sliders?.length}`);

  /* ─── 4. Social: vote + comment + aggregate ──────────────────────── */
  if (publishedId) {
    const v1 = await call("POST", `/api/planet/constitution-artifacts/${publishedId}/vote`, { body: { vote: 1 } });
    if (v1.status === 200 && v1.json?.ok) ok("POST /vote anon up");
    else fail("POST /vote anon up", `status ${v1.status}`);

    const v2 = await call("POST", `/api/planet/constitution-artifacts/${publishedId}/vote`, { body: { vote: -1 } });
    if (v2.status === 200 && v2.json?.ok) ok("POST /vote toggle to down");
    else fail("POST /vote toggle to down", `status ${v2.status}`);

    const v3 = await call("DELETE", `/api/planet/constitution-artifacts/${publishedId}/vote`);
    if (v3.status === 200 && v3.json?.ok) ok("DELETE /vote removes anon vote");
    else fail("DELETE /vote removes anon vote", `status ${v3.status}`);

    const c1 = await call("POST", `/api/planet/constitution-artifacts/${publishedId}/comment`, {
      body: { text: `smoke comment ${ts}`, authorName: "prod-smoke" },
    });
    if (c1.status === 201 && c1.json?.comment?.id) ok("POST /comment creates comment");
    else fail("POST /comment creates comment", `status ${c1.status}`);

    const c2 = await call("POST", `/api/planet/constitution-artifacts/${publishedId}/comment`, { body: { text: "" } });
    if (c2.status === 400 && c2.json?.error === "missing_text") ok("POST /comment rejects empty text (400)");
    else fail("POST /comment rejects empty text (400)", `status ${c2.status}, error=${c2.json?.error}`);

    const social = await call("GET", `/api/planet/constitution-artifacts/${publishedId}/social`);
    if (social.status === 200 && social.json?.votes && Array.isArray(social.json?.comments)) {
      ok("GET /social returns {votes, comments}", `up=${social.json.votes.up} comments=${social.json.comments.length}`);
    } else fail("GET /social returns {votes, comments}", `status ${social.status}`);
  } else {
    fail("vote/comment/social — publishedId missing, skipping", "no artifact id from earlier step");
  }

  /* ─── 5. AI advisor ───────────────────────────────────────────────── */
  if (SKIP_AI) {
    console.log("  --  SKIP  AI tests (SKIP_AI=1)");
  } else {
    const ai = await call("POST", "/api/constitution/ai-suggest", {
      body: { description: "Скандинавская страна с высокими налогами и социальным контрактом" },
    });
    if (ai.status === 200 && ai.json?.sliders && typeof ai.json?.explanation === "string") {
      ok("POST /ai-suggest returns sliders+explanation", `provider=${ai.json.provider}`);
    } else fail("POST /ai-suggest returns sliders+explanation", `status ${ai.status}`);

    const sse = await callSSE("/api/constitution/ai-suggest-stream", {
      description: "Сингапур-style эффективное правительство со сильным rule of law",
    });
    if (sse.ok && sse.gotSliders) {
      ok("SSE /ai-suggest-stream emits sliders event",
         `chunks=${sse.chunks} stub=${sse.isStub} ${sse.durationMs}ms`);
    } else fail("SSE /ai-suggest-stream emits sliders event",
                `ok=${sse.ok} sliders=${sse.gotSliders} reason=${sse.reason || "n/a"}`);

    // AI negative case — too short description
    const aiShort = await call("POST", "/api/constitution/ai-suggest", { body: { description: "hi" } });
    if (aiShort.status === 400) ok("POST /ai-suggest short description → 400");
    else fail("POST /ai-suggest short description → 400", `status ${aiShort.status}`);
  }

  /* ─── 6. Zod validation — negative cases ──────────────────────────── */

  // Vote — invalid value
  if (publishedId) {
    const voteBad = await call("POST", `/api/planet/constitution-artifacts/${publishedId}/vote`, { body: { vote: 99 } });
    if (voteBad.status === 400) ok("POST /vote invalid value → 400");
    else fail("POST /vote invalid value → 400", `status ${voteBad.status}`);

    // Vote — missing field
    const voteMissing = await call("POST", `/api/planet/constitution-artifacts/${publishedId}/vote`, { body: {} });
    if (voteMissing.status === 400) ok("POST /vote missing field → 400");
    else fail("POST /vote missing field → 400", `status ${voteMissing.status}`);

    // Comment — empty text
    const commentEmpty = await call("POST", `/api/planet/constitution-artifacts/${publishedId}/comment`, { body: { text: "" } });
    if (commentEmpty.status === 400) ok("POST /comment empty text → 400");
    else fail("POST /comment empty text → 400", `status ${commentEmpty.status}`);

    // Comment — too long
    const commentLong = await call("POST", `/api/planet/constitution-artifacts/${publishedId}/comment`, { body: { text: "x".repeat(801) } });
    if (commentLong.status === 400) ok("POST /comment text>800 → 400");
    else fail("POST /comment text>800 → 400", `status ${commentLong.status}`);
  } else {
    fail("Zod vote/comment negative cases — no publishedId", "skip");
  }

  // Waitlist — invalid email
  const waitlistBad = await call("POST", "/api/constitution/waitlist/subscribe", { body: { email: "not-an-email" } });
  if (waitlistBad.status === 400) ok("POST /waitlist/subscribe invalid email → 400");
  else fail("POST /waitlist/subscribe invalid email → 400", `status ${waitlistBad.status}`);

  // Waitlist — valid email
  const waitlistOk = await call("POST", "/api/constitution/waitlist/subscribe", { body: { email: `smoke-${ts}@test.aevion.app`, source: "smoke" } });
  if (waitlistOk.status === 201 && waitlistOk.json?.ok) ok("POST /waitlist/subscribe valid email → 201");
  else fail("POST /waitlist/subscribe valid email → 201", `status ${waitlistOk.status}`);

  // Artifact publish — missing signature
  const artifactNoSig = await call("POST", "/api/planet/constitution-artifacts", {
    body: { envelope: { payload: { title: "no-sig" } } },
  });
  if (artifactNoSig.status === 400) ok("POST artifact missing signature → 400");
  else fail("POST artifact missing signature → 400", `status ${artifactNoSig.status}`);

  /* ─── 7. Edge cases ──────────────────────────────────────────────── */

  // Sliders all zeros
  const zeroEnvelope = {
    signature: createHmac("sha256", "smoke-test").update("zeros").digest("hex"),
    payload: {
      title: `zeros-${ts}`,
      sliders: { floor: 0, ruleOfLaw: 0, rotation: 0, transparency: 0,
                 multiStatus: 0, skinInGame: 0, polycentricity: 0, positiveSum: 0 },
    },
  };
  const publishZero = await call("POST", "/api/planet/constitution-artifacts", { body: { envelope: zeroEnvelope } });
  if (publishZero.status === 201) ok("POST artifact with all-zero sliders → 201 (valid)");
  else fail("POST artifact with all-zero sliders → 201", `status ${publishZero.status}`);

  // Sliders all max
  const maxEnvelope = {
    signature: createHmac("sha256", "smoke-test").update("maxes").digest("hex"),
    payload: {
      title: `maxes-${ts}`,
      sliders: { floor: 100, ruleOfLaw: 100, rotation: 100, transparency: 100,
                 multiStatus: 100, skinInGame: 100, polycentricity: 100, positiveSum: 100 },
    },
  };
  const publishMax = await call("POST", "/api/planet/constitution-artifacts", { body: { envelope: maxEnvelope } });
  if (publishMax.status === 201) ok("POST artifact with all-100 sliders → 201");
  else fail("POST artifact with all-100 sliders → 201", `status ${publishMax.status}`);

  // GET non-existent artifact
  const notFound = await call("GET", "/api/planet/constitution-artifacts/00000000-0000-0000-0000-000000000000");
  if (notFound.status === 404) ok("GET non-existent artifact → 404");
  else fail("GET non-existent artifact → 404", `status ${notFound.status}`);

  /* ─── 8. Funnel track ─────────────────────────────────────────────── */
  const funnelOk = await call("POST", "/api/constitution/funnel/track", { body: { event: "page_view", props: { source: "smoke" } } });
  if (funnelOk.status === 200 && funnelOk.json?.ok) ok("POST /funnel/track page_view → ok");
  else fail("POST /funnel/track page_view → ok", `status ${funnelOk.status}`);

  const funnelBad = await call("POST", "/api/constitution/funnel/track", { body: { event: "unknown_nonsense_event" } });
  if (funnelBad.status === 400) ok("POST /funnel/track unknown event → 400");
  else fail("POST /funnel/track unknown event → 400", `status ${funnelBad.status}`);

  /* ─── 9. PDF ──────────────────────────────────────────────────────── */
  const pdf = await call("POST", "/api/constitution/pdf", {
    body: {
      title: `smoke-pdf-${ts}`,
      sliders: { floor: 75, ruleOfLaw: 85, rotation: 70, transparency: 80,
                 multiStatus: 75, skinInGame: 70, polycentricity: 65, positiveSum: 80 },
      regime: { id: "open-access", name: "Open Access", era: "ideal" },
    },
  });
  // PDF returns binary, check content-type header not json
  if (pdf.status === 200) {
    ok("POST /pdf returns 200");
  } else {
    fail("POST /pdf returns 200", `status ${pdf.status} body=${(pdf.raw ?? "").slice(0, 120)}`);
  }

  /* ─── Summary ─────────────────────────────────────────────────────── */
  const total = step;
  const passed = total - failed;
  console.log(`\n=== ${passed}/${total} passed${failed > 0 ? `, ${failed} FAILED` : ""} ===`);

  if (ARTIFACT) {
    try {
      mkdirSync(dirname(resolve(ARTIFACT)), { recursive: true });
      writeFileSync(ARTIFACT, JSON.stringify({
        base: BASE, ts: new Date().toISOString(),
        total, passed, failed,
        calls,
      }, null, 2));
      console.log(`Artifact written to ${ARTIFACT}`);
    } catch (e) {
      console.error(`Failed to write artifact: ${e.message}`);
    }
  }

  process.exit(failed > 0 ? 1 : 0);
})().catch((e) => {
  console.error("CRASH:", e.stack || e);
  process.exit(2);
});
