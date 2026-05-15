#!/usr/bin/env node
/**
 * Voice of Earth smoke test.
 * Usage: BASE=http://localhost:4001 node scripts/voe-smoke.js
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
  try { return { status: r.status, body: JSON.parse(text) }; }
  catch { return { status: r.status, body: text }; }
}

async function run() {
  console.log(`\nVoice of Earth smoke → ${BASE}\n`);

  console.log("1. Health");
  const h = await req("GET", "/api/voice-of-earth/health");
  assert("GET /health → 200", h.status === 200, String(h.status));
  assert("ok === true", h.body?.ok === true);
  assert("tracksCount >= 0", typeof h.body?.tracksCount === "number");

  console.log("\n2. List tracks (all)");
  const all = await req("GET", "/api/voice-of-earth/tracks?limit=20");
  assert("GET /tracks → 200", all.status === 200, String(all.status));
  assert("data is array", Array.isArray(all.body?.data));
  assert("seed loaded (≥ 8 tracks)", (all.body?.data?.length ?? 0) >= 8);

  console.log("\n3. Filter by language");
  const en = await req("GET", "/api/voice-of-earth/tracks?lang=en");
  assert("GET /tracks?lang=en → 200", en.status === 200, String(en.status));
  const enItems = en.body?.data ?? [];
  assert("all EN tracks have language=en", enItems.every(t => t.language === "en"));

  console.log("\n4. Submit track");
  const artist = `smoke-artist-${Date.now()}`;
  const sub = await req("POST", "/api/voice-of-earth/tracks", {
    title: "Smoke Test Song",
    artistAlias: artist,
    language: "ru",
    lyrics: "Это тестовый трек. Создан автоматически. Строка 1.\nСтрока 2. Строка 3.",
    mood: "hopeful",
  });
  assert("POST /tracks → 200 or 201", [200, 201].includes(sub.status), String(sub.status));
  const track = sub.body?.data;
  assert("track.id present", !!track?.id, JSON.stringify(sub.body).slice(0, 200));
  assert("track.votes === 0", track?.votes === 0);

  const trackId = track?.id;

  console.log("\n5. Single track");
  if (trackId) {
    const single = await req("GET", `/api/voice-of-earth/tracks/${trackId}`);
    assert("GET /tracks/:id → 200", single.status === 200, String(single.status));
    assert("track.lyrics present", typeof single.body?.data?.lyrics === "string");
  }

  console.log("\n6. Vote");
  if (trackId) {
    const voter = `voter-${Date.now()}`;
    const v1 = await req("POST", `/api/voice-of-earth/tracks/${trackId}/vote`, { voterAlias: voter });
    assert("POST /vote → 200 or 201", [200, 201].includes(v1.status), String(v1.status));
    assert("votes incremented", (v1.body?.data?.votes ?? 0) >= 1);

    const v2 = await req("POST", `/api/voice-of-earth/tracks/${trackId}/vote`, { voterAlias: voter });
    assert("duplicate vote → 409", v2.status === 409, String(v2.status));
  }

  console.log("\n7. Stats");
  const stats = await req("GET", "/api/voice-of-earth/stats");
  assert("GET /stats → 200", stats.status === 200, String(stats.status));
  assert("stats.total >= 8", (stats.body?.data?.total ?? 0) >= 8);
  assert("byLanguage present", typeof stats.body?.data?.byLanguage === "object");
  assert("byMood present", typeof stats.body?.data?.byMood === "object");
  assert("topTracks is array", Array.isArray(stats.body?.data?.topTracks));

  console.log(`\nVoice of Earth: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
